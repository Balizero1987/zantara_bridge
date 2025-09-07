import { google } from 'googleapis';
import { Firestore } from '@google-cloud/firestore';
import { impersonatedClient } from './google';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { Readable } from 'stream';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type NoteEntry = {
  owner: string;
  title: string;
  content: string;
  ts: number; // epoch ms
  dateKey: string; // YYYY-MM-DD
};

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

export function ymd(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function briefTitle(owner: string, dateStr: string): string {
  return `Brief – ${owner} – ${dateStr}.docx`;
}

export function reportTitle(owner: string, dateStr: string): string {
  return `Report – ${owner} – ${dateStr}.docx`;
}

export async function addNote(ownerRaw: string, title: string, content: string, at = Date.now()) {
  const owner = canonicalOwner(ownerRaw) || ownerRaw.toString().toUpperCase();
  const db = new Firestore();
  const dateStr = ymd(new Date(at));
  const entry: NoteEntry = { owner, title, content, ts: at, dateKey: dateStr };
  await db.collection('notes').add(entry);
  return entry;
}

async function driveClient() {
  const user = process.env.IMPERSONATE_USER || '';
  const ic = await impersonatedClient(user, [
    'https://www.googleapis.com/auth/drive',
  ]);
  return google.drive({ version: 'v3', auth: ic.auth });
}

async function findOrCreateOwnerFolder(drive: any, rootId: string, owner: string): Promise<string> {
  const escQ = (s: string) => s.replace(/'/g, "\\'");
  const name = owner.trim();
  const q = `name='${escQ(name)}' and mimeType='application/vnd.google-apps.folder' and '${rootId}' in parents and trashed=false`;
  const listParams: any = {
    q,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  };
  const { data } = await drive.files.list(listParams);
  if (data.files && data.files[0]?.id) return data.files[0].id as string;
  const { data: created } = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.id as string;
}

async function uploadOrReplaceDocx(drive: any, parentId: string, name: string, buffer: Buffer) {
  // Search by exact name within the owner folder
  const escQ = (s: string) => s.replace(/'/g, "\\'");
  const q = `name='${escQ(name)}' and '${parentId}' in parents and trashed=false`;
  const { data: list } = await drive.files.list({ q, fields: 'files(id,name,parents)', supportsAllDrives: true, includeItemsFromAllDrives: true } as any);
  if (list.files && list.files[0]?.id) {
    const fileId = list.files[0].id as string;
    const stream = Readable.from(buffer);
    await drive.files.update({ fileId, media: { mimeType: DOCX_MIME, body: stream }, supportsAllDrives: true });
    return { id: fileId, updated: true };
  }
  const stream = Readable.from(buffer);
  const { data: created } = await drive.files.create({
    requestBody: { name, mimeType: DOCX_MIME, parents: [parentId] },
    media: { mimeType: DOCX_MIME, body: stream },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  });
  return { id: created.id as string, created: true, webViewLink: created.webViewLink };
}

export async function listNotes(ownerRaw: string, dateStr: string) {
  const owner = canonicalOwner(ownerRaw) || ownerRaw.toString().toUpperCase();
  const db = new Firestore();
  const snap = await db.collection('notes')
    .where('owner', '==', owner)
    .where('dateKey', '==', dateStr)
    .get();
  const items = snap.docs.map(d => d.data() as NoteEntry);
  items.sort((a,b) => (a.ts||0)-(b.ts||0));
  return items;
}

export async function regenerateBriefDocx(ownerRaw: string, dateStr = ymd()) {
  const owner = canonicalOwner(ownerRaw) || ownerRaw.toString().toUpperCase();
  const notes = await listNotes(owner, dateStr);
  const title = briefTitle(owner, dateStr);

  const doc = new Document({ sections: [
    {
      properties: {},
      children: [
        new Paragraph({ text: `Brief – ${owner} – ${dateStr}`, heading: HeadingLevel.HEADING_1 }),
        ...notes.map(n => new Paragraph({ children: [ new TextRun({ text: `• ${n.title}: `, bold: true }), new TextRun(n.content) ] })),
      ],
    },
  ]});
  const buffer = await Packer.toBuffer(doc);

  const drive = await driveClient();
  const rootId = process.env.MEMORY_DRIVE_FOLDER_ID;
  if (!rootId) throw new Error('Missing MEMORY_DRIVE_FOLDER_ID');
  const folderId = await findOrCreateOwnerFolder(drive, rootId, owner);
  const up = await uploadOrReplaceDocx(drive, folderId, title, buffer);
  return { ok: true, title, owner, date: dateStr, fileId: up.id, folderId } as any;
}

export async function generateReportDocx(ownerRaw: string, dateStr = ymd(), summaryText?: string) {
  const owner = canonicalOwner(ownerRaw) || ownerRaw.toString().toUpperCase();
  const notes = await listNotes(owner, dateStr);
  const title = reportTitle(owner, dateStr);

  const paragraphs: Paragraph[] = [
    new Paragraph({ text: `Report – ${owner} – ${dateStr}`, heading: HeadingLevel.HEADING_1 }),
  ];
  if (summaryText) {
    paragraphs.push(new Paragraph(''));
    paragraphs.push(new Paragraph({ text: 'Sintesi', heading: HeadingLevel.HEADING_2 }));
    summaryText.split(/\n+/).forEach(line => paragraphs.push(new Paragraph(line)));
  }
  if (notes.length) {
    paragraphs.push(new Paragraph(''));
    paragraphs.push(new Paragraph({ text: 'Dettaglio del giorno', heading: HeadingLevel.HEADING_2 }));
    notes.forEach(n => {
      paragraphs.push(new Paragraph({ children: [ new TextRun({ text: `• ${n.title}: `, bold: true }), new TextRun(n.content) ] }));
    });
  }

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);

  const drive = await driveClient();
  const rootId = process.env.MEMORY_DRIVE_FOLDER_ID;
  if (!rootId) throw new Error('Missing MEMORY_DRIVE_FOLDER_ID');
  const folderId = await findOrCreateOwnerFolder(drive, rootId, owner);
  const up = await uploadOrReplaceDocx(drive, folderId, title, buffer);
  return { ok: true, title, owner, date: dateStr, fileId: up.id, folderId } as any;
}
