import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function duplicateDriveFileHandler(req: Request, res: Response) {
  try {
    const { fileId, newName, parentId } = req.body || {};
    if (!fileId) return res.status(400).json({ ok: false, error: 'Missing fileId' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    const requestBody: any = {};
    if (newName) requestBody.name = String(newName);
    if (parentId) requestBody.parents = [String(parentId)];
    const { data } = await drive.files.copy({ fileId, requestBody, fields: 'id,name,parents,webViewLink', supportsAllDrives: true } as any);
    (req as any).log?.info?.({ action: 'drive.duplicate', fileId, newId: data.id, name: data.name });
    return res.json({ ok: true, id: data.id, name: data.name, parents: (data as any).parents, webViewLink: (data as any).webViewLink });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.duplicate', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'drive.duplicate failed', details: gerr || undefined });
  }
}

