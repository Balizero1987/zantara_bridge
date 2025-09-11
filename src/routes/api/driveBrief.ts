import type { Router, Request, Response } from 'express';
import { db, FileIndexEntry } from '../../core/firestore';
import { getDriveClient, validateDriveId, whoami } from '../../core/drive';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';

export default function registerDriveBrief(r: Router) {
  r.post('/api/drive/brief', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const dateKey = String(req.body?.dateKey || new Date().toISOString().slice(0, 10));
      const driveId = process.env.DRIVE_ID_AMBARADAM;

      if (!driveId || !validateDriveId(driveId)) {
        return res.status(500).json({ 
          ok: false, 
          error: 'invalid_drive_config',
          detail: 'DRIVE_ID_AMBARADAM must start with 0A...' 
        });
      }

      // 🔍 Collect notes for the date
      const snap = await db.collection('notes')
        .where('canonicalOwner', '==', owner)
        .where('dateKey', '==', dateKey)
        .orderBy('ts', 'asc')
        .get();

      if (snap.empty) {
        return res.status(404).json({ 
          ok: false, 
          error: 'no_notes_found',
          detail: `No notes found for ${owner} on ${dateKey}` 
        });
      }

      // 🎨 Generate elegant .docx
      const children = [
        new Paragraph({ text: `Daily Brief – ${owner} – ${dateKey}`, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `Generated on ${new Date().toISOString()}`, heading: HeadingLevel.HEADING_3 }),
      ];

      snap.forEach(d => {
        const note = d.data() as any;
        children.push(new Paragraph({ text: note.title, heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ text: note.content }));
      });

      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBuffer(doc);
      const fileName = `Brief-${owner}-${dateKey}.docx`;

      // 🚀 Upload to Drive with impersonation elegance
      const drive = await getDriveClient();
      
      // Create folder structure if needed: AMBARADAM/<OWNER>
      const ownerFolderName = owner;
      let ownerFolderId: string;

      try {
        const folderSearch = await drive.files.list({
          q: `name='${ownerFolderName}' and parents in '${driveId}' and mimeType='application/vnd.google-apps.folder'`,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
          ownerFolderId = folderSearch.data.files[0].id!;
        } else {
          // Create owner folder
          const folderCreate = await drive.files.create({
            requestBody: {
              name: ownerFolderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [driveId],
            },
            supportsAllDrives: true,
          });
          ownerFolderId = folderCreate.data.id!;
        }
      } catch (folderError: any) {
        return res.status(500).json({ 
          ok: false, 
          error: 'folder_creation_failed',
          detail: folderError.message 
        });
      }

      // Upload the .docx file
      const uploadResponse = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [ownerFolderId],
          appProperties: {
            owner,
            dateKey,
            kind: 'brief'
          }
        },
        media: {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          body: buffer,
        },
        supportsAllDrives: true,
      });

      const fileId = uploadResponse.data.id!;
      const webViewLink = uploadResponse.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

      // 🏗️ Index in Firestore
      const ts = Date.now();
      const fileIndex: FileIndexEntry = {
        canonicalOwner: owner,
        kind: 'brief',
        driveFileId: fileId,
        name: fileName,
        webViewLink,
        dateKey,
        ts,
      };

      await db.collection('fileIndex').add(fileIndex);

      res.json({
        ok: true,
        owner,
        dateKey,
        fileId,
        webViewLink,
        name: fileName,
        notesCount: snap.size,
      });

    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: 'drive_brief_failed',
        detail: error.message 
      });
    }
  });
}

export function registerDriveDebug(r: Router) {
  r.get('/api/drive/_whoami', async (req: Request, res: Response) => {
    try {
      const result = await whoami();
      return res.status(200).json(result);
    } catch (error: any) {
      const status = error?.response?.status || error?.status || error?.code || 500;
      if (status === 401 || status === 403) {
        return res.status(403).json({ ok: false, code: 403, error: 'drive_forbidden', message: 'Subject not authorized or DWD missing' });
      }
      if (status === 404) {
        return res.status(404).json({ ok: false, code: 404, error: 'drive_not_found', message: 'Check driveId/q/flags supportsAllDrives' });
      }
      const msg = error?.message || 'drive_error';
      return res.status(500).json({ ok: false, code: 500, error: 'drive_error', message: msg });
    }
  });
}
