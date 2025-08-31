import { Request, Response } from 'express';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { impersonatedClient } from '../../google';

type Body = { title: string; content: string; tags?: string[] };

function tsLabel(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function memorySaveHandler(req: Request, res: Response) {
  try {
    const { title, content, tags } = (req.body || {}) as Partial<Body>;
    if (!title || !content) return res.status(400).json({ ok: false, error: 'Missing title/content' });
    const folderId = process.env.MEMORY_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID || '';
    if (!folderId) return res.status(500).json({ ok: false, error: 'Missing MEMORY_DRIVE_FOLDER_ID' });

    const safeTitle = String(title).trim().replace(/\s+/g, '-');
    const name = `${tsLabel()}_${safeTitle}.md`;
    const timestamp = new Date().toISOString();
    const tagsLine = (Array.isArray(tags) && tags.length) ? `Tags: ${tags.map(t => `#${String(t).trim().replace(/\s+/g, '-')}`).join(' ')}` : '';
    const md = `# ${title}\n[${timestamp}]\n${tagsLine}\n\n${content}\n`;

    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    const stream = Readable.from(Buffer.from(md, 'utf8'));
    const { data } = await drive.files.create({
      requestBody: { name, parents: [folderId] },
      media: { mimeType: 'text/markdown', body: stream },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true,
    } as any);
    (req as any).log?.info?.({ action: 'memory.save', id: (data as any)?.id, name: (data as any)?.name });
    return res.json({ id: (data as any)?.id, name: (data as any)?.name });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'memory.save', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'memory.save failed', details: gerr || undefined });
  }
}

