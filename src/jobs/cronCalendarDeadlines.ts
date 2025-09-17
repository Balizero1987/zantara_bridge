import cron from 'node-cron';
import { calendarDeadlineService, ComplianceDeadline } from '../services/calendarDeadlines';

/**
 * Calendar deadlines monitoring cron job
 * Runs daily at 8 AM Jakarta time to check for upcoming compliance deadlines
 */

export function startCalendarDeadlinesJob() {
  // Every day at 8:00 AM Jakarta time
  const schedule = '0 8 * * *';
  
  console.log('📅 Setting up calendar deadlines monitoring job...');
  
  cron.schedule(schedule, async () => {
    try {
      console.log('📅 Starting daily deadline check...');
      
      // Check for upcoming deadlines in the next 7 days
      const upcomingDeadlines = await calendarDeadlineService.getUpcomingDeadlines(7);
      
      if (upcomingDeadlines.length > 0) {
        console.log(`📋 Found ${upcomingDeadlines.length} upcoming deadlines:`);
        
        upcomingDeadlines.forEach(deadline => {
          const daysUntil = Math.ceil((new Date(deadline.start).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          console.log(`⏰ ${deadline.title} - in ${daysUntil} days`);
        });
        
        // Send reminder notifications
        const reminderResult = await calendarDeadlineService.sendDeadlineReminders();
        console.log(`📧 Sent ${reminderResult.sent} deadline reminders`);
        
        if (reminderResult.errors.length > 0) {
          console.error('❌ Reminder errors:', reminderResult.errors);
        }
        
      } else {
        console.log('✅ No upcoming deadlines in the next 7 days');
      }
      
    } catch (error) {
      console.error('❌ Calendar deadlines job failed:', error);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });
  
  console.log('✅ Calendar deadlines monitoring job started (daily at 8 AM Jakarta time)');
}

/**
 * Setup standard compliance deadlines for Indonesian businesses
 */
export async function setupStandardComplianceDeadlines(): Promise<any> {
  try {
    console.log('📅 Setting up standard compliance deadlines...');
    
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    
    const standardDeadlines: ComplianceDeadline[] = [
      // Tax deadlines
      {
        type: 'tax_filing',
        title: 'SPT Tahunan (Annual Tax Return)',
        description: 'Annual individual and corporate tax return filing deadline',
        dueDate: new Date(nextYear, 2, 31), // March 31
        reminderDays: [30, 14, 7, 1],
        priority: 'high',
        assignedTo: ['zero@balizero.com'],
        documentRequired: [
          'SPT Form 1770/1771',
          'Financial statements',
          'Tax computation',
          'Supporting documents'
        ],
        category: 'taxation'
      },
      {
        type: 'tax_filing',
        title: 'PPN (VAT) Monthly Report',
        description: 'Monthly VAT return filing',
        dueDate: new Date(currentYear, new Date().getMonth() + 1, 20), // 20th of next month
        reminderDays: [7, 3, 1],
        priority: 'medium',
        assignedTo: ['zero@balizero.com'],
        documentRequired: [
          'SPT Masa PPN',
          'Tax invoices (Faktur Pajak)',
          'Purchase invoices'
        ],
        category: 'taxation'
      },
      
      // KITAS renewal (example for next year)
      {
        type: 'kitas_renewal',
        title: 'KITAS Renewal Application',
        description: 'KITAS renewal must be submitted before expiration',
        dueDate: new Date(nextYear, 5, 15), // June 15 (example)
        reminderDays: [60, 30, 14, 7],
        priority: 'high',
        assignedTo: ['zero@balizero.com'],
        documentRequired: [
          'Passport with minimum 18 months validity',
          'Current KITAS',
          'Health certificate',
          'Sponsor letter',
          'Work permit (if applicable)',
          'Bank statement'
        ],
        category: 'immigration'
      },
      
      // PT PMA reporting
      {
        type: 'pt_pma_reporting',
        title: 'Investment Activity Report (LKPM)',
        description: 'Quarterly investment activity report to BKPM',
        dueDate: new Date(currentYear, new Date().getMonth() + 3, 25), // 25th of quarter end
        reminderDays: [14, 7, 3],
        priority: 'medium',
        assignedTo: ['zero@balizero.com'],
        documentRequired: [
          'LKPM Form',
          'Financial statements',
          'Investment realization report',
          'Employment data'
        ],
        category: 'compliance'
      },
      
      // Business license renewal
      {
        type: 'license_renewal',
        title: 'Business License Renewal',
        description: 'Annual business license renewal through OSS system',
        dueDate: new Date(nextYear, 11, 31), // December 31
        reminderDays: [60, 30, 14, 7],
        priority: 'high',
        assignedTo: ['zero@balizero.com'],
        documentRequired: [
          'NIB certificate',
          'Business activity report',
          'Compliance certificates',
          'Updated company documents'
        ],
        category: 'licensing'
      }
    ];
    
    const result = await calendarDeadlineService.setupComplianceDeadlines(standardDeadlines);
    
    console.log(`✅ Setup completed: ${result.created} events created`);
    if (result.errors.length > 0) {
      console.error('❌ Setup errors:', result.errors);
    }
    
    return {
      success: true,
      created: result.created,
      errors: result.errors,
      deadlines: standardDeadlines.length
    };
    
  } catch (error: any) {
    console.error('❌ Failed to setup compliance deadlines:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Manual trigger for testing
 */
export async function triggerDeadlineCheckNow(): Promise<any> {
  try {
    console.log('🧪 Manual deadline check trigger...');
    
    const upcomingDeadlines = await calendarDeadlineService.getUpcomingDeadlines(30);
    const reminderResult = await calendarDeadlineService.sendDeadlineReminders();
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      upcomingDeadlines: upcomingDeadlines.length,
      remindersSent: reminderResult.sent,
      errors: reminderResult.errors,
      deadlines: upcomingDeadlines.map(d => ({
        title: d.title,
        start: d.start,
        link: d.link
      }))
    };
    
    console.log('✅ Manual deadline check completed:', result);
    return result;
    
  } catch (error: any) {
    console.error('❌ Manual deadline check failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}