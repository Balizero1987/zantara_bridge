import { google } from 'googleapis';
import { Buffer } from 'buffer';

const AMBARADAM_FOLDER_ID = 'f1UGbm5er6Go351S57GQKUjmxMxHyT4QZb';

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  webContentLink: string;
  name: string;
}

/**
 * Upload file to Google Drive in AMBARADAM folder
 */
export async function uploadToDrive(
  base64Data: string, 
  fileName: string, 
  userId: string,
  mimeType: string = 'application/octet-stream'
): Promise<DriveUploadResult> {
  try {
    // Get service account key from environment
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                             process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
    
    if (!serviceAccountKey) {
      throw new Error('Missing Google Service Account key');
    }
    
    // Decode if base64
    let credentials;
    if (serviceAccountKey.includes('BEGIN')) {
      credentials = JSON.parse(serviceAccountKey);
    } else {
      const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }
    
    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ]
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    // Decode base64 data
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fullFileName = `${userId}_${timestamp}_${fileName}`;
    
    // Upload file
    const response = await drive.files.create({
      requestBody: {
        name: fullFileName,
        parents: [AMBARADAM_FOLDER_ID],
        mimeType: mimeType
      },
      media: {
        mimeType: mimeType,
        body: buffer
      },
      fields: 'id,name,webViewLink,webContentLink'
    });
    
    // Set permissions for viewing
    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    
    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink!,
      webContentLink: response.data.webContentLink!,
      name: response.data.name!
    };
    
  } catch (error: any) {
    console.error('Drive upload error:', error);
    throw new Error(`Failed to upload to Drive: ${error.message}`);
  }
}

/**
 * Upload text content as Google Doc
 */
export async function uploadTextAsDoc(
  content: string,
  title: string,
  userId: string
): Promise<DriveUploadResult> {
  try {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                             process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
    
    if (!serviceAccountKey) {
      throw new Error('Missing Google Service Account key');
    }
    
    let credentials;
    if (serviceAccountKey.includes('BEGIN')) {
      credentials = JSON.parse(serviceAccountKey);
    } else {
      const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ]
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const docName = `${userId}_${timestamp}_${title}`;
    
    // Create Google Doc
    const response = await drive.files.create({
      requestBody: {
        name: docName,
        parents: [AMBARADAM_FOLDER_ID],
        mimeType: 'application/vnd.google-apps.document'
      },
      media: {
        mimeType: 'text/plain',
        body: content
      },
      fields: 'id,name,webViewLink,webContentLink'
    });
    
    // Set permissions
    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    
    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink!,
      webContentLink: response.data.webContentLink || '',
      name: response.data.name!
    };
    
  } catch (error: any) {
    console.error('Drive doc upload error:', error);
    throw new Error(`Failed to upload doc to Drive: ${error.message}`);
  }
}

/**
 * Create subfolder in AMBARADAM
 */
export async function createDriveFolder(
  folderName: string,
  parentId: string = AMBARADAM_FOLDER_ID
): Promise<string> {
  try {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                             process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
    
    if (!serviceAccountKey) {
      throw new Error('Missing Google Service Account key');
    }
    
    let credentials;
    if (serviceAccountKey.includes('BEGIN')) {
      credentials = JSON.parse(serviceAccountKey);
    } else {
      const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    // Check if folder already exists
    const searchResponse = await drive.files.list({
      q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0].id!;
    }
    
    // Create new folder
    const response = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      },
      fields: 'id'
    });
    
    return response.data.id!;
    
  } catch (error: any) {
    console.error('Create folder error:', error);
    throw new Error(`Failed to create folder: ${error.message}`);
  }
}

/**
 * List files in AMBARADAM folder
 */
export async function listDriveFiles(
  userId?: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                             process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
    
    if (!serviceAccountKey) {
      throw new Error('Missing Google Service Account key');
    }
    
    let credentials;
    if (serviceAccountKey.includes('BEGIN')) {
      credentials = JSON.parse(serviceAccountKey);
    } else {
      const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    let query = `'${AMBARADAM_FOLDER_ID}' in parents and trashed=false`;
    if (userId) {
      query += ` and name contains '${userId}'`;
    }
    
    const response = await drive.files.list({
      q: query,
      orderBy: 'createdTime desc',
      pageSize: limit,
      fields: 'files(id,name,mimeType,createdTime,webViewLink,size)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    return response.data.files || [];
    
  } catch (error: any) {
    console.error('List files error:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
}