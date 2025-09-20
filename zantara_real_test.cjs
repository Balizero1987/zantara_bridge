#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const { google } = require('googleapis');
const usersConfig = require('./users.json');

async function runAllTests() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

  const drive = google.drive({ version: 'v3', auth });
  const calendar = google.calendar({ version: 'v3', auth });
  const gmail = google.gmail({ version: 'v1', auth });

  // 📁 Funzione uploadToDrive
  async function uploadToDrive(filePath, folderId = null) {
    const media = {
      mimeType: 'text/plain',
      body: fs.createReadStream(filePath)
    };

    if (folderId) {
      const res = await drive.files.create({
        requestBody: {
          name: filePath.split('/').pop(),
          parents: [folderId],
          mimeType: 'text/plain'
        },
        media,
        fields: 'id',
        supportsAllDrives: true
      });
      console.log(`📁 File caricato nella cartella ${folderId} → ID:`, res.data.id);
      return res.data.id;
    } else if (process.env.ZANTARA_SHARED_DRIVE_ID) {
      const res = await drive.files.create({
        requestBody: {
          name: filePath.split('/').pop(),
          mimeType: 'text/plain'
        },
        media,
        fields: 'id',
        supportsAllDrives: true,
        driveId: process.env.ZANTARA_SHARED_DRIVE_ID
      });
      console.log('📁 File caricato nella root di AMBARADAM → ID:', res.data.id);
      return res.data.id;
    } else {
      throw new Error('❌ Nessun DRIVE_FOLDER_ID o ZANTARA_SHARED_DRIVE_ID configurato nello .env');
    }
  }

  // 📂 Funzione per salvare in base all'email dell'utente
  async function saveForUser(email, filePath) {
    const user = usersConfig.users.find(u => u.email === email);
    if (!user) {
      throw new Error(`❌ Nessuna cartella configurata per ${email}`);
    }
    return await uploadToDrive(filePath, user.folderId);
  }

  console.log('🚀 ZANTARA BRIDGE - UNIFIED REAL API TEST');
  console.log('=========================================');
  console.log('🔧 Testing Enterprise-Grade Google Services Integration\n');

  console.log('📁 DRIVE API TEST');
  console.log('────────────────────');

  // 🔄 Ciclo: backup giornaliero per tutte le cartelle
  for (const user of usersConfig.users) {
    await uploadToDrive('./test_file.txt', user.folderId);
  }

  console.log('\n✅ Backup completato in tutte le cartelle utenti');

}

runAllTests().catch(err => console.error('❌ Errore durante il test:', err.message));