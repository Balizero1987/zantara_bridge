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
