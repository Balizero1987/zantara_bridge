import type { Router, Request, Response } from 'express';
import { GoogleAuth } from 'google-auth-library';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { triggerGmailMonitorNow } from '../../jobs/cronGmailMonitor';
import { triggerDeadlineCheckNow, setupStandardComplianceDeadlines } from '../../jobs/cronCalendarDeadlines';

type WeeklyResult = {
  user: string;
  created: string[];
  deleted: number;
  archived: number;
};

export default function registerCron(r: Router) {
  r.post('/api/cron/weekly-merge', async (_req: Request, res: Response) => {
    try {
      const out = await weeklyMerge();
      return res.json(out);
    } catch (e: any) {
      return res.status(500).json({ status: 'error', error: e?.message || String(e) });
    }
  });

  r.post('/api/cron/gmail-monitor', async (_req: Request, res: Response) => {
    try {
      const result = await triggerGmailMonitorNow();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ status: 'error', error: e?.message || String(e) });
    }
  });

  r.post('/api/cron/deadline-check', async (_req: Request, res: Response) => {
    try {
      const result = await triggerDeadlineCheckNow();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ status: 'error', error: e?.message || String(e) });
    }
  });

  r.post('/api/cron/setup-deadlines', async (_req: Request, res: Response) => {
    try {
      const result = await setupStandardComplianceDeadlines();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ status: 'error', error: e?.message || String(e) });
    }
  });
}

