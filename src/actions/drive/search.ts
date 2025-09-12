import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function searchDriveHandler(req: Request, res: Response) {
  try {
    const query = (req.query.query as string) || (req.body?.query as string) || '';
    const owner = (req.query.owner as string) || (req.body?.owner as string) || '';
    const pageSize = Math.min(parseInt(String(req.query.pageSize || '25'), 10) || 25, 100);
    const pageToken = (req.query.pageToken as string) || undefined;
    if (!query) return res.status(400).json({ ok: false, error: 'Missing query' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive.readonly']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    const esc = (s: string) => s.replace(/'/g, "\\'");
    // Basic fuzzy: name contains OR fullText contains
    const qParts = [
      `(name contains '${esc(query)}' or fullText contains '${esc(query)}')`,
      `trashed=false`,
    ];
    const q = qParts.join(' and ');
    const { data } = await drive.files.list({
      q,
      pageSize,
      pageToken,
      fields: 'nextPageToken, files(id,name,mimeType,owners(emailAddress),createdTime,modifiedTime,webViewLink)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'allDrives',
    } as any);
    let items = (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      owner: f.owners?.[0]?.emailAddress || null,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
    }));
    if (owner) items = items.filter(i => (i.owner || '').toLowerCase() === owner.toLowerCase());
    (req as any).log?.info?.({ action: 'drive.search', query, owner: owner || null, count: items.length });
    return res.json({ ok: true, items, nextPageToken: data.nextPageToken || null });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    return res.status(status).json({ ok: false, error: e?.message || 'drive.search failed' });
  }
}
