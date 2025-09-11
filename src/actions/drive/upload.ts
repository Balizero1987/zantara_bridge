import { Request, Response } from 'express';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { impersonatedClient } from '../../google';
import { withAllDrives } from '../../core/drive';

type UploadBody = {
  filename: string;
  mimeType?: string;
  content: string;
  folderId?: string;
};

export async function uploadDriveFileHandler(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as Partial<UploadBody>;
    const filename = (body.filename || '').toString().trim();
    const content = (body.content || '').toString();
    const mimeType = (body.mimeType || 'text/plain').toString();
    const folderId = body.folderId || process.env.MEMORY_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID || '';
    if (!filename || !content) return res.status(400).json({ ok: false, error: 'Missing filename/content' });
    if (!folderId) return res.status(500).json({ ok: false, error: 'Missing folderId and MEMORY_DRIVE_FOLDER_ID' });

    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });

    const stream = Readable.from(Buffer.from(content, 'utf8'));
    const { data } = await drive.files.create(withAllDrives({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType, body: stream },
      fields: 'id,name,webViewLink',
    } as any) as any);

    (req as any).log?.info?.({ action: 'drive.upload', filename, folderId, id: (data as any)?.id });
    return res.json({ id: (data as any)?.id, name: (data as any)?.name, webViewLink: (data as any)?.webViewLink });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.upload', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'drive.upload failed', details: gerr || undefined });
  }
}
