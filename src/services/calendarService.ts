import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { conversationService } from './conversationService';

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{ email: string; displayName?: string }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

interface DeadlineEvent {
  title: string;
  description: string;
  dueDate: string;
  type: 'visa' | 'tax' | 'permit' | 'document' | 'meeting' | 'other';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  collaborator?: string;
  relatedEmails?: string[];
  reminderIntervals: number[]; // Minutes before event
}

export class CalendarService {
  private readonly CALENDAR_ID = 'primary'; // Use primary calendar
  private readonly TIMEZONE = 'Asia/Jakarta';

  private readonly DEFAULT_REMINDERS = {
    urgent: [5, 30, 60, 1440], // 5min, 30min, 1h, 1day
    high: [30, 120, 1440], // 30min, 2h, 1day
    medium: [120, 1440], // 2h, 1day
    low: [1440] // 1day
  };

  private readonly EVENT_TYPES = {
    visa: {
      emoji: '🛂',
      color: 'red',
      defaultDuration: 60 // minutes
    },
    tax: {
      emoji: '💰',
      color: 'orange',
      defaultDuration: 120
    },
    permit: {
      emoji: '📋',
      color: 'blue',
      defaultDuration: 90
    },
    document: {
      emoji: '📄',
      color: 'green',
      defaultDuration: 30
    },
    meeting: {
      emoji: '🤝',
      color: 'purple',
      defaultDuration: 60
    },
    other: {
      emoji: '📅',
      color: 'gray',
      defaultDuration: 60
    }
  };

  /**
   * Create a new calendar event for compliance deadlines
   */
  async createDeadlineEvent(deadline: DeadlineEvent): Promise<string> {
    try {
      const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
      if (!user) throw new Error('Missing IMPERSONATE_USER for Calendar access');

      const ic = await impersonatedClient(user, [
        'https://www.googleapis.com/auth/calendar'
      ]);

      const calendar = google.calendar({ version: 'v3', auth: ic.auth });

      const eventType = this.EVENT_TYPES[deadline.type];
      const reminderMinutes = deadline.reminderIntervals.length > 0 
        ? deadline.reminderIntervals 
        : this.DEFAULT_REMINDERS[deadline.priority];

      // Parse due date
      const dueDate = new Date(deadline.dueDate);
      const endDate = new Date(dueDate.getTime() + (eventType.defaultDuration * 60000));

      const event: CalendarEvent = {
        summary: `${eventType.emoji} ${deadline.title}`,
        description: `${deadline.description}\n\nTipo: ${deadline.type.toUpperCase()}\nPriorità: ${deadline.priority.toUpperCase()}\n${deadline.collaborator ? `\nCollaboratore: ${deadline.collaborator}` : ''}\n\nCreato da ZANTARA Bridge`,
        start: {
          dateTime: dueDate.toISOString(),
          timeZone: this.TIMEZONE
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: this.TIMEZONE
        },
        reminders: {
          useDefault: false,
          overrides: reminderMinutes.map(minutes => ({
            method: 'email' as const,
            minutes
          }))
        }
      };

      // Add attendees if collaborator specified
      if (deadline.collaborator) {
        event.attendees = [
          { email: user, displayName: 'ZANTARA System' }
        ];
      }

      const response = await calendar.events.insert({
        calendarId: this.CALENDAR_ID,
        requestBody: event
      });

      console.log(`✅ Calendar event created: ${deadline.title} (${response.data.id})`);
      return response.data.id!;

    } catch (error: any) {
      console.error('Failed to create calendar event:', error);
      throw new Error(`Failed to create calendar event: ${error.message}`);
    }
  }

  /**
   * Extract deadline from conversation text
   */
  extractDeadlineFromText(text: string, collaborator?: string): DeadlineEvent | null {
    const lowerText = text.toLowerCase();

    // Look for date patterns
    const datePatterns = [
      // Indonesian date formats
      /(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/i,
      // International formats
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
      // Relative dates
      /(besok|tomorrow|minggu depan|next week|bulan depan|next month)/i
    ];

    let extractedDate: Date | null = null;
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        extractedDate = this.parseDateFromMatch(match);
        break;
      }
    }

    if (!extractedDate) {
      return null; // No date found
    }

    // Determine event type based on keywords
    let type: DeadlineEvent['type'] = 'other';
    let priority: DeadlineEvent['priority'] = 'medium';

    if (lowerText.includes('visa') || lowerText.includes('kitas') || lowerText.includes('kitap')) {
      type = 'visa';
      priority = 'high';
    } else if (lowerText.includes('pajak') || lowerText.includes('tax') || lowerText.includes('spt')) {
      type = 'tax';
      priority = 'high';
    } else if (lowerText.includes('permit') || lowerText.includes('izin') || lowerText.includes('license')) {
      type = 'permit';
      priority = 'medium';
    } else if (lowerText.includes('dokumen') || lowerText.includes('document') || lowerText.includes('berkas')) {
      type = 'document';
      priority = 'medium';
    } else if (lowerText.includes('meeting') || lowerText.includes('rapat') || lowerText.includes('pertemuan')) {
      type = 'meeting';
      priority = 'medium';
    }

