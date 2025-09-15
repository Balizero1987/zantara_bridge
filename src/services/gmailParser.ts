import { google } from 'googleapis';
import { openai } from '../core/openai';
import { uploadTextAsDoc } from './driveUpload';
import { db } from '../core/firestore';
import * as fs from 'fs';

export interface GovEmailPattern {
  domain: string;
  keywords: string[];
  category: 'kitas' | 'immigration' | 'tax' | 'licensing' | 'general';
  priority: 'high' | 'medium' | 'low';
}

export interface ParsedEmail {
  id: string;
  messageId: string;
  subject: string;
  from: string;
  date: Date;
  category: string;
  priority: string;
  summary: string;
  actionItems: string[];
  deadlines: Array<{
    task: string;
    date: Date;
    urgency: 'urgent' | 'normal';
  }>;
  extractedData: Record<string, any>;
  originalContent: string;
  userId?: string;
}

class GmailParserService {
  private readonly GOV_EMAIL_PATTERNS: GovEmailPattern[] = [
    // Immigration/KITAS related
    {
      domain: 'imigrasi.go.id',
      keywords: ['kitas', 'visa', 'permit', 'immigration', 'residence'],
      category: 'kitas',
      priority: 'high'
    },
    {
      domain: 'kemenkumham.go.id',
      keywords: ['kitas', 'kitap', 'foreign', 'residence', 'permit'],
      category: 'kitas',
      priority: 'high'
    },
    // Tax related
    {
      domain: 'pajak.go.id',
      keywords: ['pajak', 'tax', 'npwp', 'spt', 'pph', 'ppn'],
      category: 'tax',
      priority: 'high'
    },
    {
      domain: 'kemenkeu.go.id',
      keywords: ['tax', 'customs', 'bea cukai', 'tariff'],
      category: 'tax',
      priority: 'medium'
    },
    // Investment/Business
    {
      domain: 'bkpm.go.id',
      keywords: ['investment', 'pt pma', 'license', 'business permit'],
      category: 'licensing',
      priority: 'high'
    },
    {
      domain: 'oss.go.id',
      keywords: ['business license', 'nib', 'oss', 'permit'],
      category: 'licensing',
      priority: 'medium'
    },
    // General government
    {
      domain: 'go.id',
      keywords: ['government', 'official', 'notification', 'regulation'],
      category: 'general',
      priority: 'medium'
    }
  ];

  async monitorGmailInbox(userEmail: string, maxResults: number = 50): Promise<ParsedEmail[]> {
    try {
      const gmail = await this.getGmailClient();
      
      // Search for emails from government domains
      const query = this.buildGovEmailQuery();
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults
      });

      const messages = response.data.messages || [];
      const parsedEmails: ParsedEmail[] = [];

      for (const message of messages) {
        try {
          const email = await this.parseEmail(gmail, message.id!, userEmail);
          if (email) {
            parsedEmails.push(email);
            
            // Store in Firestore
            await this.storeEmail(email);
            
            // Save to Drive if important
            if (email.priority === 'high') {
              await this.saveToDrive(email, userEmail);
            }
          }
        } catch (error) {
          console.error(`Failed to parse email ${message.id}:`, error);
        }
      }

