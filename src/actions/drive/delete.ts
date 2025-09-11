import { Request, Response } from 'express';
import { google } from 'googleapis';
import { withAllDrives } from '../../core/drive';
import { impersonatedClient } from '../../google';

export async function deleteDriveFileHandler(req: Request, res: Response) {
  try {
    const { fileId } = req.body || {};
    if (!fileId) return res.status(400).json({ ok: false, error: 'Missing fileId' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    await drive.files.delete(withAllDrives({ fileId } as any) as any);
    (req as any).log?.info?.({ action: 'drive.delete', fileId });
    return res.json({ ok: true });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.delete', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'drive.delete failed', details: gerr || undefined });
  }
}