// ===== Core =====
async function weeklyMerge() {
  const token = await getAccessToken();
  const ambRoot = (process.env.DRIVE_FOLDER_AMBARADAM || '').trim();
  if (!ambRoot) throw new Error('DRIVE_FOLDER_AMBARADAM required');

  const owners = await listChildFolders(token, ambRoot);
  const { weekLabel, dates } = currentIsoWeek();

  const results: WeeklyResult[] = [];
  for (const owner of owners) {
    const created: string[] = [];
    let deleted = 0;
    let archived = 0; // optional bucket not implemented

    // Subfolders to process
    const subs = ['Chat', 'Brief', 'Notes'];
    if (owner === 'BOSS') subs.push('Logs');

    for (const sub of subs) {
      const subId = await ensurePath(token, ambRoot, [owner, sub]);
      // gather files for the week based on naming
      const files = await listFilesInParent(token, subId);
      const weekFiles = files.filter(f => isFileInWeek(f.name, owner, sub, dates));
      if (!weekFiles.length) continue;

      // Build merged content / file
      if (sub === 'Brief') {
        const buffer = await buildWeeklyBriefDocx(token, weekFiles, owner, weekLabel);
        const name = `Brief-${owner}-${weekLabel}.docx`;
        await uploadMultipart(token, subId, name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer);
        created.push(name);
      } else if (sub === 'Logs') {
        const merged = await mergePlainFiles(token, weekFiles);
        const name = `Logs-${owner}-${weekLabel}.log`;
        await uploadTextMultipart(token, subId, name, 'text/plain', merged);
        created.push(name);
      } else {
        // Chat / Notes → markdown
        const merged = await mergePlainFiles(token, weekFiles);
        const name = `${sub}-${owner}-${weekLabel}.md`;
        await uploadTextMultipart(token, subId, name, 'text/markdown', merged);
        created.push(name);
      }

      // Delete originals
      for (const f of weekFiles) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?supportsAllDrives=true`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        deleted++;
      }
    }

    results.push({ user: owner, created, deleted, archived });
  }

  return { status: 'success', week: weekLabel, users_processed: results.length, results, timestamp: new Date().toISOString() };
}

// ===== Helpers: Drive auth & REST =====
async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  const client: any = await auth.getClient();
  const tok: any = await client.getAccessToken();
  const token = typeof tok === 'string' ? tok : (tok?.token || tok?.access_token || '');
  if (!token) throw new Error('No access token');
  return token;
}

async function findFolderByNameInDrive(token: string, driveId: string, name: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('corpora', 'allDrives');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data: any = await res.json();
  return data?.files?.[0]?.id || null;
}

async function listChildFolders(token: string, parentId: string): Promise<string[]> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  // parent filter is sufficient
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await res.json();
  return (data?.files || []).map((f: any) => f.name);
}

async function ensurePath(token: string, rootId: string, segments: string[]): Promise<string> {
  let parent = rootId;
  for (const seg of segments) {
    const q = `name='${seg.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parent}' in parents and trashed=false`;
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'files(id,name)');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    // parent filter is sufficient
    const sres = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const sdata: any = await sres.json();
    let id: string | undefined = sdata?.files?.[0]?.id;
    if (!id) {
      const cres = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: seg, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }),
      });
      const cdata: any = await cres.json();
      if (!cres.ok) throw new Error(`Create folder ${seg} failed: ${cres.status} ${cdata?.error?.message || ''}`);
      id = cdata.id;
    }
    parent = id!;
  }
  return parent;
}

async function listFilesInParent(token: string, parentId: string): Promise<Array<{id: string, name: string}>> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `'${parentId}' in parents and trashed=false`);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  // parent filter is sufficient
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await res.json();
  return data?.files || [];
}

function isFileInWeek(name: string, owner: string, sub: string, dates: string[]): boolean {
  if (sub === 'Chat') {
    return dates.some(d => name.startsWith(d + '__')) && name.endsWith('__chat.md');
  }
  if (sub === 'Notes') {
    return dates.some(d => name === `Note-${owner}-${d}.md`);
  }
  if (sub === 'Logs') {
    return dates.some(d => name === `Log-BOSS-${d}.log`);
  }
  if (sub === 'Brief') {
    return dates.some(d => name === `Brief-${owner}-${d}.docx`);
  }
  return false;
}

async function mergePlainFiles(token: string, files: Array<{id: string, name: string}>): Promise<string> {
  let merged = '';
  for (const f of files) {
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
    const content = await resp.text();
    merged += `# ${f.name}\n\n` + content + `\n\n---\n\n`;
  }
  return merged;
}

async function buildWeeklyBriefDocx(token: string, files: Array<{id: string, name: string}>, owner: string, weekLabel: string): Promise<Buffer> {
  // Nota: per semplicità creiamo un docx con l'elenco dei brief e i link web
  const doc = new Document({ sections: [{ children: [ new Paragraph({ text: `Brief – ${owner} – ${weekLabel}`, heading: HeadingLevel.HEADING_1 }) ] }] });
  for (const f of files) {
    // recupera webViewLink
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?fields=webViewLink,name`, { headers: { Authorization: `Bearer ${token}` } });
    const meta: any = await metaRes.json();
    const line = new Paragraph({ text: `• ${meta?.name || f.name} – ${meta?.webViewLink || ''}` });
    // @ts-ignore
    (doc as any).Sections[0].children.push(line);
  }
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

async function uploadTextMultipart(token: string, parentId: string, name: string, mime: string, content: string): Promise<void> {
  const boundary = 'weeklyBoundary' + Date.now();
  const meta = { name, parents: [parentId] };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--`;
  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
}

async function uploadMultipart(token: string, parentId: string, name: string, mime: string, buffer: Buffer): Promise<void> {
  const boundary = 'weeklyBoundary' + Date.now();
  const delimiter = `--${boundary}\r\n`;
  const closeDelim = `--${boundary}--`;
  const parts = [
    Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name, parents: [parentId] }) + '\r\n'),
    Buffer.from(delimiter + `Content-Type: ${mime}\r\n\r\n`),
    buffer,
    Buffer.from('\r\n' + closeDelim),
  ];
  const body = Buffer.concat(parts);
  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': String(body.length) }, body: body as any,
  });
}

function currentIsoWeek() {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // ISO week start on Monday
  const day = (utc.getUTCDay() + 6) % 7; // 0=Mon
  const monday = new Date(utc);
  monday.setUTCDate(utc.getUTCDate() - day);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const weekLabel = isoWeekLabel(utc);
  return { weekLabel, dates, monday, sunday };
}

function isoWeekLabel(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday in current week decides the year
  const dayNr = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  const year = date.getUTCFullYear();
  const ww = String(week).padStart(2, '0');
  return `${year}-W${ww}`;
}
