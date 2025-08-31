import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

const GOOGLE_DOCS = 'application/vnd.google-apps.document';

export async function convertDriveFileHandler(req: Request, res: Response) {
  try {
    const { fileId, targetMimeType, newName, parentId } = req.body || {};
    if (!fileId || !targetMimeType) return res.status(400).json({ ok: false, error: 'Missing fileId/targetMimeType' });
    const target = String(targetMimeType);
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });

    if (target === 'application/pdf') {
      // Export current file (must be a Google Docs-type) to PDF
      const resp = await drive.files.export({ fileId, mimeType: target }, { responseType: 'arraybuffer' } as any);
      const base64 = Buffer.from(resp.data as any).toString('base64');
      (req as any).log?.info?.({ action: 'drive.convert.export', fileId, target });
      return res.json({ ok: true, fileId, target, contentBase64: base64 });
    }

    if (target.startsWith('application/vnd.google-apps.')) {
      // Convert/import to Google Docs format by copying with target mimeType
      const requestBody: any = { mimeType: target };
      if (newName) requestBody.name = String(newName);
      if (parentId) requestBody.parents = [String(parentId)];
      const { data } = await drive.files.copy({ fileId, requestBody, fields: 'id,name,mimeType,webViewLink', supportsAllDrives: true } as any);
      (req as any).log?.info?.({ action: 'drive.convert.import', fileId, target, newId: data.id });
      return res.json({ ok: true, id: data.id, name: data.name, mimeType: data.mimeType, webViewLink: (data as any)?.webViewLink });
    }

    return res.status(400).json({ ok: false, error: 'Unsupported targetMimeType. Use application/pdf or application/vnd.google-apps.*' });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'drive.convert', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'drive.convert failed', details: gerr || undefined });
  }
}

