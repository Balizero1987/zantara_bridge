#!/usr/bin/env node
// Minimal MCP server (Node) con strumenti di base.
// Richiede: Node >= 18, @modelcontextprotocol/sdk installato.

import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

// Nota: le API esatte del SDK MCP possono variare leggermente per versione.
// Questo scaffold presuppone metodi simili a `Server` + `StdioServerTransport` e `addTool`.
// Riferimento: @modelcontextprotocol/sdk
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const DEBUG = (process.env.MCP_DEBUG || '').toLowerCase() === '1';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

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
    if (resolved === root) return true;
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

const server = new Server({ name: 'mcp-node-tools', version: '0.1.0' });

function textResponse(text) {
  return { content: [{ type: 'text', text }] };
}

function clampText(text, max = 1_000_000) {
  if (typeof text !== 'string') text = String(text);
  return text.length > max ? text.slice(0, max) + '\n...[troncato]...' : text;
}

function defaultRepoRoot() {
  // Usa la prima entry dell'allowlist come default, altrimenti CWD
  if (FS_ALLOW.length > 0) return FS_ALLOW[0];
  return process.cwd();
}

async function runGit(args, cwd) {
  const repo = cwd ? path.resolve(cwd) : defaultRepoRoot();
  ensurePathAllowed(repo);
  // Timeout 10s, output limit 1MB
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10_000);
  try {
    const { stdout, stderr } = await execFile('git', args, {
      cwd: repo,
      maxBuffer: 2_000_000, // 2MB raw buffer
      signal: controller.signal
    });
    const out = stdout || stderr || '';
    return clampText(out);
  } catch (err) {
    let msg = '';
    if (err.stdout || err.stderr) {
      msg = String(err.stdout || err.stderr);
    } else if (err.message) {
      msg = err.message;
    } else {
      msg = String(err);
    }
    throw new Error(clampText(msg));
  } finally {
    clearTimeout(t);
  }
}

// Tool registry
const toolRegistry = new Map();
function registerTool(def, handler) {
  toolRegistry.set(def.name, { def, handler });
}

// health
registerTool(
  {
    name: 'health',
    description: 'Verifica lo stato del server',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  async () => textResponse('ok')
);

// echo
registerTool(
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
registerTool(
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
registerTool(
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
registerTool(
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
registerTool(
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
registerTool(
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

// -------- GitHub helpers --------
function ghHeaders(extra = {}) {
  const base = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (GITHUB_TOKEN) base['Authorization'] = `token ${GITHUB_TOKEN}`;
  return { ...base, ...extra };
}

async function githubFetch(pathname, { method = 'GET', body, headers = {} } = {}) {
  const url = `https://api.github.com${pathname}`;
  const opts = { method, headers: ghHeaders(headers) };
  if (body !== undefined) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
  }
  const res = await safeFetch(url, opts);
  return res;
}

function ensureGitHubToken() {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN non impostato nell\'ambiente');
}

// github_whoami
registerTool(
  {
    name: 'github_whoami',
    description: 'Restituisce info sull\'utente autenticato (richiede GITHUB_TOKEN)',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  async () => {
    ensureGitHubToken();
    const res = await githubFetch('/user');
    return textResponse(res.body);
  }
);

// github_list_repos
registerTool(
  {
    name: 'github_list_repos',
    description: 'Elenca i repo dell\'utente (richiede GITHUB_TOKEN).',
    inputSchema: {
      type: 'object',
      properties: {
        visibility: { type: 'string', enum: ['all', 'public', 'private'], default: 'all' },
        per_page: { type: 'number', minimum: 1, maximum: 100, default: 30 },
        page: { type: 'number', minimum: 1, default: 1 }
      },
      additionalProperties: false
    }
  },
  async ({ visibility = 'all', per_page = 30, page = 1 }) => {
    ensureGitHubToken();
    const qs = new URLSearchParams({ visibility, per_page: String(per_page), page: String(page) });
    const res = await githubFetch(`/user/repos?${qs.toString()}`);
    return textResponse(res.body);
  }
);

// github_list_prs
registerTool(
  {
    name: 'github_list_prs',
    description: 'Elenca PR per un repo.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
        per_page: { type: 'number', minimum: 1, maximum: 100, default: 30 },
        page: { type: 'number', minimum: 1, default: 1 }
      },
      required: ['owner', 'repo'],
      additionalProperties: false
    }
  },
  async ({ owner, repo, state = 'open', per_page = 30, page = 1 }) => {
    const qs = new URLSearchParams({ state, per_page: String(per_page), page: String(page) });
    const res = await githubFetch(`/repos/${owner}/${repo}/pulls?${qs.toString()}`);
    return textResponse(res.body);
  }
);

// github_create_issue
registerTool(
  {
    name: 'github_create_issue',
    description: 'Crea una issue (richiede GITHUB_TOKEN con permessi repo).',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        assignees: { type: 'array', items: { type: 'string' } }
      },
      required: ['owner', 'repo', 'title'],
      additionalProperties: false
    }
  },
  async ({ owner, repo, title, body, labels, assignees }) => {
    ensureGitHubToken();
    const payload = { title };
    if (body) payload.body = body;
    if (labels) payload.labels = labels;
    if (assignees) payload.assignees = assignees;
    const res = await githubFetch(`/repos/${owner}/${repo}/issues`, { method: 'POST', body: payload });
    return textResponse(res.body);
  }
);

// github_comment_issue
registerTool(
  {
    name: 'github_comment_issue',
    description: 'Aggiunge un commento a una issue/PR (richiede GITHUB_TOKEN).',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        issue_number: { type: 'number' },
        body: { type: 'string' }
      },
      required: ['owner', 'repo', 'issue_number', 'body'],
      additionalProperties: false
    }
  },
  async ({ owner, repo, issue_number, body }) => {
    ensureGitHubToken();
    const res = await githubFetch(`/repos/${owner}/${repo}/issues/${issue_number}/comments`, { method: 'POST', body: { body } });
    return textResponse(res.body);
  }
);

