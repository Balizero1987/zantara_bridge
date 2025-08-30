import { Request, Response, Express } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { uploadDriveFileHandler } from '../actions/drive/upload';

function logDriveAction(action: string, details: any) {
  console.log(`[DRIVE] ${action}`, JSON.stringify(details));
}

export const driveRoutes = (app: Express) => {
  // Upload generic file into memory folder
  app.post('/actions/drive/upload', uploadDriveFileHandler);

  // Crea file Google Doc in una cartella
  app.post('/actions/drive/create', async (req: Request, res: Response) => {
    try {
      const name = (req.body?.name as string) || 'SmokeTest Zantara';
      // Prefer the memory root if present, fallback to DRIVE_FOLDER_ID
      const parent = process.env.MEMORY_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID;
      if (!parent) return res.status(500).json({ ok: false, error: 'Missing DRIVE_FOLDER_ID' });
      const user = process.env.IMPERSONATE_USER || '';
      const ic = await impersonatedClient(user, [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
      ]);
      const drive = google.drive({ version: 'v3', auth: ic.auth });
      // Verify impersonation and log context
      try {
        const about = await drive.about.get({ fields: 'user,storageQuota', supportsAllDrives: true } as any);
        (req as any).log?.info?.({ action: 'drive.about', user: about.data.user });
      } catch (e: any) {
        (req as any).log?.warn?.({ action: 'drive.about', error: e?.message });
      }
  const createRes = await drive.files.create({
        requestBody: { name, mimeType: 'application/vnd.google-apps.document', parents: [parent] },
        fields: 'id,webViewLink,parents',
        supportsAllDrives: true,
      });
  const data = createRes.data;
  (req as any).log?.warn?.({ action: 'drive.create.resp', resp: data });
  res.json({ ok: true, action: 'drive.create', fileId: data.id, webViewLink: data.webViewLink, parents: data.parents, parentId: parent });
    } catch (e: any) {
      (req as any).log?.error?.({ action: 'drive.create', error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Leggi metadati file per verifica post-creazione
  app.get('/actions/drive/get', async (req: Request, res: Response) => {
    try {
      const fileId = (req.query.fileId as string) || '';
      if (!fileId) return res.status(400).json({ ok: false, error: 'Missing fileId' });
      const user = process.env.IMPERSONATE_USER || '';
      const ic = await impersonatedClient(user, [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/drive',
      ]);
      const drive = google.drive({ version: 'v3', auth: ic.auth });
      const { data } = await drive.files.get({
        fileId,
        fields: 'id,name,parents,ownedByMe,webViewLink,owners,driveId,permissions',
        supportsAllDrives: true,
      } as any);
      (req as any).log?.info?.({ action: 'drive.get', fileId, resp: data });
      res.json({ ok: true, action: 'drive.get', file: data });
    } catch (e: any) {
      (req as any).log?.error?.({ action: 'drive.get', error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Elenca i contenuti di una cartella (Drive/Shared Drive)
  app.get('/actions/drive/list-folder', async (req: Request, res: Response) => {
    try {
      const folderId = (req.query.folderId as string) || process.env.MEMORY_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID || '';
      if (!folderId) return res.status(400).json({ ok: false, error: 'Missing folderId and no default folder configured' });
      const user = process.env.IMPERSONATE_USER || '';
      const ic = await impersonatedClient(user, [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/drive',
      ]);
      const drive = google.drive({ version: 'v3', auth: ic.auth });
      const pageSize = Math.min(parseInt(String(req.query.pageSize || '100'), 10) || 100, 200);
      const pageToken = (req.query.pageToken as string) || undefined;
      const q = `'${folderId}' in parents and trashed = false`;
      const { data } = await drive.files.list({
        q,
        pageSize,
        pageToken,
        fields: 'nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink,owners/emailAddress)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'allDrives',
      } as any);
      const items = (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink,
        owner: f.owners?.[0]?.emailAddress || null,
      }));
      (req as any).log?.info?.({ action: 'drive.list-folder', folderId, count: items.length });
      res.json({ ok: true, action: 'drive.list-folder', folderId, items, nextPageToken: data.nextPageToken || null });
    } catch (e: any) {
      (req as any).log?.error?.({ action: 'drive.list-folder', error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // (Altri endpoint Drive qui...)
};