    // Check for urgency indicators
    if (lowerText.includes('urgent') || lowerText.includes('segera') || lowerText.includes('deadline')) {
      priority = 'urgent';
    }

    // Extract title from text
    const sentences = text.split(/[.!?]+/);
    const titleSentence = sentences[0].trim();
    const title = titleSentence.length > 50 
      ? titleSentence.substring(0, 50) + '...' 
      : titleSentence;

    return {
      title: title || `${type.charAt(0).toUpperCase() + type.slice(1)} Reminder`,
      description: text.length > 200 ? text.substring(0, 200) + '...' : text,
      dueDate: extractedDate.toISOString(),
      type,
      priority,
      collaborator,
      reminderIntervals: this.DEFAULT_REMINDERS[priority]
    };
  }

  /**
   * Parse date from regex match
   */
  private parseDateFromMatch(match: RegExpMatchArray): Date | null {
    const fullMatch = match[0].toLowerCase();

    // Handle relative dates
    if (fullMatch.includes('besok') || fullMatch.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    if (fullMatch.includes('minggu depan') || fullMatch.includes('next week')) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }

    if (fullMatch.includes('bulan depan') || fullMatch.includes('next month')) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    }

    // Handle specific date formats
    if (match.length >= 4) {
      const day = parseInt(match[1]);
      const monthOrYear = match[2];
      const year = parseInt(match[3]);

      // Indonesian month names
      const indonesianMonths = {
        'januari': 0, 'februari': 1, 'maret': 2, 'april': 3,
        'mei': 4, 'juni': 5, 'juli': 6, 'agustus': 7,
        'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
      };

      const month = indonesianMonths[monthOrYear.toLowerCase()] ?? parseInt(monthOrYear) - 1;
      
      if (month >= 0 && month <= 11) {
        return new Date(year, month, day);
      }
    }

    // Handle DD/MM/YYYY or DD-MM-YYYY
    if (match.length === 4) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // JavaScript months are 0-indexed
      const year = parseInt(match[3]);
      
      return new Date(year, month, day);
    }

    return null;
  }

  /**
   * Get upcoming deadlines from calendar
   */
  async getUpcomingDeadlines(days: number = 7): Promise<CalendarEvent[]> {
    try {
      const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
      if (!user) throw new Error('Missing IMPERSONATE_USER for Calendar access');

      const ic = await impersonatedClient(user, [
        'https://www.googleapis.com/auth/calendar.readonly'
      ]);

      const calendar = google.calendar({ version: 'v3', auth: ic.auth });

      const now = new Date();
      const future = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

      const response = await calendar.events.list({
        calendarId: this.CALENDAR_ID,
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        q: '🛂 OR 💰 OR 📋 OR 📄 OR ZANTARA' // Filter for our events
      });

      return response.data.items as CalendarEvent[] || [];

    } catch (error: any) {
      console.error('Failed to get upcoming deadlines:', error);
      throw new Error(`Failed to get upcoming deadlines: ${error.message}`);
    }
  }

  /**
   * Process conversation for deadline extraction
   */
  async processConversationForDeadlines(conversationId: string): Promise<string[]> {
    try {
      const messages = await conversationService.getMessages(conversationId);
      const eventIds: string[] = [];

      for (const message of messages) {
        const deadline = this.extractDeadlineFromText(message.text);
        
        if (deadline) {
          const eventId = await this.createDeadlineEvent(deadline);
          eventIds.push(eventId);

          // Add calendar event as artifact to conversation
          await conversationService.addArtifact(conversationId, {
            type: 'calendarEvent',
            title: `Calendar Event: ${deadline.title}`,
            description: `Auto-created calendar event for ${deadline.type} deadline`,
            metadata: {
              eventId,
              priority: deadline.priority
            }
          });

          console.log(`📅 Auto-created calendar event from conversation: ${deadline.title}`);
        }
      }

      return eventIds;

    } catch (error: any) {
      console.error('Failed to process conversation for deadlines:', error);
      throw new Error(`Failed to process conversation for deadlines: ${error.message}`);
    }
  }

  /**
   * Create reminder for collaborator
   */
  async createCollaboratorReminder(
    collaborator: string, 
    title: string, 
    description: string, 
    reminderDate: Date
  ): Promise<string> {
    const deadline: DeadlineEvent = {
      title: `📢 Reminder for ${collaborator}: ${title}`,
      description: `${description}\n\nCreated for: ${collaborator}\nAuto-generated by ZANTARA`,
      dueDate: reminderDate.toISOString(),
      type: 'other',
      priority: 'medium',
      collaborator,
      reminderIntervals: [15, 60, 1440] // 15min, 1h, 1day
    };

    return this.createDeadlineEvent(deadline);
  }
}

export const calendarService = new CalendarService();