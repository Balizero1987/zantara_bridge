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
      const ambaradamFolder = (process.env.DRIVE_FOLDER_AMBARADAM || '').trim();
      if (!ambaradamFolder && !process.env.DRIVE_FOLDER_AMBARADAM) {
        return res.status(500).json({ ok: false, error: 'Missing DRIVE_FOLDER_AMBARADAM' });
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

      // ===== Preparazione token SA =====
      const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
      const credentials = JSON.parse(raw);
      const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
      const client: any = await auth.getClient();
      const tok: any = await client.getAccessToken();
      const token = typeof tok === 'string' ? tok : (tok?.token || tok?.access_token || '');

      // ===== Helpers Drive REST =====
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

      async function findFolderByName(tokenStr: string, parentId: string, name: string): Promise<string | null> {
        const url = new URL('https://www.googleapis.com/drive/v3/files');
        url.searchParams.set('q', `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
        url.searchParams.set('fields', 'files(id,name)');
        url.searchParams.set('supportsAllDrives', 'true');
        url.searchParams.set('includeItemsFromAllDrives', 'true');
        // corpora/driveId non necessario se si restringe a parents
        const r = await fetch(url, { headers: { Authorization: `Bearer ${tokenStr}` } });
        if (!r.ok) return null;
        const d: any = await r.json();
        return d?.files?.[0]?.id || null;
      }

      async function ensureFolder(tokenStr: string, parentId: string, name: string): Promise<string> {
        const found = await findFolderByName(tokenStr, parentId, name);
        if (found) return found;
        const r = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenStr}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
        });
        const d: any = await r.json();
        if (!r.ok) throw new Error(d?.error?.message || String(r.status));
        return d.id as string;
      }

      // ===== Calcolo cartella target Brief =====
      // Preferenze: DRIVE_FOLDER_BRIEFS (root esplicita), altrimenti DRIVE_FOLDER_AMBARADAM o cartella "AMBARADAM".
      const forcedBriefRoot = (process.env.DRIVE_FOLDER_BRIEFS || '').trim() || null;
      const forcedAmbaradam = (process.env.DRIVE_FOLDER_AMBARADAM || '').trim() || null;
      const ownerFolder = (owner || 'BOSS').replace(/_/g, ' ').trim();

      let rootParent = forcedBriefRoot || forcedAmbaradam || ambaradamFolder;

      // AMBARADAM/<OWNER>/Brief (o <forcedRoot>/<OWNER>/Brief)
      const ownerId = await ensureFolder(token, rootParent, ownerFolder);
      const briefRootId = await ensureFolder(token, ownerId, 'Brief');

      // ===== Upload DOCX nella cartella Brief =====
      const fileMeta = await uploadDocx({ name: `Brief-${owner}-${dateKey}.docx`, parents: [briefRootId] }, Buffer.from(buffer));

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
      const folderId = (req.query.folderId as string | undefined)?.trim() || (process.env.DRIVE_FOLDER_AMBARADAM || '').trim();
      if (!folderId) return res.status(500).json({ ok: false, error: 'missing folderId (DRIVE_FOLDER_AMBARADAM)' });
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

      const file = await createMetadata({ name, parents: [folderId], mimeType: 'application/vnd.google-apps.document' });

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
