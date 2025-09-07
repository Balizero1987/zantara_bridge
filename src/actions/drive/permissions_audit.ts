import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function permissionsAuditHandler(req: Request, res: Response) {
  try {
    const fileId = (req.query.fileId as string) || (req.body?.fileId as string) || '';
    if (!fileId) return res.status(400).json({ ok: false, error: 'Missing fileId' });
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    const { data } = await drive.permissions.list({ fileId, fields: 'permissions(id,type,role,domain,expirationTime,emailAddress,displayName)', supportsAllDrives: true } as any);
    return res.json({ ok: true, fileId, permissions: data.permissions || [] });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.permissions.audit', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'drive.permissions.audit failed', details: gerr || undefined });
  }
}

