import cron from 'node-cron';
import { gmailMonitorService } from '../services/gmailMonitorService';

/**
 * Gmail monitoring cron job
 * Runs every 30 minutes during business hours (8 AM - 8 PM, Mon-Fri)
 * to check for government emails
 */

export function startGmailMonitorJob() {
  // Every 30 minutes, Monday-Friday, 8 AM to 8 PM (Jakarta time)
  const schedule = '*/30 8-20 * * 1-5';
  
  console.log('🔄 Setting up Gmail monitor cron job...');
  
  cron.schedule(schedule, async () => {
    try {
      console.log('📧 Starting Gmail monitoring check...');
      
      const emails = await gmailMonitorService.monitorGovernmentEmails();
      
      if (emails.length > 0) {
        const stats = {
          total: emails.length,
          high: emails.filter(e => e.priority === 'high').length,
          medium: emails.filter(e => e.priority === 'medium').length,
          low: emails.filter(e => e.priority === 'low').length,
          agencies: [...new Set(emails.map(e => e.agency))]
        };
        
        console.log(`✅ Gmail monitoring completed:`, {
          ...stats,
          timestamp: new Date().toISOString()
        });
        
        // Alert if high priority emails found
        if (stats.high > 0) {
          console.log(`🚨 ALERT: ${stats.high} high priority government email(s) found!`);
        }
        
      } else {
        console.log('📭 No new government emails found');
      }
      
    } catch (error) {
      console.error('❌ Gmail monitoring job failed:', error);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });
  
  console.log('✅ Gmail monitor cron job started (every 30 min, 8AM-8PM, Mon-Fri Jakarta time)');
}

/**
 * Manual trigger for testing
 */
export async function triggerGmailMonitorNow(): Promise<any> {
  try {
    console.log('🧪 Manual Gmail monitoring trigger...');
    
    const emails = await gmailMonitorService.monitorGovernmentEmails();
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      emailsFound: emails.length,
      emails: emails.map(e => ({
        agency: e.agency,
        priority: e.priority,
        subject: e.subject,
        from: e.from,
        keywords: e.keywords
      }))
    };
    
    console.log('✅ Manual Gmail monitoring completed:', result);
    return result;
    
  } catch (error: any) {
    console.error('❌ Manual Gmail monitoring failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}