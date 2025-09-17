import type { Router, Request, Response } from 'express';
import { gmailMonitorService } from '../../services/gmailMonitor';

export default function registerGmailMonitor(r: Router) {
  
  /**
   * POST /api/gmail/monitor
   * Start government email monitoring
   */
  r.post('/api/gmail/monitor', async (req: Request, res: Response) => {
    try {
      const { userEmail } = req.body;
      const email = userEmail || 'zero@balizero.com';
      
      console.log(`🔍 Starting Gmail monitoring for: ${email}`);
      
      const results = await gmailMonitorService.monitorGovernmentEmails(email);
      
      res.json({
        ok: true,
        results,
        message: `Processed ${results.processed} emails, saved ${results.saved} government emails`
      });
      
    } catch (error: any) {
      console.error('Gmail monitor API error:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'Gmail monitoring failed'
      });
    }
  });

  /**
   * POST /api/gmail/start-periodic
   * Start periodic monitoring (for cron jobs)
   */
  r.post('/api/gmail/start-periodic', async (req: Request, res: Response) => {
    try {
      // Start async monitoring (don't wait for completion)
      gmailMonitorService.startPeriodicMonitoring().catch(err => {
        console.error('Background monitoring error:', err);
      });
      
      res.json({
        ok: true,
        message: 'Periodic Gmail monitoring started in background'
      });
      
    } catch (error: any) {
      console.error('Start periodic monitor error:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'Failed to start periodic monitoring'
      });
    }
  });

  /**
   * GET /api/gmail/monitor/status
   * Get monitoring status and recent activity
   */
  r.get('/api/gmail/monitor/status', async (req: Request, res: Response) => {
    try {
      // TODO: Implement status tracking in Firestore
      res.json({
        ok: true,
        status: 'active',
        monitored_domains: [
          'imigrasi.go.id',
          'kemenkumham.go.id', 
          'pajak.go.id',
          'bkpm.go.id',
          'kemendag.go.id',
          'bps.go.id',
          '*.go.id'
        ],
        last_check: new Date().toISOString(),
        monitoring_user: 'zero@balizero.com'
      });
      
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: error.message || 'Failed to get monitor status'
      });
    }
  });
}