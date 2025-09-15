#!/usr/bin/env node
// Minimal E2E test runner producing JSON summary

const API_URL = process.env.API_URL || process.argv[2] || '';
const API_KEY = process.env.API_KEY || process.argv[3] || '';
const USER = process.env.USER || process.env.BZ_USER || process.argv[4] || '';
const USER_EMAIL = process.env.USER_EMAIL || process.argv[5] || '';

if (!API_URL || !API_KEY || !USER) {
  console.error('Usage: node scripts/api-test-suite.mjs <API_URL> <API_KEY> <USER> [USER_EMAIL]');
  process.exit(2);
}

const H = {
  'X-API-KEY': API_KEY,
  'X-BZ-USER': USER,
  'Content-Type': 'application/json'
};

async function call(name, method, path, body) {
  const t0 = Date.now();
  let res, json, error;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: H,
      body: body ? JSON.stringify(body) : undefined
    });
    const txt = await res.text();
    try { json = JSON.parse(txt); } catch { json = { raw: txt.slice(0, 2000) }; }
  } catch (e) {
    error = String(e && e.message || e);
  }
  const durationMs = Date.now() - t0;
  const http = res ? res.status : 0;
  const ok = !!(json && (json.ok === true || json.success === true) && http >= 200 && http < 300);
  return { name, http, ok, durationMs, body: json, error };
}

async function main(){
  const results = [];

  // 1) Assistant: create thread
  const create = await call('assistant.thread.create', 'POST', '/api/assistant/thread/create', {
    userId: USER,
    title: 'KITAS procedure',
    category: 'kitas',
    collaborators: []
  });
  results.push(create);
  const threadId = create?.body?.thread?.id || create?.body?.threadId || create?.body?.thread?.threadId;

  // 2) Assistant: send message
  if (threadId) {
    results.push(await call('assistant.thread.message', 'POST', `/api/assistant/thread/${threadId}/message`, {
      userId: USER,
      message: 'Cos’è un KITAS?'
    }));
  } else {
    results.push({ name: 'assistant.thread.message', http: 0, ok: false, durationMs: 0, error: 'missing threadId from previous step' });
  }

  // 3) Assistant: search
  results.push(await call('assistant.search', 'POST', '/api/assistant/search', {
    query: 'KITAS renewal',
    limit: 5
  }));

  // 4) Compliance: Gmail monitor
  if (USER_EMAIL) {
    results.push(await call('compliance.gmail.monitor', 'POST', '/api/compliance/gmail/monitor', {
      userEmail: USER_EMAIL,
      maxResults: 10
    }));
  } else {
    results.push({ name: 'compliance.gmail.monitor', http: 0, ok: false, durationMs: 0, error: 'USER_EMAIL not provided' });
  }

  // 5) Compliance: create deadline
  results.push(await call('compliance.deadline.create', 'POST', '/api/compliance/deadline/create', {
    userId: USER,
    title: 'KITAS Renewal',
    deadline: '2025-12-15'
  }));

  // 6) Compliance: create dashboard
  results.push(await call('compliance.dashboard.create', 'POST', '/api/compliance/dashboard/create'));

  // 7) Compliance: upcoming deadlines
  results.push(await call('compliance.upcoming-deadlines', 'GET', `/api/compliance/upcoming-deadlines/${encodeURIComponent(USER)}?days=90`));

  // 8) Compliance: cache stats
  results.push(await call('compliance.cache.stats', 'GET', '/api/compliance/cache/stats'));

  // 9) Compliance: process overdue
  results.push(await call('compliance.admin.process-overdue', 'POST', '/api/compliance/admin/process-overdue'));

  const summary = {
    api_url: API_URL,
    user: USER,
    user_email: USER_EMAIL || null,
    passed: results.filter(r => r.ok).length,
    total: results.length,
    results
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.passed === summary.total ? 0 : 1);
}

main().catch(e=>{
  console.error('Fatal:', e);
  process.exit(1);
});

