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

export default function registerDiag(app: any) {
  app.use('/', router);
}
