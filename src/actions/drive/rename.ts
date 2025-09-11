import { Request, Response } from 'express';
import { google } from 'googleapis';
import { withAllDrives } from '../../core/drive';
import { impersonatedClient } from '../../google';

export async function renameDriveFileHandler(req: Request, res: Response) {
  try {
    const { fileId, name } = req.body || {};
    if (!fileId || !name) return res.status(400).json({ ok: false, error: 'Missing fileId/name' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    const { data } = await drive.files.update(withAllDrives({ fileId, requestBody: { name }, fields: 'id,name' } as any) as any);
    (req as any).log?.info?.({ action: 'drive.rename', fileId, name: data.name });
    return res.json({ ok: true, id: data.id, name: data.name });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.rename', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'drive.rename failed', details: gerr || undefined });
  }
}
