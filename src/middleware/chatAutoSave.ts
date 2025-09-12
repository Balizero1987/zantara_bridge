import { Request, Response, NextFunction } from 'express';
import { addNote, canonicalOwner } from '../notes';
import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { resolveFolderPath } from '../lib/googleApiHelpers';
import { Readable } from 'stream';

function extractContent(body: any): { title: string; content: string } | null {
  if (!body || typeof body !== 'object') return null;
  const candidates: Array<{ title?: string; content?: string }> = [];
  candidates.push({ title: body.title, content: body.content });
  candidates.push({ title: body.title || 'Chat', content: body.text });
  candidates.push({ title: body.title || 'Chat', content: body.message });
  if (typeof body.recap === 'string') candidates.push({ title: body.title || 'Recap', content: body.recap });
  if (body.recap && typeof body.recap === 'object') {
    candidates.push({ title: body.recap.title || 'Recap', content: body.recap.text || body.recap.content });
  }
  for (const c of candidates) {
    const content = (c.content || '').toString();
    if (content.trim().length) return { title: (c.title || 'Auto-saved Chat').toString(), content };
  }
  return null;
}

async function ensureDriveUpload(ownerRaw: string, title: string, content: string) {
  const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
  if (!user) return; // Drive disabled if impersonation missing
  const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/drive']);
  const drive = google.drive({ version: 'v3', auth: ic.auth });

  const owner = canonicalOwner(ownerRaw) || ownerRaw.toString().toUpperCase();
  const root = process.env.DEFAULT_FOLDER_ROOT || 'AMBARADAM';
  const chatLeaf = process.env.CHAT_FOLDER_LEAF || 'Chat';
  const path = `${root}/${owner}/${chatLeaf}`;
  const folder = await resolveFolderPath(path, ic.auth, true);
  if (!folder) return;

  const nameSafe = title.replace(/[\n\r]/g, ' ').slice(0, 120) || 'Chat';
  const ts = new Date();
  const fname = `${nameSafe} – ${ts.toISOString().replace(/[:]/g, '-')}.txt`;
  const buffer = Buffer.from(content, 'utf8');
  const stream = Readable.from(buffer);
  await drive.files.create({
    requestBody: { name: fname, parents: [folder.id] },
    media: { mimeType: 'text/plain', body: stream },
    fields: 'id',
    supportsAllDrives: true,
  } as any);
}

export async function chatAutoSave(req: Request, res: Response, next: NextFunction) {
  const enabled = String(process.env.CHAT_AUTO_SAVE || 'false').toLowerCase() === 'true';
  if (!enabled) return next();
  const minLength = parseInt(process.env.CHAT_AUTO_SAVE_MIN_LENGTH || '50', 10) || 50;
  const data = extractContent(req.body);
  if (!data) return next();
  if (data.content.length < minLength) return next();

  // Determine owner
  const owner = (req as any).user?.name || req.header('X-BZ-USER') || req.header('X-User-Name') || 'UNKNOWN';
  const title = data.title || 'Auto-saved Chat';
  try {
    await addNote(owner, title, data.content);
  } catch (e) {
    (req as any).log?.warn?.({ action: 'chat.autosave.firestore.failed', error: (e as any)?.message || String(e) });
  }
  try {
    await ensureDriveUpload(owner, title, data.content);
  } catch (e) {
    (req as any).log?.warn?.({ action: 'chat.autosave.drive.failed', error: (e as any)?.message || String(e) });
  }
  return next();
}

