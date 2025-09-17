import { Router, Request, Response } from 'express';
import { conversationService } from '../services/conversationService';
import { MoodType } from '../types/conversations';
import { uploadNoteToAmbaradam } from '../services/appsScriptDrive';

const router = Router();

/**
 * POST /api/conversations/start
 * Start new conversation for collaborator
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { collab, initialMessage } = req.body;

    if (!collab) {
      return res.status(400).json({
        ok: false,
        error: 'collab is required'
      });
    }

    const conversation = await conversationService.createConversation(collab, initialMessage);

    return res.json({
      ok: true,
      conversation,
      message: `Conversation started for ${collab}`
    });

  } catch (error: any) {
    console.error('Start conversation error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to start conversation'
    });
  }
});

/**
 * POST /api/conversations/:conversationId/message
 * Add message to conversation
 */
router.post('/:conversationId/message', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { sender, text, mood, trigger } = req.body;

    if (!sender || !text) {
      return res.status(400).json({
        ok: false,
        error: 'sender and text are required'
      });
    }

    const message = await conversationService.addMessage(
      conversationId,
      sender,
      text,
      mood as MoodType,
      trigger
    );

    return res.json({
      ok: true,
      message,
      conversationId
    });

  } catch (error: any) {
    console.error('Add message error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to add message'
    });
  }
});

/**
 * POST /api/conversations/:conversationId/artifact
 * Add artifact to conversation
 */
router.post('/:conversationId/artifact', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { type, title, description, fileId, link, metadata } = req.body;

    if (!type) {
      return res.status(400).json({
        ok: false,
        error: 'type is required'
      });
    }

    const artifact = await conversationService.addArtifact(conversationId, {
      type,
      title,
      description,
      fileId,
      link,
      metadata
    });

    return res.json({
      ok: true,
      artifact,
      conversationId
    });

  } catch (error: any) {
    console.error('Add artifact error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to add artifact'
    });
  }
});

/**
 * GET /api/conversations/:conversationId
 * Get conversation details
 */
router.get('/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { includeMessages, includeArtifacts } = req.query;

    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        ok: false,
        error: 'Conversation not found'
      });
    }

    const result: any = { conversation };

    if (includeMessages === 'true') {
      result.messages = await conversationService.getMessages(conversationId);
    }

    if (includeArtifacts === 'true') {
      result.artifacts = await conversationService.getArtifacts(conversationId);
    }

    return res.json({
      ok: true,
      ...result
    });

  } catch (error: any) {
    console.error('Get conversation error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get conversation'
    });
  }
});

/**
 * GET /api/conversations/collab/:collab/active
 * Get or create active conversation for collaborator
 */
router.get('/collab/:collab/active', async (req: Request, res: Response) => {
  try {
    const { collab } = req.params;

    const conversation = await conversationService.getOrCreateActiveConversation(collab);

    return res.json({
      ok: true,
      conversation
    });

  } catch (error: any) {
    console.error('Get active conversation error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get active conversation'
    });
  }
});

/**
 * GET /api/conversations
 * Query conversations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { collab, tags, status, limit } = req.query;

    const query: any = {};
    
    if (collab) query.collab = collab as string;
    if (status) query.status = status as string;
    if (tags) query.tags = (tags as string).split(',');
    if (limit) query.limit = parseInt(limit as string);

    const conversations = await conversationService.queryConversations(query);

    return res.json({
      ok: true,
      conversations,
      count: conversations.length
    });

  } catch (error: any) {
    console.error('Query conversations error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to query conversations'
    });
  }
});

/**
 * POST /api/conversations/:conversationId/summary
 * Update conversation summary
 */
router.post('/:conversationId/summary', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { short, bullets, narrative } = req.body;

    await conversationService.updateSummary(conversationId, {
      short,
      bullets,
      narrative
    });

    return res.json({
      ok: true,
      message: 'Summary updated successfully'
    });

  } catch (error: any) {
    console.error('Update summary error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to update summary'
    });
  }
});

/**
 * POST /api/conversations/:conversationId/tags
 * Add tags to conversation
 */
router.post('/:conversationId/tags', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({
        ok: false,
        error: 'tags must be an array'
      });
    }

    await conversationService.addTags(conversationId, tags);

    return res.json({
      ok: true,
      message: 'Tags added successfully'
    });

  } catch (error: any) {
    console.error('Add tags error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to add tags'
    });
  }
});

