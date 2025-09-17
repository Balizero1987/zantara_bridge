import type { Router, Request, Response } from 'express';
import { calendarDeadlineService, ComplianceDeadline } from '../../services/calendarDeadlines';

export default function registerCalendarDeadlines(r: Router) {
  
  /**
   * POST /api/calendar/event-from-chat
   * Create calendar event from natural language chat message
   */
  r.post('/api/calendar/event-from-chat', async (req: Request, res: Response) => {
    try {
      const { message, userId } = req.body;
      
      if (!message) {
        return res.status(400).json({
          ok: false,
          error: 'Message is required'
        });
      }

      console.log(`📅 Creating event from chat: "${message}" (user: ${userId || 'BOSS'})`);
      
      const result = await calendarDeadlineService.createEventFromChat(message, userId || 'BOSS');
      
      if (result.ok) {
        res.json({
          ok: true,
          event: result.event,
          message: `Event created: ${result.event?.title}`
        });
      } else {
        res.status(400).json({
          ok: false,
          error: result.error
        });
      }
      
    } catch (error: any) {
      console.error('Calendar event from chat error:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'Failed to create calendar event'
      });
    }
  });

  /**
   * POST /api/calendar/setup-compliance-deadlines
   * Setup predefined compliance deadlines
   */
  r.post('/api/calendar/setup-compliance-deadlines', async (req: Request, res: Response) => {
    try {
      const { deadlines } = req.body;
      
      if (!deadlines || !Array.isArray(deadlines)) {
        // Use default Indonesia compliance deadlines
        const defaultDeadlines: ComplianceDeadline[] = [
          {
            type: 'kitas_renewal',
            title: 'KITAS Renewal Deadline',
            description: 'Annual KITAS renewal must be completed before expiration',
            dueDate: new Date('2025-12-31'),
            reminderDays: [30, 14, 7, 1],
            priority: 'high',
            assignedTo: ['zero@balizero.com'],
            documentRequired: ['Passport', 'Sponsor Letter', 'Health Certificate'],
            category: 'immigration'
          },
          {
            type: 'tax_filing',
            title: 'Annual Tax Filing',
            description: 'Corporate and personal tax filing for Indonesia',
            dueDate: new Date('2025-04-30'),
            reminderDays: [60, 30, 14, 7, 1],
            priority: 'high',
            assignedTo: ['zero@balizero.com'],
            documentRequired: ['Financial Statements', 'Tax Books', 'Supporting Documents'],
            category: 'taxation'
          },
          {
            type: 'pt_pma_reporting',
            title: 'PT PMA Quarterly Report',
            description: 'Quarterly reporting to BKPM for foreign investment company',
            dueDate: new Date('2025-04-15'),
            reminderDays: [30, 14, 7, 1],
            priority: 'medium',
            assignedTo: ['zero@balizero.com'],
            documentRequired: ['Activity Report', 'Financial Summary'],
            category: 'compliance'
          }
        ];
        
        console.log('📅 Setting up default compliance deadlines');
        const result = await calendarDeadlineService.setupComplianceDeadlines(defaultDeadlines);
        
        return res.json({
          ok: true,
          result,
          message: `Created ${result.created} calendar events for compliance deadlines`
        });
      }
      
      console.log(`📅 Setting up ${deadlines.length} custom compliance deadlines`);
      const result = await calendarDeadlineService.setupComplianceDeadlines(deadlines);
      
      res.json({
        ok: true,
        result,
        message: `Created ${result.created} calendar events`
      });
      
    } catch (error: any) {
      console.error('Setup compliance deadlines error:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'Failed to setup compliance deadlines'
      });
    }
  });

  /**
   * GET /api/calendar/upcoming-deadlines
   * Get upcoming compliance deadlines
   */
  r.get('/api/calendar/upcoming-deadlines', async (req: Request, res: Response) => {
    try {
      const { days } = req.query;
      const daysAhead = days ? parseInt(days as string) : 30;
      
      console.log(`📅 Getting upcoming deadlines for next ${daysAhead} days`);
      
      const deadlines = await calendarDeadlineService.getUpcomingDeadlines(daysAhead);
      
      res.json({
        ok: true,
        deadlines,
        count: deadlines.length,
        period_days: daysAhead
      });
      
    } catch (error: any) {
      console.error('Get upcoming deadlines error:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'Failed to get upcoming deadlines'
      });
    }
  });

  /**
   * POST /api/calendar/send-reminders
   * Send deadline reminders to team
   */
  r.post('/api/calendar/send-reminders', async (req: Request, res: Response) => {
    try {
      console.log('📧 Sending deadline reminders to team');
      
      const result = await calendarDeadlineService.sendDeadlineReminders();
      
      res.json({
        ok: true,
        result,
        message: `Sent ${result.sent} deadline reminders`
      });
      
    } catch (error: any) {
      console.error('Send reminders error:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'Failed to send reminders'
      });
    }
  });

  /**
   * GET /api/calendar/status
   * Get calendar integration status
   */
  r.get('/api/calendar/status', async (req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        status: 'active',
        features: [
          'Natural language event creation',
          'Compliance deadline tracking',
          'Automatic reminders',
          'Indonesia timezone support'
        ],
        calendar_user: 'zero@balizero.com',
        timezone: 'Asia/Jakarta'
      });
      
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: error.message || 'Failed to get calendar status'
      });
    }
  });
}