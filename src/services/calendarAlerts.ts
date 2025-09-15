import { google } from 'googleapis';
import { db } from '../core/firestore';
import { gmailParserService } from './gmailParser';
import * as fs from 'fs';

export interface KITASDeadline {
  id: string;
  userId: string;
  type: 'kitas_renewal' | 'kitas_application' | 'exit_reentry' | 'work_permit' | 'tax_filing' | 'annual_report';
  title: string;
  description: string;
  deadline: Date;
  reminderDays: number[];
  status: 'upcoming' | 'reminded' | 'completed' | 'overdue';
  category: 'immigration' | 'tax' | 'business';
  priority: 'critical' | 'high' | 'medium' | 'low';
  calendarEventId?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  reminders: number[]; // days before
  attendees?: string[];
}

class CalendarAlertsService {
  private readonly CALENDAR_ID = 'primary';
  private readonly COMMON_DEADLINES = [
    {
      type: 'kitas_renewal',
      title: 'KITAS Renewal Due',
      description: 'KITAS must be renewed before expiration to maintain legal status',
      reminderDays: [60, 30, 14, 7, 3, 1],
      category: 'immigration',
      priority: 'critical'
    },
    {
      type: 'exit_reentry',
      title: 'Exit-Reentry Permit Required',
      description: 'Apply for exit-reentry permit before traveling abroad',
      reminderDays: [14, 7, 3],
      category: 'immigration',
      priority: 'high'
    },
    {
      type: 'tax_filing',
      title: 'Tax Return Filing',
      description: 'Annual tax return must be filed by March 31',
      reminderDays: [30, 14, 7, 3, 1],
      category: 'tax',
      priority: 'critical'
    },
    {
      type: 'annual_report',
      title: 'Company Annual Report',
      description: 'PT PMA annual report submission required',
      reminderDays: [30, 14, 7],
      category: 'business',
      priority: 'high'
    }
  ];

  async createKITASDeadline(
    userId: string,
    deadline: Omit<KITASDeadline, 'id' | 'createdAt' | 'status'>
  ): Promise<KITASDeadline> {
    try {
      const calendar = await this.getCalendarClient();
      
      // Create calendar event
      const event = await this.createCalendarEvent(calendar, {
        id: '',
        summary: deadline.title,
        description: deadline.description,
        start: deadline.deadline,
        end: new Date(deadline.deadline.getTime() + 2 * 60 * 60 * 1000), // 2 hours
        reminders: deadline.reminderDays,
        attendees: []
      });

      // Create deadline record
      const kitasDeadline: KITASDeadline = {
        id: Math.random().toString(36),
        userId,
        ...deadline,
        status: 'upcoming',
        calendarEventId: event.id,
        createdAt: new Date()
      };

      // Store in Firestore
      await db.collection('kitasDeadlines').doc(kitasDeadline.id).set(kitasDeadline);

      console.log(`Created KITAS deadline: ${kitasDeadline.title} for ${userId}`);
      return kitasDeadline;

    } catch (error) {
      console.error('Failed to create KITAS deadline:', error);
      throw error;
    }
  }

