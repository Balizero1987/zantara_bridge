import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { uploadTextAsDoc } from './driveUpload';
// import { gmailParserService } from './gmailParser'; // TODO: implement after testing

export class GmailMonitorService {
  private readonly GOV_DOMAINS = [
    'imigrasi.go.id',
    'kemenkumham.go.id', 
    'pajak.go.id',
    'bkpm.go.id',
    'kemendag.go.id',
    'bps.go.id',
    'go.id' // catch-all for government domains
  ];

  /**
   * Monitor Gmail for government emails and auto-save to AMBARADAM
   */
  async monitorGovernmentEmails(userEmail: string = 'zero@balizero.com'): Promise<{
    processed: number;
    saved: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      saved: 0,
      errors: [] as string[]
    };

    try {
      // Get Gmail access
      const ic = await impersonatedClient(userEmail, [
        'https://www.googleapis.com/auth/gmail.readonly'
      ]);
      const gmail = google.gmail({ version: 'v1', auth: ic.auth });

      // Search for government emails from last 24 hours
      const query = this.buildGovEmailQuery();
      console.log('🔍 Searching Gmail with query:', query);

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50
      });

      const messages = response.data.messages || [];
      console.log(`📧 Found ${messages.length} potential government emails`);

      for (const message of messages) {
        try {
          results.processed++;
          
          // Get full message details
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full'
          });

          // Parse government email (simplified for now)
          const parsed = this.parseBasicGovEmail(fullMessage.data);
          if (!parsed) {
            console.log(`⏭️ Skipping non-government email: ${message.id}`);
            continue;
          }

          // Auto-save to AMBARADAM without showing "save" actions to user
          await this.autoSaveGovEmail(parsed);
          results.saved++;

          console.log(`✅ Saved government email: ${parsed.subject} (${parsed.category})`);

        } catch (error: any) {
          console.error('Error processing email:', error);
          results.errors.push(`Email ${message.id}: ${error.message}`);
        }
      }

      return results;

    } catch (error: any) {
      console.error('Gmail monitoring error:', error);
      results.errors.push(`Monitor error: ${error.message}`);
      return results;
    }
  }

  /**
   * Build search query for government emails
   */
  private buildGovEmailQuery(): string {
    const domainQueries = this.GOV_DOMAINS.map(domain => `from:${domain}`).join(' OR ');
    const timeRange = 'newer_than:1d'; // Last 24 hours
    
    return `(${domainQueries}) AND ${timeRange}`;
  }

  /**
   * Auto-save government email to AMBARADAM (silent operation)
   */
  private async autoSaveGovEmail(parsed: any): Promise<void> {
    try {
      // Create comprehensive document
      const content = this.formatGovEmailForSave(parsed);
      
      // Save to Drive with structured filename
      const fileName = `GOV_${parsed.category.toUpperCase()}_${parsed.subject.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}`;
      
      await uploadTextAsDoc(content, fileName, 'BOSS');

      // Also log to Firestore for dashboard tracking
      // TODO: Implement Firestore logging

    } catch (error: any) {
      console.error('Auto-save error:', error);
      throw error;
    }
  }

  /**
   * Format government email for Drive storage
   */
  private formatGovEmailForSave(parsed: any): string {
    return `# GOVERNMENT EMAIL - ${parsed.category.toUpperCase()}

**From:** ${parsed.from}
**Date:** ${parsed.date}
**Subject:** ${parsed.subject}
**Priority:** ${parsed.priority}

## Summary
${parsed.summary}

## Action Items
${parsed.actionItems.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}

## Deadlines
${parsed.deadlines.map((deadline: any) => `- **${deadline.task}** - Due: ${deadline.date} (${deadline.urgency})`).join('\n')}

## Extracted Data
${JSON.stringify(parsed.extractedData, null, 2)}

---

**Original Email Content:**
${parsed.originalContent}

---
*Auto-saved by ZANTARA Government Email Monitor*
*Processed: ${new Date().toISOString()}*`;
  }

  /**
   * Basic government email parser (simplified version)
   */
  private parseBasicGovEmail(messageData: any): any | null {
    try {
      const headers = messageData.payload?.headers || [];
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
      const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');
      
      const fromEmail = fromHeader?.value || '';
      const subject = subjectHeader?.value || '';
      
      // Check if it's from government domain
      const isGovEmail = this.GOV_DOMAINS.some(domain => fromEmail.includes(domain));
      if (!isGovEmail) return null;

      // Get body content
      let body = '';
      if (messageData.payload?.body?.data) {
        body = Buffer.from(messageData.payload.body.data, 'base64').toString();
      } else if (messageData.payload?.parts) {
        for (const part of messageData.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body += Buffer.from(part.body.data, 'base64').toString();
          }
        }
      }

      return {
        id: messageData.id,
        messageId: messageData.id,
        subject: subject,
        from: fromEmail,
        date: new Date(dateHeader?.value || new Date()),
        category: this.detectCategory(fromEmail, subject),
        priority: this.detectPriority(subject, body),
        summary: this.generateSummary(subject, body),
        actionItems: this.extractActionItems(body),
        deadlines: this.extractDeadlines(body),
        extractedData: { messageId: messageData.id, threadId: messageData.threadId },
        originalContent: body
      };
    } catch (error) {
      console.error('Basic parsing error:', error);
      return null;
    }
  }

  private detectCategory(from: string, subject: string): string {
    const lower = (from + ' ' + subject).toLowerCase();
    if (lower.includes('kitas') || lower.includes('immigration') || lower.includes('imigrasi')) return 'kitas';
    if (lower.includes('pajak') || lower.includes('tax') || lower.includes('djp')) return 'tax';
    if (lower.includes('bkpm') || lower.includes('investment')) return 'licensing';
    return 'general';
  }

  private detectPriority(subject: string, body: string): string {
    const content = (subject + ' ' + body).toLowerCase();
    if (content.includes('urgent') || content.includes('segera') || content.includes('deadline')) return 'high';
    if (content.includes('reminder') || content.includes('pengingat')) return 'medium';
    return 'low';
  }

  private generateSummary(subject: string, body: string): string {
    return `Government email: ${subject}. Content length: ${body.length} characters.`;
  }

  private extractActionItems(body: string): string[] {
    // Simple extraction - look for numbered lists or bullet points
    const lines = body.split('\n');
    const actionItems: string[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (/^\d+\./.test(trimmed) || trimmed.startsWith('*') || trimmed.startsWith('-')) {
        actionItems.push(trimmed);
      }
    });
    
    return actionItems.length > 0 ? actionItems : ['Review government email content'];
  }

  private extractDeadlines(body: string): Array<{task: string, date: Date, urgency: string}> {
    // Simple deadline detection
    const deadlines: Array<{task: string, date: Date, urgency: string}> = [];
    
    // Look for date patterns
    const dateMatches = body.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g);
    if (dateMatches) {
      dateMatches.forEach(match => {
        deadlines.push({
          task: 'Respond to government communication',
          date: new Date(match),
          urgency: 'normal'
        });
      });
    }
    
    return deadlines;
  }

  /**
   * Start periodic monitoring (called via cron or scheduler)
   */
  async startPeriodicMonitoring(): Promise<void> {
    console.log('🚀 Starting Gmail government email monitoring...');
    
    try {
      const results = await this.monitorGovernmentEmails();
      console.log(`📊 Monitor results: ${results.processed} processed, ${results.saved} saved, ${results.errors.length} errors`);
      
      if (results.errors.length > 0) {
        console.error('Monitor errors:', results.errors);
      }
    } catch (error: any) {
      console.error('Periodic monitoring failed:', error);
    }
  }
}

export const gmailMonitorService = new GmailMonitorService();