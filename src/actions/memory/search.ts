import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function memorySearchHandler(req: Request, res: Response) {
  try {
    const q = (req.query.q as string) || '';
    if (!q) return res.status(400).json({ ok: false, error: 'Missing q' });
    const folderId = process.env.MEMORY_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID || '';
    if (!folderId) return res.status(500).json({ ok: false, error: 'Missing MEMORY_DRIVE_FOLDER_ID' });

    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive.readonly']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });

    const escQ = (s: string) => s.replace(/'/g, "\\'");
    const query = `('${folderId}' in parents) and mimeType='text/markdown' and trashed=false and fullText contains '${escQ(q)}'`;

    const { data } = await drive.files.list({
      q: query,
      fields: 'files(id,name,createdTime,webViewLink)',
      pageSize: 50,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'allDrives',
    } as any);

    const items = (data.files || []).map((f: any) => ({ id: f.id, name: f.name, createdTime: f.createdTime, webViewLink: f.webViewLink }));
    (req as any).log?.info?.({ action: 'memory.search', q, folderId, count: items.length });
    return res.json({ ok: true, items });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'memory.search', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'memory.search failed', details: gerr || undefined });
  }
}

