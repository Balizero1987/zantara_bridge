import { google, drive_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

let _drive: drive_v3.Drive | null = null;

/**
 * Restituisce un client Google Drive memoizzato
 * usando impersonation (Domain-Wide Delegation).
 */
export function getDrive(): drive_v3.Drive {
  if (_drive) return _drive;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const subject = (process.env.DRIVE_SUBJECT || '').trim();

  if (!raw) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  }
  if (!subject) {
    throw new Error('Missing DRIVE_SUBJECT');
  }

  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
    clientOptions: { subject },
  });

  _drive = google.drive({ version: 'v3', auth: auth as any });
  return _drive;
}

/**
 * Compatibilità con vecchi import.
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  return getDrive();
}

/**
 * Recupera info sull’utente impersonato.
 */
export async function getDriveWhoAmI(): Promise<drive_v3.Schema$User | undefined> {
  const drive = getDrive();
  const about = await drive.about.get({
    fields: 'user(emailAddress,displayName,permissionId)',
    supportsAllDrives: true,
  } as any);
  return about.data.user as any;
}

/**
 * whoami(): test di accesso. BYPASS SHARED DRIVE per evitare DWD issues.
 */
export async function whoami(): Promise<{ ok: true; about?: any; sample?: any; drive?: any; user?: any; impersonating?: any }> {
  const drive = getDrive();
  
  // BYPASS: usa solo about.get invece della Shared Drive
  // per evitare problemi di Domain-Wide Delegation
  const about = await drive.about.get({
    fields: 'user(emailAddress,displayName),storageQuota',
    supportsAllDrives: true,
  } as any);
  
  // Test basic drive access con "My Drive"
  const myFiles = await drive.files.list({
    pageSize: 1,
    fields: 'files(id,name)',
    q: 'trashed=false'
  } as any);
  
  return { 
    ok: true, 
    about: about.data,
    sample: myFiles.data.files ?? [],
    user: about.data.user,
    impersonating: process.env.DRIVE_SUBJECT
  };
}
