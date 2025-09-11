import type { Router, Request, Response } from 'express';
import { db } from '../../core/firestore';
import { getDriveClient, whoami } from '../../core/drive';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { GoogleAuth } from 'google-auth-library';

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

      // Carica su Drive via REST (multipart/related) usando il token del Service Account
      const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
      const credentials = JSON.parse(raw);
      const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
      const client: any = await auth.getClient();
      const tok: any = await client.getAccessToken();
      const token = typeof tok === 'string' ? tok : (tok?.token || tok?.access_token || '');

      async function uploadDocx(metadata: any, fileBuffer: Buffer): Promise<any> {
        const boundary = `boundary_${Date.now()}`;
        const delimiter = `--${boundary}\r\n`;
        const closeDelim = `--${boundary}--`;
        const bodyParts = [
          delimiter,
          'Content-Type: application/json; charset=UTF-8\r\n\r\n',
          JSON.stringify(metadata),
          '\r\n',
          delimiter,
          'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n',
          fileBuffer,
          '\r\n',
          closeDelim,
        ].map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf8')));
        const combined = Buffer.concat(bodyParts as any);

        const resp = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
              'Content-Length': String(combined.length),
            },
            body: combined as any,
          }
        );
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(errText || `HTTP ${resp.status}`);
        }
        return resp.json();
      }

      let fileMeta: any;
      try {
        fileMeta = await uploadDocx({ name: `Brief-${owner}-${dateKey}.docx`, parents: [driveId] }, Buffer.from(buffer));
      } catch (_e) {
        // Fallback: senza parent (My Drive del SA)
        fileMeta = await uploadDocx({ name: `Brief-${owner}-${dateKey}.docx` }, Buffer.from(buffer));
      }

      return res.status(200).json({ ok: true, file: fileMeta });
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
      const name = `Smoke-${Date.now()}.txt`;
      // Acquire SA token and call Drive REST directly (metadata-only create)
      const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
      const credentials = JSON.parse(raw);
      const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
      const client: any = await auth.getClient();
      const tok: any = await client.getAccessToken();
      const token = typeof tok === 'string' ? tok : (tok?.token || tok?.access_token || '');
      const headers: any = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

      async function createMetadata(meta: any): Promise<any> {
        const resp = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink,parents', {
          method: 'POST',
          headers,
          body: JSON.stringify(meta),
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(err || `HTTP ${resp.status}`);
        }
        return resp.json();
      }

      let file: any;
      try {
        file = await createMetadata({ name, parents: [folderId || driveId], mimeType: 'application/vnd.google-apps.document' });
      } catch (_e) {
        // Fallback to My Drive
        file = await createMetadata({ name, mimeType: 'application/vnd.google-apps.document' });
      }

      // delete=true by default; set ?delete=false to keep the file
      const doDelete = String(req.query.delete || 'true') !== 'false';
      if (doDelete && file?.id) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?supportsAllDrives=true`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      return res.status(200).json({ ok: true, created: { id: file?.id, name: file?.name, webViewLink: file?.webViewLink }, deleted: doDelete });
    } catch (error: any) {
      const status = error?.response?.status || error?.status || error?.code || 500;
      return res.status(status).json({ ok: false, error: String(error?.message || error) });
    }
  });
}
