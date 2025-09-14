import type { Router, Request, Response } from 'express';
import { uploadTextAsDoc } from '../../services/driveUpload';

interface NotificationConfig {
  webhookUrl?: string;
  emailNotifications: boolean;
  slackIntegration?: string;
  events: string[];
  teamMembers: string[];
}

interface TeamNotification {
  id: string;
  type: 'document_created' | 'team_mention' | 'task_assigned' | 'deadline_reminder' | 'collaboration_request';
  message: string;
  data: any;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recipients: string[];
}

// In-memory storage (in production, use database)
let notificationConfigs: Map<string, NotificationConfig> = new Map();
let notificationHistory: TeamNotification[] = [];

export default function registerTeamNotifications(r: Router) {
  
  // Setup team notifications
  r.post('/api/team/notifications/setup', async (req: Request, res: Response) => {
    try {
      const {
        teamId = 'bali-zero',
        webhookUrl,
        emailNotifications = true,
        slackIntegration,
        events = ['document_created', 'team_mention', 'task_assigned'],
        teamMembers = []
      } = req.body;
      
      const config: NotificationConfig = {
        webhookUrl,
        emailNotifications,
        slackIntegration,
        events,
        teamMembers
      };
      
      notificationConfigs.set(teamId, config);
      
      // Create notification log document
      const setupDoc = await uploadTextAsDoc(
        `# Team Notifications Setup - ${teamId.toUpperCase()}

**Setup Date**: ${new Date().toISOString()}
**Configuration**:
- Email Notifications: ${emailNotifications ? 'Enabled' : 'Disabled'}
- Webhook URL: ${webhookUrl || 'Not configured'}
- Slack Integration: ${slackIntegration || 'Not configured'}

**Event Types**:
${events.map(event => `- ${event}`).join('\n')}

**Team Members**:
${teamMembers.map(member => `- ${member}`).join('\n')}

**Status**: Active
        `,
        `Team_Notifications_Config_${teamId}`,
        'SHARED_ADMIN'
      );
      
      res.json({
        success: true,
        message: 'Team notifications configured successfully',
        config: config,
        setupDocument: setupDoc.webViewLink
      });
      
    } catch (error: any) {
      console.error('Notification setup error:', error);
      res.status(500).json({ 
        error: 'Failed to setup team notifications',
        details: error.message 
      });
    }
  });
  
  // Send notification
  r.post('/api/team/notifications/send', async (req: Request, res: Response) => {
    try {
      const {
        teamId = 'bali-zero',
        type,
        message,
        data = {},
        priority = 'medium',
        recipients = []
      } = req.body;
      
      if (!type || !message) {
        return res.status(400).json({ error: 'Type and message required' });
      }
      
      const notification: TeamNotification = {
        id: generateNotificationId(),
        type,
        message,
        data,
        timestamp: new Date().toISOString(),
        priority,
        recipients
      };
      
      // Store notification
      notificationHistory.push(notification);
      
      // Get team config
      const config = notificationConfigs.get(teamId);
      
      const results = {
        notificationId: notification.id,
        sent: [],
        failed: []
      };
      
      // Send webhook if configured
      if (config?.webhookUrl && config.events.includes(type)) {
        try {
          const webhookPayload = {
            team: teamId,
            notification: notification,
            timestamp: new Date().toISOString()
          };
          
          // In real implementation, send HTTP POST to webhook URL
          console.log('📧 Webhook payload:', JSON.stringify(webhookPayload, null, 2));
          results.sent.push({ method: 'webhook', status: 'sent' });
        } catch (error) {
          console.error('Webhook send failed:', error);
          results.failed.push({ method: 'webhook', error: error.message });
        }
      }
      
      // Send team mentions
      if (type === 'team_mention' || recipients.length > 0) {
        const mentions = recipients.length > 0 ? recipients : config?.teamMembers || [];
        
        for (const member of mentions) {
          try {
            // In real implementation, send email/push notification
            console.log(`📱 Notifying ${member}: ${message}`);
            results.sent.push({ method: 'mention', recipient: member, status: 'sent' });
          } catch (error) {
            console.error(`Failed to notify ${member}:`, error);
            results.failed.push({ method: 'mention', recipient: member, error: error.message });
          }
        }
      }
      
      // Log notification to Drive
      if (priority === 'high' || priority === 'urgent') {
        try {
          const logContent = `# ${priority.toUpperCase()} Priority Notification

**Type**: ${type}
**Message**: ${message}
**Timestamp**: ${notification.timestamp}
**Priority**: ${priority}
**Recipients**: ${recipients.join(', ') || 'All team members'}

**Data**:
${JSON.stringify(data, null, 2)}

**Delivery Status**:
- Sent: ${results.sent.length}
- Failed: ${results.failed.length}
          `;
          
          await uploadTextAsDoc(
            logContent,
            `Notification_${priority}_${notification.id}`,
            'SHARED_NOTIFICATIONS'
          );
        } catch (error) {
          console.error('Failed to log notification:', error);
        }
      }
      
      res.json({
        success: true,
        message: 'Notification sent',
        notification: notification,
        results: results
      });
      
    } catch (error: any) {
      console.error('Send notification error:', error);
      res.status(500).json({ 
        error: 'Failed to send notification',
        details: error.message 
      });
    }
  });
  
  // Get notification history
  r.get('/api/team/notifications/history', async (req: Request, res: Response) => {
    try {
      const { 
        teamId = 'bali-zero',
        limit = 50,
        type,
        priority,
        since
      } = req.query;
      
      let filtered = [...notificationHistory];
      
      // Apply filters
      if (type) {
        filtered = filtered.filter(n => n.type === type);
      }
      
      if (priority) {
        filtered = filtered.filter(n => n.priority === priority);
      }
      
      if (since) {
        const sinceDate = new Date(since as string);
        filtered = filtered.filter(n => new Date(n.timestamp) >= sinceDate);
      }
      
      // Sort by timestamp (newest first)
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Limit results
      const limited = filtered.slice(0, parseInt(limit as string));
      
      res.json({
        success: true,
        notifications: limited,
        total: filtered.length,
        filters: { type, priority, since, limit }
      });
      
    } catch (error: any) {
      console.error('Notification history error:', error);
      res.status(500).json({ 
        error: 'Failed to get notification history',
        details: error.message 
      });
    }
  });
  
  // Team activity webhook endpoint
  r.post('/api/team/notifications/webhook', async (req: Request, res: Response) => {
    try {
      const { 
        action,
        document,
        user,
        timestamp = new Date().toISOString()
      } = req.body;
      
      // Auto-generate notifications based on actions
      let notificationType: TeamNotification['type'] = 'document_created';
      let message = '';
      let priority: TeamNotification['priority'] = 'medium';
      
      switch (action) {
        case 'document_created':
          notificationType = 'document_created';
          message = `📄 New document created: "${document.name}" by ${user}`;
          priority = 'low';
          break;
          
        case 'urgent_task':
          notificationType = 'task_assigned';
          message = `🚨 Urgent task assigned: ${document.name}`;
          priority = 'urgent';
          break;
          
        case 'deadline_approaching':
          notificationType = 'deadline_reminder';
          message = `⏰ Deadline approaching: ${document.name} due soon`;
          priority = 'high';
          break;
          
        case 'collaboration_request':
          notificationType = 'collaboration_request';
          message = `🤝 Collaboration requested on: ${document.name}`;
          priority = 'medium';
          break;
          
        default:
          message = `Team activity: ${action} by ${user}`;
      }
      
      // Create and send notification
      const notification: TeamNotification = {
        id: generateNotificationId(),
        type: notificationType,
        message,
        data: { action, document, user, timestamp },
        timestamp,
        priority,
        recipients: []
      };
      
      notificationHistory.push(notification);
      
      res.json({
        success: true,
        message: 'Webhook processed',
        notification: notification
      });
      
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ 
        error: 'Failed to process webhook',
        details: error.message 
      });
    }
  });
  
  // Get team activity summary
  r.get('/api/team/notifications/summary', async (req: Request, res: Response) => {
    try {
      const { teamId = 'bali-zero' } = req.query;
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
      
      const todayNotifications = notificationHistory.filter(n => 
        new Date(n.timestamp) >= today
      );
      
      const weekNotifications = notificationHistory.filter(n => 
        new Date(n.timestamp) >= thisWeek
      );
      
      const summary = {
        today: {
          total: todayNotifications.length,
          byType: groupByType(todayNotifications),
          byPriority: groupByPriority(todayNotifications)
        },
        thisWeek: {
          total: weekNotifications.length,
          byType: groupByType(weekNotifications),
          byPriority: groupByPriority(weekNotifications)
        },
        recent: notificationHistory
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5)
          .map(n => ({
            type: n.type,
            message: n.message,
            priority: n.priority,
            timestamp: n.timestamp
          }))
      };
      
      res.json({
        success: true,
        teamId,
        summary
      });
      
    } catch (error: any) {
      console.error('Summary error:', error);
      res.status(500).json({ 
        error: 'Failed to get activity summary',
        details: error.message 
      });
    }
  });
}

// Helper functions
function generateNotificationId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function groupByType(notifications: TeamNotification[]): Record<string, number> {
  return notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function groupByPriority(notifications: TeamNotification[]): Record<string, number> {
  return notifications.reduce((acc, n) => {
    acc[n.priority] = (acc[n.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}