#!/usr/bin/env node
/*
 * Extract Shared Drive ID(s) and folder IDs by name using Service Account.
 * Requires env GOOGLE_SERVICE_ACCOUNT_KEY containing SA JSON.
 * Usage: node scripts/extract-drive-ids.js [FOLDER_NAME]
 * Default FOLDER_NAME is "AMBARADAM".
 */

const { GoogleAuth } = require('google-auth-library');

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  if (!raw.trim()) {
    console.error('ERROR: Set GOOGLE_SERVICE_ACCOUNT_KEY (Service Account JSON) in the environment');
    process.exit(2);
  }
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch (e) {
    console.error('ERROR: GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
    process.exit(2);
  }

  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  const client = await auth.getClient();
  const tok = await client.getAccessToken();
  const token = typeof tok === 'string' ? tok : (tok && (tok.token || tok.access_token)) || '';
  if (!token) {
    console.error('ERROR: Unable to obtain access token for the Service Account');
    process.exit(2);
  }

  const headers = { Authorization: `Bearer ${token}` };
  async function getJson(url) {
    const res = await fetch(url, { headers });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    return JSON.parse(text);
  }

  // Shared Drives listing removed — we operate on a single folder in My Drive.

  // 2) Search for a folder name across all drives
  const searchName = (process.argv[2] || 'AMBARADAM').toString();
  const esc = searchName.replace(/'/g, "\\'");
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `name='${esc}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  url.searchParams.set('fields', 'files(id,name,driveId,parents,webViewLink)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('corpora', 'allDrives');
  const data = await getJson(url.toString());
  const files = data.files || [];

  console.log(`\nFolders named "${searchName}":`);
  if (!files.length) {
    console.log('(none found)');
  } else {
    for (const f of files) {
      console.log(`- ${f.name} fileId=${f.id} driveId=${f.driveId || 'n/a'}${f.webViewLink ? ` link=${f.webViewLink}` : ''}`);
    }
    const candidate = files[0];
    console.log(`\nSuggested env:`);
    console.log(`DRIVE_FOLDER_AMBARADAM=${candidate.id}`);
  }
}

main().catch(err => {
  console.error(err && (err.stack || err.message) || String(err));
  process.exit(1);
});
