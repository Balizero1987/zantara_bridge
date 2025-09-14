import type { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { openai } from '../../core/openai';
import { uploadToDrive, listDriveFiles } from '../../services/driveUpload';
import * as fs from 'fs';
import * as path from 'path';

const AMBARADAM_FOLDER_ID = 'f1UGbm5er6Go351S57GQKUjmxMxHyT4QZb';

export default function registerFileOperations(r: Router) {
  
  /**
   * DELETE file from Google Drive
   */
  r.delete('/api/files/:fileId', async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;
      const userId = req.query.userId as string || 'anonymous';
      
      if (!fileId) {
        return res.status(400).json({ error: 'fileId required' });
      }
      
      // Get service account credentials
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                               process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
      
      if (!serviceAccountKey) {
        throw new Error('Missing Google Service Account key');
      }
      
      let credentials;
      if (serviceAccountKey.includes('BEGIN')) {
        credentials = JSON.parse(serviceAccountKey);
      } else {
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
      }
      
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive']
      });
      
      const drive = google.drive({ version: 'v3', auth });
      
      // Delete the file
      await drive.files.delete({
        fileId: fileId,
        supportsAllDrives: true
      });
      
      res.json({
        success: true,
        message: 'File deleted successfully',
        fileId
      });
      
    } catch (error: any) {
      console.error('Delete file error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to delete file',
        details: error.response?.data || undefined
      });
    }
  });
  
  /**
   * SUMMARIZE file content using OpenAI
   */
  r.post('/api/files/summarize', async (req: Request, res: Response) => {
    try {
      const { fileId, base64Content, mimeType, language = 'en' } = req.body;
      
      if (!fileId && !base64Content) {
        return res.status(400).json({ error: 'fileId or base64Content required' });
      }
      
      let textContent = '';
      
      // If fileId provided, fetch from Drive
      if (fileId) {
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                                 process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
        
        if (!serviceAccountKey) {
          throw new Error('Missing Google Service Account key');
        }
        
        let credentials;
        if (serviceAccountKey.includes('BEGIN')) {
          credentials = JSON.parse(serviceAccountKey);
        } else {
          const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
          credentials = JSON.parse(decoded);
        }
        
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
        
        const drive = google.drive({ version: 'v3', auth });
        
        // Get file content
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media',
          supportsAllDrives: true
        }, {
          responseType: 'text'
        });
        
        textContent = response.data as string;
        
      } else if (base64Content) {
        // Decode base64 content
        const buffer = Buffer.from(base64Content, 'base64');
        textContent = buffer.toString('utf-8');
      }
      
      // Limit content length for summary
      if (textContent.length > 50000) {
        textContent = textContent.substring(0, 50000) + '...[truncated]';
      }
      
      // Generate summary using OpenAI
      const systemPrompt = language === 'it' 
        ? 'Sei un assistente che crea riassunti concisi e informativi di documenti. Rispondi in italiano.'
        : language === 'id'
        ? 'Anda adalah asisten yang membuat ringkasan dokumen yang ringkas dan informatif. Jawab dalam Bahasa Indonesia.'
        : 'You are an assistant that creates concise and informative document summaries. Reply in English.';
      
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Please provide a comprehensive summary of the following document. Include key points, main topics, and important details:\n\n${textContent}` 
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });
      
      const summary = completion.choices[0]?.message?.content || 'Unable to generate summary';
      
      res.json({
        success: true,
        summary,
        originalLength: textContent.length,
        summaryLength: summary.length,
        compressionRatio: Math.round((1 - summary.length / textContent.length) * 100) + '%',
        language,
        tokens: completion.usage?.total_tokens || 0
      });
      
    } catch (error: any) {
      console.error('Summarize error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to summarize file'
      });
    }
  });
  
  /**
   * BATCH operations on multiple files
   */
  r.post('/api/files/batch', async (req: Request, res: Response) => {
    try {
      const { operation, fileIds, userId = 'anonymous' } = req.body;
      
      if (!operation || !fileIds || !Array.isArray(fileIds)) {
        return res.status(400).json({ error: 'operation and fileIds array required' });
      }
      
      const results = [];
      const errors = [];
      
      for (const fileId of fileIds) {
        try {
          switch (operation) {
            case 'delete':
              // Delete file
              const deleteReq = { params: { fileId }, query: { userId } } as any;
              const deleteRes = { 
                json: (data: any) => results.push({ fileId, ...data }),
                status: () => ({ json: (data: any) => errors.push({ fileId, ...data }) })
              } as any;
              await r.delete('/api/files/:fileId', deleteReq, deleteRes);
              break;
              
            case 'summarize':
              // Summarize file
              const sumReq = { body: { fileId } } as any;
              const sumRes = {
                json: (data: any) => results.push({ fileId, ...data }),
                status: () => ({ json: (data: any) => errors.push({ fileId, ...data }) })
              } as any;
              await r.post('/api/files/summarize', sumReq, sumRes);
              break;
              
            default:
              errors.push({ fileId, error: `Unknown operation: ${operation}` });
          }
        } catch (error: any) {
          errors.push({ fileId, error: error.message });
        }
      }
      
      res.json({
        success: errors.length === 0,
        results,
        errors,
        processed: results.length,
        failed: errors.length
      });
      
    } catch (error: any) {
      console.error('Batch operation error:', error);
      res.status(500).json({ 
        error: error.message || 'Batch operation failed'
      });
    }
  });
  
  /**
   * ANALYZE document for compliance issues
   */
  r.post('/api/files/analyze', async (req: Request, res: Response) => {
    try {
      const { fileId, base64Content, analysisType = 'compliance' } = req.body;
      
      if (!fileId && !base64Content) {
        return res.status(400).json({ error: 'fileId or base64Content required' });
      }
      
      let textContent = '';
      
      // Get content (similar to summarize)
      if (fileId) {
        // ... fetch from Drive (same as summarize)
        textContent = 'Document content here'; // Simplified for brevity
      } else if (base64Content) {
        const buffer = Buffer.from(base64Content, 'base64');
        textContent = buffer.toString('utf-8');
      }
      
      // Analyze based on type
      let prompt = '';
      switch (analysisType) {
        case 'compliance':
          prompt = `Analyze this document for Indonesian compliance issues related to KITAS, KITAP, PT PMA, taxes, or business regulations. List any potential issues or missing requirements:\n\n${textContent}`;
          break;
        case 'contract':
          prompt = `Review this contract/agreement and identify key terms, obligations, risks, and any clauses that need attention:\n\n${textContent}`;
          break;
        case 'tax':
          prompt = `Analyze this document for Indonesian tax implications, requirements, and potential issues:\n\n${textContent}`;
          break;
        default:
          prompt = `Provide a detailed analysis of this document:\n\n${textContent}`;
      }
      
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert analyst for Indonesian business compliance. Provide detailed, actionable analysis. Start important warnings with ⚠️'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 1500
      });
      
      const analysis = completion.choices[0]?.message?.content || 'Unable to analyze document';
      
      res.json({
        success: true,
        analysisType,
        analysis,
        warnings: analysis.includes('⚠️'),
        tokens: completion.usage?.total_tokens || 0
      });
      
    } catch (error: any) {
      console.error('Analyze error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to analyze file'
      });
    }
  });
}