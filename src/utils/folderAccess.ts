/**
 * Utility per testare e gestire l'accesso OAuth alla cartella Drive specifica
 * Use environment variable DRIVE_FOLDER_ID to specify target folder
 */

import { google } from 'googleapis';
import { buildJwt } from '../core/impersonation';

export const TARGET_FOLDER_ID = process.env.DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_AMBARADAM || '';

export interface FolderAccessResult {
  accessible: boolean;
  metadata?: any;
  files?: any[];
  permissions?: any[];
  error?: string;
}

/**
 * Test completo dell'accesso alla cartella target con OAuth delegation
 */
export async function testFolderAccess(
  folderId: string = TARGET_FOLDER_ID,
  subject?: string
): Promise<FolderAccessResult> {
  try {
    const auth = buildJwt([
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.metadata'
    ], subject);
    
    const drive = google.drive({ version: 'v3', auth: auth as any });

    // 1. Test metadata cartella
    console.log(`🔍 Testing access to folder: ${folderId}`);
    const folderResponse = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,permissions,owners,shared,createdTime,modifiedTime'
    });

    // 2. Test lista file nella cartella
    const filesResponse = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: 10,
      fields: 'files(id,name,mimeType,createdTime,modifiedTime,size)'
    });

    // 3. Test permessi cartella
    const permissionsResponse = await drive.permissions.list({
      fileId: folderId,
      fields: 'permissions(id,type,role,emailAddress,displayName)'
    });

    return {
      accessible: true,
      metadata: folderResponse.data,
      files: filesResponse.data.files,
      permissions: permissionsResponse.data.permissions
    };

  } catch (error: any) {
    console.error(`❌ Error accessing folder ${folderId}:`, error.message);
    
    return {
      accessible: false,
      error: error.message,
      metadata: {
        errorCode: error.code,
        errorType: error.code === 404 ? 'NOT_FOUND' : 
                   error.code === 403 ? 'PERMISSION_DENIED' : 'UNKNOWN'
      }
    };
  }
}

/**
 * Verifica se il Service Account ha accesso alla cartella target
 */
export async function checkDelegationSetup(): Promise<{
  serviceAccountReady: boolean;
  delegationEnabled: boolean;
  folderAccessible: boolean;
  recommendations: string[];
}> {
  const recommendations: string[] = [];
  
  // 1. Check environment variables
  const hasServiceAccountKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const hasImpersonateUser = !!process.env.IMPERSONATE_USER;
  
  if (!hasServiceAccountKey) {
    recommendations.push('Set GOOGLE_SERVICE_ACCOUNT_KEY environment variable');
  }
  
  if (!hasImpersonateUser) {
    recommendations.push('Set IMPERSONATE_USER environment variable (e.g., zero@balizero.com)');
  }

  // 2. Test folder access
  let folderAccessible = false;
  try {
    const result = await testFolderAccess();
    folderAccessible = result.accessible;
    
    if (!result.accessible) {
      if (result.metadata?.errorCode === 403) {
        recommendations.push('Configure Domain-wide Delegation in Google Admin Console');
        recommendations.push(`Add Client ID with Drive scopes: https://admin.google.com/ac/owl/domainwidedelegation`);
      } else if (result.metadata?.errorCode === 404) {
        recommendations.push(`Verify folder ID ${TARGET_FOLDER_ID} exists and is shared`);
      }
    }
  } catch (error) {
    recommendations.push('Check service account credentials and permissions');
  }

  return {
    serviceAccountReady: hasServiceAccountKey,
    delegationEnabled: hasImpersonateUser && folderAccessible,
    folderAccessible,
    recommendations
  };
}

/**
 * Utility per creare un file di test nella cartella target
 */
export async function createTestFile(
  content: string = 'Test OAuth delegation access',
  filename: string = `oauth-test-${Date.now()}.txt`,
  folderId: string = TARGET_FOLDER_ID
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    const auth = buildJwt([
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]);
    
    const drive = google.drive({ version: 'v3', auth: auth as any });

    const fileMetadata = {
      name: filename,
      parents: [folderId]
    };

    const media = {
      mimeType: 'text/plain',
      body: content
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id,name'
    });

    return {
      success: true,
      fileId: response.data.id
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}