import { Request, Response, NextFunction } from 'express';
import { conversationService } from '../services/conversationService';
import { MoodType } from '../types/conversations';

// Mood analysis based on keywords and tone
function analyzeMood(text: string): MoodType | undefined {
  const lowerText = text.toLowerCase();
  
  // Stress indicators
  if (lowerText.includes('urgent') || lowerText.includes('deadline') || 
      lowerText.includes('help') || lowerText.includes('bingung') ||
      lowerText.includes('stressed') || lowerText.includes('panik')) {
    return 'stressed';
  }
  
  // Excitement indicators
  if (lowerText.includes('excited') || lowerText.includes('senang') ||
      lowerText.includes('great') || lowerText.includes('amazing') ||
      lowerText.includes('perfect')) {
    return 'excited';
  }
  
  // Confusion indicators
  if (lowerText.includes('confused') || lowerText.includes('bingung') ||
      lowerText.includes('tidak mengerti') || lowerText.includes('gimana')) {
    return 'confused';
  }
  
  // Relief indicators
  if (lowerText.includes('thanks') || lowerText.includes('terima kasih') ||
      lowerText.includes('solved') || lowerText.includes('selesai')) {
    return 'relieved';
  }
  
  // Curiosity indicators
  if (lowerText.includes('how') || lowerText.includes('bagaimana') ||
      lowerText.includes('what') || lowerText.includes('apa') ||
      lowerText.includes('?')) {
    return 'curious';
  }
  
  // Confidence indicators
  if (lowerText.includes('sure') || lowerText.includes('confident') ||
      lowerText.includes('yakin') || lowerText.includes('pasti')) {
    return 'confident';
  }
  
  // Default to casual
  return 'casual';
}

// Extract triggers from text
function extractTriggers(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  const triggers = [
    'kitas', 'kitap', 'voa', 'visa', 'tax', 'pajak', 'pt pma', 'permit',
    'deadline', 'expired', 'renewal', 'extension', 'document', 'dokumen',
    'immigration', 'imigrasi', 'djp', 'bkpm', 'ministry'
  ];
  
  for (const trigger of triggers) {
    if (lowerText.includes(trigger)) {
      return trigger;
    }
  }
  
  return undefined;
}

// Extract tags from text content
function extractTags(text: string): string[] {
  const tags = [];
  const lowerText = text.toLowerCase();
  
  // Compliance tags
  if (lowerText.includes('kitas') || lowerText.includes('visa')) {
    tags.push('visa');
  }
  
  if (lowerText.includes('tax') || lowerText.includes('pajak')) {
    tags.push('tax');
  }
  
  if (lowerText.includes('pt pma') || lowerText.includes('company')) {
    tags.push('company');
  }
  
  if (lowerText.includes('deadline') || lowerText.includes('urgent')) {
    tags.push('deadline');
  }
  
  if (lowerText.includes('help') || lowerText.includes('support')) {
    tags.push('support');
  }
  
  if (lowerText.includes('document') || lowerText.includes('dokumen')) {
    tags.push('documents');
  }
  
  return tags;
}

/**
 * Enhanced conversation middleware that integrates with AMBARADAM conversation system
 */
