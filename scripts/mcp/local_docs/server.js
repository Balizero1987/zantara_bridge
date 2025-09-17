const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
app.use(express.json());

app.get('/mcp', (_req, res) => {
  res.json({ ok: true, name: 'local_docs', version: '0.1.0' });
});

app.get('/mcp/readme', (req, res) => {
  const repo = req.query.repo || process.cwd();
  const file = path.join(repo, 'README.md');
  if (!fs.existsSync(file)) return res.status(404).json({ ok: false, error: 'README not found' });
  const content = fs.readFileSync(file, 'utf-8');
  res.json({ ok: true, content });
});

// Security: optional local key and whitelist
const LOCAL_KEY = process.env.LOCAL_MCP_KEY || '';
const READ_WHITELIST = (process.env.READ_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
function checkAuth(req, res) {
  if (!LOCAL_KEY) return true; // no key required
  const got = (req.header('X-LOCAL-KEY') || '').trim();
  if (got && got === LOCAL_KEY) return true;
  res.status(401).json({ ok: false, error: 'unauthorized' });
  return false;
}
function inWhitelist(p) {
  if (!READ_WHITELIST.length) return true; // allow all
  const norm = path.resolve(p);
  return READ_WHITELIST.some(w => norm.startsWith(path.resolve(w)));
}

// Return a text file
app.get('/mcp/file', (req, res) => {
  if (!checkAuth(req, res)) return;
  const filePath = String(req.query.path || '').trim();
  if (!filePath) return res.status(400).json({ ok: false, error: 'path required' });
  if (!inWhitelist(filePath)) return res.status(403).json({ ok: false, error: 'path not allowed' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'not found' });
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return res.status(400).json({ ok: false, error: 'is directory' });
  const content = fs.readFileSync(filePath, 'utf-8');
  res.json({ ok: true, path: filePath, size: stat.size, content });
});

// Shallow tree listing
app.get('/mcp/tree', (req, res) => {
  if (!checkAuth(req, res)) return;
  const root = String(req.query.root || process.cwd());
  const depth = Math.min(parseInt(req.query.depth || '2', 10) || 2, 5);
  if (!inWhitelist(root)) return res.status(403).json({ ok: false, error: 'root not allowed' });
  function list(dir, d) {
    const entries = [];
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      const item = { name, path: full, type: st.isDirectory() ? 'dir' : 'file' };
      if (st.isDirectory() && d < depth) item.children = list(full, d + 1);
      entries.push(item);
    }
    return entries;
  }
  try {
    const tree = list(root, 1);
    res.json({ ok: true, root, depth, tree });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Simple grep
app.get('/mcp/grep', (req, res) => {
  if (!checkAuth(req, res)) return;
  const root = String(req.query.root || process.cwd());
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ ok: false, error: 'q required' });
  if (!inWhitelist(root)) return res.status(403).json({ ok: false, error: 'root not allowed' });
  try {
    const results = [];
    function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full);
        else {
          try {
            const txt = fs.readFileSync(full, 'utf-8');
            const idx = txt.indexOf(q);
            if (idx >= 0) {
              const start = Math.max(0, idx - 80);
              const end = Math.min(txt.length, idx + q.length + 80);
              results.push({ file: full, match: q, snippet: txt.slice(start, end) });
            }
          } catch {}
        }
      }
    }
    walk(root);
    res.json({ ok: true, count: results.length, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Return OpenAPI from service if reachable
app.get('/mcp/openapi', async (_req, res) => {
  try {
    // Tries common local URL; adjust via OPENAPI_URL env to override
    const url = process.env.OPENAPI_URL || 'http://localhost:8080/.well-known/openapi.json';
    const r = await fetch(url);
    const json = await r.json();
    res.json({ ok: true, source: url, spec: json });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Run tests/smoke
app.post('/mcp/tests/run', (req, res) => {
  if (!checkAuth(req, res)) return;
  const cmd = (req.body && req.body.cmd) || 'npm run smoke';
  const cwd = (req.body && req.body.cwd) || process.cwd();
  exec(cmd, { cwd, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    res.json({ ok: !err, cmd, cwd, code: err ? err.code : 0, stdout, stderr });
  });
});

// Trigger deploy script (protected)
app.post('/mcp/deploy', (req, res) => {
  if (!checkAuth(req, res)) return;
  const script = (req.body && req.body.script) || path.join(process.cwd(), 'scripts/deploy/cloud-run.sh');
  const env = req.body && req.body.env || {};
  exec(`bash ${script}`, { env: { ...process.env, ...env }, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    res.json({ ok: !err, script, code: err ? err.code : 0, stdout, stderr });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MCP local_docs running on http://localhost:${PORT}`));
