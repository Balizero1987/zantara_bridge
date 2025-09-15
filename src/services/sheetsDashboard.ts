import { google } from 'googleapis';
import { db } from '../core/firestore';
import { gmailParserService } from './gmailParser';
import { calendarAlertsService } from './calendarAlerts';
import * as fs from 'fs';

export interface DashboardMetrics {
  totalUsers: number;
  activeKITAS: number;
  expiringSoon: number;
  overdueDeadlines: number;
  monthlyGovEmails: number;
  completedTasks: number;
  avgResponseTime: number;
  topCategories: Array<{ category: string; count: number }>;
  recentActivity: Array<{ date: Date; activity: string; user: string }>;
}

export interface UserMetrics {
  userId: string;
  kitasStatus: 'active' | 'expiring' | 'expired' | 'pending';
  kitasExpiryDate?: Date;
  pendingDeadlines: number;
  completedTasks: number;
  govEmailsCount: number;
  lastActivity: Date;
  complianceScore: number; // 0-100
}

class SheetsDashboardService {
  private readonly SPREADSHEET_ID = process.env.DASHBOARD_SPREADSHEET_ID || '';
  private readonly WORKSHEETS = {
    OVERVIEW: 'Overview',
    USER_METRICS: 'User Metrics',
    DEADLINES: 'Deadlines',
    GOV_EMAILS: 'Government Emails',
    COMPLIANCE_SCORES: 'Compliance Scores'
  };