export async function conversationMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Only process if enabled
    const enabled = String(process.env.CONVERSATION_TRACKING || 'true').toLowerCase() === 'true';
    if (!enabled) return next();

    // Extract user and content
    const owner = (req as any).user?.name || req.header('X-BZ-USER') || req.header('X-User-Name');
    if (!owner) return next(); // Skip if no user identified

    const body = req.body;
    if (!body || typeof body !== 'object') return next();

    // Extract message content
    let messageText = '';
    let isZantaraResponse = false;

    if (body.content) {
      messageText = body.content.toString();
    } else if (body.text) {
      messageText = body.text.toString();
    } else if (body.message) {
      messageText = body.message.toString();
    } else if (body.recap) {
      messageText = typeof body.recap === 'string' ? body.recap : body.recap?.text || body.recap?.content || '';
      isZantaraResponse = true; // Recap usually comes from ZANTARA
    }

    if (!messageText || messageText.trim().length < 10) {
      return next(); // Skip short messages
    }

    // Get or create active conversation
    const conversation = await conversationService.getOrCreateActiveConversation(owner);

    // Analyze message
    const mood = analyzeMood(messageText);
    const trigger = extractTriggers(messageText);
    const tags = extractTags(messageText);

    // Add message to conversation
    const sender = isZantaraResponse ? 'zantara' : 'collab';
    await conversationService.addMessage(
      conversation.id,
      sender,
      messageText,
      mood,
      trigger
    );

    // Add tags if found
    if (tags.length > 0) {
      await conversationService.addTags(conversation.id, tags);
    }

    // Store conversation info in request for other middleware
    (req as any).conversation = {
      id: conversation.id,
      collab: owner,
      tags,
      mood,
      trigger
    };

    console.log(`📝 Conversation tracking: ${owner} | ${mood} | ${trigger || 'no trigger'} | Tags: ${tags.join(', ') || 'none'}`);

  } catch (error) {
    console.error('Conversation middleware error:', error);
    // Don't fail the request if conversation tracking fails
  }

  return next();
}

/**
 * Auto-summarization middleware - runs after response
 */
export async function conversationSummaryMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;

  res.send = function(body: any) {
    // Call original send first
    const result = originalSend.call(this, body);

    // Then do async summary work
    setImmediate(async () => {
      try {
        const conversationInfo = (req as any).conversation;
        if (!conversationInfo) return;

        // Check if conversation has enough messages for summary
        const conversation = await conversationService.getConversation(conversationInfo.id);
        if (!conversation) return;

        const shouldSummarize = (conversation.messageCount || 0) >= 5 && 
                               (conversation.messageCount || 0) % 5 === 0; // Every 5 messages

        if (shouldSummarize) {
          const messages = await conversationService.getMessages(conversationInfo.id, 10);
          
          // Generate simple summary
          const recentTexts = messages.slice(-5).map(m => m.text).join(' ');
          const words = recentTexts.split(' ');
          const shortSummary = words.slice(0, 15).join(' ') + (words.length > 15 ? '...' : '');
          
          await conversationService.updateSummary(conversationInfo.id, {
            short: shortSummary
          });

          console.log(`📊 Auto-summary generated for conversation ${conversationInfo.id}`);
        }

        // Auto-close inactive conversations (older than 2 hours with no activity)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        if (conversation.lastMessageAt < twoHoursAgo && conversation.status === 'open') {
          await conversationService.closeConversation(conversationInfo.id, 'Auto-closed due to inactivity');
          console.log(`🔒 Auto-closed inactive conversation ${conversationInfo.id}`);
        }

      } catch (error) {
        console.error('Conversation summary middleware error:', error);
      }
    });

    return result;
  } as any;

  next();
}

/**
 * Quest generation middleware - creates quests based on conversation patterns
 */
export async function questGenerationMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const conversationInfo = (req as any).conversation;
    if (!conversationInfo) return next();

    // Generate quest based on triggers and mood
    if (conversationInfo.trigger && conversationInfo.mood === 'stressed') {
      // TODO: Integrate with quest system when available
      console.log(`🎯 Quest suggestion: Help ${conversationInfo.collab} with ${conversationInfo.trigger}`);
      
      // For now, just add as artifact
      await conversationService.addArtifact(conversationInfo.id, {
        type: 'quest',
        title: `Help with ${conversationInfo.trigger}`,
        description: `Generated quest to assist ${conversationInfo.collab} with ${conversationInfo.trigger} issue`,
        metadata: {
          priority: conversationInfo.mood === 'stressed' ? 'high' : 'medium'
        }
      });
    }

  } catch (error) {
    console.error('Quest generation middleware error:', error);
  }

  return next();
}