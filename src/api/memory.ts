import { Request, Response, Express } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { addNote, regenerateBriefDocx, briefTitle, reportTitle } from '../notes';
import { memorySaveHandler } from '../actions/memory/save';

function escQ(s: string) { return s.replace(/'/g, "\\'"); }

// Blocca titoli sospetti per evitare scritture fantasma di probe
function isSuspiciousTitle(t: string): boolean {
  const raw = String(t || '').toLowerCase();
  const norm = raw
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const collapsed = norm.replace(/\s+/g, '');
  if (norm.includes('zantara memory root probe')) return true;
  if (collapsed.includes('zantaramemoryrootprobe')) return true;
  // parola intera "probe"
  if (/\bprobe\b/.test(norm)) return true;
  return false;
}

async function driveClient() {
  const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
  const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
  return google.drive({ version: 'v3', auth: ic.auth });
}

async function findOrCreateOwnerFolder(drive: any, rootId: string, owner: string): Promise<string> {
  const name = owner.trim();
  const q = `name='${escQ(name)}' and mimeType='application/vnd.google-apps.folder' and '${rootId}' in parents and trashed=false`;
  const listParams: any = {
    q,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  };
  if (process.env.ZANTARA_SHARED_DRIVE_ID) {
    listParams.corpora = 'drive';
    listParams.driveId = process.env.ZANTARA_SHARED_DRIVE_ID;
  }
  const { data } = await drive.files.list(listParams);
  if (data.files && data.files[0]?.id) return data.files[0].id as string;
  const { data: created } = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.id as string;
}

async function findByTitleAnywhere(drive: any, title: string): Promise<any | null> {
  const q = `name='${escQ(title)}' and trashed=false`;
  const params: any = {
    q,
    fields: 'files(id,name,parents,webViewLink)',
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  };
  if (process.env.ZANTARA_SHARED_DRIVE_ID) {
    params.corpora = 'drive';
    params.driveId = process.env.ZANTARA_SHARED_DRIVE_ID;
  }
  const { data } = await drive.files.list(params);
  return (data.files && data.files[0]) || null;
}

async function updateMarkdown(drive: any, fileId: string, content: string) {
  await drive.files.update({
    fileId,
    media: { mimeType: 'text/markdown', body: content },
    supportsAllDrives: true,
  });
}

// Deprecated: markdown creation path, kept for fallback if needed
async function createMarkdown(drive: any, parentId: string, title: string, content: string) {
  const { data } = await drive.files.create({
    requestBody: { name: `${title}.md`, parents: [parentId] },
    media: { mimeType: 'text/markdown', body: content },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  });
  return data;
}

// Canonical owner mapping (align with server.ts logic). Returns UPPERCASE folder name.
function canonicalOwner(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  const nameOnly = s.replace(/@balizero\.com$/i, '').trim();
  const key = nameOnly.toLowerCase().replace(/[^a-z]/g, '');
  const MAP: Record<string, string> = {
    boss: 'BOSS', zero: 'BOSS',
    riri: 'RIRI', rina: 'RINA',
    gianluca: 'GIANLUCA', gl: 'GIANLUCA',
    ari: 'ARI', surya: 'SURYA', amanda: 'AMANDA'
  };
  return MAP[key] || nameOnly.toUpperCase();
}

type SmartSaveParams = { title: string; content: string; owner: string; log?: { info?: Function; warn?: Function; error?: Function } | null };
type SmartSaveResult = { ok: true; action: 'created' | 'updated' | 'moved+updated'; id: string };

export async function smartSaveNote(params: SmartSaveParams): Promise<SmartSaveResult> {
  const { title, content, owner, log } = params;
  if (!title || !content || !owner) {
    throw new Error('missing title/content/owner');
  }

  if (isSuspiciousTitle(title)) {
    const msg = 'blocked suspicious title';
    (log as any)?.info?.({ module: 'memory.smart-save', blocked: true, reason: 'suspicious_title', title });
    throw Object.assign(new Error(msg), { status: 400 });
  }
  const tl = String(title).toLowerCase();
  if (tl === 'probe' || tl.includes('zantara memory root probe')) {
    const msg = 'probe-title blocked';
    throw Object.assign(new Error(msg), { status: 400 });
  }

  // New behavior: persist note to Firestore and regenerate today's Brief DOCX under AMBARADAM/<OWNER>
  const saved = await addNote(owner, title, content, Date.now());
  const brief = await regenerateBriefDocx(saved.owner, saved.dateKey);
  (log as any)?.info?.({ module: 'memory.smart-save', result: 'brief-regenerated', owner: saved.owner, date: saved.dateKey, fileId: brief.fileId });
  return { ok: true, action: 'updated', id: brief.fileId } as any;
}

export const memoryRoutes = (app: Express) => {
  // Action endpoint without API key: create markdown memory in MEMORY_DRIVE_FOLDER_ID
  app.post('/actions/memory/save', memorySaveHandler);
  // Simple inline API key guard (keeps route modular without importing server middleware)
  const requireApiKey = (req: Request, res: Response): string | null => {
    const apiKey = process.env.API_KEY;
    const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const provided = req.header('x-api-key') || bearer || (req.query.api_key as string | undefined);
    if (!apiKey) { res.status(500).json({ ok: false, error: 'Missing API_KEY' }); return null; }
    if (provided !== apiKey) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return null; }
    return apiKey;
  };

  app.post('/memory/smart-save', async (req: Request, res: Response) => {
    if (!requireApiKey(req, res)) return;
    try {
      const { title, content, owner } = req.body || {};
      if (!process.env.MEMORY_DRIVE_FOLDER_ID) {
        (req as any).log?.warn?.({ module: 'memory.smart-save', warning: 'Missing MEMORY_DRIVE_FOLDER_ID' });
      }
      const result: any = await smartSaveNote({ title, content, owner, log: (req as any).log });
      (req as any).log?.info?.({ module: 'memory.smart-save', phase: 'done', title, owner, targetFolderId: result?.folderId || null, fileId: result?.id || result?.fileId, outcome: result?.action || 'updated' });
      return res.json(result);
    } catch (e: any) {
      const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
      (req as any).log?.error?.({ module: 'memory.smart-save', error: e.message });
      return res.status(status).json({ ok: false, error: e.message || 'smart-save failed' });
    }
  });

  // Backward-compatible alias: /memory/save -> smartSaveNote
  app.post('/memory/save', async (req: Request, res: Response) => {
    if (!requireApiKey(req, res)) return;
    try {
      const { title, content } = req.body || {};
      if (!title || !content) return res.status(400).json({ ok: false, error: 'Missing title/content' });
      const owner = (req.body?.owner as string) || 'BOSS';
  const result = await smartSaveNote({ title, content, owner, log: (req as any).log });
      return res.json(result);
    } catch (e: any) {
      const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
  (req as any).log?.error?.({ module: 'memory.save', error: e.message });
      return res.status(status).json({ ok: false, error: e.message || 'save failed' });
    }
  });

  // List generated DOCX files (Brief + Report) for an owner/date
  app.get('/memory/list-docs', async (req: Request, res: Response) => {
    if (!requireApiKey(req, res)) return;
    try {
      const ownerRaw = (req.query.owner as string) || '';
      const dateStr = (req.query.date as string) || new Date().toISOString().slice(0,10);
      if (!ownerRaw) return res.status(400).json({ ok: false, error: 'Missing owner' });
      const owner = canonicalOwner(ownerRaw) || ownerRaw.toString().toUpperCase();
      const drive = await driveClient();
      const targets = [briefTitle(owner, dateStr), reportTitle(owner, dateStr)];
      const results: any[] = [];
      for (const name of targets) {
        const found = await findByTitleAnywhere(drive, name);
        if (found) results.push({ title: found.name, id: found.id, link: found.webViewLink });
      }
      return res.json(results);
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });
};
