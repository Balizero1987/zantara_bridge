import { Request, Response } from 'express';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { impersonatedClient } from '../../google';
import { resolveFolderPath } from '../../lib/googleApiHelpers';
import { getCurrentUser } from '../../api/identity';

type UploadBody = {
  filename: string;
  mimeType?: string;
  content: string;
  folderId?: string;
  folderName?: string; // e.g., "BOSS"
  folderPath?: string; // e.g., "AMBARADAM/BOSS/Notes"
  owner?: string;      // e.g., username to build path
};

export async function uploadDriveFileHandler(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as Partial<UploadBody>;
    const filename = (body.filename || '').toString().trim();
    const content = (body.content || '').toString();
    const mimeType = (body.mimeType || 'text/plain').toString();
    let folderId = (body.folderId || '').toString().trim();
    const folderName = (body.folderName || '').toString().trim();
    const folderPath = (body.folderPath || '').toString().trim();
    const owner = (body.owner || '').toString().trim();
    if (!filename || !content) return res.status(400).json({ ok: false, error: 'Missing filename/content' });

    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    if (!user) {
      return res.status(500).json({ ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER for Drive impersonation' });
    }
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });

    // Resolve folder by path or name if folderId not supplied
    if (!folderId) {
      let targetPath = '';
      if (folderPath) targetPath = folderPath;
      else if (folderName && owner) targetPath = `AMBARADAM/${folderName}/${owner}`;
      else if (folderName) targetPath = `AMBARADAM/${folderName}`;
      else {
        // Default per utente: AMBARADAM/<USER>/Notes (configurabile via env)
        const u = getCurrentUser();
        const root = process.env.DEFAULT_FOLDER_ROOT || 'AMBARADAM';
        const leaf = process.env.DEFAULT_FOLDER_LEAF || 'Notes';
        if (u?.name) targetPath = `${root}/${u.name}/${leaf}`;
      }
      if (targetPath) {
        const resolved = await resolveFolderPath(targetPath, ic.auth, true);
        if (!resolved) return res.status(404).json({ ok: false, error: 'Unable to resolve folderPath/name', folderPath: targetPath });
        folderId = resolved.id;
      }
    }
    if (!folderId) return res.status(400).json({ ok: false, error: 'Missing folderId or folderPath/folderName' });

    const buffer = Buffer.from(content, 'utf8');
    const stream = Readable.from(buffer);

    // Use resumable upload for large payloads
    const useResumable = buffer.length > 5 * 1024 * 1024; // >5MB

    // Simple retry with exponential backoff for transient errors
    const maxAttempts = 3;
    let attempt = 0;
    let lastErr: any = null;
    while (attempt < maxAttempts) {
      try {
        const { data } = await drive.files.create({
          requestBody: { name: filename, parents: [folderId] },
          media: { mimeType, body: stream },
          fields: 'id,name,webViewLink',
          supportsAllDrives: true,
          // @ts-ignore: googleapis allows uploadType
          uploadType: useResumable ? 'resumable' : undefined,
        } as any);

        (req as any).log?.info?.({ action: 'drive.upload', filename, folderId, id: (data as any)?.id, attempt: attempt + 1, resumable: useResumable });
        return res.json({ id: (data as any)?.id, name: (data as any)?.name, webViewLink: (data as any)?.webViewLink });
      } catch (e: any) {
        lastErr = e;
        const status = e?.response?.status || 0;
        const transient = status === 429 || (status >= 500 && status <= 599);
        (req as any).log?.warn?.({ action: 'drive.upload.retry', attempt: attempt + 1, status, transient, error: e?.message || String(e) });
        if (!transient || attempt === maxAttempts - 1) break;
        const delay = Math.pow(2, attempt) * 250; // 250ms, 500ms, 1000ms
        await new Promise(r => setTimeout(r, delay));
        attempt++;
        continue;
      }
    }

    // If we reach here, all attempts failed
    const status = lastErr?.response?.status || 500;
    const gerr = lastErr?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.upload', error: lastErr?.message || String(lastErr), status, gerr, filename, folderId });
    return res.status(status).json({ ok: false, error: lastErr?.message || 'drive.upload failed', details: gerr || undefined });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.upload', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'drive.upload failed', details: gerr || undefined });
  }
}
