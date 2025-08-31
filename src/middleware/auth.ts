import { Request, Response, NextFunction } from 'express';

/**
 * API key guard with broad compatibility and safe debug logs.
 * Accepts key via:
 *  - Header: X-Api-Key
 *  - Header: Authorization: Bearer <key>
 *  - Query: ?api_key=<key> or ?apikey=<key>
 * Supports multiple keys via env `API_KEYS` (comma-separated) in addition to `API_KEY`.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const envKeys = ((process.env.API_KEYS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean));
  if (process.env.API_KEY && process.env.API_KEY.trim()) envKeys.push(process.env.API_KEY.trim());

  const bearer = (req.header('authorization') || '')
    .replace(/\s+/g, ' ')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const headerKey = (req.header('x-api-key') || req.header('X-Api-Key') || '').toString().trim();
  const queryKey = (req.query.api_key as string) || (req.query.apikey as string) || '';
  const provided = (headerKey || bearer || queryKey || '').trim();

  // Temporary debug (non-sensitive): only presence flags, never the key value
  try {
    (req as any).log?.info?.({
      action: 'auth.requireApiKey.debug',
      hasHeaderKey: !!headerKey,
      hasBearer: !!bearer,
      hasQueryKey: !!queryKey,
      envKeysConfigured: envKeys.length,
      path: req.originalUrl,
      method: req.method,
    });
  } catch {}

  if (!envKeys.length) {
    return res.status(500).json({ ok: false, error: 'Missing API_KEY' });
  }
  if (!provided) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const match = envKeys.some(k => k && k === provided);
  if (!match) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  return next();
}

/**
 * Prefer OIDC ID token (Authorization: Bearer <JWT>) and fallback to API Key.
 * Audience from API_AUDIENCE (comma-separated allowed). Issuer allowlist via ALLOWED_ISSUERS.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = (req.header('authorization') || '')
    .replace(/\s+/g, ' ')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (bearer) {
    try {
      const { OAuth2Client } = require('google-auth-library');
      const client = new OAuth2Client();
      const audRaw = (process.env.API_AUDIENCE || process.env.CHAT_AUDIENCE || '').trim();
      const audiences = audRaw ? audRaw.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined;
      const ticket = await client.verifyIdToken({ idToken: bearer, audience: audiences });
      const payload = ticket.getPayload();
      const allowedIss = (process.env.ALLOWED_ISSUERS || 'https://accounts.google.com,accounts.google.com')
        .split(',').map((s: string) => s.trim());
      if (!payload || (allowedIss.length && !allowedIss.includes(String(payload.iss)))) {
        return res.status(401).json({ ok: false, error: 'Invalid issuer' });
      }
      (req as any).principal = { sub: payload.sub, email: payload.email, iss: payload.iss, aud: payload.aud };
      return next();
    } catch (e: any) {
      (req as any).log?.warn?.({ action: 'auth.requireAuth.jwt.verify_failed', error: e?.message || String(e) });
      // fallthrough to API key
    }
  }
  return requireApiKey(req, res, next);
}
