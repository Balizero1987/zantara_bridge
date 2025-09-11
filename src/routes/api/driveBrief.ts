import type { Router, Request, Response } from 'express';
import { db } from '../../core/firestore';
import { getDriveClient, whoami } from '../../core/drive';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';

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
}
