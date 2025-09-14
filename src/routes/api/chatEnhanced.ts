import type { Router, Request, Response } from 'express';
import { openai, DEFAULT_MODEL } from '../../core/openai';
import { uploadTextAsDoc, createDriveFolder } from '../../services/driveUpload';
import conversationMemory from '../../services/conversationMemory';
import languageDetection from '../../services/languageDetection';
import { cacheService } from '../../services/cache';

export default function registerChatEnhanced(r: Router) {
  // Enhanced chat with Drive save
  r.post('/api/chat/enhanced', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const { 
        message = '', 
        userId, 
        sessionId, 
        saveToDrive = true,
        useCache = true,
        detectLanguage = true 
      } = req.body;
      
      const user = userId || sessionId || 'anonymous';
      
      if (!message.trim()) {
        return res.status(400).json({ error: 'Message required' });
      }
      
      // Language detection
      let language = 'en';
      let systemPrompt = '';
      
      if (detectLanguage) {
        const detection = languageDetection.detect(message);
        language = detection.language;
        systemPrompt = languageDetection.getSystemPrompt(language);
      } else {
        systemPrompt = `You are ZANTARA, Bali Zero's AI assistant for Indonesia compliance. 
                        Help with KITAS, KITAP, PT PMA, taxes. Be concise and helpful.`;
      }
      
      // Check cache
      if (useCache) {
        const cacheKey = `chat_${language}_${message.toLowerCase().replace(/\s+/g, '_')}`;
        const cached = await cacheService.get(cacheKey, language);
        
        if (cached) {
          return res.json({
            reply: cached,
            cached: true,
            language,
            responseTime: Date.now() - startTime,
            savedToDrive: false
          });
        }
      }
      
      // Get conversation context
      const contextMessages = await conversationMemory.getContextMessages(user);
      
      // Build messages
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...contextMessages,
        { role: 'user' as const, content: message }
      ];
      
      // Get AI response
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1000
      });
      
      const reply = completion.choices[0]?.message?.content || 'Sorry, I could not process your request.';
      const responseTime = Date.now() - startTime;
      
      // Save to memory
      await conversationMemory.addConversation(user, message, reply);
      
      // Save to cache if common question
      if (useCache && isCommonQuestion(message)) {
        const cacheKey = `chat_${language}_${message.toLowerCase().replace(/\s+/g, '_')}`;
        await cacheService.set(cacheKey, reply, 86400, 'chat', language); // 24h cache
      }
      
      // Save to Google Drive
      let driveLink = '';
      if (saveToDrive) {
        try {
          // Create user folder if needed
          const userFolder = await createDriveFolder(user.toUpperCase());
          
          // Save conversation as doc
          const docTitle = `Chat_${new Date().toISOString().slice(0,10)}`;
          const docContent = `ZANTARA CHAT CONVERSATION
User: ${user}
Date: ${new Date().toISOString()}
Language: ${language}

USER: ${message}

ZANTARA: ${reply}

---
Session: ${sessionId || 'N/A'}
Response Time: ${responseTime}ms
Model: ${process.env.OPENAI_MODEL || DEFAULT_MODEL}`;
          
          const result = await uploadTextAsDoc(docContent, docTitle, user);
          driveLink = result.webViewLink;
        } catch (error) {
          console.error('Drive save failed:', error);
        }
      }
      
      res.json({
        reply,
        cached: false,
        language,
        responseTime,
        savedToDrive: !!driveLink,
        driveLink,
        tokens: completion.usage?.total_tokens || 0
      });
      
    } catch (error: any) {
      console.error('Enhanced chat error:', error);
      res.status(500).json({ 
        error: error.message || 'Chat failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
  
  // Upload file endpoint
  r.post('/api/upload', async (req: Request, res: Response) => {
    try {
      const { base64Data, fileName, userId, mimeType } = req.body;
      
      if (!base64Data || !fileName) {
        return res.status(400).json({ error: 'base64Data and fileName required' });
      }
      
      const { uploadToDrive } = require('../../services/driveUpload');
      const result = await uploadToDrive(
        base64Data,
        fileName,
        userId || 'anonymous',
        mimeType || 'application/octet-stream'
      );
      
      res.json({
        success: true,
        fileId: result.fileId,
        webViewLink: result.webViewLink,
        name: result.name
      });
      
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  });
  
  // List user files
  r.get('/api/files/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const { listDriveFiles } = require('../../services/driveUpload');
      const files = await listDriveFiles(userId, limit);
      
      res.json({
        success: true,
        files,
        count: files.length
      });
      
    } catch (error: any) {
      console.error('List files error:', error);
      res.status(500).json({ error: error.message || 'Failed to list files' });
    }
  });
}

function isCommonQuestion(text: string): boolean {
  const keywords = [
    'kitas', 'kitap', 'visa', 'visto', 
    'pt pma', 'tax', 'tasse', 'pajak',
    'business', 'company', 'società',
    'permit', 'permesso', 'izin'
  ];
  
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}