  async createCalendarEvent(calendar: any, event: CalendarEvent): Promise<any> {
    try {
      const calendarEvent = {
        summary: event.summary,
        description: event.description,
        start: {
          dateTime: event.start.toISOString(),
          timeZone: 'Asia/Jakarta'
        },
        end: {
          dateTime: event.end.toISOString(),
          timeZone: 'Asia/Jakarta'
        },
        reminders: {
          useDefault: false,
          overrides: event.reminders.map(days => ({
            method: 'email',
            minutes: days * 24 * 60
          }))
        },
        attendees: event.attendees?.map(email => ({ email })) || []
      };

      const response = await calendar.events.insert({
        calendarId: this.CALENDAR_ID,
        resource: calendarEvent
      });

      return response.data;

    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  async setupAutomaticReminders(userId: string): Promise<void> {
    try {
      // Create common deadlines for the user
      const currentYear = new Date().getFullYear();
      
      for (const template of this.COMMON_DEADLINES) {
        const deadline = this.generateDeadlineDate(template.type, currentYear);
        
        if (deadline > new Date()) { // Only future deadlines
          await this.createKITASDeadline(userId, {
            userId,
            type: template.type as any,
            title: template.title,
            description: template.description,
            deadline,
            reminderDays: template.reminderDays,
            category: template.category as any,
            priority: template.priority as any
          });
        }
      }

      // Import deadlines from parsed government emails
      await this.importEmailDeadlines(userId);

    } catch (error) {
      console.error('Failed to setup automatic reminders:', error);
      throw error;
    }
  }

  private generateDeadlineDate(type: string, year: number): Date {
    switch (type) {
      case 'tax_filing':
        return new Date(year + 1, 2, 31); // March 31st next year
      case 'annual_report':
        return new Date(year + 1, 3, 30); // April 30th next year
      case 'kitas_renewal':
        // Assume KITAS expires at end of year
        return new Date(year, 11, 1); // December 1st this year
      default:
        return new Date(year + 1, 0, 31); // January 31st next year
    }
  }

  private async importEmailDeadlines(userId: string): Promise<void> {
    try {
      const emailDeadlines = await gmailParserService.getUpcomingDeadlines(userId, 365);
      
      for (const emailDeadline of emailDeadlines) {
        // Check if already exists
        const existing = await this.findExistingDeadline(userId, emailDeadline.task, emailDeadline.date);
        
        if (!existing) {
          await this.createKITASDeadline(userId, {
            userId,
            type: 'kitas_application', // Default type
            title: emailDeadline.task,
            description: `Deadline imported from government email`,
            deadline: emailDeadline.date,
            reminderDays: [7, 3, 1],
            category: emailDeadline.category as any,
            priority: emailDeadline.urgency === 'urgent' ? 'critical' : 'high',
            metadata: {
              importedFromEmail: true,
              emailId: emailDeadline.emailId
            }
          });
        }
      }

    } catch (error) {
      console.error('Failed to import email deadlines:', error);
    }
  }

  private async findExistingDeadline(userId: string, title: string, date: Date): Promise<KITASDeadline | null> {
    try {
      const snapshot = await db.collection('kitasDeadlines')
        .where('userId', '==', userId)
        .where('title', '==', title)
        .get();

      const existing = snapshot.docs.find(doc => {
        const data = doc.data() as KITASDeadline;
        const deadlineDate = data.deadline instanceof Date ? data.deadline : 
                           (data.deadline as any).toDate ? (data.deadline as any).toDate() : 
                           new Date(data.deadline);
        return Math.abs(deadlineDate.getTime() - date.getTime()) < 24 * 60 * 60 * 1000; // Within 1 day
      });

      return existing ? existing.data() as KITASDeadline : null;

    } catch (error) {
      console.error('Failed to find existing deadline:', error);
      return null;
    }
  }

  async getUserDeadlines(userId: string, status?: string): Promise<KITASDeadline[]> {
    try {
      let query = db.collection('kitasDeadlines')
        .where('userId', '==', userId)
        .orderBy('deadline', 'asc');

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data() as KITASDeadline;
        // Convert Firestore timestamps to Date objects
        if (data.deadline && (data.deadline as any).toDate) {
          data.deadline = (data.deadline as any).toDate();
        }
        if (data.createdAt && (data.createdAt as any).toDate) {
          data.createdAt = (data.createdAt as any).toDate();
        }
        return data;
      });

    } catch (error) {
      console.error('Failed to get user deadlines:', error);
      return [];
    }
  }

