import { google } from "googleapis";

async function main() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });

  const rootFolder = process.env.DRIVE_FOLDER_AMBARADAM; // ID cartella AMBARADAM in My Drive
  const owner = process.argv[2] || "BOSS"; // default BOSS se non passi argomento

  if (!rootFolder) {
    console.error("❌ DRIVE_FOLDER_AMBARADAM non impostato");
    process.exit(1);
  }

  console.log(`📂 Listing files in ${owner} (rootFolder=${rootFolder})`);

  // Trova (o crea) la cartella dell'owner sotto AMBARADAM
  const esc = (s: string) => s.replace(/'/g, "\\'");
  const qOwner = `name='${esc(owner)}' and mimeType='application/vnd.google-apps.folder' and '${rootFolder}' in parents and trashed=false`;
  const res = await drive.files.list({
    q: qOwner,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: "files(id,name)",
  } as any);

  if (!res.data.files || res.data.files.length === 0) {
    console.log(`⚠️ Nessuna cartella trovata per ${owner}`);
    return;
  }

  const folderId = res.data.files[0].id!;
  console.log(`📂 Folder ${owner} id=${folderId}`);

  const files = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: "files(id,name,webViewLink,createdTime)",
    orderBy: "createdTime desc",
    pageSize: 10,
  } as any);

  if (!files.data.files || files.data.files.length === 0) {
    console.log(`⚠️ Nessun file trovato in cartella ${owner}`);
    return;
  }

  files.data.files.forEach((f) => {
    console.log(`📄 ${f.name} (${f.id}) → ${f.webViewLink}`);
  });
}

main().catch((e) => {
  console.error("❌ Errore:", e.message);
  process.exit(1);
});
