import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { uploadNoteToAmbaradam } from '../services/appsScriptDrive';

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ body?: { data?: string }; mimeType?: string }>;
  };
  internalDate: string;
}

interface ProcessedEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedDate: string;
  agency: 'DitjenImigrasi' | 'DJP' | 'BKPM' | 'Other';
  priority: 'high' | 'medium' | 'low';
  keywords: string[];
}

export class GmailMonitorService {
  private readonly GOVERNMENT_DOMAINS = [
    // DitjenImigrasi
    'imigrasi.go.id',
    'kemenkumham.go.id',
    'immigration.go.id',
    
    // DJP (Direktorat Jenderal Pajak)
    'pajak.go.id',
    'kemenkeu.go.id',
    'dgthq.go.id',
    
    // BKPM (Badan Koordinasi Penanaman Modal)
    'bkpm.go.id',
    'investindonesia.go.id',
    'oss.go.id',
    
    // Other government agencies
    'go.id'
  ];

  private readonly PRIORITY_KEYWORDS = {
    high: [
      'urgent', 'segera', 'penting', 'deadline', 'expired', 'kadaluarsa',
      'peringatan', 'warning', 'notice', 'pemberitahuan', 'sanksi', 'penalty',
      'deportasi', 'deportation', 'overstay', 'illegal', 'violation'
    ],
    medium: [
      'perpanjangan', 'renewal', 'extension', 'pembaruan', 'update',
      'verifikasi', 'verification', 'konfirmasi', 'confirmation',
      'dokumen', 'document', 'berkas', 'aplikasi', 'application'
    ]
  };

  private readonly AGENCY_KEYWORDS = {
    DitjenImigrasi: ['visa', 'kitas', 'kitap', 'voa', 'immigration', 'imigrasi', 'passport', 'paspor'],
    DJP: ['pajak', 'tax', 'npwp', 'pph', 'ppn', 'spt', 'laporan', 'billing'],
    BKPM: ['investasi', 'investment', 'oss', 'nib', 'perizinan', 'license', 'modal']
  };

  /**
   * Monitor Gmail for government emails
   */
  async monitorGovernmentEmails(): Promise<ProcessedEmail[]> {
    try {
      const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
      if (!user) throw new Error('Missing IMPERSONATE_USER for Gmail access');

      const ic = await impersonatedClient(user, [
        'https://www.googleapis.com/auth/gmail.readonly'
      ]);

      const gmail = google.gmail({ version: 'v1', auth: ic.auth });

      // Build query for government domains
      const domainQueries = this.GOVERNMENT_DOMAINS.map(domain => `from:${domain}`);
      const query = `(${domainQueries.join(' OR ')}) newer_than:1d`;

      console.log(`🔍 Gmail query: ${query}`);

      // Search for recent government emails
      const searchResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50
      });

      if (!searchResponse.data.messages || searchResponse.data.messages.length === 0) {
        console.log('📭 No recent government emails found');
        return [];
      }

      console.log(`📧 Found ${searchResponse.data.messages.length} government emails`);