  async getUpcomingDeadlines(userId: string, days: number = 30): Promise<KITASDeadline[]> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const snapshot = await db.collection('kitasDeadlines')
        .where('userId', '==', userId)
        .where('deadline', '<=', futureDate)
        .where('deadline', '>=', new Date())
        .orderBy('deadline', 'asc')
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data() as KITASDeadline;
        if (data.deadline && (data.deadline as any).toDate) {
          data.deadline = (data.deadline as any).toDate();
        }
        if (data.createdAt && (data.createdAt as any).toDate) {
          data.createdAt = (data.createdAt as any).toDate();
        }
        return data;
      });

    } catch (error) {
      console.error('Failed to get upcoming deadlines:', error);
      return [];
    }
  }

  async markDeadlineCompleted(deadlineId: string, userId: string): Promise<boolean> {
    try {
      const deadlineRef = db.collection('kitasDeadlines').doc(deadlineId);
      const doc = await deadlineRef.get();

      if (!doc.exists) {
        throw new Error('Deadline not found');
      }

      const deadline = doc.data() as KITASDeadline;
      
      if (deadline.userId !== userId) {
        throw new Error('Permission denied');
      }

      await deadlineRef.update({
        status: 'completed',
        completedAt: new Date()
      });

      // Update calendar event
      if (deadline.calendarEventId) {
        const calendar = await this.getCalendarClient();
        await this.updateCalendarEvent(calendar, deadline.calendarEventId, {
          summary: `✅ ${deadline.title}`,
          description: `${deadline.description}\n\nCompleted: ${new Date().toISOString()}`
        });
      }

      return true;

    } catch (error) {
      console.error('Failed to mark deadline completed:', error);
      return false;
    }
  }

  async updateCalendarEvent(calendar: any, eventId: string, updates: any): Promise<boolean> {
    try {
      await calendar.events.patch({
        calendarId: this.CALENDAR_ID,
        eventId,
        resource: updates
      });
      return true;
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      return false;
    }
  }

  async deleteDeadline(deadlineId: string, userId: string): Promise<boolean> {
    try {
      const deadlineRef = db.collection('kitasDeadlines').doc(deadlineId);
      const doc = await deadlineRef.get();

      if (!doc.exists) {
        throw new Error('Deadline not found');
      }

      const deadline = doc.data() as KITASDeadline;
      
      if (deadline.userId !== userId) {
        throw new Error('Permission denied');
      }

      // Delete calendar event
      if (deadline.calendarEventId) {
        const calendar = await this.getCalendarClient();
        await calendar.events.delete({
          calendarId: this.CALENDAR_ID,
          eventId: deadline.calendarEventId
        });
      }

      // Delete deadline record
      await deadlineRef.delete();

      return true;

    } catch (error) {
      console.error('Failed to delete deadline:', error);
      return false;
    }
  }

  async processOverdueDeadlines(): Promise<void> {
    try {
      const now = new Date();
      
      const snapshot = await db.collection('kitasDeadlines')
        .where('deadline', '<', now)
        .where('status', '==', 'upcoming')
        .get();

      const batch = db.batch();

      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { status: 'overdue' });
      });

      await batch.commit();

      console.log(`Marked ${snapshot.docs.length} deadlines as overdue`);

    } catch (error) {
      console.error('Failed to process overdue deadlines:', error);
    }
  }

  private async getCalendarClient() {
    const { impersonatedClient } = await import('../google');
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    if (!user) {
      throw new Error('Missing IMPERSONATE_USER for Calendar access');
    }

    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ]);

    return google.calendar({ version: 'v3', auth: ic.auth });
  }

  // Webhook endpoint for calendar notifications
  async handleCalendarWebhook(notification: any): Promise<void> {
    try {
      // Process calendar change notifications
      console.log('Calendar webhook received:', notification);
      
      // You can implement logic here to sync changes back to Firestore
      // or trigger additional actions based on calendar events

    } catch (error) {
      console.error('Failed to handle calendar webhook:', error);
    }
  }
}

export const calendarAlertsService = new CalendarAlertsService();