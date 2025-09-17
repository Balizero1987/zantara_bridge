const express = require('express');
const fs = require('fs');
const path = require('path');

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MCP local_docs running on http://localhost:${PORT}`));

