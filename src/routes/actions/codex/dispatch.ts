import { defineEventHandler, readBody } from 'h3';
import { $fetch } from 'ofetch';
import { randomUUID } from 'crypto';

const REQUIRED_TOKEN = process.env.CODEX_DISPATCH_TOKEN;

export default defineEventHandler(async (event) => {
  const auth = event.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '').trim();

  console.log('🔐 Received token:', token);
  console.log('✅ Expected token:', REQUIRED_TOKEN);

  if (!REQUIRED_TOKEN || token !== REQUIRED_TOKEN) {
    return { ok: false, error: 'Unauthorized' };
  }

  const payload = await readBody(event);
  const requestId = randomUUID();
  const branch = `codex/update-${requestId}`;

  const body = {
    event_type: 'codex-apply-patch',
    client_payload: {
      branch,
      title: payload.title,
      body: `${payload.body}\n\nZANTARA req: ${requestId}`,
      patch_b64: payload.patch_b64,
      requestId,
    },
  };

  console.log('🚀 Dispatching to GitHub:', body);

  const res = await $fetch(`https://api.github.com/repos/Balizero1987/zantara_bridge/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REQUIRED_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body,
  }).catch(async (err) => {
    const msg = await err.response?.text();
    console.error('❌ Dispatch error:', msg);
    throw new Error('GitHub dispatch failed');
  });

  return {
    ok: true,
    status: res.status,
    requestId,
    branch,
  };
});
