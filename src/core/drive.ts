import { GoogleAuth } from 'google-auth-library';
import { google, drive_v3 } from 'googleapis';

// Parse service account JSON from environment variables
function parseSaKeyFromEnv(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.ZANTARA_WORKSPACE_SA_KEY;
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj.client_email && obj.private_key) return obj;
  } catch {
    // ignore
  }
  return null;
}

let _drive: drive_v3.Drive | null = null;

export function getDrive(): drive_v3.Drive {
  if (_drive) return _drive;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const subject = (process.env.DRIVE_SUBJECT || '').trim();
  if (!raw) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
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

export async function getDriveClient(): Promise<drive_v3.Drive> {
  return getDrive();
}

export function validateDriveId(id: string | undefined | null): boolean {
  const s = String(id || '').trim();
  return /^0A[\w-]+$/.test(s);
}

export async function getDriveWhoAmI(): Promise<drive_v3.Schema$User | undefined> {
  const drive = getDrive();
  const about = await drive.about.get({ fields: 'user(emailAddress,displayName,permissionId)', supportsAllDrives: true } as any);
  return about.data.user as any;
}

// Unified whoami with About or minimal Shared Drive list
export async function whoami(): Promise<{ ok: true; about?: any; sample?: any }>{
  const driveId = process.env.DRIVE_ID_AMBARADAM;
  const drive = getDrive();
  if (validateDriveId(driveId)) {
    const res = await drive.files.list({
      pageSize: 1,
      driveId: driveId!,
      corpora: 'drive',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      q: `'${driveId}' in parents`,
      fields: 'files(id,name,driveId,parents)'
    } as any);
    return { ok: true, sample: res.data.files ?? [] };
  }

  const about = await drive.about.get({ fields: 'user,storageQuota', supportsAllDrives: true } as any);
  return { ok: true, about: about.data };
}
