import { Request, Response, Express } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../google';

function logDriveAction(action: string, details: any) {
  console.log(`[DRIVE] ${action}`, JSON.stringify(details));
}

export const driveRoutes = (app: Express) => {
  // Crea file Google Doc in una cartella
  app.post('/actions/drive/create', async (req: Request, res: Response) => {
    try {
      const name = (req.body?.name as string) || 'SmokeTest Zantara';
      const parent = process.env.DRIVE_FOLDER_ID;
      if (!parent) return res.status(500).json({ ok: false, error: 'Missing DRIVE_FOLDER_ID' });
      const user = process.env.IMPERSONATE_USER || '';
      const ic = await impersonatedClient(user, [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
      ]);
      const drive = google.drive({ version: 'v3', auth: ic.auth });
      const { data } = await drive.files.create({
        requestBody: { name, mimeType: 'application/vnd.google-apps.document', parents: [parent] },
        fields: 'id,webViewLink,parents',
        supportsAllDrives: true,
      });
      logDriveAction('create.success', { name, id: data.id, parent: parent, link: data.webViewLink });
      res.json({ ok: true, action: 'drive.create', fileId: data.id, webViewLink: data.webViewLink, parentId: parent });
    } catch (e: any) {
      logDriveAction('create.error', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ... altri endpoint ...
};
