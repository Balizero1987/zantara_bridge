import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function actionsWhoamiHandler(req: Request, res: Response) {
  try {
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/drive.readonly',
    ]);
    const oauth2 = google.oauth2({ version: 'v2', auth: ic.auth as any });
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    const [uinfo, about] = await Promise.all([
      oauth2.userinfo.get({} as any),
      drive.about.get({ fields: 'user,permissionId', supportsAllDrives: true } as any),
    ]);
    const email = (uinfo.data as any)?.email || null;
    const userId = (uinfo.data as any)?.id || null;
    const drivePermissionId = (about.data as any)?.permissionId || (about.data as any)?.user?.permissionId || null;
    const domain = email ? String(email).split('@')[1] : null;
    const env = {
      PROJECT: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null,
      IMPERSONATE_USER: !!process.env.IMPERSONATE_USER,
      GMAIL_SENDER: !!process.env.GMAIL_SENDER,
      MEMORY_DRIVE_FOLDER_ID: !!process.env.MEMORY_DRIVE_FOLDER_ID,
      BALI_ZERO_CALENDAR_ID: !!process.env.BALI_ZERO_CALENDAR_ID,
    };
    (req as any).log?.info?.({ action: 'actions.debug.whoami', email, userId, drivePermissionId, domain });
    return res.json({ email, userId, drivePermissionId, domain, env });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'actions.debug.whoami', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'whoami failed', details: gerr || undefined });
  }
}

