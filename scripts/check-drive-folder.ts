import { google } from "googleapis";

async function main() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    const folderId =
      process.env.BRIEF_DRIVE_FOLDER_ID || process.env.ZANTARA_SHARED_DRIVE_ID;

    if (!folderId) {
      console.error("❌ Nessuna variabile BRIEF_DRIVE_FOLDER_ID o ZANTARA_SHARED_DRIVE_ID trovata");
      process.exit(1);
    }

    console.log(`📂 Listing files in folderId=${folderId}`);

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id,name,webViewLink,createdTime)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 10,
    });

    const files = res.data.files || [];
    if (!files.length) {
      console.log("⚠️ Nessun file trovato in questa cartella");
    } else {
      files.forEach((f) =>
        console.log(`- ${f.name} (${f.id}) [${f.webViewLink}] created=${f.createdTime}`)
      );
    }
  } catch (err: any) {
    console.error("❌ Errore:", err.message || err);
    process.exit(1);
  }
}

main();
