import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function commentDriveFileHandler(req: Request, res: Response) {
  try {
    const { fileId, content, anchor } = req.body || {};
    if (!fileId || !content) return res.status(400).json({ ok: false, error: 'Missing fileId/content' });
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    const requestBody: any = { content: String(content) };
    if (anchor) requestBody.anchor = String(anchor);
    const { data } = await (drive as any).comments.create({ fileId, requestBody, fields: 'id,content,author/displayName,createdTime' });
    (req as any).log?.info?.({ action: 'drive.comment', fileId, commentId: data.id });
    return res.json({ ok: true, id: data.id, content: data.content, author: (data as any)?.author, createdTime: (data as any)?.createdTime });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.comment', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'drive.comment failed', details: gerr || undefined });
  }
}

