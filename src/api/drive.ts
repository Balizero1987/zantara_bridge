import { Request, Response, Express } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { requireAuth as requireApiKey } from '../middleware/auth';
import { uploadDriveFileHandler } from '../actions/drive/upload';
import { renameDriveFileHandler } from '../actions/drive/rename';
import { moveDriveFileHandler } from '../actions/drive/move';
import { deleteDriveFileHandler } from '../actions/drive/delete';
import { modifyDriveFileHandler } from '../actions/drive/modify';
import { shareDriveFileHandler } from '../actions/drive/share';
import { searchDriveHandler } from '../actions/drive/search';

function logDriveAction(action: string, details: any) {
  console.log(`[DRIVE] ${action}`, JSON.stringify(details));
}

export const driveRoutes = (app: Express) => {
  // Upload generic file into memory folder (protected)
  app.post('/actions/drive/upload', requireApiKey, uploadDriveFileHandler);
  app.post('/actions/drive/modify', requireApiKey, modifyDriveFileHandler);
  app.post('/actions/drive/rename', requireApiKey, renameDriveFileHandler);
  app.post('/actions/drive/move', requireApiKey, moveDriveFileHandler);
  app.post('/actions/drive/delete', requireApiKey, deleteDriveFileHandler);
  app.post('/actions/drive/share', requireApiKey, shareDriveFileHandler);
  app.get('/actions/drive/search', requireApiKey, searchDriveHandler);

  // Crea file Google Doc in una cartella
  app.post('/actions/drive/create', requireApiKey, async (req: Request, res: Response) => {
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
  app.get('/actions/drive/get', requireApiKey, async (req: Request, res: Response) => {
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
  app.get('/actions/drive/list-folder', requireApiKey, async (req: Request, res: Response) => {
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

  // Aggiungi permessi a un file Drive (editor/viewer)
  app.post('/actions/drive/permissions/add', requireApiKey, async (req: Request, res: Response) => {
    const { fileId, email, role } = req.body;
    if (!fileId || !email || !role || !['writer', 'reader'].includes(role)) {
      (req as any).log?.warn?.({ action: 'drive.permissions.add', fileId, email, role });
      return res.status(400).json({ ok: false, error: 'fileId, email, role (writer|reader) richiesti' });
    }
    try {
      const user = process.env.IMPERSONATE_USER || '';
      const ic = await impersonatedClient(user, [
        'https://www.googleapis.com/auth/drive',
      ]);
      const drive = google.drive({ version: 'v3', auth: ic.auth });
      const result = await drive.permissions.create({
        fileId,
        requestBody: {
          type: 'user',
          role,
          emailAddress: email,
        },
        sendNotificationEmail: false,
        supportsAllDrives: true,
      } as any);
      (req as any).log?.info?.({ action: 'drive.permissions.add', fileId, email, role, permissionId: result.data.id });
      res.json({ ok: true, permissionId: result.data.id });
    } catch (e: any) {
      (req as any).log?.error?.({ action: 'drive.permissions.add', fileId, email, role, error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Rimuovi permesso da un file Drive (via permissionId o email)
  app.post('/actions/drive/permissions/remove', requireApiKey, async (req: Request, res: Response) => {
    const { fileId, permissionId, email } = req.body;
    if (!fileId || (!permissionId && !email)) {
      (req as any).log?.warn?.({ action: 'drive.permissions.remove', fileId, permissionId, email });
      return res.status(400).json({ ok: false, error: 'fileId e (permissionId o email) richiesti' });
    }
    try {
      const user = process.env.IMPERSONATE_USER || '';
      const ic = await impersonatedClient(user, [
        'https://www.googleapis.com/auth/drive',
      ]);
      const drive = google.drive({ version: 'v3', auth: ic.auth });
      let permId = permissionId;
      if (!permId && email) {
        // Cerca permissionId via email
        const perms = await drive.permissions.list({ fileId, supportsAllDrives: true } as any);
        const found = perms.data.permissions?.find((p: any) => p.emailAddress === email);
        if (!found) {
          (req as any).log?.warn?.({ action: 'drive.permissions.remove', fileId, email, msg: 'Permesso non trovato' });
          return res.status(404).json({ ok: false, error: 'Permesso non trovato per email' });
        }
        permId = found.id;
      }
      await drive.permissions.delete({ fileId, permissionId: permId, supportsAllDrives: true } as any);
      (req as any).log?.info?.({ action: 'drive.permissions.remove', fileId, permissionId: permId, email });
      res.json({ ok: true });
    } catch (e: any) {
      (req as any).log?.error?.({ action: 'drive.permissions.remove', fileId, permissionId, email, error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });
};
