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

  let sample: any[] = [];
  let driveMeta: any = { info: 'My Drive context (no shared drive)' };
  try {
    const url =
      'https://www.googleapis.com/drive/v3/files?corpora=user&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1&q=trashed=false&fields=files(id,name)';
    const res = await fetch(url, { headers });
    const data = res.ok ? await res.json() : { files: [], error: await res.text() };
    sample = data.files || [];
  } catch (e: any) {
    sample = [];
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

// Deprecated helpers removed: we no longer use a Shared Drive root.
// All operations are now anchored by a folderId (DRIVE_FOLDER_AMBARADAM) in My Drive.

export type DriveContext = { folderId: string };

/**
 * Utility functions for dynamic folder resolution
 */
async function findFolderByNameGlobal(token: string, name: string): Promise<string | null> {
  console.log(`[DEBUG] findFolderByNameGlobal - searching for: ${name}`);
  try {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    url.searchParams.set('fields', 'files(id,name)');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    url.searchParams.set('corpora', 'allDrives');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.log(`[DEBUG] findFolderByNameGlobal - API error: ${res.status}`);
      return null;
    }
    const data: any = await res.json();
    const folderId = data?.files?.[0]?.id || null;
    console.log(`[DEBUG] findFolderByNameGlobal - result: ${folderId}`);
    return folderId;
  } catch (e: any) {
    console.log(`[DEBUG] findFolderByNameGlobal - exception: ${e.message}`);
    return null;
  }
}

async function ensurePathUnderParent(token: string, rootId: string, segments: string[]): Promise<string> {
  console.log(`[DEBUG] ensurePathUnderParent - rootId: ${rootId}, segments: ${segments.join('/')}`);
  let parent = rootId;
  for (const seg of segments) {
    const q = `name='${seg.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parent}' in parents and trashed=false`;
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'files(id,name)');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    const sres = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const sdata: any = await sres.json();
    let id: string | undefined = sdata?.files?.[0]?.id;
    if (!id) {
      console.log(`[DEBUG] ensurePathUnderParent - creating folder: ${seg} under ${parent}`);
      const cres = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: seg, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }),
      });
      if (!cres.ok) throw new Error(`Create folder failed: ${cres.status}`);
      const cdata: any = await cres.json();
      id = cdata.id;
    }
    if (!id) throw new Error(`Failed to resolve folder: ${seg}`);
    parent = id;
    console.log(`[DEBUG] ensurePathUnderParent - resolved ${seg} to: ${id}`);
  }
  return parent;
}

/**
 * Enhanced resolveDriveContext with dynamic folder resolution fallback
 */
export async function resolveDriveContext(ownerRaw?: string): Promise<DriveContext> {
  console.log('[DEBUG] resolveDriveContext - starting resolution');
  
  // Try environment variable first
  const envFolderId = (process.env.DRIVE_FOLDER_AMBARADAM || '').trim();
  console.log('[DEBUG] resolveDriveContext - DRIVE_FOLDER_AMBARADAM:', envFolderId || '(empty)');
  
  if (envFolderId) {
    console.log('[DEBUG] resolveDriveContext - using env folderId:', envFolderId);
    return { folderId: envFolderId };
  }
  
  // Fallback to dynamic resolution
  console.log('[DEBUG] resolveDriveContext - attempting dynamic resolution');
  
  try {
    const { token } = await getAccessToken();
    const rootFolder = process.env.DEFAULT_FOLDER_ROOT || 'AMBARADAM';
    const owner = (ownerRaw || 'BOSS').toUpperCase();
    
    console.log('[DEBUG] resolveDriveContext - DEFAULT_FOLDER_ROOT:', rootFolder);
    console.log('[DEBUG] resolveDriveContext - owner:', owner);
    
    // Try to find root folder by name
    let ambaradamId = await findFolderByNameGlobal(token, rootFolder);
    
    if (!ambaradamId) {
      console.warn('[WARN] resolveDriveContext - root folder not found, creating it');
      // Create root folder if it doesn't exist
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: rootFolder, 
          mimeType: 'application/vnd.google-apps.folder' 
        }),
      });
      if (!createRes.ok) {
        throw new Error(`Failed to create root folder ${rootFolder}: ${createRes.status}`);
      }
      const createData: any = await createRes.json();
      ambaradamId = createData.id;
      console.log('[DEBUG] resolveDriveContext - created root folder:', ambaradamId);
    }
    
    // Ensure owner subfolder exists  
    if (!ambaradamId) throw new Error('Failed to resolve AMBARADAM folder');
    const finalFolderId = await ensurePathUnderParent(token, ambaradamId, [owner]);
    console.log('[DEBUG] resolveDriveContext - final folderId:', finalFolderId);
    
    return { folderId: finalFolderId };
    
  } catch (e: any) {
    console.error('[ERROR] resolveDriveContext - dynamic resolution failed:', e.message);
    throw new Error('AMBARADAM authentication required');
  }
}

/**
 * Legacy synchronous version for backward compatibility
 */
export function resolveDriveContextSync(): DriveContext {
  const folderId = (process.env.DRIVE_FOLDER_AMBARADAM || '').trim();
  if (!folderId) throw new Error('Missing DRIVE_FOLDER_AMBARADAM');
  return { folderId };
}
