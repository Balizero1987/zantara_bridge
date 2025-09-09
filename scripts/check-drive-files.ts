import { google } from "googleapis";

async function main() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });

  const driveId = process.env.DRIVE_ID_AMBARADAM; // ID dello Shared Drive
  const owner = process.argv[2] || "BOSS"; // default BOSS se non passi argomento

  if (!driveId) {
    console.error("❌ DRIVE_ID_AMBARADAM non impostato");
    process.exit(1);
  }

  console.log(`📂 Listing files in ${owner} (driveId=${driveId})`);

  const res = await drive.files.list({
    q: `name='${owner}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    corpora: "drive",
    driveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: "files(id,name)",
  });

  if (!res.data.files || res.data.files.length === 0) {
    console.log(`⚠️ Nessuna cartella trovata per ${owner}`);
    return;
  }

  const folderId = res.data.files[0].id!;
  console.log(`📂 Folder ${owner} id=${folderId}`);

  const files = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    corpora: "drive",
    driveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: "files(id,name,webViewLink,createdTime)",
    orderBy: "createdTime desc",
    pageSize: 10,
  });

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
