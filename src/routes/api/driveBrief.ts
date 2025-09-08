import type { Router, Request, Response } from 'express';
import { db } from '../../core/firestore';
import { google } from 'googleapis';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { Readable } from 'node:stream';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export default function registerDriveBrief(r: Router) {
  r.post('/api/drive/brief', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const dateKey = String(req.body?.dateKey || new Date().toISOString().slice(0, 10));
      const folderId = process.env.BRIEF_DRIVE_FOLDER_ID || process.env.ZANTARA_SHARED_DRIVE_ID || '';
      if (!folderId) return res.status(500).json({ ok: false, error: 'Missing BRIEF_DRIVE_FOLDER_ID or ZANTARA_SHARED_DRIVE_ID' });

      // build docx from notes
      const snap = await db.collection('notes')
        .where('canonicalOwner', '==', owner)
        .where('dateKey', '==', dateKey)
        .orderBy('ts', 'asc').get();

      const children: Paragraph[] = [ new Paragraph({ text: `Brief – ${owner} – ${dateKey}`, heading: HeadingLevel.HEADING_1 }) ];
      if (snap.empty) {
        children.push(new Paragraph('No notes found for the selected date.'));
      } else {
        snap.forEach(d => {
          const n = d.data() as any;
          children.push(new Paragraph({ text: n.title, heading: HeadingLevel.HEADING_2 }));
          children.push(new Paragraph(n.content));
        });
      }

      const doc = new Document({ sections: [{ children }] });
      const buf = await Packer.toBuffer(doc);

      // Drive auth via ADC (Cloud Run) o SA impersonation se configurata fuori
      const auth = await google.auth.getClient({ scopes: ['https://www.googleapis.com/auth/drive'] });
      const drive = google.drive({ version: 'v3', auth });

      const name = `Brief-${owner}-${dateKey}.docx`;
      const stream = Readable.from(buf);
      const { data } = await drive.files.create({
        requestBody: { name, parents: [folderId] },
        media: { mimeType: DOCX_MIME, body: stream },
        fields: 'id,webViewLink',
        supportsAllDrives: true
      } as any);

      const fileId = (data as any)?.id;
      const webViewLink = (data as any)?.webViewLink;
      await db.collection('fileIndex').doc(fileId).set({
        canonicalOwner: owner, dateKey, kind: 'brief', driveFileId: fileId, name, webViewLink, ts: Date.now()
      }, { merge: true });

      res.json({ ok: true, owner, dateKey, fileId, webViewLink, name });
    } catch (e: any) {
      const status = e?.response?.status || 500;
      const gerr = e?.response?.data || undefined;
      res.status(status).json({ ok: false, error: e?.message || 'drive.brief failed', details: gerr });
    }
  });
}

