import { Router, Request, Response } from 'express';
import { gmailMonitorService } from '../services/gmailMonitorService';

const router = Router();

/**
 * POST /api/gmail/monitor
 * Run Gmail monitoring and process government emails
 */
router.post('/monitor', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Starting Gmail monitoring...');
    
    const processedEmails = await gmailMonitorService.monitorGovernmentEmails();
    
    const summary = {
      totalProcessed: processedEmails.length,
      byAgency: processedEmails.reduce((acc, email) => {
        acc[email.agency] = (acc[email.agency] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPriority: processedEmails.reduce((acc, email) => {
        acc[email.priority] = (acc[email.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      highPriorityEmails: processedEmails.filter(e => e.priority === 'high')
    };

    console.log(`✅ Gmail monitoring completed: ${processedEmails.length} emails processed`);

    return res.json({
      ok: true,
      summary,
      emails: processedEmails,
      message: `Processed ${processedEmails.length} government emails`
    });

  } catch (error: any) {
    console.error('Gmail monitoring error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to monitor Gmail'
    });
  }
});

/**
 * GET /api/gmail/stats
 * Get Gmail monitoring statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await gmailMonitorService.getMonitoringStats();
    
    return res.json({
      ok: true,
      stats
    });

  } catch (error: any) {
    console.error('Get Gmail stats error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get Gmail stats'
    });
  }
});

/**
 * POST /api/gmail/test-filters
 * Test Gmail filters with sample data
 */
router.post('/test-filters', async (req: Request, res: Response) => {
  try {
    const { from, subject, body } = req.body;

    if (!from || !subject) {
      return res.status(400).json({
        ok: false,
        error: 'from and subject are required for testing'
      });
    }

    // Create a mock processed email for testing
    const testEmail = {
      messageId: 'test-' + Date.now(),
      from,
      to: 'zero@balizero.com',
      subject,
      body: body || '',
      receivedDate: new Date().toISOString(),
      agency: 'Other' as const,
      priority: 'medium' as const,
      keywords: []
    };

    // Test agency detection
    const gmailService = new (gmailMonitorService.constructor as any)();
    const text = `${from} ${subject} ${body || ''}`.toLowerCase();
    
    let agency: 'DitjenImigrasi' | 'DJP' | 'BKPM' | 'Other' = 'Other';
    
    if (text.includes('imigrasi') || text.includes('visa') || text.includes('kitas')) {
      agency = 'DitjenImigrasi';
    } else if (text.includes('pajak') || text.includes('tax') || text.includes('npwp')) {
      agency = 'DJP';
    } else if (text.includes('bkpm') || text.includes('investasi') || text.includes('oss')) {
      agency = 'BKPM';
    }

    // Test priority detection
    let priority: 'high' | 'medium' | 'low' = 'low';
    const highKeywords = ['urgent', 'segera', 'deadline', 'expired', 'warning'];
    const mediumKeywords = ['perpanjangan', 'renewal', 'verifikasi', 'dokumen'];

    if (highKeywords.some(keyword => text.includes(keyword))) {
      priority = 'high';
    } else if (mediumKeywords.some(keyword => text.includes(keyword))) {
      priority = 'medium';
    }

    testEmail.agency = agency;
    testEmail.priority = priority;

    return res.json({
      ok: true,
      testEmail,
      analysis: {
        detectedAgency: agency,
        detectedPriority: priority,
        governmentEmail: from.includes('.go.id'),
        matchedKeywords: {
          high: highKeywords.filter(k => text.includes(k)),
          medium: mediumKeywords.filter(k => text.includes(k))
        }
      },
      message: 'Filter test completed'
    });

  } catch (error: any) {
    console.error('Test filters error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to test filters'
    });
  }
});

/**
 * POST /api/gmail/manual-save
 * Manually save an email to AMBARADAM (for testing)
 */
router.post('/manual-save', async (req: Request, res: Response) => {
  try {
    const { from, subject, body, agency = 'Other', priority = 'medium' } = req.body;

    if (!from || !subject || !body) {
      return res.status(400).json({
        ok: false,
        error: 'from, subject, and body are required'
      });
    }

    const mockEmail = {
      messageId: 'manual-' + Date.now(),
      from,
      to: 'zero@balizero.com',
      subject,
      body,
      receivedDate: new Date().toISOString(),
      agency: agency as any,
      priority: priority as any,
      keywords: []
    };

    // Use the private method via reflection (for testing only)
    const saveMethod = (gmailMonitorService as any).saveToAmbaradam;
    if (saveMethod) {
      await saveMethod.call(gmailMonitorService, mockEmail);
    }

    return res.json({
      ok: true,
      mockEmail,
      message: 'Email manually saved to AMBARADAM'
    });

  } catch (error: any) {
    console.error('Manual save error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to manually save email'
    });
  }
});

export default router;