// github_get_file
registerTool(
  {
    name: 'github_get_file',
    description: 'Scarica contenuto file via API contents (base64). Facoltativo `ref`.',
    inputSchema: {
      type: 'object',
      properties: { owner: { type: 'string' }, repo: { type: 'string' }, path: { type: 'string' }, ref: { type: 'string' } },
      required: ['owner', 'repo', 'path'],
      additionalProperties: false
    }
  },
  async ({ owner, repo, path: filePath, ref }) => {
    const qs = new URLSearchParams();
    if (ref) qs.set('ref', ref);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await githubFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}${suffix}`);
    return textResponse(res.body);
  }
);

// git_status
registerTool(
  {
    name: 'git_status',
    description: 'Mostra lo stato git (porcelain) nella repo indicata',
    inputSchema: {
      type: 'object',
      properties: { repo: { type: 'string' } },
      additionalProperties: false
    }
  },
  async ({ repo }) => {
    const out = await runGit(['status', '--porcelain=v1', '--untracked-files=all'], repo);
    return textResponse(out || '(pulito)');
  }
);

// git_diff
registerTool(
  {
    name: 'git_diff',
    description: 'Mostra il diff. Supporta staged o rev range (es. "HEAD~1..HEAD").',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string' },
        path: { type: 'string' },
        staged: { type: 'boolean', default: false },
        revRange: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  async ({ repo, path: filePath, staged = false, revRange }) => {
    const args = ['diff'];
    if (staged) args.push('--staged');
    if (revRange) args.push(revRange);
    if (filePath) args.push('--', filePath);
    const out = await runGit(args, repo);
    return textResponse(out || '(nessun diff)');
  }
);

// git_commit
registerTool(
  {
    name: 'git_commit',
    description: 'Esegue commit (su index esistente o con addAll). Non spinge in remoto.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string' },
        message: { type: 'string' },
        addAll: { type: 'boolean', default: false },
        signoff: { type: 'boolean', default: false }
      },
      required: ['message'],
      additionalProperties: false
    }
  },
  async ({ repo, message, addAll = false, signoff = false }) => {
    if (!message || !message.trim()) {
      throw new Error('Messaggio di commit mancante');
    }
    const cwd = repo || defaultRepoRoot();
    ensurePathAllowed(cwd);
    if (addAll) {
      await runGit(['add', '-A'], cwd);
    }
    const args = ['commit', '-m', message];
    if (signoff) args.push('--signoff');
    const out = await runGit(args, cwd);
    // Prova a ottenere l'ultimo commit
    let hash = '';
    try {
      hash = await runGit(['rev-parse', 'HEAD'], cwd);
      hash = hash.trim();
    } catch (_) {}
    const result = out + (hash ? `\ncommit: ${hash}` : '');
    return textResponse(result.trim());
  }
);

// git_log
registerTool(
  {
    name: 'git_log',
    description: 'Mostra il log (oneline). Supporta revRange, max e path.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string' },
        revRange: { type: 'string' },
        max: { type: 'number', minimum: 1, maximum: 500, default: 20 },
        path: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  async ({ repo, revRange, max = 20, path: filePath }) => {
    const args = ['log', '--oneline', '--decorate', `--max-count=${Math.floor(max)}`];
    if (revRange) args.push(revRange);
    if (filePath) args.push('--', filePath);
    const out = await runGit(args, repo);
    return textResponse(out || '(nessun log)');
  }
);

// git_branches
registerTool(
  {
    name: 'git_branches',
    description: 'Elenca i branch locali (e opzionalmente remoti).',
    inputSchema: {
      type: 'object',
      properties: { repo: { type: 'string' }, remotes: { type: 'boolean', default: false } },
      additionalProperties: false
    }
  },
  async ({ repo, remotes = false }) => {
    const args = ['branch', '--list'];
    if (remotes) args.push('--all');
    const out = await runGit(args, repo);
    return textResponse(out || '(nessun branch)');
  }
);

// git_current_branch
registerTool(
  {
    name: 'git_current_branch',
    description: 'Mostra il branch corrente (HEAD).',
    inputSchema: { type: 'object', properties: { repo: { type: 'string' } }, additionalProperties: false }
  },
  async ({ repo }) => {
    const out = (await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repo)).trim();
    return textResponse(out);
  }
);

// git_show
registerTool(
  {
    name: 'git_show',
    description: 'Mostra contenuto file a una revisione (es. rev:"HEAD", path:"src/app.js").',
    inputSchema: {
      type: 'object',
      properties: { repo: { type: 'string' }, rev: { type: 'string' }, path: { type: 'string' } },
      required: ['rev', 'path'],
      additionalProperties: false
    }
  },
  async ({ repo, rev, path: filePath }) => {
    const spec = `${rev}:${filePath}`;
    const out = await runGit(['show', spec], repo);
    return textResponse(clampText(out));
  }
);

// git_add
registerTool(
  {
    name: 'git_add',
    description: 'Esegue git add. Con path assente usa -A.',
    inputSchema: {
      type: 'object',
      properties: { repo: { type: 'string' }, path: { type: 'string' } },
      additionalProperties: false
    }
  },
  async ({ repo, path: filePath }) => {
    if (!filePath) {
      const out = await runGit(['add', '-A'], repo);
      return textResponse(out || 'ok');
    }
    const out = await runGit(['add', '--', filePath], repo);
    return textResponse(out || 'ok');
  }
);

// git_checkout
registerTool(
  {
    name: 'git_checkout',
    description: 'Cambia branch o crea nuovo (-b) se create=true.',
    inputSchema: {
      type: 'object',
      properties: { repo: { type: 'string' }, branch: { type: 'string' }, create: { type: 'boolean', default: false } },
      required: ['branch'],
      additionalProperties: false
    }
  },
  async ({ repo, branch, create = false }) => {
    const args = ['checkout'];
    if (create) args.push('-b');
    args.push(branch);
    const out = await runGit(args, repo);
    return textResponse(out || 'ok');
  }
);

// MCP handlers for tools list/call
server.setRequestHandler(ListToolsRequestSchema, async (_req) => {
  return {
    tools: Array.from(toolRegistry.values()).map(({ def }) => def)
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params || {};
  if (!name) throw new Error('Nome strumento mancante');
  const entry = toolRegistry.get(name);
  if (!entry) throw new Error(`Strumento non trovato: ${name}`);
  const out = await entry.handler(args || {});
  return out;
});

const transport = new StdioServerTransport();
await server.connect(transport);
logDebug('MCP Node server avviato');
