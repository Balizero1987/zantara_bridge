import { google, drive_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

let _drive: drive_v3.Drive | null = null;

/**
 * Restituisce un client Google Drive usando il service account diretto.
 * Il SA deve essere già membro della Shared Drive.
 */
export async function getDrive(): Promise<drive_v3.Drive> {
  if (_drive) return _drive;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');

  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const client = await auth.getClient();
  _drive = google.drive({ version: 'v3', auth: client as any });
  return _drive;
}

/**
 * Compatibilità con vecchi import.
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  return getDrive();
}

/**
 * Recupera info sull’utente impersonato dal SA.
 */
export async function getDriveWhoAmI(): Promise<drive_v3.Schema$User | undefined> {
  try {
    const drive = await getDrive();
    const about = await drive.about.get({
      fields: 'user(emailAddress,displayName,permissionId)',
      supportsAllDrives: true,
    } as any);
    return about.data.user as any;
  } catch {
    return undefined;
  }
}

/**
 * Utility centralizzata per ottenere token Bearer del SA.
 */
async function getAccessToken(): Promise<{ token: string; clientEmail: string | null }> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const client: any = await auth.getClient();
  const tok: any = await client.getAccessToken();
  const token = typeof tok === 'string' ? tok : tok?.token || tok?.access_token || '';
  if (!token) throw new Error('No access token');
  return { token, clientEmail: credentials?.client_email || null };
}

/**
 * whoami(): test di accesso SA-only via REST API.
 */
export async function whoami(): Promise<{
  ok: true;
  about: any;
  sample: any[];
  drive: any;
  user: any;
  service_account: string | null;
}> {
  const { token, clientEmail } = await getAccessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  // About
  let about: any = {};
  try {
    const r = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user,storageQuota&supportsAllDrives=true',
      { headers }
    );
    about = r.ok ? await r.json() : { error: await r.text() };
  } catch (e: any) {
    about = { error: e?.message || 'about_failed' };
  }

  const sharedId = (process.env.DRIVE_ID_AMBARADAM || '').trim();
  let sample: any[] = [];
  let driveMeta: any = {};

  if (sharedId) {
    try {
      const md = await fetch(
        `https://www.googleapis.com/drive/v3/drives/${encodeURIComponent(sharedId)}`,
        { headers }
      );
      driveMeta = md.ok ? await md.json() : { error: await md.text() };

      const url = `https://www.googleapis.com/drive/v3/files?driveId=${encodeURIComponent(
        sharedId
      )}&corpora=drive&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1&q=trashed=false&fields=files(id,name)`;
      const res = await fetch(url, { headers });
      const data = res.ok ? await res.json() : { files: [], error: await res.text() };
      sample = data.files || [];
    } catch (e: any) {
      driveMeta = { id: sharedId, error: e?.message || 'forbidden' };
    }
  } else {
    try {
      const url =
        'https://www.googleapis.com/drive/v3/files?corpora=user&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1&q=trashed=false&fields=files(id,name)';
      const res = await fetch(url, { headers });
      const data = res.ok ? await res.json() : { files: [], error: await res.text() };
      sample = data.files || [];
    } catch (e: any) {
      sample = [];
    }
  }

  return {
    ok: true,
    about,
    sample,
    drive: driveMeta,
    user: about?.user || null,
    service_account: clientEmail,
  };
}

// ===============
// Shared Drive helpers
// ===============

export function getSharedDriveId(): string | null {
  const id = (process.env.DRIVE_ID_AMBARADAM || '').trim();
  return id || null;
}

export function listInSharedDriveParams(overrides: any = {}): any {
  const driveId = getSharedDriveId();
  return {
    corpora: 'drive',
    driveId: driveId || undefined,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    ...overrides,
  };
}

export function withAllDrives<T extends Record<string, any>>(
  overrides: T
): T & { supportsAllDrives: true } {
  return { supportsAllDrives: true, ...overrides } as any;
}

export function ensureParentsInSharedDrive(parents?: string[] | null): string[] | undefined {
  const driveId = getSharedDriveId();
  const list = Array.isArray(parents) ? parents.slice() : [];
  if (driveId && !list.includes(driveId)) list.unshift(driveId);
  return list.length ? list : undefined;
}
