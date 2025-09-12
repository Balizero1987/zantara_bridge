import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { resolveDriveContext } from "./googleApiHelpers";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY mancante");
  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({ credentials, scopes: DRIVE_SCOPES });
  const client = await auth.getClient();
  const token = await (client as any).getAccessToken();
  const t = typeof token === "string" ? token : token?.token;
  if (!t) throw new Error("Impossibile ottenere access token");
  return t as string;
}

function isoDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function isoTime(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Salva un messaggio di chat come file Markdown su Shared Drive.
 * Crea automaticamente una struttura di cartelle: Zantara/Chats/YYYY-MM-DD/
 * Ritorna {id, webViewLink, name}.
 */
export async function saveChatMessageToDrive(params: {
  chatId: string;
  author: string;    // es. "user" | "assistant"
  text: string;
  title?: string;    // titolo conversazione (opzionale)
}): Promise<{ id: string; webViewLink?: string; name: string }> {
  const accessToken = await getAccessToken();
  const date = isoDate();
  const time = isoTime();

  // Use drive context to get AMBARADAM folder directly
  const context = resolveDriveContext();
  
  // Nome cartella collaboratore: trasformiamo gli underscore in spazi
  const ownerFolderName = (params.author || 'BOSS').replace(/_/g, ' ').trim();

  // Direct path: AMBARADAM/<OWNER>/Chat/
  const basePath = [ownerFolderName, 'Chat'];
  let parentId = context.rootFolderId;  // Start from AMBARADAM folder directly

  for (const folderName of basePath) {
    const q = [
      `name='${folderName.replace(/'/g, "\\'")}'`,
      `mimeType='application/vnd.google-apps.folder'`,
      `'${parentId}' in parents`,
      "trashed=false",
    ].join(" and ");

    // search folder
    const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("fields", "files(id,name)");

    const sres = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const sdata: any = await sres.json();
    let folderId: string | undefined = sdata?.files?.[0]?.id;

    if (!folderId) {
      // create folder
      const cres = await fetch(
        "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId],
          }),
        }
      );
      const cdata: any = await cres.json();
      if (!cres.ok) {
        throw new Error(
          `Impossibile creare cartella "${folderName}": ${cres.status} ${cdata?.error?.message || ""}`
        );
      }
      folderId = cdata.id;
    }

    parentId = folderId!;
  }

  // 2) Prepara contenuto markdown
  const filename = `${date}__${time}__chat.md`;
  const titleLine = params.title ? `# ${params.title}\n\n` : "";
  const content =
    `${titleLine}` +
    `**chatId**: ${params.chatId}\n` +
    `**author**: ${params.author}\n` +
    `**time**: ${new Date().toISOString()}\n\n` +
    params.text +
    `\n`;

  // 3) Upload multipart/related (metadata + file) come text/markdown
  const meta = {
    name: filename,
    parents: [parentId],
  };
  const boundary = "zantaraBoundary" + Date.now();
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(meta) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: text/markdown; charset=UTF-8\r\n\r\n` +
    content +
    `\r\n--${boundary}--`;

  const upUrl =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true";
  const ures = await fetch(upUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const udata: any = await ures.json();
  if (!ures.ok) {
    throw new Error(
      `Upload fallito: ${ures.status} ${udata?.error?.message || ""}`
    );
  }
  // Arricchisci con webViewLink
  const gUrl = new URL(`https://www.googleapis.com/drive/v3/files/${udata.id}`);
  gUrl.searchParams.set("fields", "id,name,webViewLink");
  gUrl.searchParams.set("supportsAllDrives", "true");
  const gres = await fetch(gUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const gdata: any = await gres.json();

  return { id: gdata.id, webViewLink: gdata.webViewLink, name: gdata.name };
}

// Helpers
async function findFolderByNameInDrive(token: string, driveId: string, folderName: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('corpora', 'drive');
  url.searchParams.set('driveId', driveId);
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return null;
  const data: any = await resp.json();
  return data?.files?.[0]?.id || null;
}

function isNonEmptyId(id: string | null): id is string {
  return typeof id === 'string' && !!id.trim();
}