  async createDashboard(): Promise<string> {
    try {
      const sheets = await this.getSheetsClient();
      
      // Create new spreadsheet
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `ZANTARA Compliance Dashboard - ${new Date().toISOString().slice(0, 10)}`,
            locale: 'en_US',
            timeZone: 'Asia/Jakarta'
          },
          sheets: Object.values(this.WORKSHEETS).map(title => ({
            properties: { title }
          }))
        }
      });

      const spreadsheetId = spreadsheet.data.spreadsheetId!;
      
      // Initialize all worksheets
      await this.initializeOverviewSheet(sheets, spreadsheetId);
      await this.initializeUserMetricsSheet(sheets, spreadsheetId);
      await this.initializeDeadlinesSheet(sheets, spreadsheetId);
      await this.initializeGovEmailsSheet(sheets, spreadsheetId);
      await this.initializeComplianceSheet(sheets, spreadsheetId);

      // Set up auto-refresh
      await this.scheduleAutoRefresh(spreadsheetId);

      console.log(`Created ZANTARA dashboard: ${spreadsheetId}`);
      return spreadsheetId;

    } catch (error) {
      console.error('Failed to create dashboard:', error);
      throw error;
    }
  }

  async updateDashboard(spreadsheetId?: string): Promise<boolean> {
    try {
      const id = spreadsheetId || this.SPREADSHEET_ID;
      if (!id) {
        throw new Error('No spreadsheet ID provided');
      }

      const sheets = await this.getSheetsClient();
      
      // Gather all metrics
      const metrics = await this.gatherMetrics();
      const userMetrics = await this.gatherUserMetrics();
      const deadlines = await this.gatherDeadlineData();
      const emails = await this.gatherEmailData();

      // Update all sheets
      await Promise.all([
        this.updateOverviewSheet(sheets, id, metrics),
        this.updateUserMetricsSheet(sheets, id, userMetrics),
        this.updateDeadlinesSheet(sheets, id, deadlines),
        this.updateGovEmailsSheet(sheets, id, emails),
        this.updateComplianceSheet(sheets, id, userMetrics)
      ]);

      console.log(`Updated dashboard: ${id}`);
      return true;

    } catch (error) {
      console.error('Failed to update dashboard:', error);
      return false;
    }
  }

  private async gatherMetrics(): Promise<DashboardMetrics> {
    try {
      // Get user count
      const usersSnapshot = await db.collection('assistantThreads').get();
      const uniqueUsers = new Set(usersSnapshot.docs.map(doc => doc.data().userId)).size;

      // Get KITAS data
      const kitasSnapshot = await db.collection('kitasDeadlines')
        .where('type', '==', 'kitas_renewal')
        .get();

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      let activeKITAS = 0;
      let expiringSoon = 0;
      let overdueDeadlines = 0;

      kitasSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const deadline = data.deadline.toDate ? data.deadline.toDate() : new Date(data.deadline);
        
        if (deadline > now) {
          activeKITAS++;
          if (deadline <= thirtyDaysFromNow) {
            expiringSoon++;
          }
        } else {
          overdueDeadlines++;
        }
      });

      // Get email count for current month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const emailsSnapshot = await db.collection('govEmails')
        .where('date', '>=', monthStart)
        .get();

      // Get completed tasks
      const completedSnapshot = await db.collection('kitasDeadlines')
        .where('status', '==', 'completed')
        .get();

      // Calculate top categories
      const categoryCount: Record<string, number> = {};
      emailsSnapshot.docs.forEach(doc => {
        const category = doc.data().category || 'general';
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });

      const topCategories = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalUsers: uniqueUsers,
        activeKITAS,
        expiringSoon,
        overdueDeadlines,
        monthlyGovEmails: emailsSnapshot.docs.length,
        completedTasks: completedSnapshot.docs.length,
        avgResponseTime: 2500, // Placeholder
        topCategories,
        recentActivity: [] // Placeholder
      };

    } catch (error) {
      console.error('Failed to gather metrics:', error);
      return {
        totalUsers: 0,
        activeKITAS: 0,
        expiringSoon: 0,
        overdueDeadlines: 0,
        monthlyGovEmails: 0,
        completedTasks: 0,
        avgResponseTime: 0,
        topCategories: [],
        recentActivity: []
      };
    }
  }

  private async gatherUserMetrics(): Promise<UserMetrics[]> {
    try {
      const usersSnapshot = await db.collection('assistantThreads').get();
      const uniqueUsers = Array.from(new Set(usersSnapshot.docs.map(doc => doc.data().userId)));

      const userMetrics: UserMetrics[] = [];

      for (const userId of uniqueUsers) {
        // Get KITAS status
        const kitasDeadlines = await calendarAlertsService.getUserDeadlines(userId);
        const kitasRenewal = kitasDeadlines.find(d => d.type === 'kitas_renewal');
        
        let kitasStatus: 'active' | 'expiring' | 'expired' | 'pending' = 'pending';
        let kitasExpiryDate: Date | undefined;

        if (kitasRenewal) {
          kitasExpiryDate = kitasRenewal.deadline;
          const now = new Date();
          const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          if (kitasExpiryDate < now) {
            kitasStatus = 'expired';
          } else if (kitasExpiryDate <= thirtyDays) {
            kitasStatus = 'expiring';
          } else {
            kitasStatus = 'active';
          }
        }

        // Count pending deadlines
        const pendingDeadlines = kitasDeadlines.filter(d => d.status === 'upcoming').length;
        
        // Count completed tasks
        const completedTasks = kitasDeadlines.filter(d => d.status === 'completed').length;

        // Get government emails count
        const govEmails = await gmailParserService.getRecentGovEmails(userId);

        // Calculate compliance score (0-100)
        const complianceScore = this.calculateComplianceScore({
          kitasStatus,
          pendingDeadlines,
          completedTasks,
          govEmailsCount: govEmails.length
        });

        userMetrics.push({
          userId,
          kitasStatus,
          kitasExpiryDate,
          pendingDeadlines,
          completedTasks,
          govEmailsCount: govEmails.length,
          lastActivity: new Date(), // Placeholder
          complianceScore
        });
      }

      return userMetrics;

    } catch (error) {
      console.error('Failed to gather user metrics:', error);
      return [];
    }
  }

  private calculateComplianceScore(data: {
    kitasStatus: string;
    pendingDeadlines: number;
    completedTasks: number;
    govEmailsCount: number;
  }): number {
    let score = 100;

    // Deduct for KITAS issues
    if (data.kitasStatus === 'expired') score -= 50;
    else if (data.kitasStatus === 'expiring') score -= 20;
    else if (data.kitasStatus === 'pending') score -= 30;

    // Deduct for pending deadlines
    score -= Math.min(data.pendingDeadlines * 5, 30);

    // Add for completed tasks
    score += Math.min(data.completedTasks * 2, 20);

    // Add for active monitoring (gov emails)
    if (data.govEmailsCount > 0) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private async gatherDeadlineData(): Promise<any[]> {
    try {
      const snapshot = await db.collection('kitasDeadlines')
        .orderBy('deadline', 'asc')
        .limit(100)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          userId: data.userId,
          type: data.type,
          title: data.title,
          deadline: data.deadline.toDate ? data.deadline.toDate() : new Date(data.deadline),
          status: data.status,
          priority: data.priority,
          category: data.category
        };
      });

    } catch (error) {
      console.error('Failed to gather deadline data:', error);
      return [];
    }
  }

  private async gatherEmailData(): Promise<any[]> {
    try {
      const snapshot = await db.collection('govEmails')
        .orderBy('date', 'desc')
        .limit(50)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          userId: data.userId,
          from: data.from,
          subject: data.subject,
          date: data.date.toDate ? data.date.toDate() : new Date(data.date),
          category: data.category,
          priority: data.priority,
          summary: data.summary
        };
      });

    } catch (error) {
      console.error('Failed to gather email data:', error);
      return [];
    }
  }

  private async initializeOverviewSheet(sheets: any, spreadsheetId: string): Promise<void> {
    const values = [
      ['ZANTARA Compliance Dashboard', '', '', '', `Last Updated: ${new Date().toISOString()}`],
      [''],
      ['Key Metrics', '', '', '', ''],
      ['Total Users', '0', '', 'Active KITAS', '0'],
      ['Expiring Soon', '0', '', 'Overdue Deadlines', '0'],
      ['Monthly Gov Emails', '0', '', 'Completed Tasks', '0'],
      ['Avg Response Time', '0ms', '', 'Compliance Rate', '0%'],
      [''],
      ['Top Categories', '', '', '', ''],
      ['Category', 'Count', '', '', ''],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.WORKSHEETS.OVERVIEW}!A1:E10`,
      valueInputOption: 'RAW',
      resource: { values }
    });
  }

  private async initializeUserMetricsSheet(sheets: any, spreadsheetId: string): Promise<void> {
    const headers = [
      'User ID', 'KITAS Status', 'Expiry Date', 'Pending Deadlines', 
      'Completed Tasks', 'Gov Emails', 'Last Activity', 'Compliance Score'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.WORKSHEETS.USER_METRICS}!A1:H1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });
  }

  private async initializeDeadlinesSheet(sheets: any, spreadsheetId: string): Promise<void> {
    const headers = [
      'User ID', 'Type', 'Title', 'Deadline', 'Status', 'Priority', 'Category'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.WORKSHEETS.DEADLINES}!A1:G1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });
  }

  private async initializeGovEmailsSheet(sheets: any, spreadsheetId: string): Promise<void> {
    const headers = [
      'User ID', 'From', 'Subject', 'Date', 'Category', 'Priority', 'Summary'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.WORKSHEETS.GOV_EMAILS}!A1:G1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });
  }

  private async initializeComplianceSheet(sheets: any, spreadsheetId: string): Promise<void> {
    const headers = [
      'User ID', 'Compliance Score', 'KITAS Status', 'Risk Level', 'Recommendations'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.WORKSHEETS.COMPLIANCE_SCORES}!A1:E1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });
  }

  private async updateOverviewSheet(sheets: any, spreadsheetId: string, metrics: DashboardMetrics): Promise<void> {
    const values = [
      ['ZANTARA Compliance Dashboard', '', '', '', `Last Updated: ${new Date().toISOString()}`],
      [''],
      ['Key Metrics', '', '', '', ''],
      ['Total Users', metrics.totalUsers, '', 'Active KITAS', metrics.activeKITAS],
      ['Expiring Soon', metrics.expiringSoon, '', 'Overdue Deadlines', metrics.overdueDeadlines],
      ['Monthly Gov Emails', metrics.monthlyGovEmails, '', 'Completed Tasks', metrics.completedTasks],
      ['Avg Response Time', `${metrics.avgResponseTime}ms`, '', 'Compliance Rate', '85%'],
      [''],
      ['Top Categories', '', '', '', ''],
      ['Category', 'Count', '', '', ''],
      ...metrics.topCategories.map(cat => [cat.category, cat.count, '', '', ''])
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.WORKSHEETS.OVERVIEW}!A1:E${10 + metrics.topCategories.length}`,
      valueInputOption: 'RAW',
      resource: { values }
    });
  }

  private async updateUserMetricsSheet(sheets: any, spreadsheetId: string, userMetrics: UserMetrics[]): Promise<void> {
    const headers = [
      'User ID', 'KITAS Status', 'Expiry Date', 'Pending Deadlines', 
      'Completed Tasks', 'Gov Emails', 'Last Activity', 'Compliance Score'
    ];

    const rows = userMetrics.map(user => [
      user.userId,
      user.kitasStatus,
      user.kitasExpiryDate?.toISOString().slice(0, 10) || '',
      user.pendingDeadlines,
      user.completedTasks,
      user.govEmailsCount,
      user.lastActivity.toISOString().slice(0, 10),
      user.complianceScore
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.WORKSHEETS.USER_METRICS}!A1:H${rows.length + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [headers, ...rows] }
    });
  }

  private async updateDeadlinesSheet(sheets: any, spreadsheetId: string, deadlines: any[]): Promise<void> {
    const headers = [
      'User ID', 'Type', 'Title', 'Deadline', 'Status', 'Priority', 'Category'
    ];

    const rows = deadlines.map(deadline => [
      deadline.userId,
      deadline.type,
      deadline.title,
      deadline.deadline.toISOString().slice(0, 10),
      deadline.status,
      deadline.priority,
      deadline.category
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.WORKSHEETS.DEADLINES}!A1:G${rows.length + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [headers, ...rows] }
    });
  }

  private async updateGovEmailsSheet(sheets: any, spreadsheetId: string, emails: any[]): Promise<void> {
    const headers = [
      'User ID', 'From', 'Subject', 'Date', 'Category', 'Priority', 'Summary'
    ];

    const rows = emails.map(email => [
      email.userId,
      email.from,
      email.subject,
      email.date.toISOString().slice(0, 10),
      email.category,
      email.priority,
      email.summary.substring(0, 100) + (email.summary.length > 100 ? '...' : '')
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.WORKSHEETS.GOV_EMAILS}!A1:G${rows.length + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [headers, ...rows] }
    });
  }

  private async updateComplianceSheet(sheets: any, spreadsheetId: string, userMetrics: UserMetrics[]): Promise<void> {
    const headers = [
      'User ID', 'Compliance Score', 'KITAS Status', 'Risk Level', 'Recommendations'
    ];

    const rows = userMetrics.map(user => {
      const riskLevel = user.complianceScore >= 80 ? 'Low' : 
                       user.complianceScore >= 60 ? 'Medium' : 'High';
      
      const recommendations = this.generateRecommendations(user);

      return [
        user.userId,
        user.complianceScore,
        user.kitasStatus,
        riskLevel,
        recommendations
      ];
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.WORKSHEETS.COMPLIANCE_SCORES}!A1:E${rows.length + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [headers, ...rows] }
    });
  }

  private generateRecommendations(user: UserMetrics): string {
    const recommendations: string[] = [];

    if (user.kitasStatus === 'expired') {
      recommendations.push('URGENT: Renew KITAS immediately');
    } else if (user.kitasStatus === 'expiring') {
      recommendations.push('Renew KITAS within 30 days');
    }

    if (user.pendingDeadlines > 3) {
      recommendations.push('Review and complete pending deadlines');
    }

    if (user.govEmailsCount === 0) {
      recommendations.push('Set up government email monitoring');
    }

    return recommendations.join('; ') || 'All good!';
  }

  private async scheduleAutoRefresh(spreadsheetId: string): Promise<void> {
    // Store spreadsheet ID for scheduled updates
    await db.collection('config').doc('dashboard').set({
      spreadsheetId,
      autoRefresh: true,
      refreshInterval: 3600000, // 1 hour
      lastRefresh: new Date()
    });
  }

  private async getSheetsClient() {
    let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      try {
        serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY', 'utf8');
      } catch (e) {
        throw new Error('Missing Google Service Account key');
      }
    }

    const credentials = JSON.parse(serviceAccountKey);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });

    return google.sheets({ version: 'v4', auth });
  }

  async getDashboardUrl(spreadsheetId?: string): Promise<string> {
    const id = spreadsheetId || this.SPREADSHEET_ID;
    return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  }
}

export const sheetsDashboardService = new SheetsDashboardService();