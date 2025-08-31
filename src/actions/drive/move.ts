import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function moveDriveFileHandler(req: Request, res: Response) {
  try {
    const { fileId, newParentId } = req.body || {};
    if (!fileId || !newParentId) return res.status(400).json({ ok: false, error: 'Missing fileId/newParentId' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    const meta = await drive.files.get({ fileId, fields: 'id,parents', supportsAllDrives: true } as any);
    const prevParents = (meta.data.parents || []).join(',');
    const { data } = await drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: prevParents || undefined,
      fields: 'id,parents',
      supportsAllDrives: true,
    } as any);
    (req as any).log?.info?.({ action: 'drive.move', fileId, newParentId, parents: data.parents });
    return res.json({ ok: true, id: data.id, parents: data.parents });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.move', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'drive.move failed', details: gerr || undefined });
  }
}

