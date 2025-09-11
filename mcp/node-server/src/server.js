#!/usr/bin/env node
// Minimal MCP server (Node) con strumenti di base.
// Richiede: Node >= 18, @modelcontextprotocol/sdk installato.

import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// Nota: le API esatte del SDK MCP possono variare leggermente per versione.
// Questo scaffold presuppone metodi simili a `Server` + `StdioServerTransport` e `addTool`.
// Riferimento: @modelcontextprotocol/sdk
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const DEBUG = (process.env.MCP_DEBUG || '').toLowerCase() === '1';

function logDebug(...args) {
  if (DEBUG) console.error('[DEBUG]', ...args);
}

function parseAllowlistEnv(name) {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => path.resolve(p));
}

const FS_ALLOW = parseAllowlistEnv('MCP_FS_ALLOWLIST');
const FETCH_ALLOW_ALL = ['1', 'true', 'yes'].includes(
  (process.env.MCP_FETCH_ALLOW_ALL || '').toLowerCase()
);
const FETCH_ALLOW_HOSTS = (process.env.MCP_FETCH_ALLOW_HOSTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isPathAllowed(target) {
  const resolved = path.resolve(target);
  if (FS_ALLOW.length === 0) {
    // Se non impostato, consenti solo sotto la CWD
    const cwd = process.cwd();
    return resolved.startsWith(cwd + path.sep) || resolved === cwd;
  }
  return FS_ALLOW.some((root) => {
    const rel = path.relative(root, resolved);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  });
}

function ensurePathAllowed(target) {
  if (!isPathAllowed(target)) {
    throw new Error(`Percorso non consentito: ${target}`);
  }
}

function isHostAllowed(hostname) {
  if (FETCH_ALLOW_ALL) return true;
  if (FETCH_ALLOW_HOSTS.length === 0) return false;
  return FETCH_ALLOW_HOSTS.some((allowed) =>
    hostname === allowed || hostname.endsWith('.' + allowed)
  );
}

async function safeFetch(url, options = {}) {
  const u = new URL(url);
  if (!isHostAllowed(u.hostname)) {
    throw new Error(`Host non consentito: ${u.hostname}`);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    const max = 1_000_000; // 1MB
    const body = text.length > max ? text.slice(0, max) + '\n...[troncato]...' : text;
    return { status: res.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

const server = new Server(
  { name: 'mcp-node-tools', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

function textResponse(text) {
  return { content: [{ type: 'text', text }] };
}

// health
server.addTool(
  {
    name: 'health',
    description: 'Verifica lo stato del server',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  async () => textResponse('ok')
);

// echo
server.addTool(
  {
    name: 'echo',
    description: 'Ripete il testo fornito',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
      additionalProperties: false
    }
  },
  async ({ text }) => textResponse(text)
);

// sum
server.addTool(
  {
    name: 'sum',
    description: 'Somma una lista di numeri',
    inputSchema: {
      type: 'object',
      properties: { numbers: { type: 'array', items: { type: 'number' } } },
      required: ['numbers'],
      additionalProperties: false
    }
  },
  async ({ numbers }) => textResponse(String(numbers.reduce((a, b) => a + b, 0)))
);

// list_dir
server.addTool(
  {
    name: 'list_dir',
    description: 'Elenca file/dir in un percorso consentito',
    inputSchema: {
      type: 'object',
      properties: { dir: { type: 'string' } },
      required: ['dir'],
      additionalProperties: false
    }
  },
  async ({ dir }) => {
    ensurePathAllowed(dir);
    const entries = await readdir(dir, { withFileTypes: true });
    const out = await Promise.all(
      entries.map(async (e) => {
        const full = path.join(dir, e.name);
        const s = await stat(full);
        return { name: e.name, isDir: e.isDirectory(), size: s.size };
      })
    );
    return textResponse(JSON.stringify(out, null, 2));
  }
);

// fs_read
server.addTool(
  {
    name: 'fs_read',
    description: 'Legge un file (allowlist)',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string' }, encoding: { type: 'string', enum: ['utf-8'], default: 'utf-8' } },
      required: ['file'],
      additionalProperties: false
    }
  },
  async ({ file }) => {
    ensurePathAllowed(file);
    const data = await readFile(file, 'utf-8');
    const max = 1_000_000;
    const body = data.length > max ? data.slice(0, max) + '\n...[troncato]...' : data;
    return textResponse(body);
  }
);

// fs_write
server.addTool(
  {
    name: 'fs_write',
    description: 'Scrive un file (allowlist)',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        content: { type: 'string' },
        createDirs: { type: 'boolean', default: true }
      },
      required: ['file', 'content'],
      additionalProperties: false
    }
  },
  async ({ file, content, createDirs = true }) => {
    ensurePathAllowed(file);
    if (createDirs) {
      await mkdir(path.dirname(file), { recursive: true });
    }
    await writeFile(file, content, 'utf-8');
    return textResponse('ok');
  }
);

// fetch
server.addTool(
  {
    name: 'fetch',
    description: 'Esegue richieste HTTP (GET/POST) con allowlist di host',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
        headers: { type: 'object', additionalProperties: { type: 'string' } },
        body: { type: 'string' }
      },
      required: ['url'],
      additionalProperties: false
    }
  },
  async ({ url, method = 'GET', headers = {}, body }) => {
    const res = await safeFetch(url, {
      method,
      headers,
      body: method === 'POST' ? body || '' : undefined
    });
    return textResponse(JSON.stringify(res));
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
logDebug('MCP Node server avviato');

