import { google, drive_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

let _drive: drive_v3.Drive | null = null;

/**
 * Helpers env: usa TEST_* se presenti (diagnostica),
 * altrimenti fallback a DRIVE_SUBJECT / DRIVE_ID_AMBARADAM.
 */
function getDriveSubject(): string | null {
  return (
    (process.env.TEST_SUBJECT ||
      process.env.DRIVE_SUBJECT ||
      '').trim() || null
  );
}

function getSharedDriveId(): string | null {
  return (
    (process.env.TEST_DRIVE_ID ||
      process.env.DRIVE_ID_AMBARADAM ||
      '').trim() || null
  );
}

/**
 * Restituisce un client Google Drive memoizzato
 * usando impersonation (Domain-Wide Delegation).
 */
export function getDrive(): drive_v3.Drive {
  if (_drive) return _drive;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const subject = getDriveSubject();

  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!subject) throw new Error('Missing DRIVE_SUBJECT/TEST_SUBJECT');

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
 * Recupera info sull’utente impersonato (about.user).
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
 * whoami(): test di accesso a Drive (My Drive o Shared Drive).
 */
export async function whoami(): Promise<{
  ok: true;
  about?: any;
  sample?: any;
  drive?: any;
  user?: any;
  impersonating?: any;
}> {
  const drive = getDrive();
  const subject = getDriveSubject();
  const sharedId = getSharedDriveId();

  // Always fetch about info
  const about = await drive.about.get({
    fields: 'user(emailAddress,displayName),storageQuota',
    supportsAllDrives: true,
  } as any);

  let sample: any[] | undefined;
  let driveMeta: any | undefined;

  if (sharedId) {
    try {
      // Metadata dello Shared Drive
      const d = await (drive as any).drives.get({ driveId: sharedId });
      driveMeta = d.data;

      // Lista di un file di esempio nella Shared Drive
      const lst = await drive.files.list({
        pageSize: 1,
        fields: 'files(id,name)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'drive',
        driveId: sharedId,
        q: 'trashed=false',
      } as any);
      sample = lst.data.files || [];
    } catch (e: any) {
      // Se fallisce (403/404), fallback su My Drive
      const lst = await drive.files.list({
        pageSize: 1,
        fields: 'files(id,name)',
        q: 'trashed=false',
      } as any);
      sample = lst.data.files || [];
      driveMeta = { id: sharedId, error: e?.message || 'forbidden' };
    }
  } else {
    // Nessun Shared Drive configurato → My Drive
    const lst = await drive.files.list({
      pageSize: 1,
      fields: 'files(id,name)',
      q: 'trashed=false',
    } as any);
    sample = lst.data.files || [];
  }

  return {
    ok: true,
    about: about.data,
    sample,
    drive: driveMeta,
    user: about.data.user,
    impersonating: subject,
  };
}
