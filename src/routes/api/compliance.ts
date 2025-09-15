import type { Router, Request, Response } from 'express';
import { gmailParserService } from '../../services/gmailParser';
import { calendarAlertsService } from '../../services/calendarAlerts';
import { sheetsDashboardService } from '../../services/sheetsDashboard';
import { cacheService } from '../../services/cache';

export default function registerCompliance(r: Router) {
  
  // Monitor Gmail for government emails
  r.post('/api/compliance/gmail/monitor', async (req: Request, res: Response) => {
    try {
      const { userEmail, maxResults = 50 } = req.body;
      
      if (!userEmail) {
        return res.status(400).json({ error: 'userEmail required' });
      }

      const emails = await gmailParserService.monitorGmailInbox(userEmail, maxResults);

      res.json({
        success: true,
        emails,
        count: emails.length
      });

    } catch (error: any) {
      console.error('Gmail monitoring failed:', error);
      res.status(500).json({ 
        error: error.message || 'Gmail monitoring failed' 
      });
    }
  });

  // Get recent government emails
  r.get('/api/compliance/emails/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const category = req.query.category as string;
      const limit = parseInt(req.query.limit as string) || 20;

      const emails = await gmailParserService.getRecentGovEmails(userId, category, limit);

      res.json({
        success: true,
        emails,
        count: emails.length
      });

    } catch (error: any) {
      console.error('Get emails failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to get emails' 
      });
    }
  });

  // Get upcoming deadlines
  r.get('/api/compliance/deadlines/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const deadlines = await gmailParserService.getUpcomingDeadlines(userId, days);

      res.json({
        success: true,
        deadlines,
        count: deadlines.length
      });

    } catch (error: any) {
      console.error('Get deadlines failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to get deadlines' 
      });
    }
  });

  // Create KITAS deadline
  r.post('/api/compliance/deadline/create', async (req: Request, res: Response) => {
    try {
      const { 
        userId, 
        type, 
        title, 
        description, 
        deadline, 
        reminderDays = [7, 3, 1],
        category = 'immigration',
        priority = 'high'
      } = req.body;
      
      if (!userId || !title || !deadline) {
        return res.status(400).json({ 
          error: 'userId, title, and deadline required' 
        });
      }

      const kitasDeadline = await calendarAlertsService.createKITASDeadline(userId, {
        userId,
        type,
        title,
        description,
        deadline: new Date(deadline),
        reminderDays,
        category,
        priority
      });

      res.json({
        success: true,
        deadline: kitasDeadline
      });

    } catch (error: any) {
      console.error('Create deadline failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to create deadline' 
      });
    }
  });

  // Setup automatic reminders for user
  r.post('/api/compliance/setup-reminders/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      await calendarAlertsService.setupAutomaticReminders(userId);

      res.json({
        success: true,
        message: 'Automatic reminders setup successfully'
      });

    } catch (error: any) {
      console.error('Setup reminders failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to setup reminders' 
      });
    }
  });

  // Get user KITAS deadlines
  r.get('/api/compliance/kitas-deadlines/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const status = req.query.status as string;

      const deadlines = await calendarAlertsService.getUserDeadlines(userId, status);

      res.json({
        success: true,
        deadlines,
        count: deadlines.length
      });

    } catch (error: any) {
      console.error('Get KITAS deadlines failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to get KITAS deadlines' 
      });
    }
  });

  // Get upcoming KITAS deadlines
  r.get('/api/compliance/upcoming-deadlines/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const deadlines = await calendarAlertsService.getUpcomingDeadlines(userId, days);

      res.json({
        success: true,
        deadlines,
        count: deadlines.length
      });

    } catch (error: any) {
      console.error('Get upcoming deadlines failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to get upcoming deadlines' 
      });
    }
  });

  // Mark deadline as completed
  r.post('/api/compliance/deadline/:deadlineId/complete', async (req: Request, res: Response) => {
    try {
      const { deadlineId } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'userId required' });
      }

      const success = await calendarAlertsService.markDeadlineCompleted(deadlineId, userId);

      res.json({
        success,
        message: success ? 'Deadline marked as completed' : 'Failed to mark deadline as completed'
      });

    } catch (error: any) {
      console.error('Mark deadline completed failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to mark deadline as completed' 
      });
    }
  });

  // Delete deadline
  r.delete('/api/compliance/deadline/:deadlineId', async (req: Request, res: Response) => {
    try {
      const { deadlineId } = req.params;
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: 'userId required' });
      }

      const success = await calendarAlertsService.deleteDeadline(deadlineId, userId);

      res.json({
        success,
        message: success ? 'Deadline deleted' : 'Failed to delete deadline'
      });

    } catch (error: any) {
      console.error('Delete deadline failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to delete deadline' 
      });
    }
  });

  // Create dashboard
  r.post('/api/compliance/dashboard/create', async (req: Request, res: Response) => {
    try {
      const spreadsheetId = await sheetsDashboardService.createDashboard();

      res.json({
        success: true,
        spreadsheetId,
        url: await sheetsDashboardService.getDashboardUrl(spreadsheetId)
      });

    } catch (error: any) {
      console.error('Create dashboard failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to create dashboard' 
      });
    }
  });

  // Update dashboard
  r.post('/api/compliance/dashboard/update', async (req: Request, res: Response) => {
    try {
      const { spreadsheetId } = req.body;

      const success = await sheetsDashboardService.updateDashboard(spreadsheetId);

      res.json({
        success,
        message: success ? 'Dashboard updated' : 'Failed to update dashboard'
      });

    } catch (error: any) {
      console.error('Update dashboard failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to update dashboard' 
      });
    }
  });

  // Get dashboard URL
  r.get('/api/compliance/dashboard/url', async (req: Request, res: Response) => {
    try {
      const spreadsheetId = req.query.spreadsheetId as string;
      const url = await sheetsDashboardService.getDashboardUrl(spreadsheetId);

      res.json({
        success: true,
        url
      });

    } catch (error: any) {
      console.error('Get dashboard URL failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to get dashboard URL' 
      });
    }
  });

  // Cache management endpoints
  r.get('/api/compliance/cache/stats', async (req: Request, res: Response) => {
    try {
      const stats = cacheService.getStats();
      const performance = cacheService.getPerformanceMetrics();
      const health = await cacheService.getHealthStatus();

      res.json({
        success: true,
        stats,
        performance,
        health
      });

    } catch (error: any) {
      console.error('Get cache stats failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to get cache stats' 
      });
    }
  });

  r.delete('/api/compliance/cache/clear', async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string;
      const deletedCount = await cacheService.clear(category);

      res.json({
        success: true,
        deletedCount,
        message: `Cleared ${deletedCount} cache entries`
      });

    } catch (error: any) {
      console.error('Clear cache failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to clear cache' 
      });
    }
  });

  // Mark email as processed
  r.post('/api/compliance/email/:emailId/processed', async (req: Request, res: Response) => {
    try {
      const { emailId } = req.params;

      const success = await gmailParserService.markEmailProcessed(emailId);

      res.json({
        success,
        message: success ? 'Email marked as processed' : 'Failed to mark email as processed'
      });

    } catch (error: any) {
      console.error('Mark email processed failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to mark email as processed' 
      });
    }
  });

  // Process overdue deadlines (admin endpoint)
  r.post('/api/compliance/admin/process-overdue', async (req: Request, res: Response) => {
    try {
      await calendarAlertsService.processOverdueDeadlines();

      res.json({
        success: true,
        message: 'Processed overdue deadlines'
      });

    } catch (error: any) {
      console.error('Process overdue deadlines failed:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to process overdue deadlines' 
      });
    }
  });
}