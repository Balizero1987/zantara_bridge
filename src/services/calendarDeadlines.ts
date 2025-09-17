import { google } from 'googleapis';
import { impersonatedClient } from '../google';

export interface ComplianceDeadline {
  type: 'kitas_renewal' | 'tax_filing' | 'license_renewal' | 'pt_pma_reporting' | 'custom';
  title: string;
  description: string;
  dueDate: Date;
  reminderDays: number[];
  priority: 'high' | 'medium' | 'low';
  assignedTo?: string[];
  documentRequired: string[];
  category: 'immigration' | 'taxation' | 'licensing' | 'compliance';
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  reminders: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  attendees?: Array<{ email: string }>;
}

export class CalendarDeadlineService {
  private readonly INDONESIA_TZ = 'Asia/Jakarta';
  private readonly DEFAULT_CALENDAR_USER = 'zero@balizero.com';

  /**
   * Create calendar event from chat message like "ZANTARA, rapat pajak besok jam 10"
   */
  async createEventFromChat(message: string, userId: string = 'BOSS'): Promise<{
    ok: boolean;
    event?: any;
    error?: string;
  }> {
    try {
      const eventDetails = this.parseEventFromMessage(message);
      if (!eventDetails) {
        return { ok: false, error: 'Could not parse event details from message' };
      }

      const calendar = await this.getCalendarClient();
      const calendarEvent: CalendarEvent = {
        summary: eventDetails.title,
        description: `Created by ZANTARA from chat message: "${message}"\nRequested by: ${userId}`,
        start: {
          dateTime: eventDetails.startTime.toISOString(),
          timeZone: this.INDONESIA_TZ
        },
        end: {
          dateTime: eventDetails.endTime.toISOString(),
          timeZone: this.INDONESIA_TZ
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 }, // 1 hour before
            { method: 'popup', minutes: 10 }  // 10 minutes before
          ]
        }
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: calendarEvent
      });

      return {
        ok: true,
        event: {
          id: response.data.id,
          title: eventDetails.title,
          startTime: eventDetails.startTime,
          link: response.data.htmlLink
        }
      };

    } catch (error: any) {
      console.error('Create event from chat error:', error);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Setup compliance deadline reminders
   */
  async setupComplianceDeadlines(deadlines: ComplianceDeadline[]): Promise<{
    created: number;
    errors: string[];
  }> {
    const result = {
      created: 0,
      errors: [] as string[]
    };

    try {
      const calendar = await this.getCalendarClient();

      for (const deadline of deadlines) {
        try {
          // Create main deadline event
          const mainEvent = await this.createDeadlineEvent(calendar, deadline);
          result.created++;

          // Create reminder events
          for (const reminderDays of deadline.reminderDays) {
            const reminderDate = new Date(deadline.dueDate);
            reminderDate.setDate(reminderDate.getDate() - reminderDays);
            
            await this.createReminderEvent(calendar, deadline, reminderDate, reminderDays);
            result.created++;
          }

        } catch (error: any) {
          console.error(`Error creating deadline ${deadline.title}:`, error);
          result.errors.push(`${deadline.title}: ${error.message}`);
        }
      }

    } catch (error: any) {
      console.error('Setup compliance deadlines error:', error);
      result.errors.push(`Setup error: ${error.message}`);
    }

    return result;
  }

  /**
   * Get upcoming compliance deadlines
   */
  async getUpcomingDeadlines(daysAhead: number = 30): Promise<any[]> {
    try {
      const calendar = await this.getCalendarClient();
      const now = new Date();
      const future = new Date();
      future.setDate(now.getDate() + daysAhead);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        q: 'ZANTARA compliance OR deadline OR KITAS OR pajak OR license'
      });

      return (response.data.items || []).map(event => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        start: event.start?.dateTime || event.start?.date,
        link: event.htmlLink
      }));

    } catch (error: any) {
      console.error('Get upcoming deadlines error:', error);
      return [];
    }
  }

  /**
   * Send deadline reminders to team
   */
  async sendDeadlineReminders(): Promise<{
    sent: number;
    errors: string[];
  }> {
    const result = {
      sent: 0,
      errors: [] as string[]
    };

    try {
      const upcomingDeadlines = await this.getUpcomingDeadlines(7); // Next 7 days
      
      for (const deadline of upcomingDeadlines) {
        // TODO: Integrate with Gmail service to send reminder emails
        // For now, just log the reminders
        console.log(`📅 Reminder: ${deadline.title} - ${deadline.start}`);
        result.sent++;
      }

    } catch (error: any) {
      console.error('Send deadline reminders error:', error);
      result.errors.push(`Reminder error: ${error.message}`);
    }

    return result;
  }

  /**
   * Parse event details from natural language message
   */
  private parseEventFromMessage(message: string): {
    title: string;
    startTime: Date;
    endTime: Date;
  } | null {
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);

      // Simple parsing for common patterns
      const lowerMessage = message.toLowerCase();

      // Extract title (everything after "zantara,")
      const titleMatch = message.match(/zantara,?\s*(.+?)(?:\s+(?:besok|tomorrow|oggi|today|domani)|\s+jam\s*\d+|$)/i);
      const title = titleMatch ? titleMatch[1].trim() : 'ZANTARA Meeting';

      // Parse time
      let eventDate = now;
      let hour = 10; // default hour

      // Check for time indicators
      if (lowerMessage.includes('besok') || lowerMessage.includes('tomorrow') || lowerMessage.includes('domani')) {
        eventDate = tomorrow;
      } else if (lowerMessage.includes('oggi') || lowerMessage.includes('today')) {
        eventDate = now;
      }

      // Extract hour
      const hourMatch = message.match(/jam\s*(\d+)/i) || message.match(/at\s*(\d+)/i) || message.match(/alle\s*(\d+)/i);
      if (hourMatch) {
        hour = parseInt(hourMatch[1]);
      }

      // Set start time
      const startTime = new Date(eventDate);
      startTime.setHours(hour, 0, 0, 0);

      // Set end time (1 hour later)
      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 1);

      return {
        title,
        startTime,
        endTime
      };

    } catch (error) {
      console.error('Parse event message error:', error);
      return null;
    }
  }

  private async getCalendarClient() {
    const ic = await impersonatedClient(this.DEFAULT_CALENDAR_USER, [
      'https://www.googleapis.com/auth/calendar'
    ]);
    return google.calendar({ version: 'v3', auth: ic.auth });
  }

  private async createDeadlineEvent(calendar: any, deadline: ComplianceDeadline): Promise<any> {
    const eventDate = new Date(deadline.dueDate);
    eventDate.setHours(9, 0, 0, 0); // 9 AM

    const endDate = new Date(eventDate);
    endDate.setHours(10, 0, 0, 0); // 1 hour duration

    const calendarEvent: CalendarEvent = {
      summary: `🚨 DEADLINE: ${deadline.title}`,
      description: this.formatDeadlineDescription(deadline),
      start: {
        dateTime: eventDate.toISOString(),
        timeZone: this.INDONESIA_TZ
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: this.INDONESIA_TZ
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 }, // 1 day before
          { method: 'email', minutes: 60 },   // 1 hour before
          { method: 'popup', minutes: 10 }    // 10 minutes before
        ]
      },
      attendees: deadline.assignedTo?.map(email => ({ email }))
    };

    return await calendar.events.insert({
      calendarId: 'primary',
      requestBody: calendarEvent
    });
  }

  private async createReminderEvent(calendar: any, deadline: ComplianceDeadline, reminderDate: Date, daysBefore: number): Promise<any> {
    const reminderTime = new Date(reminderDate);
    reminderTime.setHours(9, 0, 0, 0);

    const endTime = new Date(reminderTime);
    endTime.setHours(9, 30, 0, 0);

    const calendarEvent: CalendarEvent = {
      summary: `⚠️ REMINDER: ${deadline.title} (${daysBefore} days)`,
      description: `Reminder: ${deadline.title} is due in ${daysBefore} days.\n\n${this.formatDeadlineDescription(deadline)}`,
      start: {
        dateTime: reminderTime.toISOString(),
        timeZone: this.INDONESIA_TZ
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: this.INDONESIA_TZ
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 0 }
        ]
      },
      attendees: deadline.assignedTo?.map(email => ({ email }))
    };

    return await calendar.events.insert({
      calendarId: 'primary',
      requestBody: calendarEvent
    });
  }

  private formatDeadlineDescription(deadline: ComplianceDeadline): string {
    return `**Type:** ${deadline.type}
**Category:** ${deadline.category}
**Priority:** ${deadline.priority}
**Due Date:** ${deadline.dueDate.toLocaleDateString()}

**Description:**
${deadline.description}

**Required Documents:**
${deadline.documentRequired.map(doc => `• ${doc}`).join('\n')}

**Assigned To:**
${deadline.assignedTo ? deadline.assignedTo.map(person => `• ${person}`).join('\n') : 'Not assigned'}

---
Created by ZANTARA Compliance System`;
  }
}

export const calendarDeadlineService = new CalendarDeadlineService();