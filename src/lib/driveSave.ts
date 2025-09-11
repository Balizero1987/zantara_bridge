import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];

function getDriveId(): string {
  const id = (process.env.DRIVE_ID_AMBARADAM || "").trim();
  if (!id) throw new Error("DRIVE_ID_AMBARADAM non impostato");
  return id;
}

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
  const driveId = getDriveId();
  const date = isoDate();
  const time = isoTime();

  // Cartella root preferita: AMBARADAM (se esiste), altrimenti Drive root
  // È possibile forzare l'ID con env DRIVE_FOLDER_AMBARADAM
  const forcedRoot = (process.env.DRIVE_FOLDER_AMBARADAM || '').trim() || null;

  // Nome cartella collaboratore: trasformiamo gli underscore in spazi
  const ownerFolderName = (params.author || 'BOSS').replace(/_/g, ' ').trim();

  // Costruisci percorso logico: AMBARADAM/<OWNER>/<YYYY-MM-DD>/ oppure fallback Zantara/Chats/YYYY-MM-DD
  let basePath: string[];
  let parentId = driveId;

  if (forcedRoot) {
    basePath = [ownerFolderName, date];
    parentId = forcedRoot;
  } else {
    // Prova a risolvere AMBARADAM per nome
    const ambFolderId = await findFolderByNameInDrive(accessToken, driveId, 'AMBARADAM');
    if (isNonEmptyId(ambFolderId)) {
      parentId = ambFolderId as string;
      basePath = [ownerFolderName, date];
    } else {
      // Fallback storico
      basePath = ["Zantara", "Chats", date];
      parentId = driveId;
    }
  }

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
    searchUrl.searchParams.set("supportsAllDrives", "true");
    searchUrl.searchParams.set("includeItemsFromAllDrives", "true");
    searchUrl.searchParams.set("corpora", "drive");
    searchUrl.searchParams.set("driveId", driveId);

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
  const filename = `${date}__${time}__${params.chatId}__${params.author}.md`;
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
