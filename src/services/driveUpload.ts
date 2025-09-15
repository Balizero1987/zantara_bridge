import { google } from 'googleapis';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import { 
  AppsScriptDriveService, 
  uploadChatToAmbaradam, 
  uploadNoteToAmbaradam, 
  uploadBriefToAmbaradam,
  AMBARADAM_FOLDER_ID 
} from './appsScriptDrive';

const LEGACY_AMBARADAM_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '1UGbm5er6Go351S57GQKUjmxMxHyT4QZb';

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
    // Get service account key from environment or mounted secret
    let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                           process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
    
    // If not in env vars, try to read from mounted secret file
    if (!serviceAccountKey || serviceAccountKey.length < 10) {
      try {
        // Cloud Run mounts secrets at /secrets/<secret-name>
        serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY', 'utf8');
      } catch (e) {
        try {
          serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY_B64', 'utf8');
        } catch (e2) {
          console.log('Could not read secret files:', e.message, e2.message);
        }
      }
    }
    
    if (!serviceAccountKey) {
      throw new Error('Missing Google Service Account key');
    }
    
    // Avoid logging key material
    
    // Parse credentials - handle different formats
    let credentials;
    try {
      // Try direct JSON parse first
      credentials = JSON.parse(serviceAccountKey);
      console.log('✅ Direct JSON parse successful');
    } catch (e) {
      console.log('❌ Direct JSON parse failed:', e.message);
      try {
        // Try base64 decode then parse
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
        console.log('✅ Base64 decode + JSON parse successful');
      } catch (e2) {
        console.log('❌ Base64 decode + JSON parse failed:', e2.message);
        throw new Error(`Invalid service account key format: ${e.message} | ${e2.message}`);
      }
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
    let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                           process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
    
    // If not in env vars, try to read from mounted secret file
    if (!serviceAccountKey || serviceAccountKey.length < 10) {
      try {
        // Cloud Run mounts secrets at /secrets/<secret-name>
        serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY', 'utf8');
      } catch (e) {
        try {
          serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY_B64', 'utf8');
        } catch (e2) {
          console.log('Could not read secret files:', e.message, e2.message);
        }
      }
    }
    
    if (!serviceAccountKey) {
      throw new Error('Missing Google Service Account key');
    }
    
    // Avoid logging key material
    
    // Parse credentials - handle different formats
    let credentials;
    try {
      // Try direct JSON parse first
      credentials = JSON.parse(serviceAccountKey);
      console.log('✅ Direct JSON parse successful');
    } catch (e) {
      console.log('❌ Direct JSON parse failed:', e.message);
      try {
        // Try base64 decode then parse
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
        console.log('✅ Base64 decode + JSON parse successful');
      } catch (e2) {
        console.log('❌ Base64 decode + JSON parse failed:', e2.message);
        throw new Error(`Invalid service account key format: ${e.message} | ${e2.message}`);
      }
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
    let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                           process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
    
    // If not in env vars, try to read from mounted secret file
    if (!serviceAccountKey || serviceAccountKey.length < 10) {
      try {
        // Cloud Run mounts secrets at /secrets/<secret-name>
        serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY', 'utf8');
      } catch (e) {
        try {
          serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY_B64', 'utf8');
        } catch (e2) {
          console.log('Could not read secret files:', e.message, e2.message);
        }
      }
    }
    
    if (!serviceAccountKey) {
      throw new Error('Missing Google Service Account key');
    }
    
    // Avoid logging key material
    
    // Parse credentials - handle different formats
    let credentials;
    try {
      // Try direct JSON parse first
      credentials = JSON.parse(serviceAccountKey);
      console.log('✅ Direct JSON parse successful');
    } catch (e) {
      console.log('❌ Direct JSON parse failed:', e.message);
      try {
        // Try base64 decode then parse
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
        console.log('✅ Base64 decode + JSON parse successful');
      } catch (e2) {
        console.log('❌ Base64 decode + JSON parse failed:', e2.message);
        throw new Error(`Invalid service account key format: ${e.message} | ${e2.message}`);
      }
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
    let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                           process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
    
    // If not in env vars, try to read from mounted secret file
    if (!serviceAccountKey || serviceAccountKey.length < 10) {
      try {
        // Cloud Run mounts secrets at /secrets/<secret-name>
        serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY', 'utf8');
      } catch (e) {
        try {
          serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY_B64', 'utf8');
        } catch (e2) {
          console.log('Could not read secret files:', e.message, e2.message);
        }
      }
    }
    
    if (!serviceAccountKey) {
      throw new Error('Missing Google Service Account key');
    }
    
    console.log('Service account key type:', typeof serviceAccountKey);
    console.log('Service account key length:', serviceAccountKey.length);
    console.log('Service account key first 50 chars:', serviceAccountKey.substring(0, 50));
    
    // Parse credentials - handle different formats
    let credentials;
    try {
      // Try direct JSON parse first
      credentials = JSON.parse(serviceAccountKey);
      console.log('✅ Direct JSON parse successful');
    } catch (e) {
      console.log('❌ Direct JSON parse failed:', e.message);
      try {
        // Try base64 decode then parse
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
        console.log('✅ Base64 decode + JSON parse successful');
      } catch (e2) {
        console.log('❌ Base64 decode + JSON parse failed:', e2.message);
        throw new Error(`Invalid service account key format: ${e.message} | ${e2.message}`);
      }
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

/**
 * Ensure /AMBARADAM/COMPLIANCE_KNOWLEDGE structure with base folders.
 * Returns IDs for root and children.
 */
export async function ensureComplianceKnowledgeStructure(): Promise<{ rootId: string; folders: Record<string,string> }>{
  try {
    let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                           process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
    if (!serviceAccountKey || serviceAccountKey.length < 10) {
      try { serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY', 'utf8'); } catch {}
      if (!serviceAccountKey) try { serviceAccountKey = fs.readFileSync('/secrets/GOOGLE_SERVICE_ACCOUNT_KEY_B64', 'utf8'); } catch {}
    }
    if (!serviceAccountKey) throw new Error('Missing Google Service Account key');
    let credentials: any;
    try { credentials = JSON.parse(serviceAccountKey); } catch {
      const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
    const drive = google.drive({ version: 'v3', auth });

    const rootName = 'COMPLIANCE_KNOWLEDGE';
    // Ensure root under AMBARADAM
    const searchRoot = await drive.files.list({
      q: `name='${rootName}' and '${AMBARADAM_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)', supportsAllDrives: true, includeItemsFromAllDrives: true
    } as any);
    let rootId = searchRoot.data.files?.[0]?.id as string | undefined;
    if (!rootId) {
      const created = await drive.files.create({ requestBody: { name: rootName, mimeType: 'application/vnd.google-apps.folder', parents: [AMBARADAM_FOLDER_ID] }, fields: 'id' } as any);
      rootId = created.data.id!;
    }
    const children = ['KITAS','KITAP','VOA','PT_PMA','TAX'];
    const out: Record<string,string> = {};
    for (const name of children) {
      const list = await drive.files.list({ q: `name='${name}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id,name)', supportsAllDrives: true, includeItemsFromAllDrives: true } as any);
      let id = list.data.files?.[0]?.id as string | undefined;
      if (!id) {
        const created = await drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] }, fields: 'id' } as any);
        id = created.data.id!;
      }
      out[name] = id!;
    }
    return { rootId, folders: out };
  } catch (e: any) {
    console.error('Compliance structure error:', e);
    throw e;
  }
}
