import { Router, Request, Response } from 'express';
import { calendarService } from '../services/calendarService';

const router = Router();

/**
 * POST /api/calendar/deadline
 * Create a deadline event in calendar
 */
router.post('/deadline', async (req: Request, res: Response) => {
  try {
    const { title, description, dueDate, type, priority, collaborator, reminderIntervals } = req.body;

    if (!title || !dueDate) {
      return res.status(400).json({
        ok: false,
        error: 'title and dueDate are required'
      });
    }

    const deadline = {
      title,
      description: description || title,
      dueDate,
      type: type || 'other',
      priority: priority || 'medium',
      collaborator,
      reminderIntervals: reminderIntervals || []
    };

    const eventId = await calendarService.createDeadlineEvent(deadline);

    return res.json({
      ok: true,
      eventId,
      deadline,
      message: `Calendar event created: ${title}`
    });

  } catch (error: any) {
    console.error('Create deadline error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to create deadline'
    });
  }
});

/**
 * POST /api/calendar/extract-from-text
 * Extract deadline from text and optionally create calendar event
 */
router.post('/extract-from-text', async (req: Request, res: Response) => {
  try {
    const { text, collaborator, createEvent = false } = req.body;

    if (!text) {
      return res.status(400).json({
        ok: false,
        error: 'text is required'
      });
    }

    const extractedDeadline = calendarService.extractDeadlineFromText(text, collaborator);

    if (!extractedDeadline) {
      return res.json({
        ok: true,
        extracted: null,
        message: 'No deadline found in text'
      });
    }

    let eventId = null;
    if (createEvent) {
      eventId = await calendarService.createDeadlineEvent(extractedDeadline);
    }

    return res.json({
      ok: true,
      extracted: extractedDeadline,
      eventId,
      message: extractedDeadline 
        ? `Deadline extracted: ${extractedDeadline.title}${eventId ? ' (Calendar event created)' : ''}`
        : 'No deadline found in text'
    });

  } catch (error: any) {
    console.error('Extract deadline error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to extract deadline'
    });
  }
});

/**
 * GET /api/calendar/upcoming
 * Get upcoming deadlines
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const { days = 7 } = req.query;
    const daysNumber = parseInt(days as string) || 7;

    const upcomingDeadlines = await calendarService.getUpcomingDeadlines(daysNumber);

    // Group by priority and type for better organization
    const organized = {
      urgent: upcomingDeadlines.filter(e => e.summary?.includes('🚨') || e.description?.includes('urgent')),
      high: upcomingDeadlines.filter(e => e.summary?.includes('🛂') || e.summary?.includes('💰')),
      medium: upcomingDeadlines.filter(e => e.summary?.includes('📋') || e.summary?.includes('📄')),
      low: upcomingDeadlines.filter(e => !e.summary?.match(/🚨|🛂|💰|📋|📄/))
    };

    return res.json({
      ok: true,
      upcomingDeadlines,
      organized,
      count: upcomingDeadlines.length,
      period: `Next ${daysNumber} days`
    });

  } catch (error: any) {
    console.error('Get upcoming deadlines error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get upcoming deadlines'
    });
  }
});

/**
 * POST /api/calendar/reminder
 * Create a reminder for a collaborator
 */
router.post('/reminder', async (req: Request, res: Response) => {
  try {
    const { collaborator, title, description, reminderDate } = req.body;

    if (!collaborator || !title || !reminderDate) {
      return res.status(400).json({
        ok: false,
        error: 'collaborator, title, and reminderDate are required'
      });
    }

    const eventId = await calendarService.createCollaboratorReminder(
      collaborator,
      title,
      description || title,
      new Date(reminderDate)
    );

    return res.json({
      ok: true,
      eventId,
      message: `Reminder created for ${collaborator}: ${title}`
    });

  } catch (error: any) {
    console.error('Create reminder error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to create reminder'
    });
  }
});

/**
 * POST /api/calendar/process-conversation
 * Process a conversation for deadline extraction and calendar event creation
 */
router.post('/process-conversation', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        ok: false,
        error: 'conversationId is required'
      });
    }

    const eventIds = await calendarService.processConversationForDeadlines(conversationId);

    return res.json({
      ok: true,
      conversationId,
      eventIds,
      count: eventIds.length,
      message: `Processed conversation and created ${eventIds.length} calendar events`
    });

  } catch (error: any) {
    console.error('Process conversation error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to process conversation'
    });
  }
});

/**
 * POST /api/calendar/bulk-deadline
 * Create multiple deadlines at once (useful for importing existing deadlines)
 */
router.post('/bulk-deadline', async (req: Request, res: Response) => {
  try {
    const { deadlines } = req.body;

    if (!Array.isArray(deadlines) || deadlines.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'deadlines array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const deadline of deadlines) {
      try {
        const eventId = await calendarService.createDeadlineEvent(deadline);
        results.push({
          title: deadline.title,
          eventId,
          success: true
        });
      } catch (error: any) {
        errors.push({
          title: deadline.title,
          error: error.message,
          success: false
        });
      }
    }

    return res.json({
      ok: true,
      results,
      errors,
      totalProcessed: deadlines.length,
      successCount: results.length,
      errorCount: errors.length,
      message: `Bulk deadline creation completed: ${results.length}/${deadlines.length} successful`
    });

  } catch (error: any) {
    console.error('Bulk deadline creation error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to create bulk deadlines'
    });
  }
});

/**
 * GET /api/calendar/test-extraction
 * Test deadline extraction with sample texts
 */
router.get('/test-extraction', async (req: Request, res: Response) => {
  try {
    const sampleTexts = [
      'KITAS saya expired tanggal 15 November 2024, tolong diurus perpanjangan',
      'Meeting dengan klien besok jam 10 pagi untuk discuss investasi',
      'Deadline SPT pajak 31 Maret 2024, jangan sampai telat!',
      'Dokumen permit harus diserahkan minggu depan ke BKPM',
      'Rapat internal bulan depan untuk review compliance'
    ];

    const extractions = sampleTexts.map(text => ({
      originalText: text,
      extracted: calendarService.extractDeadlineFromText(text, 'TEST_USER')
    }));

    return res.json({
      ok: true,
      extractions,
      message: 'Test extraction completed'
    });

  } catch (error: any) {
    console.error('Test extraction error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to test extraction'
    });
  }
});

export default router;