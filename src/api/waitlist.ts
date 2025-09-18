/**
 * Waitlist API for Bali Zero Landing Page
 * Stores registrations in AMBARADAM Drive folder with analytics
 */

import express, { Request, Response } from 'express';
import { driveAsUser } from '../core/impersonation';
import { TARGET_FOLDER_ID } from '../utils/folderAccess';

const router = express.Router();

interface WaitlistEntry {
  name: string;
  email: string;
  phone?: string;
  timestamp: string;
  source: string;
  userAgent?: string;
  ip?: string;
}

/**
 * POST /api/waitlist/join
 * Join the Bali Zero waitlist
 */
router.post('/join', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, timestamp, source } = req.body as WaitlistEntry;

    // Validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Prepare waitlist entry
    const waitlistEntry: WaitlistEntry = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      timestamp: timestamp || new Date().toISOString(),
      source: source || 'unknown',
      userAgent: req.get('User-Agent') || '',
      ip: req.ip || req.connection.remoteAddress || ''
    };

    // Create CSV content
    const csvContent = [
      `"${waitlistEntry.name}"`,
      `"${waitlistEntry.email}"`,
      `"${waitlistEntry.phone}"`,
      `"${waitlistEntry.timestamp}"`,
      `"${waitlistEntry.source}"`,
      `"${waitlistEntry.userAgent}"`,
      `"${waitlistEntry.ip}"`
    ].join(',');

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `bali-zero-waitlist-${date}.csv`;

    try {
      const drive = driveAsUser();

      // Check if file exists
      const existingFiles = await drive.files.list({
        q: `name='${filename}' and '${TARGET_FOLDER_ID}' in parents and trashed=false`,
        fields: 'files(id,name)'
      });

      let fileContent = csvContent;
      
      if (existingFiles.data.files && existingFiles.data.files.length > 0) {
        // File exists, append to it
        const fileId = existingFiles.data.files[0].id!;
        
        // Get existing content
        const existingContent = await drive.files.get({
          fileId,
          alt: 'media'
        });
        
        fileContent = existingContent.data + '\n' + csvContent;
        
        // Update file
        await drive.files.update({
          fileId,
          media: {
            mimeType: 'text/csv',
            body: fileContent
          }
        });
      } else {
        // Create new file with header
        const header = 'Name,Email,Phone,Timestamp,Source,UserAgent,IP';
        fileContent = header + '\n' + csvContent;
        
        await drive.files.create({
          requestBody: {
            name: filename,
            parents: [TARGET_FOLDER_ID],
            mimeType: 'text/csv'
          },
          media: {
            mimeType: 'text/csv',
            body: fileContent
          }
        });
      }

      // Also create individual JSON file for detailed record
      const jsonFilename = `waitlist-entry-${Date.now()}.json`;
      const detailedEntry = {
        ...waitlistEntry,
        id: Date.now().toString(),
        registrationComplete: true,
        metadata: {
          savedAt: new Date().toISOString(),
          version: '1.0',
          platform: 'bali-zero-landing'
        }
      };

      await drive.files.create({
        requestBody: {
          name: jsonFilename,
          parents: [TARGET_FOLDER_ID],
          mimeType: 'application/json'
        },
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(detailedEntry, null, 2)
        }
      });

      console.log(`✅ Waitlist entry saved: ${email} -> ${filename}`);

      res.json({
        success: true,
        message: 'Successfully joined the waitlist!',
        data: {
          name: waitlistEntry.name,
          email: waitlistEntry.email,
          timestamp: waitlistEntry.timestamp,
          id: detailedEntry.id
        }
      });

    } catch (driveError: any) {
      console.error('Drive save error:', driveError);
      
      // Fallback: log to console/local storage
      console.log('WAITLIST ENTRY (FALLBACK):', JSON.stringify(waitlistEntry, null, 2));
      
      res.status(500).json({
        success: false,
        message: 'Registration received but could not be saved to drive. We have your details and will contact you manually.',
        fallback: true
      });
    }

  } catch (error: any) {
    console.error('Waitlist join error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/waitlist/stats
 * Get waitlist statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const drive = driveAsUser();
    
    // Get all waitlist files
    const files = await drive.files.list({
      q: `name contains 'bali-zero-waitlist' and '${TARGET_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id,name,createdTime,size)',
      orderBy: 'createdTime desc'
    });

    // Get JSON entries for detailed stats
    const jsonFiles = await drive.files.list({
      q: `name contains 'waitlist-entry' and '${TARGET_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id,name,createdTime)',
      orderBy: 'createdTime desc'
    });

    const stats = {
      totalEntries: jsonFiles.data.files?.length || 0,
      csvFiles: files.data.files?.length || 0,
      latestRegistration: jsonFiles.data.files?.[0]?.createdTime || null,
      files: files.data.files?.map(file => ({
        name: file.name,
        created: file.createdTime,
        size: file.size
      })) || []
    };

    res.json({
      success: true,
      stats
    });

  } catch (error: any) {
    console.error('Waitlist stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve waitlist statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/waitlist/export
 * Export complete waitlist (admin only)
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    // Simple admin check - in production use proper authentication
    const adminKey = req.query.admin_key;
    if (adminKey !== process.env.ADMIN_EXPORT_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const drive = driveAsUser();
    
    // Get all JSON entries
    const jsonFiles = await drive.files.list({
      q: `name contains 'waitlist-entry' and '${TARGET_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id,name,createdTime)',
      orderBy: 'createdTime asc'
    });

    const entries = [];
    
    if (jsonFiles.data.files) {
      for (const file of jsonFiles.data.files) {
        try {
          const content = await drive.files.get({
            fileId: file.id!,
            alt: 'media'
          });
          entries.push(JSON.parse(content.data as string));
        } catch (e) {
          console.warn(`Could not read file ${file.name}:`, e);
        }
      }
    }

    res.json({
      success: true,
      total: entries.length,
      entries: entries.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
    });

  } catch (error: any) {
    console.error('Waitlist export error:', error);
    res.status(500).json({
      success: false,
      message: 'Export failed',
      error: error.message
    });
  }
});

export default router;