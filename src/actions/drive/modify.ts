import { Request, Response } from 'express';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { impersonatedClient } from '../../google';

export async function modifyDriveFileHandler(req: Request, res: Response) {
  try {
    const { fileId, content, mimeType } = req.body || {};
    if (!fileId || typeof content !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing fileId/content' });
    }
    const mt = (mimeType || '').toString().trim() || 'text/plain';
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ]);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    const stream = Readable.from(Buffer.from(content, 'utf8'));
    const { data } = await drive.files.update({
      fileId,
      media: { mimeType: mt, body: stream },
      fields: 'id,name,modifiedTime',
      supportsAllDrives: true,
    } as any);
    (req as any).log?.info?.({ action: 'drive.modify', fileId, mimeType: mt });
    return res.json({ ok: true, id: data.id, name: (data as any).name, modifiedTime: (data as any).modifiedTime });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.modify', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'drive.modify failed', details: gerr || undefined });
  }
}

