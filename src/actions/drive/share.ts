import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';
import { withAllDrives } from '../../core/drive';

export async function shareDriveFileHandler(req: Request, res: Response) {
  try {
    const { fileId, emailAddress, role } = req.body || {};
    const allowed = new Set(['reader', 'writer', 'commenter']);
    if (!fileId || !emailAddress || !allowed.has(String(role))) {
      return res.status(400).json({ ok: false, error: 'fileId, emailAddress, role(reader|writer|commenter) required' });
    }
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
    const drive = google.drive({ version: 'v3', auth: ic.auth });
    try {
      const result = await drive.permissions.create(withAllDrives({
        fileId,
        sendNotificationEmail: false,
        requestBody: { type: 'user', role, emailAddress },
      } as any) as any);
      (req as any).log?.info?.({ action: 'drive.share', fileId, emailAddress, role, permissionId: result.data.id });
      return res.json({ ok: true, permissionId: result.data.id });
    } catch (err: any) {
      const code = err?.code || err?.response?.status;
      const msg = err?.message || String(err);
      if (code === 404) return res.status(404).json({ ok: false, error: 'file not found' });
      if (code === 409) return res.status(200).json({ ok: true, note: 'already shared or duplicate', error: msg });
      (req as any).log?.warn?.({ action: 'drive.share', fileId, emailAddress, role, error: msg });
      return res.status(code || 500).json({ ok: false, error: msg });
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'drive.share failed' });
  }
}
