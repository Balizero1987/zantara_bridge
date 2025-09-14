import type { Router, Request, Response } from 'express';
import { listDriveFiles, uploadTextAsDoc } from '../../services/driveUpload';

interface TeamMetrics {
  period: string;
  totalDocuments: number;
  totalConversations: number;
  activeMembers: number;
  topCategories: { name: string; count: number }[];
  memberActivity: { member: string; documents: number; conversations: number }[];
  documentTypes: { type: string; count: number }[];
  timeDistribution: { hour: number; activity: number }[];
  collaborationScore: number;
  efficiency: {
    avgResponseTime: number;
    documentsPerDay: number;
    templatesUsed: number;
    knowledgeBaseHits: number;
  };
}

interface ActivityEvent {
  timestamp: string;
  user: string;
  action: 'document_created' | 'conversation_started' | 'template_used' | 'knowledge_accessed' | 'collaboration';
  details: any;
}

// Mock activity data (in production, this would come from actual usage logs)
let activityEvents: ActivityEvent[] = [];

export default function registerTeamAnalytics(r: Router) {
  
  // Get team dashboard overview
  r.get('/api/analytics/dashboard', async (req: Request, res: Response) => {
    try {
      const { 
        period = 'week',
        teamId = 'bali-zero'
      } = req.query;
      
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          break;
        case 'month':
          startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
          break;
        case 'quarter':
          startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
          break;
        default: // week
          startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      }
      
      // Get Drive files for analysis
      const allFiles = await listDriveFiles(undefined, 1000);
      
      // Filter files by period
      const periodFiles = allFiles.filter(file => 
        new Date(file.createdTime) >= startDate
      );
      
      // Analyze activity
      const periodActivity = activityEvents.filter(event => 
        new Date(event.timestamp) >= startDate
      );
      
      const metrics: TeamMetrics = {
        period: period as string,
        totalDocuments: periodFiles.length,
        totalConversations: periodActivity.filter(e => e.action === 'conversation_started').length,
        activeMembers: [...new Set(periodActivity.map(e => e.user))].length,
        topCategories: analyzeCategoriesFromFiles(periodFiles),
        memberActivity: analyzeMemberActivity(periodActivity, periodFiles),
        documentTypes: analyzeDocumentTypes(periodFiles),
        timeDistribution: analyzeTimeDistribution(periodActivity),
        collaborationScore: calculateCollaborationScore(periodActivity),
        efficiency: {
          avgResponseTime: calculateAvgResponseTime(periodActivity),
          documentsPerDay: periodFiles.length / getDaysBetween(startDate, now),
          templatesUsed: periodActivity.filter(e => e.action === 'template_used').length,
          knowledgeBaseHits: periodActivity.filter(e => e.action === 'knowledge_accessed').length
        }
      };
      
      // Generate insights
      const insights = generateInsights(metrics, periodActivity);
      
      res.json({
        success: true,
        teamId,
        metrics,
        insights,
        lastUpdated: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('Dashboard analytics error:', error);
      res.status(500).json({ 
        error: 'Failed to generate dashboard analytics',
        details: error.message 
      });
    }
  });
  
  // Get detailed member analytics
  r.get('/api/analytics/members', async (req: Request, res: Response) => {
    try {
      const { 
        period = 'week',
        member
      } = req.query;
      
      const now = new Date();
      const startDate = getStartDate(period as string, now);
      
      const allFiles = await listDriveFiles(undefined, 1000);
      const periodActivity = activityEvents.filter(event => 
        new Date(event.timestamp) >= startDate
      );
      
      let memberData;
      
      if (member) {
        // Single member analysis
        const memberFiles = allFiles.filter(file => 
          file.name.toLowerCase().includes((member as string).toLowerCase()) &&
          new Date(file.createdTime) >= startDate
        );
        
        const memberActivity = periodActivity.filter(e => 
          e.user.toLowerCase() === (member as string).toLowerCase()
        );
        
        memberData = {
          member: member,
          documents: memberFiles.length,
          conversations: memberActivity.filter(e => e.action === 'conversation_started').length,
          templatesUsed: memberActivity.filter(e => e.action === 'template_used').length,
          knowledgeAccess: memberActivity.filter(e => e.action === 'knowledge_accessed').length,
          collaborations: memberActivity.filter(e => e.action === 'collaboration').length,
          activityByDay: generateDailyActivity(memberActivity, startDate, now),
          topCategories: analyzeCategoriesFromFiles(memberFiles),
          efficiency: {
            documentsPerDay: memberFiles.length / getDaysBetween(startDate, now),
            avgSessionTime: calculateAvgSessionTime(memberActivity),
            responseTime: calculateMemberResponseTime(memberActivity)
          }
        };
      } else {
        // All members summary
        const members = [...new Set(periodActivity.map(e => e.user))];
        
        memberData = members.map(memberName => {
          const memberFiles = allFiles.filter(file => 
            file.name.toLowerCase().includes(memberName.toLowerCase()) &&
            new Date(file.createdTime) >= startDate
          );
          
          const memberActivity = periodActivity.filter(e => e.user === memberName);
          
          return {
            member: memberName,
            documents: memberFiles.length,
            conversations: memberActivity.filter(e => e.action === 'conversation_started').length,
            templatesUsed: memberActivity.filter(e => e.action === 'template_used').length,
            knowledgeAccess: memberActivity.filter(e => e.action === 'knowledge_accessed').length,
            collaborations: memberActivity.filter(e => e.action === 'collaboration').length,
            lastActive: memberActivity.length > 0 ? 
              Math.max(...memberActivity.map(e => new Date(e.timestamp).getTime())) : null
          };
        }).sort((a, b) => (b.documents + b.conversations) - (a.documents + a.conversations));
      }
      
      res.json({
        success: true,
        period,
        memberData,
        summary: member ? null : {
          totalMembers: memberData.length,
          totalActivity: periodActivity.length,
          mostActive: memberData[0]?.member || null
        }
      });
      
    } catch (error: any) {
      console.error('Member analytics error:', error);
      res.status(500).json({ 
        error: 'Failed to generate member analytics',
        details: error.message 
      });
    }
  });
  
  // Track activity event
  r.post('/api/analytics/track', async (req: Request, res: Response) => {
    try {
      const {
        user,
        action,
        details = {},
        timestamp = new Date().toISOString()
      } = req.body;
      
      if (!user || !action) {
        return res.status(400).json({ error: 'User and action required' });
      }
      
      const event: ActivityEvent = {
        timestamp,
        user,
        action,
        details
      };
      
      activityEvents.push(event);
      
      // Keep only last 10000 events (memory management)
      if (activityEvents.length > 10000) {
        activityEvents = activityEvents.slice(-10000);
      }
      
      res.json({
        success: true,
        message: 'Activity tracked',
        event: event
      });
      
    } catch (error: any) {
      console.error('Activity tracking error:', error);
      res.status(500).json({ 
        error: 'Failed to track activity',
        details: error.message 
      });
    }
  });
  
  // Generate analytics report
  r.post('/api/analytics/report', async (req: Request, res: Response) => {
    try {
      const {
        period = 'week',
        includeCharts = false,
        format = 'document',
        teamId = 'bali-zero'
      } = req.body;
      
      const now = new Date();
      const startDate = getStartDate(period, now);
      
      // Get comprehensive analytics
      const allFiles = await listDriveFiles(undefined, 1000);
      const periodFiles = allFiles.filter(file => 
        new Date(file.createdTime) >= startDate
      );
      
      const periodActivity = activityEvents.filter(event => 
        new Date(event.timestamp) >= startDate
      );
      
      const metrics: TeamMetrics = {
        period: period,
        totalDocuments: periodFiles.length,
        totalConversations: periodActivity.filter(e => e.action === 'conversation_started').length,
        activeMembers: [...new Set(periodActivity.map(e => e.user))].length,
        topCategories: analyzeCategoriesFromFiles(periodFiles),
        memberActivity: analyzeMemberActivity(periodActivity, periodFiles),
        documentTypes: analyzeDocumentTypes(periodFiles),
        timeDistribution: analyzeTimeDistribution(periodActivity),
        collaborationScore: calculateCollaborationScore(periodActivity),
        efficiency: {
          avgResponseTime: calculateAvgResponseTime(periodActivity),
          documentsPerDay: periodFiles.length / getDaysBetween(startDate, now),
          templatesUsed: periodActivity.filter(e => e.action === 'template_used').length,
          knowledgeBaseHits: periodActivity.filter(e => e.action === 'knowledge_accessed').length
        }
      };
      
      const insights = generateInsights(metrics, periodActivity);
      
      // Generate report content
      const reportContent = `# Team Analytics Report - ${teamId.toUpperCase()}

**Report Period**: ${period} (${startDate.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]})
**Generated**: ${new Date().toISOString()}

## Executive Summary

### Key Metrics
- **Total Documents Created**: ${metrics.totalDocuments}
- **Total Conversations**: ${metrics.totalConversations}
- **Active Team Members**: ${metrics.activeMembers}
- **Collaboration Score**: ${metrics.collaborationScore.toFixed(1)}/10

### Efficiency Metrics
- **Documents per Day**: ${metrics.efficiency.documentsPerDay.toFixed(1)}
- **Average Response Time**: ${metrics.efficiency.avgResponseTime.toFixed(1)} minutes
- **Templates Used**: ${metrics.efficiency.templatesUsed}
- **Knowledge Base Hits**: ${metrics.efficiency.knowledgeBaseHits}

## Team Activity

### Most Active Members
${metrics.memberActivity.slice(0, 5).map((member, index) => 
  `${index + 1}. **${member.member}**: ${member.documents} documents, ${member.conversations} conversations`
).join('\n')}

### Top Document Categories
${metrics.topCategories.slice(0, 5).map((cat, index) => 
  `${index + 1}. **${cat.name}**: ${cat.count} documents`
).join('\n')}

### Document Types Distribution
${metrics.documentTypes.map(type => 
  `- **${type.type}**: ${type.count} files`
).join('\n')}

## Time Analysis

### Peak Activity Hours
${metrics.timeDistribution
  .sort((a, b) => b.activity - a.activity)
  .slice(0, 3)
  .map(hour => `- **${hour.hour}:00**: ${hour.activity} activities`)
  .join('\n')}

## Insights & Recommendations

${insights.map(insight => `### ${insight.title}\n${insight.description}\n**Recommendation**: ${insight.recommendation}`).join('\n\n')}

## Data Notes
- Report generated from ${periodActivity.length} tracked activities
- File analysis based on ${allFiles.length} total documents
- Collaboration score calculated from team interactions and shared documents

---
*Generated by Zantara Analytics Engine*
*Team: ${teamId} | Period: ${period} | Date: ${now.toISOString().split('T')[0]}*
      `;
      
      // Save report as document
      const reportDoc = await uploadTextAsDoc(
        reportContent,
        `Team_Analytics_Report_${period}_${now.toISOString().split('T')[0]}`,
        'SHARED_ANALYTICS'
      );
      
      res.json({
        success: true,
        message: 'Analytics report generated',
        report: {
          period,
          teamId,
          metrics,
          insights,
          document: reportDoc.webViewLink,
          generatedAt: new Date().toISOString()
        }
      });
      
    } catch (error: any) {
      console.error('Report generation error:', error);
      res.status(500).json({ 
        error: 'Failed to generate analytics report',
        details: error.message 
      });
    }
  });
  
  // Initialize with sample data
  r.post('/api/analytics/init-sample-data', async (req: Request, res: Response) => {
    try {
      const sampleEvents: ActivityEvent[] = [
        // Generate sample activity for last week
        ...generateSampleEvents('BOSS', 'week'),
        ...generateSampleEvents('RIRI', 'week'),
        ...generateSampleEvents('SURYA', 'week'),
        ...generateSampleEvents('COLLABORATOR1', 'week')
      ];
      
      activityEvents.push(...sampleEvents);
      
      res.json({
        success: true,
        message: 'Sample analytics data initialized',
        eventsCreated: sampleEvents.length,
        totalEvents: activityEvents.length
      });
      
    } catch (error: any) {
      console.error('Sample data initialization error:', error);
      res.status(500).json({ 
        error: 'Failed to initialize sample data',
        details: error.message 
      });
    }
  });
}

// Helper functions
function getStartDate(period: string, now: Date): Date {
  switch (period) {
    case 'day':
      return new Date(now.getTime() - (24 * 60 * 60 * 1000));
    case 'month':
      return new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    case 'quarter':
      return new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    default: // week
      return new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  }
}

function getDaysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

function analyzeCategoriesFromFiles(files: any[]): { name: string; count: number }[] {
  const categories = {};
  
  files.forEach(file => {
    if (file.name.includes('KITAS') || file.name.includes('visa')) {
      categories['Visa & Immigration'] = (categories['Visa & Immigration'] || 0) + 1;
    } else if (file.name.includes('PT') || file.name.includes('business')) {
      categories['Business Setup'] = (categories['Business Setup'] || 0) + 1;
    } else if (file.name.includes('tax') || file.name.includes('compliance')) {
      categories['Tax & Compliance'] = (categories['Tax & Compliance'] || 0) + 1;
    } else if (file.name.includes('meeting') || file.name.includes('team')) {
      categories['Team Collaboration'] = (categories['Team Collaboration'] || 0) + 1;
    } else if (file.name.includes('client') || file.name.includes('consultation')) {
      categories['Client Management'] = (categories['Client Management'] || 0) + 1;
    } else {
      categories['General'] = (categories['General'] || 0) + 1;
    }
  });
  
  return Object.entries(categories)
    .map(([name, count]) => ({ name, count: count as number }))
    .sort((a, b) => b.count - a.count);
}

function analyzeMemberActivity(activity: ActivityEvent[], files: any[]): { member: string; documents: number; conversations: number }[] {
  const members = [...new Set(activity.map(e => e.user))];
  
  return members.map(member => ({
    member,
    documents: files.filter(f => f.name.toLowerCase().includes(member.toLowerCase())).length,
    conversations: activity.filter(e => e.user === member && e.action === 'conversation_started').length
  })).sort((a, b) => (b.documents + b.conversations) - (a.documents + a.conversations));
}

function analyzeDocumentTypes(files: any[]): { type: string; count: number }[] {
  const types = {};
  
  files.forEach(file => {
    if (file.mimeType === 'application/vnd.google-apps.document') {
      types['Google Docs'] = (types['Google Docs'] || 0) + 1;
    } else if (file.mimeType.includes('pdf')) {
      types['PDF'] = (types['PDF'] || 0) + 1;
    } else if (file.mimeType.includes('spreadsheet')) {
      types['Spreadsheet'] = (types['Spreadsheet'] || 0) + 1;
    } else if (file.mimeType.includes('folder')) {
      types['Folder'] = (types['Folder'] || 0) + 1;
    } else {
      types['Other'] = (types['Other'] || 0) + 1;
    }
  });
  
  return Object.entries(types)
    .map(([type, count]) => ({ type, count: count as number }))
    .sort((a, b) => b.count - a.count);
}

function analyzeTimeDistribution(activity: ActivityEvent[]): { hour: number; activity: number }[] {
  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, activity: 0 }));
  
  activity.forEach(event => {
    const hour = new Date(event.timestamp).getHours();
    hours[hour].activity++;
  });
  
  return hours;
}

function calculateCollaborationScore(activity: ActivityEvent[]): number {
  const collaborationEvents = activity.filter(e => e.action === 'collaboration').length;
  const totalEvents = activity.length;
  
  if (totalEvents === 0) return 0;
  
  const collaborationRatio = collaborationEvents / totalEvents;
  const uniqueUsers = new Set(activity.map(e => e.user)).size;
  
  // Score based on collaboration frequency and user diversity
  return Math.min(10, (collaborationRatio * 5) + (uniqueUsers * 0.5));
}

function calculateAvgResponseTime(activity: ActivityEvent[]): number {
  // Mock calculation - in reality, measure actual response times
  const responseTimes = activity.filter(e => e.action === 'conversation_started')
    .map(() => Math.random() * 60); // Random response time 0-60 minutes
  
  return responseTimes.length > 0 ? 
    responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
}

function calculateAvgSessionTime(activity: ActivityEvent[]): number {
  // Mock calculation - in reality, measure actual session durations
  return activity.length > 0 ? 15 + (Math.random() * 30) : 0; // 15-45 minutes
}

function calculateMemberResponseTime(activity: ActivityEvent[]): number {
  // Mock calculation for individual member response time
  return activity.length > 0 ? 5 + (Math.random() * 20) : 0; // 5-25 minutes
}

function generateDailyActivity(activity: ActivityEvent[], startDate: Date, endDate: Date): { date: string; activity: number }[] {
  const days = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dayActivity = activity.filter(e => 
      e.timestamp.startsWith(dateStr)
    ).length;
    
    days.push({ date: dateStr, activity: dayActivity });
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

function generateInsights(metrics: TeamMetrics, activity: ActivityEvent[]): { title: string; description: string; recommendation: string }[] {
  const insights = [];
  
  // Activity level insights
  if (metrics.activeMembers < 3) {
    insights.push({
      title: 'Low Team Engagement',
      description: `Only ${metrics.activeMembers} team members active in the ${metrics.period}`,
      recommendation: 'Consider team training sessions or onboarding inactive members'
    });
  }
  
  // Efficiency insights
  if (metrics.efficiency.documentsPerDay < 1) {
    insights.push({
      title: 'Low Document Creation',
      description: `Team is creating ${metrics.efficiency.documentsPerDay.toFixed(1)} documents per day`,
      recommendation: 'Implement templates and automation to increase productivity'
    });
  }
  
  // Collaboration insights
  if (metrics.collaborationScore < 5) {
    insights.push({
      title: 'Limited Collaboration',
      description: `Collaboration score is ${metrics.collaborationScore.toFixed(1)}/10`,
      recommendation: 'Encourage shared document creation and team projects'
    });
  }
  
  // Template usage insights
  if (metrics.efficiency.templatesUsed === 0) {
    insights.push({
      title: 'Templates Underutilized',
      description: 'No templates were used during this period',
      recommendation: 'Promote template library and create training materials'
    });
  }
  
  // Knowledge base insights
  if (metrics.efficiency.knowledgeBaseHits < 5) {
    insights.push({
      title: 'Knowledge Base Underused',
      description: `Only ${metrics.efficiency.knowledgeBaseHits} knowledge base accesses`,
      recommendation: 'Improve knowledge base visibility and search functionality'
    });
  }
  
  return insights;
}

function generateSampleEvents(user: string, period: string): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const now = new Date();
  const startDate = getStartDate(period, now);
  
  // Generate random events for each day
  const days = getDaysBetween(startDate, now);
  
  for (let day = 0; day < days; day++) {
    const eventDate = new Date(startDate.getTime() + (day * 24 * 60 * 60 * 1000));
    const eventsPerDay = Math.floor(Math.random() * 5) + 1; // 1-5 events per day
    
    for (let i = 0; i < eventsPerDay; i++) {
      const eventTime = new Date(eventDate.getTime() + (Math.random() * 24 * 60 * 60 * 1000));
      const actions: ActivityEvent['action'][] = [
        'document_created', 'conversation_started', 'template_used', 
        'knowledge_accessed', 'collaboration'
      ];
      
      events.push({
        timestamp: eventTime.toISOString(),
        user,
        action: actions[Math.floor(Math.random() * actions.length)],
        details: {
          synthetic: true,
          randomValue: Math.random()
        }
      });
    }
  }
  
  return events;
}