      // Process each message
      const processedEmails = [];
      for (const message of searchResponse.data.messages.slice(0, 10)) { // Limit to 10 most recent
        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full'
          });

          const processed = this.processGmailMessage(fullMessage.data as GmailMessage);
          if (processed) {
            processedEmails.push(processed);
            
            // Auto-save to AMBARADAM
            await this.saveToAmbaradam(processed);
          }
        } catch (error) {
          console.error(`Failed to process message ${message.id}:`, error);
        }
      }

      return processedEmails;

    } catch (error: any) {
      console.error('Gmail monitoring error:', error);
      throw new Error(`Failed to monitor Gmail: ${error.message}`);
    }
  }

  /**
   * Process Gmail message and extract relevant information
   */
  private processGmailMessage(message: GmailMessage): ProcessedEmail | null {
    try {
      const headers = message.payload.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('From');
      const to = getHeader('To');
      const subject = getHeader('Subject');
      const receivedDate = new Date(parseInt(message.internalDate)).toISOString();

      // Extract body text
      let body = this.extractBody(message.payload);
      
      // Clean up body
      body = body.replace(/<[^>]*>/g, ''); // Remove HTML tags
      body = body.replace(/\s+/g, ' ').trim(); // Normalize whitespace

      if (body.length > 5000) {
        body = body.substring(0, 5000) + '... [truncated]';
      }

      // Determine agency
      const agency = this.determineAgency(from, subject, body);
      
      // Determine priority
      const priority = this.determinePriority(subject, body);
      
      // Extract keywords
      const keywords = this.extractKeywords(subject, body, agency);

      return {
        messageId: message.id,
        from,
        to,
        subject,
        body,
        receivedDate,
        agency,
        priority,
        keywords
      };

    } catch (error) {
      console.error('Error processing Gmail message:', error);
      return null;
    }
  }

  /**
   * Extract body text from Gmail message payload
   */
  private extractBody(payload: any): string {
    let body = '';

    // Try direct body
    if (payload.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    // Try parts
    if (!body && payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf8');
          break;
        }
      }
      
      // Fallback to HTML
      if (!body) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/html' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf8');
            break;
          }
        }
      }
    }

    return body;
  }

  /**
   * Determine which agency sent the email
   */
  private determineAgency(from: string, subject: string, body: string): ProcessedEmail['agency'] {
    const text = `${from} ${subject} ${body}`.toLowerCase();

    for (const [agency, keywords] of Object.entries(this.AGENCY_KEYWORDS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return agency as ProcessedEmail['agency'];
      }
    }

    return 'Other';
  }

  /**
   * Determine email priority based on content
   */
  private determinePriority(subject: string, body: string): ProcessedEmail['priority'] {
    const text = `${subject} ${body}`.toLowerCase();

    if (this.PRIORITY_KEYWORDS.high.some(keyword => text.includes(keyword))) {
      return 'high';
    }

    if (this.PRIORITY_KEYWORDS.medium.some(keyword => text.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Extract relevant keywords from email
   */
  private extractKeywords(subject: string, body: string, agency: ProcessedEmail['agency']): string[] {
    const text = `${subject} ${body}`.toLowerCase();
    const keywords: string[] = [];

    // Add agency-specific keywords
    const agencyKeywords = this.AGENCY_KEYWORDS[agency] || [];
    keywords.push(...agencyKeywords.filter(keyword => text.includes(keyword)));

    // Add priority keywords
    keywords.push(...this.PRIORITY_KEYWORDS.high.filter(keyword => text.includes(keyword)));
    keywords.push(...this.PRIORITY_KEYWORDS.medium.filter(keyword => text.includes(keyword)));

    // Remove duplicates
    return [...new Set(keywords)];
  }

  /**
   * Save processed email to AMBARADAM
   */
  private async saveToAmbaradam(email: ProcessedEmail): Promise<void> {
    try {
      const priorityEmoji = email.priority === 'high' ? '🚨' : email.priority === 'medium' ? '⚠️' : '📋';
      const agencyEmoji = {
        'DitjenImigrasi': '🛂',
        'DJP': '💰', 
        'BKPM': '🏢',
        'Other': '📧'
      };

      const document = `${priorityEmoji} ${agencyEmoji[email.agency]} EMAIL GOVERNATIVO - ${email.agency.toUpperCase()}
===============================================
Data: ${new Date(email.receivedDate).toLocaleDateString('id-ID', { 
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
})}
Priorità: ${email.priority.toUpperCase()}
Keywords: ${email.keywords.join(', ') || 'None'}

MITTENTE: ${email.from}
DESTINATARIO: ${email.to}
OGGETTO: ${email.subject}

CONTENUTO:
${email.body}

---
Auto-saved by ZANTARA Gmail Monitor
Message ID: ${email.messageId}
Processed: ${new Date().toISOString()}`;

      const result = await uploadNoteToAmbaradam({
        owner: 'GOVERNMENT_EMAILS',
        text: document,
        title: `${email.agency} - ${email.subject.substring(0, 50)}${email.subject.length > 50 ? '...' : ''}`
      });

      if (result.ok) {
        console.log(`✅ Email saved to AMBARADAM: ${email.agency} - ${email.priority} priority`);
      } else {
        console.error('❌ Failed to save email to AMBARADAM:', result.error);
      }

    } catch (error) {
      console.error('Error saving email to AMBARADAM:', error);
    }
  }

  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(): Promise<{
    totalEmails: number;
    byAgency: Record<string, number>;
    byPriority: Record<string, number>;
    lastCheck: string;
  }> {
    // TODO: Implement stats tracking in Firestore
    return {
      totalEmails: 0,
      byAgency: {},
      byPriority: {},
      lastCheck: new Date().toISOString()
    };
  }
}

export const gmailMonitorService = new GmailMonitorService();