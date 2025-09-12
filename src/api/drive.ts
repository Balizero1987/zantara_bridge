import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { uploadDriveFileHandler } from '../actions/drive/upload';
import { impersonatedClient } from '../google';
import { resolveFolderPath } from '../lib/googleApiHelpers';

const actions = Router();

// POST /actions/drive/upload
// Requires folderId in body; uses uploadDriveFileHandler for core logic
actions.post('/upload', uploadDriveFileHandler as any);

// Diagnostic router for Drive
const diag = Router();

// GET /diag/drive/check
// Optional query: folderId=... to verify access to a specific folder
diag.get('/check', async (req: Request, res: Response) => {
  try {
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    if (!user) return res.status(500).json({ ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER' });

    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ]);
    const drive = google.drive({ version: 'v3', auth: ic.auth });

    const about = await drive.about.get({ fields: 'user,permissionId,storageQuota', supportsAllDrives: true } as any);
    const folderId = (req.query.folderId || '').toString().trim();
    let folderCheck: any = null;
    if (folderId) {
      try {
        const meta = await drive.files.get({ fileId: folderId, fields: 'id,name,driveId,parents,capabilities', supportsAllDrives: true } as any);
        folderCheck = { ok: true, id: meta.data.id, name: (meta.data as any).name || null, driveId: (meta.data as any).driveId || null, parents: (meta.data as any).parents || null };
      } catch (e: any) {
        folderCheck = { ok: false, error: e?.message || String(e) };
      }
    }

    return res.json({
      ok: true,
      user: about.data.user || null,
      drivePermissionId: (about.data as any)?.permissionId || null,
      quota: (about.data as any)?.storageQuota || null,
      folderId: folderId || null,
      folderCheck,
      env: {
        MEMORY_DRIVE_FOLDER_ID: process.env.MEMORY_DRIVE_FOLDER_ID || null,
        DRIVE_FOLDER_ID: process.env.DRIVE_FOLDER_ID || null,
        ZANTARA_SHARED_DRIVE_ID: process.env.ZANTARA_SHARED_DRIVE_ID || null,
      },
      ts: new Date().toISOString(),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'diag.drive.check failed' });
  }
});

// GET /diag/drive/find-folder?name=BOSS
// Lists folders matching the provided name across My Drive and Shared Drives
diag.get('/find-folder', async (req: Request, res: Response) => {
  try {
    const name = (req.query.name || '').toString().trim();
    if (!name) return res.status(400).json({ ok: false, error: 'Missing name' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    if (!user) return res.status(500).json({ ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER' });

    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ]);
    const drive = google.drive({ version: 'v3', auth: ic.auth });

    const q = [
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false",
      `name = '${name.replace(/'/g, "\\'")}'`,
    ].join(' and ');

    const { data } = await drive.files.list({
      q,
      fields: 'files(id,name,parents,driveId,webViewLink)',
      pageSize: 50,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    } as any);

    return res.json({ ok: true, name, matches: data.files || [] });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'diag.drive.find-folder failed' });
  }
});

export default actions;
export { diag as driveDiagRouter };

// Resolver API: POST /actions/drive/resolve { folderPath?, folderName?, owner?, createIfMissing? }
actions.post('/resolve', async (req, res) => {
  try {
    const { folderPath, folderName, owner, createIfMissing } = req.body || {};
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    if (!user) return res.status(500).json({ ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER' });
    const ic = await impersonatedClient(user, [ 'https://www.googleapis.com/auth/drive' ]);

    let path = (folderPath || '').toString().trim();
    if (!path) {
      if (folderName && owner) path = `AMBARADAM/${String(folderName)}/${String(owner)}`;
      else if (folderName) path = `AMBARADAM/${String(folderName)}`;
    }
    if (!path) return res.status(400).json({ ok: false, error: 'Provide folderPath or folderName(/owner)' });

    const resolved = await resolveFolderPath(path, ic.auth, !!createIfMissing);
    if (!resolved) return res.status(404).json({ ok: false, error: 'Folder not found and not created', path });
    return res.json({ ok: true, path, folderId: resolved.id, name: resolved.name, driveId: resolved.driveId || null });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'resolve failed' });
  }
});
