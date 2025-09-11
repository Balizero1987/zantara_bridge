import { google, drive_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

let _drive: drive_v3.Drive | null = null;

/**
 * Restituisce un client Google Drive usando il service account diretto
 * (non serve Domain-Wide Delegation se il SA è già membro della Shared Drive).
 */
export async function getDrive(): Promise<drive_v3.Drive> {
  // build Drive client using Service Account only (no DWD subject)
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  const client = await auth.getClient();
  _drive = google.drive({ version: 'v3', auth: client as any });
  return _drive;
}

/**
 * Compatibilità con vecchi import.
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  return await getDrive();
}

/**
 * Recupera info sull’utente impersonato.
 */
export async function getDriveWhoAmI(): Promise<drive_v3.Schema$User | undefined> {
  try {
    const drive = await getDrive();
    const about = await drive.about.get({
      fields: 'user(emailAddress,displayName,permissionId)',
      supportsAllDrives: true,
    } as any);
    return about.data.user as any;
  } catch (_e) {
    return undefined;
  }
}

/**
 * whoami(): test di accesso. BYPASS SHARED DRIVE per evitare DWD issues.
 */
export async function whoami(): Promise<{ ok: true; about?: any; sample?: any; drive?: any; user?: any; service_account?: string | null }> {
  // Acquire raw token via SA and hit Drive REST directly
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  const client: any = await auth.getClient();
  const tok: any = await client.getAccessToken();
  const token = typeof tok === 'string' ? tok : (tok?.token || tok?.access_token || '');
  if (!token) throw new Error('No access token');

  const headers: any = { Authorization: `Bearer ${token}` };

  // About via REST (avoid googleapis bug in some SA contexts)
  let about: any = null;
  try {
    const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota&supportsAllDrives=true', { headers });
    about = await r.json();
  } catch (_e) { /* ignore */ }

  const sharedId = (process.env.DRIVE_ID_AMBARADAM || '').trim();
  let sample: any[] | undefined;
  let driveMeta: any | undefined;

  if (sharedId) {
    try {
      const md = await fetch(`https://www.googleapis.com/drive/v3/drives/${encodeURIComponent(sharedId)}`, { headers });
      driveMeta = await (md.json() as any);
      const url = `https://www.googleapis.com/drive/v3/files?driveId=${encodeURIComponent(sharedId)}&corpora=drive&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1&q=trashed=false&fields=files(id,name)`;
      const res = await fetch(url, { headers });
      const data: any = await res.json();
      sample = data.files || [];
    } catch (e: any) {
      // Fallback: list from My Drive for SA
      const url = 'https://www.googleapis.com/drive/v3/files?corpora=user&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1&q=trashed=false&fields=files(id,name)';
      const res = await fetch(url, { headers });
      const data: any = await res.json();
      sample = data.files || [];
      driveMeta = { id: sharedId, error: e?.message || 'forbidden' };
    }
  } else {
    const url = 'https://www.googleapis.com/drive/v3/files?corpora=user&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1&q=trashed=false&fields=files(id,name)';
    const res = await fetch(url, { headers });
    const data: any = await res.json();
    sample = data.files || [];
  }

  return {
    ok: true,
    about,
    sample,
    drive: driveMeta,
    user: about?.user || null,
    service_account: credentials?.client_email || null,
  };
}

// ===============
// Shared Drive helpers (centralized flags)
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

export function withAllDrives<T extends Record<string, any>>(overrides: T): T & { supportsAllDrives: true } {
  return { supportsAllDrives: true, ...overrides } as any;
}

export function ensureParentsInSharedDrive(parents?: string[] | null): string[] | undefined {
  const driveId = getSharedDriveId();
  const list = Array.isArray(parents) ? parents.slice() : [];
  if (driveId && !list.includes(driveId)) list.unshift(driveId);
  return list.length ? list : undefined;
}
