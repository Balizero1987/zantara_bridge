import { Express, Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from './google';
import { actionsWhoamiHandler } from './actions/debug/whoami';
import { requireApiKey } from './middleware/auth';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

type CheckResult = { ok: boolean; error?: string; details?: any };

async function checkDrive(user: string): Promise<CheckResult> {
  try {
    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ]);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    const { data } = await drive.files.list({
      pageSize: 1,
      fields: 'files(id,name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return { ok: true, details: { sample: data.files?.[0] || null } };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function checkCalendar(user: string): Promise<CheckResult> {
  try {
    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/calendar',
    ]);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    const { data } = await calendar.calendarList.list({ maxResults: 1 });
    return { ok: true, details: { sample: data.items?.[0]?.id || null } };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function checkGmail(user: string): Promise<CheckResult> {
  try {
    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/gmail.send',
    ]);
    // Token obtainable implies DWD + scope OK for send
    const token = await (ic.auth as any).authorize();
    if (!token || !token.access_token) throw new Error('No access token');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function checkChat(): Promise<CheckResult> {
  try {
    const auth = await google.auth.getClient({ scopes: ['https://www.googleapis.com/auth/chat.bot'] });
    const token = await auth.getAccessToken();
    if (!token || !token.token) throw new Error('No access token');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function debugRoutes(app: Express) {
  // Service Account info + DWD validation
  app.get('/debug/sa-info', requireApiKey, async (req: Request, res: Response) => {
    try {
      const secretEnv = process.env.SA_JSON_SECRET || process.env.GOOGLE_SA_JSON_SECRET || '';
      let parsed: any | null = null;
      if (secretEnv && (secretEnv.trim().startsWith('{') || secretEnv.includes('"private_key"'))) {
        try { parsed = JSON.parse(secretEnv); } catch {/* fallthrough */}
      }
      if (!parsed) {
        const sm = new SecretManagerServiceClient();
        const projectId = await google.auth.getProjectId();
        if (!projectId) throw new Error('Unable to resolve GCP project id via ADC');
        const name = `projects/${projectId}/secrets/${secretEnv}/versions/latest`;
        const [access] = await sm.accessSecretVersion({ name });
        const payload = access.payload?.data?.toString() || '';
        if (!payload) throw new Error('Secret payload empty');
        parsed = JSON.parse(payload);
      }
      const info = {
        client_id: parsed.client_id || null,
        client_email: parsed.client_email || null,
        project_id: parsed.project_id || null,
      };

      const allowed = (process.env.ALLOWED_CLIENT_IDS || '')
        .split(',').map(s => s.trim()).filter(Boolean);
      const allowedMatch = info.client_id ? allowed.includes(info.client_id) : false;
      const user = process.env.IMPERSONATE_USER || '';
      let aboutEmail: string | null = null;
      try {
        const ic = await impersonatedClient(user, [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
        ]);
        const drive = google.drive({ version: 'v3', auth: ic.auth });
        const about = await drive.about.get({ fields: 'user', supportsAllDrives: true } as any);
        // @ts-ignore
        aboutEmail = (about.data.user && (about.data.user.emailAddress as string)) || null;
      } catch (e: any) {
        (req as any).log?.warn?.({ action: 'debug.sa-info.drive.about', error: e?.message || String(e) });
      }

      // Structured log summary
      const logEntry = { action: 'debug.sa-info', ...info, allowedConfigured: allowed.length, allowedMatch, aboutEmail };
      if (allowed.length && !allowedMatch) (req as any).log?.warn?.(logEntry); else (req as any).log?.info?.(logEntry);

      return res.json({ ok: true, info, allowedMatch, aboutEmail });
    } catch (e: any) {
      (req as any).log?.error?.({ action: 'debug.sa-info', error: e?.message || String(e) });
      return res.status(500).json({ ok: false, error: e?.message || 'sa-info failed' });
    }
  });
  // Summarize effective identities and quick capability probe
  app.get('/debug/whoami', requireApiKey, async (_req: Request, res: Response) => {
    const user = process.env.IMPERSONATE_USER || '';
    const out: any = {
      impersonatedUser: user || null,
      drive: null,
      calendar: null,
      gmail: null,
      sharedDrive: null,
    };
    try {
      const ic = await impersonatedClient(user, [
        'https://www.googleapis.com/auth/drive',
      ]);
      const drive = google.drive({ version: 'v3', auth: ic.auth });
      const about = await drive.about.get({ fields: 'user,storageQuota', supportsAllDrives: true } as any);
      out.drive = { user: about.data.user || null };

      // If a Shared Drive ID is configured, verify access and basic metadata
      const sharedId = process.env.ZANTARA_SHARED_DRIVE_ID;
      if (sharedId) {
        try {
          const dr = await (drive as any).drives.get({ driveId: sharedId });
          out.sharedDrive = { id: sharedId, name: dr.data?.name || null };
        } catch (e: any) {
          out.sharedDrive = { id: sharedId, error: e?.message || String(e) };
        }
      }
    } catch (e: any) {
      out.drive = { error: e?.message || String(e) };
    }

    try {
      const ic = await impersonatedClient(user, [ 'https://www.googleapis.com/auth/calendar' ]);
      const calendar = google.calendar({ version: 'v3', auth: ic.auth });
      const cl = await calendar.calendarList.list({ maxResults: 10 });
      const items = cl.data.items || [];
      const visibleCalendarIds = items.map((c: any) => ({ id: c.id, summary: c.summary, primary: !!c.primary })).slice(0, 10);
      const primary = items.find((c: any) => c.primary) || null;
      out.calendar = { sampleCalendarId: items?.[0]?.id || null, visibleCalendarIds, primary: primary ? { id: primary.id, summary: primary.summary } : null };
    } catch (e: any) {
      out.calendar = { error: e?.message || String(e) };
    }

    try {
      const ic = await impersonatedClient(user, [ 'https://www.googleapis.com/auth/gmail.send' ]);
      const token = await (ic.auth as any).authorize();
      out.gmail = { accessToken: !!token?.access_token };
    } catch (e: any) {
      out.gmail = { error: e?.message || String(e) };
    }

    res.json({ ok: true, whoami: out, ts: new Date().toISOString() });
  });
  app.get('/debug/self-check', async (_req: Request, res: Response) => {
    const user = process.env.IMPERSONATE_USER || '';
    const env = {
      DRIVE_FOLDER_ID: !!process.env.DRIVE_FOLDER_ID,
      BALI_ZERO_CALENDAR_ID: !!process.env.BALI_ZERO_CALENDAR_ID,
      MEMORY_DRIVE_FOLDER_ID: !!process.env.MEMORY_DRIVE_FOLDER_ID,
      ZANTARA_SHARED_DRIVE_ID: !!process.env.ZANTARA_SHARED_DRIVE_ID,
      IMPERSONATE_USER: !!process.env.IMPERSONATE_USER,
      GMAIL_SENDER: !!process.env.GMAIL_SENDER,
      SA_JSON_SECRET: !!process.env.SA_JSON_SECRET || !!process.env.GOOGLE_SA_JSON_SECRET,
      GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
      GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
      GOOGLE_CLOUD_PROJECT: !!process.env.GOOGLE_CLOUD_PROJECT,
    };

    const results: Record<string, CheckResult> = {};
    results.drive = user ? await checkDrive(user) : { ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER' };
    results.calendar = user ? await checkCalendar(user) : { ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER' };
    results.gmail = user ? await checkGmail(user) : { ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER' };
    results.chat = await checkChat();

    res.json({ ok: true, env, results, ts: new Date().toISOString() });
  });
  // Actions endpoint: whoami (protected with API key)
  app.get('/actions/debug/whoami', requireApiKey as any, actionsWhoamiHandler as any);
}

export function debugRawRoutes(app: Express) {
  app.get('/debug/env/raw', requireApiKey, (_req: Request, res: Response) => {
    res.json({
      DRIVE_FOLDER_ID: process.env.DRIVE_FOLDER_ID || null,
      MEMORY_DRIVE_FOLDER_ID: process.env.MEMORY_DRIVE_FOLDER_ID || null,
      BALI_ZERO_CALENDAR_ID: process.env.BALI_ZERO_CALENDAR_ID || null,
      ZANTARA_SHARED_DRIVE_ID: process.env.ZANTARA_SHARED_DRIVE_ID || null,
    });
  });
}
