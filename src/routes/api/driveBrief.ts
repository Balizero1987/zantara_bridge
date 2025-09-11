import type { Router, Request, Response } from 'express';
import { db } from '../../core/firestore';
import { getDriveClient, whoami } from '../../core/drive';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { Readable } from 'stream';

/**
 * Registra le rotte legate ai "brief" su Drive.
 */
export default function registerDriveBrief(r: Router) {
  /**
   * Endpoint diagnostico: chiama whoami()
   */
  r.get('/api/drive/_whoami', async (_req: Request, res: Response) => {
    try {
      const result = await whoami();
      return res.status(200).json(result);
    } catch (error: any) {
      const status = error?.response?.status || error?.status || error?.code || 500;
      if (status === 401 || status === 403) {
        return res
          .status(403)
          .json({ ok: false, code: 403, error: 'drive_forbidden', message: 'Subject not authorized or DWD missing' });
      }
      if (status === 404) {
        return res
          .status(404)
          .json({ ok: false, code: 404, error: 'drive_not_found', message: 'Check driveId/flags supportsAllDrives' });
      }
      return res.status(500).json({ ok: false, code: 500, error: 'drive_error', message: String(error?.message || error) });
    }
  });

  /**
   * Endpoint: genera un documento "brief" e lo carica su Drive.
   */
  r.post('/api/drive/brief', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const dateKey = String(req.body?.dateKey || new Date().toISOString().slice(0, 10));
      const driveId = process.env.DRIVE_ID_AMBARADAM;

      if (!driveId || !driveId.startsWith('0A')) {
        return res.status(500).json({
          ok: false,
          error: 'invalid_drive_config',
          detail: 'DRIVE_ID_AMBARADAM must start with 0A...',
        });
      }

      // Leggi note da Firestore (senza pretendere campi title/content forti)
      const snap = await db.collection('notes').get();
      const items: any[] = [];
      snap.forEach((doc) => items.push(doc.data()));

      // Crea docx con le note
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: `Brief for ${owner} on ${dateKey}`,
                heading: HeadingLevel.HEADING_1,
              }),
              ...items.map(
                (item) =>
                  new Paragraph({
                    text: `- ${item.title ?? 'Untitled'}: ${item.content ?? ''}`,
                  })
              ),
            ],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);

      // Carica su Drive
      const drive = await getDriveClient();
      const resp = await drive.files.create({
        requestBody: {
          name: `Brief-${owner}-${dateKey}.docx`,
          parents: [driveId],
        },
        media: {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          body: Buffer.from(buffer),
        } as any,
        fields: 'id,name',
        supportsAllDrives: true,
      });

      return res.status(200).json({ ok: true, file: resp.data });
    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        error: 'brief_failed',
        detail: error?.message || String(error),
      });
    }
  });

  /**
   * POST /api/drive/_write_smoke
   * Crea un piccolo file di testo nella Shared Drive configurata e (di default) lo elimina.
   * Protetto da API key (middleware a monte).
   */
  r.post('/api/drive/_write_smoke', async (req: Request, res: Response) => {
    try {
      const driveId = (process.env.DRIVE_ID_AMBARADAM || '').trim();
      const folderId = (req.query.folderId as string | undefined)?.trim();
      if (!driveId && !folderId) return res.status(500).json({ ok: false, error: 'missing DRIVE_ID_AMBARADAM or folderId' });

      const drive = await getDriveClient();
      const name = `Smoke-${Date.now()}.txt`;
      // Create a Google Docs file (no media upload required)
      let created: any;
      try {
        created = await drive.files.create({
          requestBody: { name, parents: [folderId || driveId], mimeType: 'application/vnd.google-apps.document' },
          fields: 'id,name,webViewLink,parents',
          supportsAllDrives: true,
        } as any);
      } catch (e: any) {
        // Fallback: create in My Drive root if Shared Drive parent fails (e.g., Login Required)
        created = await drive.files.create({
          requestBody: { name, mimeType: 'application/vnd.google-apps.document' },
          fields: 'id,name,webViewLink,parents',
        } as any);
      }

      const file = created.data as any;

      // delete=true by default; set ?delete=false to keep the file
      const doDelete = String(req.query.delete || 'true') !== 'false';
      if (doDelete && file?.id) {
        await drive.files.delete({ fileId: file.id, supportsAllDrives: true } as any);
      }

      return res.status(200).json({ ok: true, created: { id: file?.id, name: file?.name, webViewLink: file?.webViewLink }, deleted: doDelete });
    } catch (error: any) {
      const status = error?.response?.status || error?.status || error?.code || 500;
      return res.status(status).json({ ok: false, error: String(error?.message || error) });
    }
  });
}