// ==========================
// Notes saving (AMBARADAM/<OWNER>/Notes/Note-<OWNER>-YYYY-MM-DD.md)
// ==========================
export async function saveNote(ownerRaw: string, text: string, title?: string): Promise<{ id: string; name: string; webViewLink?: string }> {
  const accessToken = await getAccessToken();
  const ownerFolderName = (ownerRaw || 'BOSS').replace(/_/g, ' ').trim();
  const context = resolveDriveContext();

  // Use AMBARADAM folder directly
  let parentId = context.rootFolderId;
  // ensure path <OWNER>/Notes
  parentId = await ensurePath(accessToken, parentId, [ownerFolderName, 'Notes']);

  const date = isoDate();
  const filename = `Note-${ownerFolderName}-${date}.md`;

  // try find existing file in parent
  const existingId = await findFileByNameInParent(accessToken, parentId, filename);
  const titleLine = title ? `# ${title}\n\n` : '';
  const entry = `${titleLine}${text}\n\n— ${new Date().toISOString()}\n`;

  if (existingId) {
    // append to existing (download, append, re-upload as media)
    const current = await fetch(`https://www.googleapis.com/drive/v3/files/${existingId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const currentText = await current.text();
    const newBody = currentText + (currentText.endsWith('\n') ? '' : '\n') + entry;
    const up = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/markdown; charset=UTF-8' },
      body: newBody,
    });
    if (!up.ok) throw new Error(`Append note failed: ${up.status}`);
    return { id: existingId, name: filename };
  }

  // create new multipart file
  const boundary = 'zantaraBoundary' + Date.now();
  const meta = { name: filename, parents: [parentId] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(meta) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: text/markdown; charset=UTF-8\r\n\r\n` +
    entry +
    `\r\n--${boundary}--`;
  const upUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink';
  const resp = await fetch(upUrl, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  const data: any = await resp.json();
  if (!resp.ok) throw new Error(`Create note failed: ${resp.status} ${data?.error?.message || ''}`);
  return { id: data.id, name: data.name, webViewLink: data.webViewLink };
}

// ==========================
// Boss logs (AMBARADAM/BOSS/Logs/Log-BOSS-YYYY-MM-DD.log)
// ==========================
export async function writeBossLog(line: string): Promise<{ id: string; name: string }> {
  const accessToken = await getAccessToken();
  const context = resolveDriveContext();
  let parentId = context.rootFolderId;
  parentId = await ensurePath(accessToken, parentId, ['BOSS', 'Logs']);

  const date = isoDate();
  const filename = `Log-BOSS-${date}.log`;
  const existingId = await findFileByNameInParent(accessToken, parentId, filename);
  const entry = `[${new Date().toISOString()}] ${line}\n`;
  if (existingId) {
    const current = await fetch(`https://www.googleapis.com/drive/v3/files/${existingId}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const currentText = await current.text();
    const newBody = currentText + entry;
    const up = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain; charset=UTF-8' }, body: newBody });
    if (!up.ok) throw new Error(`Append log failed: ${up.status}`);
    return { id: existingId, name: filename };
  }
  const boundary = 'zantaraBoundary' + Date.now();
  const meta = { name: filename, parents: [parentId] };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${entry}\r\n--${boundary}--`;
  const upUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name';
  const resp = await fetch(upUrl, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  const data: any = await resp.json();
  if (!resp.ok) throw new Error(`Create log failed: ${resp.status} ${data?.error?.message || ''}`);
  return { id: data.id, name: data.name };
}

// Ensure path helper used by notes/logs
async function ensurePath(token: string, rootId: string, segments: string[]): Promise<string> {
  let parent = rootId;
  for (const seg of segments) {
    const q = `name='${seg.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parent}' in parents and trashed=false`;
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'files(id,name)');
    const sres = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const sdata: any = await sres.json();
    let id: string | undefined = sdata?.files?.[0]?.id;
    if (!id) {
      const cres = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

async function findFileByNameInParent(token: string, parentId: string, name: string): Promise<string | null> {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`;
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return null;
  const data: any = await resp.json();
  return data?.files?.[0]?.id || null;
}

// ==========================
// Brief creation (AMBARADAM/<OWNER>/Brief/Brief-<OWNER>-YYYY-MM-DD.docx)
// ==========================
export async function createBrief(ownerRaw: string, content: string, title?: string): Promise<{ id: string; name: string; webViewLink?: string }> {
  const accessToken = await getAccessToken();
  const owner = (ownerRaw || 'BOSS').replace(/_/g, ' ').trim();
  const context = resolveDriveContext();
  
  // Use AMBARADAM folder with optional DRIVE_FOLDER_BRIEFS override
  const forcedBriefRoot = (process.env.DRIVE_FOLDER_BRIEFS || '').trim() || null;
  let rootParent = forcedBriefRoot || context.rootFolderId;
  
  // ensure path <OWNER>/Brief
  const briefParent = await ensurePath(accessToken, rootParent, [owner, 'Brief']);

  const date = isoDate();
  const name = `Brief-${owner}-${date}.docx`;

  // build simple docx
  const sections: any[] = [ new Paragraph({ text: `Brief – ${owner} – ${date}`, heading: HeadingLevel.HEADING_1 }) ];
  if (title) sections.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }));
  if (content) sections.push(new Paragraph({ text: content }));
  const doc = new Document({ sections: [{ children: sections }] });
  const buffer = await Packer.toBuffer(doc);

  // upload multipart
  const boundary = 'briefBoundary' + Date.now();
  const meta = { name, parents: [briefParent] };
  const parts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`,
  ].map(s => Buffer.from(s, 'utf8'));
  const body = Buffer.concat([parts[0], parts[1], Buffer.from(buffer), Buffer.from(`\r\n--${boundary}--`) ]);

  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': String(body.length) },
    body: body as any,
  });
  const data: any = await resp.json();
  if (!resp.ok) throw new Error(`Create brief failed: ${resp.status} ${data?.error?.message || ''}`);
  return { id: data.id, name: data.name, webViewLink: data.webViewLink };
}
