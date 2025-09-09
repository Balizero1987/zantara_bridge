#!/usr/bin/env node
/* Sequential smoke tests for Zantara Bridge endpoints. */

const BASE_URL = process.env.BASE_URL || 'https://zantara-chat-v3-1064094238013.asia-southeast2.run.app';
const API_KEY = process.env.API_KEY || 'your_api_key';
const BZ_USER = process.env.BZ_USER || 'boss';

const commonHeaders = {
  'X-API-KEY': API_KEY,
  'X-BZ-USER': BZ_USER,
  'Content-Type': 'application/json'
};

async function request(method, path, body) {
  const opts = { method, headers: { ...commonHeaders } };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function step(name, fn) {
  try {
    const res = await fn();
    if (res.ok) {
      console.log(`PASS - ${name} (${res.status})`);
    } else {
      console.log(`FAIL - ${name} (${res.status})`, res.data);
    }
  } catch (err) {
    console.log(`FAIL - ${name} (error)`, err.message);
  }
}

(async () => {
  await step('health check', () => request('GET', '/health'));
  await step('create note', () => request('POST', '/api/notes', { text: 'Smoke test', dateKey: new Date().toISOString().slice(0, 10) }));
  await step('get notes', () => request('GET', '/api/notes'));
  await step('brief with notes', () => request('POST', '/api/drive/brief', { title: 'Smoke', includeNotes: true }));
  await step('brief without notes', () => request('POST', '/api/drive/brief', { title: 'Smoke', includeNotes: false }));
  await step('chat', () => request('POST', '/api/chat', { message: 'ping' }));
  await step('chat ririMode', () => request('POST', '/api/chat', { message: 'ping', ririMode: true }));
  await step('drive _whoami', () => request('GET', '/api/drive/_whoami'));
})();
