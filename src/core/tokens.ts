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
=======
// src/core/tokens.ts
import { promises as fs } from 'fs';
import * as path from 'path';

export interface TokenParams {
  sampler?: string;
  steps?: number;
  cfg?: number;
  resolution?: string;
  seed?: number;
  hires_fix?: boolean;
  [k: string]: unknown;
}

export interface TokenDef {
  token: string;                       // es: "<ZAN_RIRI>"
  description?: string;
  style_pack?: string;
  reference_image?: string;            // es: "memory/tokens/assets/zan_riri_ref.png"
  positive_prompt?: string;
  negative_prompt?: string;
  params?: TokenParams;
  lora?: { name?: string; weight?: number; notes?: string };
  sora_append?: string;
  version?: string;
  tags?: string[];
  [k: string]: unknown;
}

export type TokenMap = Record<string, TokenDef>;

const TOKENS_DIR_DEFAULT = 'memory/tokens';

/**
 * Carica tutti i .json nella cartella tokensDir e ritorna una mappa { "<TOKEN>": def }
 */
export async function loadTokens(tokensDir: string = TOKENS_DIR_DEFAULT): Promise<TokenMap> {
  const map: TokenMap = {};
  const dir = path.resolve(tokensDir);
  let files: string[] = [];
  try {
    const list = await fs.readdir(dir);
    files = list.filter((f) => f.toLowerCase().endsWith('.json'));
  } catch {
    return map;
  }

  for (const file of files) {
    try {
      const full = path.join(dir, file);
      const raw = await fs.readFile(full, 'utf8');
      const def = JSON.parse(raw) as TokenDef;
      if (def && typeof def.token === 'string' && def.token.startsWith('<') && def.token.endsWith('>')) {
        map[def.token] = def;
      }
    } catch (e) {
      console.warn(`tokens: cannot load ${file}:`, (e as Error).message);
    }
  }
  return map;
}

/**
 * Espande un prompt sostituendo i placeholder (es. "<ZAN_RIRI>")
 */
export function expandPrompt(
  basePrompt: string,
  map: TokenMap,
  options?: { target?: 'sdxl' | 'sora' | 'generic' }
): {
  prompt: string;
  negative?: string;
  params?: TokenParams;
  reference_image?: string;
  used: string[];
} {
  const target = options?.target ?? 'generic';
  const tokensUsed = Array.from(new Set((basePrompt.match(/<[^>]+>/g) || [])));

  let prompt = basePrompt;
  let mergedNegative: string[] = [];
  let mergedParams: TokenParams = {};
  let referenceImage: string | undefined;

  for (const t of tokensUsed) {
    const def = map[t];
    if (!def) continue;

    if (def.reference_image) referenceImage = def.reference_image;

    if (def.positive_prompt) {
      prompt = prompt.replace(new RegExp(escapeRegExp(t), 'g'), def.positive_prompt);
    } else {
      prompt = prompt.replace(new RegExp(escapeRegExp(t), 'g'), '');
    }

    if (def.negative_prompt) mergedNegative.push(def.negative_prompt);
    if (def.params) mergedParams = { ...mergedParams, ...def.params };
    if (target === 'sora' && def.sora_append) {
      prompt = `${prompt.trim()}\n${def.sora_append.trim()}`;
    }
  }

  return {
    prompt: prompt.trim(),
    negative: mergedNegative.length ? mergedNegative.join(', ') : undefined,
    params: Object.keys(mergedParams).length ? mergedParams : undefined,
    reference_image: referenceImage,
    used: tokensUsed
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
} 

