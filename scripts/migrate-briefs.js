#!/usr/bin/env node
/*
  Migrates root-level Brief-* docs into AMBARADAM/<OWNER>/Brief/
  Env required:
    - GOOGLE_SERVICE_ACCOUNT_KEY (JSON)
    - DRIVE_ID_AMBARADAM (shared drive id, 0A...)
    - DRIVE_FOLDER_AMBARADAM (folder id of AMBARADAM) [recommended]
*/
const { GoogleAuth } = require('google-auth-library');

async function getToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  const client = await auth.getClient();
  const tok = await client.getAccessToken();
  const t = typeof tok === 'string' ? tok : (tok && tok.token) || '';
  if (!t) throw new Error('No access token');
  return t;
}

async function rest(method, url, token, body, headers = {}) {
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status} ${res.statusText} – ${t}`);
  }
  return res.json();
}

async function findFolderByNameInDrive(token, driveId, name) {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('corpora', 'drive');
  url.searchParams.set('driveId', driveId);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.files && data.files[0] && data.files[0].id) || null;
}

async function ensurePath(token, driveId, rootId, segments) {
  let parent = rootId;
  for (const seg of segments) {
    const q = `name='${seg.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parent}' in parents and trashed=false`;
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'files(id,name)');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    url.searchParams.set('corpora', 'drive');
    url.searchParams.set('driveId', driveId);
    const sres = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const sdata = await sres.json();
    let id = sdata.files && sdata.files[0] && sdata.files[0].id;
    if (!id) {
      const cres = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: seg, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }),
      });
      const cdata = await cres.json();
      if (!cres.ok) throw new Error(`Create folder ${seg} failed: ${cdata && cdata.error && cdata.error.message}`);
      id = cdata.id;
    }
    parent = id;
  }
  return parent;
}

function parseOwnerFromBrief(name) {
  const m = /^Brief-([^-]+)-\d{4}-\d{2}-\d{2}\.docx$/.exec(name || '');
  return m ? m[1].trim() : null;
}

async function main() {
  const token = await getToken();
  const driveId = (process.env.DRIVE_ID_AMBARADAM || '').trim();
  const ambRoot = (process.env.DRIVE_FOLDER_AMBARADAM || '').trim();
  if (!driveId) throw new Error('DRIVE_ID_AMBARADAM required');

  // 1) Cerca tutti i Brief-* in tutta la drive
  const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
  listUrl.searchParams.set('q', "name contains 'Brief-' and mimeType='application/vnd.google-apps.document' and trashed=false");
  listUrl.searchParams.set('fields', 'files(id,name,parents)');
  listUrl.searchParams.set('supportsAllDrives', 'true');
  listUrl.searchParams.set('includeItemsFromAllDrives', 'true');
  listUrl.searchParams.set('corpora', 'drive');
  listUrl.searchParams.set('driveId', driveId);
  const all = await rest('GET', listUrl.toString(), token);

  // 2) Risolvi AMBARADAM base
  let ambaradamId = ambRoot;
  if (!ambRoot) ambaradamId = await findFolderByNameInDrive(token, driveId, 'AMBARADAM');
  if (!ambardamIdTruthy(ambaramId(ambardamId))) throw new Error('AMBARADAM folder not found');
  ambaradamId = ambaradamId;

  let moved = 0;
  for (const f of all.files || []) {
    const owner = parseOwnerFromBrief(f.name);
    if (!owner) continue;
    const parents = f.parents || [];
    // se già sotto AMBARADAM, salta
    if (parents.includes(ambaramId(ambardamId))) continue;
    const ownerFolder = owner.replace(/_/g, ' ').trim();
    const briefTarget = await ensurePath(token, driveId, ambaradamId, [ownerFolder, 'Brief']);
    const addParents = briefTarget;
    const removeParents = parents.join(',');
    // move
    await rest('PATCH', `https://www.googleapis.com/drive/v3/files/${f.id}?addParents=${encodeURIComponent(addParents)}&removeParents=${encodeURIComponent(removeParents)}&supportsAllDrives=true&fields=id,parents`, token, null, { 'Content-Type': 'application/json' });
    moved++;
  }
  console.log(JSON.stringify({ ok: true, moved }, null, 2));
}

function ambaramId(x){return x}
function ambardamIdTruthy(id){return typeof id==='string' && !!id.trim()}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});

