import type { Request, Response } from 'express';
import { Router } from 'express';
import { createHash } from 'crypto';
import { GoogleAuth } from 'google-auth-library';

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

const router = Router();

// GET /diag/auth
router.get('/diag/auth', (req: Request, res: Response) => {
  const headerKey = (req.header('X-API-KEY') || req.header('x-api-key') || '').trim();
  const headerPresent = !!headerKey;
  const headerHash = headerPresent ? sha256(headerKey) : null;

  const envs = [
    { name: 'ZANTARA_PLUGIN_API_KEY', value: process.env.ZANTARA_PLUGIN_API_KEY },
  ];

  const seen: Array<{ name: string; present: boolean; envHash: string | null; eq: boolean }> = [];

  for (const { name, value } of envs) {
    const present = !!(value && value.trim());
    const envHash = present ? sha256(String(value)) : null;
    const eq = !!(headerHash && envHash && headerHash === envHash);
    seen.push({ name, present, envHash, eq });
  }

  // API_KEYS (CSV)
  const apiKeysCsv = (process.env.API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
  const csvPresent = apiKeysCsv.length > 0;
  const csvEq = headerPresent
    ? apiKeysCsv.some(k => sha256(k) === headerHash)
    : false;
  seen.push({ name: 'API_KEYS', present: csvPresent, envHash: null, eq: csvEq });

  res.json({
    ok: true,
    headerPresent,
    headerHash,
    seen,
  });
});

// GET /diag/google
router.get('/diag/google', async (_req: Request, res: Response) => {
  try {
    const credsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!credsRaw) {
      return res.status(500).json({ ok: false, error: 'missing_sa_key' });
    }
    const credentials = JSON.parse(credsRaw);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
      // Direct service account - no clientOptions needed
    });
    const client = await auth.getClient();
    const t: any = await (client as any).getAccessToken();
    const tok = typeof t === 'string' ? t : (t?.token || '');
    const token_preview = tok ? `${String(tok).slice(0, 12)}...` : 'none';
    return res.json({ 
      ok: true, 
      service_account: credentials.client_email,
      token_preview 
    });
  } catch (e: any) {
    // Do not log token or secrets
    return res.status(500).json({ ok: false, error: 'diag_google_failed', message: e?.message || String(e) });
  }
});

// GET /diag/drive - Test direct service account Drive API access
router.get('/diag/drive', async (req: Request, res: Response) => {
  try {
    const credsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!credsRaw) return res.status(500).json({ ok: false, error: 'missing_sa_key' });
    const credentials = JSON.parse(credsRaw);
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
    const client: any = await auth.getClient();
    const t: any = await client.getAccessToken();
    const token = typeof t === 'string' ? t : (t?.token || '');
    const token_preview = token ? `${String(token).slice(0, 12)}...` : 'none';

    const driveId = (req.query.driveId as string) || process.env.DRIVE_ID_AMBARADAM || '';
    const q = (req.query.q as string) || 'trashed=false';
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'files(id,name,parents,webViewLink)');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (driveId) {
      url.searchParams.set('corpora', 'drive');
      url.searchParams.set('driveId', driveId);
    }
    const fres = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const files: any = await fres.json();
    if (!fres.ok) throw new Error(files?.error?.message || `HTTP ${fres.status}`);

    return res.json({
      ok: true,
      token_preview,
      shared_drive_id: driveId || null,
      query: q,
      count: files.files?.length || 0,
      files: files.files || [],
      sa_email: credentials.client_email,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'unknown' });
  }
});

// GET /diag/drive/today?owner=SURYA&type=Chat|Notes|Brief
router.get('/diag/drive/today', async (req: Request, res: Response) => {
  try {
    const ownerRaw = String(req.query.owner || '').trim();
    const kind = String(req.query.type || 'Chat').trim();
    if (!ownerRaw) return res.status(400).json({ ok: false, error: 'owner required' });

    const owner = ownerRaw.toUpperCase().replace(/_/g, ' ').trim();
    const today = new Date().toISOString().slice(0, 10);

    const token = await getAccessTokenSA();
    const driveId = (process.env.DRIVE_ID_AMBARADAM || '').trim();
    if (!driveId) return res.status(500).json({ ok: false, error: 'DRIVE_ID_AMBARADAM missing' });
    let ambRoot = (process.env.DRIVE_FOLDER_AMBARADAM || '').trim() || null;
    if (!ambRoot) ambRoot = await findFolderByNameInDrive(token, driveId, 'AMBARADAM');
    if (!ambRoot) return res.status(404).json({ ok: false, error: 'AMBARADAM not found' });

    const ownerId = await findFolderByNameInParent(token, ambRoot, owner);
    if (!ownerId) return res.status(404).json({ ok: false, error: `owner folder not found: ${owner}` });
    const subId = await findFolderByNameInParent(token, ownerId, kind);
    if (!subId) return res.status(404).json({ ok: false, error: `${kind} folder not found for ${owner}` });

    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${subId}' in parents and trashed=false`);
    url.searchParams.set('fields', 'files(id,name,webViewLink)');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    const fres = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data: any = await fres.json();
    const files: Array<{id:string;name:string;webViewLink?:string}> = data?.files || [];

    const filtered = files.filter(f => matchToday(f.name, owner, kind, today));
    return res.json({ ok: true, owner, type: kind, date: today, count: filtered.length, files: filtered });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'diag_today_failed' });
  }
});

function matchToday(name: string, owner: string, kind: string, today: string): boolean {
  if (kind === 'Chat') return name.startsWith(`${today}__`) && name.endsWith('__chat.md');
  if (kind === 'Notes') return name === `Note-${owner}-${today}.md`;
  if (kind === 'Brief') return name === `Brief-${owner}-${today}.docx`;
  return false;
}

async function getAccessTokenSA(): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library');
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  const client: any = await auth.getClient();
  const tok: any = await client.getAccessToken();
  const token = typeof tok === 'string' ? tok : (tok?.token || tok?.access_token || '');
  if (!token) throw new Error('No access token');
  return token;
}

async function findFolderByNameInParent(token: string, parentId: string, name: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data: any = await res.json();
  return data?.files?.[0]?.id || null;
}

async function findFolderByNameInDrive(token: string, driveId: string, name: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('corpora', 'drive');
  url.searchParams.set('driveId', driveId);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data: any = await res.json();
  return data?.files?.[0]?.id || null;
}
export default function registerDiag(app: any) {
  app.use('/', router);
}
