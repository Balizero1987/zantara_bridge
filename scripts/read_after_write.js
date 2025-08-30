#!/usr/bin/env node
/*
 Read-after-write sanity script for ZANTARA backend.
 Requirements:
  - ENV: API_BASE (Cloud Run URL), API_KEY
  - Optional: BALI_ZERO_CALENDAR_ID override via query
*/
const fs = require('fs');
const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || process.env.SERVICE_URL;
const API_KEY = process.env.API_KEY;
const OUT = process.env.OUT || 'post_deploy_results.txt';
if (!API_BASE || !API_KEY) {
  console.error('Missing API_BASE or API_KEY env');
  process.exit(2);
}

const headers = { 'content-type': 'application/json', 'x-api-key': API_KEY };

(function appendResult(line) {
  try { fs.appendFileSync(OUT, line + "\n"); } catch (_) {}
})

(async () => {
  try {
    const ts = Date.now();
    const name = `Zantara Test ${ts}`;
    const summary = { module: 'read_after_write', ts, pass: false, details: { drive: {}, calendar: {} } };

    // 1) Create Drive file (Google Doc)
    const driveResp = await fetch(`${API_BASE}/actions/drive/create`, {
      method: 'POST', headers, body: JSON.stringify({ name })
    });
    const driveJson = await driveResp.json();
    console.log('drive.create ->', driveResp.status, JSON.stringify(driveJson));
    if (!driveResp.ok || !driveJson.fileId) {
      const cause = driveResp.status === 401 ? 'unauthorized (DWD/scopes)' : (driveResp.status === 403 ? 'insufficient permissions (Drive scope or ACL)' : 'unknown');
      appendResult(`[RA] drive.create FAIL status=${driveResp.status} cause=${cause} msg=${driveJson?.error || ''}`);
      throw new Error(`drive.create failed: status ${driveResp.status}`);
    }

    // 3a) Read file back
    const getFileResp = await fetch(`${API_BASE}/actions/drive/get?fileId=${encodeURIComponent(driveJson.fileId)}`, { headers });
    const getFileJson = await getFileResp.json();
    console.log('drive.get ->', getFileResp.status, JSON.stringify(getFileJson));
    const file = getFileJson.file || {};
    const ownedByMe = !!file.ownedByMe;
    const parentOk = Array.isArray(file.parents) && (!!driveJson.parentId ? file.parents.includes(driveJson.parentId) : file.parents.length > 0);
    const driveOk = getFileResp.ok && ownedByMe && parentOk;
    summary.details.drive = {
      fileId: driveJson.fileId,
      webViewLink: driveJson.webViewLink || file.webViewLink || null,
      folderId: driveJson.parentId || (Array.isArray(file.parents) ? file.parents[0] : null),
      ownedByMe,
      parentOk,
      status: driveResp.status,
    };

    // 2) Create Calendar event
    const calPayload = { summary: `Zantara Test Event ${ts}` };
    const calResp = await fetch(`${API_BASE}/actions/calendar/create`, { method: 'POST', headers, body: JSON.stringify(calPayload) });
    const calJson = await calResp.json();
    console.log('calendar.create ->', calResp.status, JSON.stringify(calJson));
    if (!calResp.ok || !calJson.eventId) {
      const cause = calResp.status === 401 ? 'unauthorized (DWD/scopes)' : (calResp.status === 403 ? 'insufficient permissions (Calendar scope/ACL)' : 'unknown');
      appendResult(`[RA] calendar.create FAIL status=${calResp.status} cause=${cause} msg=${calJson?.error || ''}`);
      throw new Error(`calendar.create failed: status ${calResp.status}`);
    }

    // 3b) Read event back
    const calId = calJson.calendarId ? encodeURIComponent(calJson.calendarId) : '';
    const evGetUrl = `${API_BASE}/actions/calendar/get?eventId=${encodeURIComponent(calJson.eventId)}${calId ? `&calendarId=${calId}` : ''}`;
    const getEvResp = await fetch(evGetUrl, { headers });
    const getEvJson = await getEvResp.json();
    console.log('calendar.get ->', getEvResp.status, JSON.stringify(getEvJson));
    const event = getEvJson.event || {};
    const confirmed = (event.status || '').toLowerCase() === 'confirmed';
    const organizer = event?.organizer?.email || calJson.organizer || null;
    const calOk = getEvResp.ok && !!event.id && confirmed;
    summary.details.calendar = {
      eventId: calJson.eventId,
      calendarId: calJson.calendarId || null,
      status: event.status,
      organizer,
      htmlLink: calJson.htmlLink || event.htmlLink || null,
      confirmed,
      getStatus: getEvResp.status,
    };

    // Summary
    const pass = !!(driveOk && calOk);
    summary.pass = pass;
    // summary.details already set above
    console.log('\nSUMMARY');
    console.log('fileId:', summary.details.drive.fileId, 'folderId:', summary.details.drive.folderId, 'ownedByMe:', ownedByMe);
    console.log('eventId:', summary.details.calendar.eventId, 'calendarId:', summary.details.calendar.calendarId, 'status:', event.status, 'organizer:', organizer);
    console.log('PASS:', pass);
    try { appendResult(`[RA] RESULT ${JSON.stringify(summary)}`); } catch (_) {}

    if (!pass) {
      try {
        // Fetch SA info for quick diagnostics
        const sai = await fetch(`${API_BASE}/debug/sa-info`, { headers });
        const saj = await sai.json();
        const out = {
          client_id: saj?.info?.client_id || null,
          client_email: saj?.info?.client_email || null,
          aboutEmail: saj?.aboutEmail || null,
          allowedMatch: !!saj?.allowedMatch,
        };
        // Optional scopeStatus via /debug/self-check
        try {
          const sc = await fetch(`${API_BASE}/debug/self-check`);
          const scj = await sc.json();
          if (scj && scj.results) {
            out.scopeStatus = {
              drive: !!scj.results.drive?.ok,
              calendar: !!scj.results.calendar?.ok,
              gmail: !!scj.results.gmail?.ok,
              chat: !!scj.results.chat?.ok,
            };
          }
        } catch (_) {}
        appendResult(`[SA-INFO] ${JSON.stringify(out)}`);
        appendResult('[HINT] Check Admin Console → Security → API Controls → Domain-wide Delegation');
      } catch (e) {
        appendResult(`[SA-INFO] ERROR ${e?.message || String(e)}`);
      }
    }
    process.exit(pass ? 0 : 1);
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.error('ERROR:', msg);
    appendResult(`[RA] ERROR ${msg}`);
    appendResult('[RA] HINT probable_causes=[missing_scope, acl_error, impersonation_failed]');
    try { appendResult(`[RA] RESULT ${JSON.stringify(summary)}`); } catch (_) {}
    process.exit(1);
  }
})();
