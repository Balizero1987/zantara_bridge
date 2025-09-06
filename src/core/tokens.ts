import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export type TokenRef = { id: string; name: string; ref_image?: string; enabled?: boolean };

export async function loadTokens(dir = path.join(process.cwd(), 'memory', 'tokens')): Promise<TokenRef[]> {
  const out: TokenRef[] = [];
  async function walk(d: string) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.toLowerCase() === 'assets') continue;
        await walk(p);
        continue;
      }
      if (ent.isFile() && ent.name.toLowerCase().endsWith('.json')) {
        try {
          const raw = await fs.readFile(p, 'utf8');
          const obj = JSON.parse(raw);
          if (!obj || !obj.id || !obj.name) continue;
          const t: TokenRef = {
            id: String(obj.id).toUpperCase(),
            name: String(obj.name),
            ref_image: obj.ref_image ? rel(obj.ref_image) : undefined,
            enabled: obj.enabled !== false
          };
          out.push(t);
        } catch {}
      }
    }
  }
  function rel(p: string) { return path.isAbsolute(p) ? path.relative(process.cwd(), p) : p; }
  try { await walk(dir); } catch {}
  return out;
}

export function expandPrompt(prompt: string, tokens: TokenRef[], opt?: { open?: string; close?: string; onMissing?: 'keep'|'drop' }) {
  const open = opt?.open ?? '<';
  const close = opt?.close ?? '>';
  const onMissing = opt?.onMissing ?? 'keep';
  const re = new RegExp(`${esc(open)}([A-Z0-9_\\-]+)${esc(close)}`, 'g');

  const used: TokenRef[] = [];
  const text = prompt.replace(re, (_m, id) => {
    const t = tokens.find(x => (x.enabled ?? true) && x.id === String(id).toUpperCase());
    if (t) { used.push(t); return t.name; }
    return onMissing === 'drop' ? '' : `${open}${id}${close}`;
  }).replace(/\s{2,}/g, ' ').trim();

  return { text, used };
}

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
