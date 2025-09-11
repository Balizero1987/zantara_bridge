import { google, drive_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

let _drive: drive_v3.Drive | null = null;

/**
 * Restituisce un client Google Drive memoizzato
 * con impersonation via Domain-Wide Delegation.
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
 * Restituisce informazioni di base sull’utente impersonato.
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
 * whoami(): prova a listare un file nella Shared Drive, se definita,
 * altrimenti ritorna informazioni generali sull’account.
 */
export async function whoami(): Promise<{ ok: true; about?: any; sample?: any; drive?: any }> {
  const drive = getDrive();
  const driveId = process.env.DRIVE_ID_AMBARADAM;

  // Caso Shared Drive (ID tipico: inizia con "0A...")
  if (driveId && driveId.startsWith('0A')) {
    // Metadati della Shared Drive (fallisce con 403 se il subject non è membro)
    const dmeta = await (drive.drives.get as any)({ driveId });
    const res = await drive.files.list({
      pageSize: 1,
      corpora: 'drive',
      driveId: driveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      q: 'trashed=false',
      fields: 'files(id,name,parents)',
    } as any);
    return { ok: true, sample: res.data.files ?? [], drive: dmeta.data };
  }

  // Fallback: informazioni generali
  const about = await drive.about.get({
    fields: 'user,storageQuota',
    supportsAllDrives: true,
  } as any);
  return { ok: true, about: about.data };
}