      return parsedEmails;

    } catch (error) {
      console.error('Gmail monitoring failed:', error);
      throw error;
    }
  }

  private async getGmailClient() {
    const { impersonatedClient } = await import('../google');
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    if (!user) {
      throw new Error('Missing IMPERSONATE_USER for Gmail access');
    }

    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ]);

    return google.gmail({ version: 'v1', auth: ic.auth });
  }

  private buildGovEmailQuery(): string {
    const domains = this.GOV_EMAIL_PATTERNS.map(p => `from:${p.domain}`).join(' OR ');
    return `(${domains}) newer_than:7d`;
  }

  private async parseEmail(gmail: any, messageId: string, userId: string): Promise<ParsedEmail | null> {
    try {
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const headers = message.data.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const date = new Date(headers.find((h: any) => h.name === 'Date')?.value || '');

      // Extract email body
      const body = this.extractEmailBody(message.data.payload);
      
      // Determine category and priority
      const { category, priority } = this.categorizeEmail(from, subject, body);

      // Use AI to parse content
      const aiAnalysis = await this.analyzeEmailWithAI(subject, body, from);

      const parsedEmail: ParsedEmail = {
        id: Math.random().toString(36),
        messageId,
        subject,
        from,
        date,
        category,
        priority,
        summary: aiAnalysis.summary,
        actionItems: aiAnalysis.actionItems,
        deadlines: aiAnalysis.deadlines,
        extractedData: aiAnalysis.extractedData,
        originalContent: body,
        userId
      };

      return parsedEmail;

    } catch (error) {
      console.error('Email parsing failed:', error);
      return null;
    }
  }

  private extractEmailBody(payload: any): string {
    let body = '';

    if (payload.body && payload.body.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    return body;
  }

  private categorizeEmail(from: string, subject: string, body: string): { category: string; priority: string } {
    const content = `${from} ${subject} ${body}`.toLowerCase();
    
    for (const pattern of this.GOV_EMAIL_PATTERNS) {
      if (from.includes(pattern.domain) || 
          pattern.keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
        return { category: pattern.category, priority: pattern.priority };
      }
    }

    return { category: 'general', priority: 'low' };
  }

  private async analyzeEmailWithAI(subject: string, body: string, from: string): Promise<{
    summary: string;
    actionItems: string[];
    deadlines: Array<{ task: string; date: Date; urgency: 'urgent' | 'normal' }>;
    extractedData: Record<string, any>;
  }> {
    try {
      const prompt = `Analyze this Indonesian government email and extract key information:

FROM: ${from}
SUBJECT: ${subject}
BODY: ${body}

Please provide a JSON response with:
1. summary - Brief summary of the email content
2. actionItems - Array of specific actions required
3. deadlines - Array of objects with task, date, and urgency
4. extractedData - Important data like reference numbers, amounts, etc.

Focus on compliance-related information for KITAS, PT PMA, taxes, and business permits.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert at analyzing Indonesian government emails for compliance purposes. Extract key information and deadlines accurately.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || '{}';
      
      try {
        const parsed = JSON.parse(content);
        
        // Convert date strings to Date objects
        if (parsed.deadlines) {
          parsed.deadlines = parsed.deadlines.map((d: any) => ({
            ...d,
            date: new Date(d.date)
          }));
        }

        return {
          summary: parsed.summary || 'Unable to generate summary',
          actionItems: parsed.actionItems || [],
          deadlines: parsed.deadlines || [],
          extractedData: parsed.extractedData || {}
        };
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        return {
          summary: 'Email analysis failed',
          actionItems: [],
          deadlines: [],
          extractedData: {}
        };
      }

    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        summary: 'AI analysis unavailable',
        actionItems: [],
        deadlines: [],
        extractedData: {}
      };
    }
  }

  private async storeEmail(email: ParsedEmail): Promise<void> {
    try {
      await db.collection('govEmails').doc(email.id).set({
        ...email,
        createdAt: new Date(),
        processed: true
      });
    } catch (error) {
      console.error('Failed to store email:', error);
    }
  }

  private async saveToDrive(email: ParsedEmail, userId: string): Promise<void> {
    try {
      const content = `GOVERNMENT EMAIL ANALYSIS

FROM: ${email.from}
SUBJECT: ${email.subject}
DATE: ${email.date.toISOString()}
CATEGORY: ${email.category}
PRIORITY: ${email.priority}

SUMMARY:
${email.summary}

ACTION ITEMS:
${email.actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

DEADLINES:
${email.deadlines.map(d => `- ${d.task}: ${d.date.toLocaleDateString()} (${d.urgency})`).join('\n')}

EXTRACTED DATA:
${Object.entries(email.extractedData).map(([k, v]) => `${k}: ${v}`).join('\n')}

ORIGINAL CONTENT:
${email.originalContent}

---
Processed by ZANTARA at ${new Date().toISOString()}`;

      const title = `GovEmail_${email.category}_${email.date.toISOString().slice(0, 10)}`;
      
      await uploadTextAsDoc(content, title, userId);
      
    } catch (error) {
      console.error('Failed to save email to Drive:', error);
    }
  }

  async getRecentGovEmails(userId: string, category?: string, limit: number = 20): Promise<ParsedEmail[]> {
    try {
      let query = db.collection('govEmails')
        .where('userId', '==', userId)
        .orderBy('date', 'desc')
        .limit(limit);

      if (category) {
        query = query.where('category', '==', category);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => doc.data() as ParsedEmail);

    } catch (error) {
      console.error('Failed to get recent emails:', error);
      return [];
    }
  }

  async getUpcomingDeadlines(userId: string, days: number = 30): Promise<Array<{
    task: string;
    date: Date;
    urgency: string;
    emailId: string;
    category: string;
  }>> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const snapshot = await db.collection('govEmails')
        .where('userId', '==', userId)
        .where('processed', '==', true)
        .get();

      const deadlines: Array<{
        task: string;
        date: Date;
        urgency: string;
        emailId: string;
        category: string;
      }> = [];

      snapshot.docs.forEach(doc => {
        const email = doc.data() as ParsedEmail;
        
        email.deadlines?.forEach(deadline => {
          if (deadline.date <= futureDate && deadline.date >= new Date()) {
            deadlines.push({
              task: deadline.task,
              date: deadline.date,
              urgency: deadline.urgency,
              emailId: email.id,
              category: email.category
            });
          }
        });
      });

      return deadlines.sort((a, b) => a.date.getTime() - b.date.getTime());

    } catch (error) {
      console.error('Failed to get upcoming deadlines:', error);
      return [];
    }
  }

  async markEmailProcessed(emailId: string): Promise<boolean> {
    try {
      await db.collection('govEmails').doc(emailId).update({
        processed: true,
        processedAt: new Date()
      });
      return true;
    } catch (error) {
      console.error('Failed to mark email as processed:', error);
      return false;
    }
  }
}

export const gmailParserService = new GmailParserService();