/**
 * POST /api/conversations/:conversationId/close
 * Close conversation
 */
router.post('/:conversationId/close', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { reason } = req.body;

    await conversationService.closeConversation(conversationId, reason);

    return res.json({
      ok: true,
      message: 'Conversation closed successfully'
    });

  } catch (error: any) {
    console.error('Close conversation error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to close conversation'
    });
  }
});

/**
 * GET /api/conversations/:conversationId/analyze
 * Analyze conversation for insights
 */
router.get('/:conversationId/analyze', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const analysis = await conversationService.analyzeConversation(conversationId);

    return res.json({
      ok: true,
      analysis
    });

  } catch (error: any) {
    console.error('Analyze conversation error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to analyze conversation'
    });
  }
});

/**
 * POST /api/conversations/:conversationId/save-to-drive
 * Save conversation summary to AMBARADAM Drive
 */
router.post('/:conversationId/save-to-drive', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        ok: false,
        error: 'Conversation not found'
      });
    }

    const messages = await conversationService.getMessages(conversationId);
    const artifacts = await conversationService.getArtifacts(conversationId);

    // Create comprehensive conversation document
    const conversationDoc = `ZANTARA CONVERSATION LOG
=======================================
ID: ${conversation.id}
Collaborator: ${conversation.collab}
Started: ${new Date(conversation.startedAt).toLocaleDateString('id-ID', { 
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
})}
Status: ${conversation.status.toUpperCase()}
Tags: ${conversation.tags.join(', ') || 'None'}
Messages: ${conversation.messageCount || 0}
Mood Trend: ${conversation.moodTrend.join(' → ') || 'No mood data'}

${conversation.summary ? `
SUMMARY
-------
${conversation.summary.short}

Key Points:
${conversation.summary.bullets?.map(bullet => `• ${bullet}`).join('\n') || 'No bullets available'}

Narrative:
${conversation.summary.narrative || 'No narrative available'}
` : ''}

MESSAGES
--------
${messages.map(msg => {
  const timestamp = new Date(msg.timestamp).toLocaleString('id-ID');
  const moodIcon = msg.mood ? ` [${msg.mood}]` : '';
  const triggerInfo = msg.trigger ? ` (triggered by: ${msg.trigger})` : '';
  return `[${timestamp}] ${msg.sender.toUpperCase()}${moodIcon}${triggerInfo}:\n${msg.text}\n`;
}).join('\n')}

${artifacts.length > 0 ? `
ARTIFACTS CREATED
-----------------
${artifacts.map(art => {
  const timestamp = new Date(art.createdAt).toLocaleString('id-ID');
  return `• ${art.type.toUpperCase()}: ${art.title || art.description || 'Untitled'} (${timestamp})${art.link ? `\n  Link: ${art.link}` : ''}`;
}).join('\n')}
` : ''}

---
Generated by ZANTARA Bridge
${new Date().toISOString()}`;

    // Upload to AMBARADAM
    const uploadResult = await uploadNoteToAmbaradam({
      owner: conversation.collab,
      text: conversationDoc,
      title: `Conversation ${conversation.id}`
    });

    if (uploadResult.ok) {
      // Add the drive file as an artifact
      await conversationService.addArtifact(conversationId, {
        type: 'driveFile',
        title: `Conversation Log - ${conversation.collab}`,
        description: `Complete conversation log saved to AMBARADAM`,
        fileId: uploadResult.fileId,
        link: uploadResult.webViewLink
      });
    }

    return res.json({
      ok: true,
      uploadResult,
      message: 'Conversation saved to AMBARADAM successfully'
    });

  } catch (error: any) {
    console.error('Save to drive error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to save conversation to drive'
    });
  }
});

/**
 * GET /api/conversations/metrics
 * Get conversation metrics
 */
router.get('/metrics/overview', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const timeframe = (startDate && endDate) ? {
      start: startDate as string,
      end: endDate as string
    } : undefined;

    const metrics = await conversationService.getMetrics(timeframe);

    return res.json({
      ok: true,
      metrics
    });

  } catch (error: any) {
    console.error('Get metrics error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get metrics'
    });
  }
});

export default router;