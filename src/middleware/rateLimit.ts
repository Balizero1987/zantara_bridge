import { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };

export function rateLimit(opts?: { limit?: number; windowMs?: number }) {
  const limit = opts?.limit ?? 60; // requests
  const windowMs = opts?.windowMs ?? 60_000; // per minute
  const buckets = new Map<string, Bucket>();

  function keyFrom(req: Request): string {
    const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const xk = req.header('x-api-key');
    return (xk || bearer || req.ip || 'anon').toString();
  }

  return function limiter(req: Request, res: Response, next: NextFunction) {
    const k = keyFrom(req);
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(k, b);
    }
    if (b.count >= limit) {
      const retry = Math.max(0, b.resetAt - now);
      res.setHeader('Retry-After', Math.ceil(retry / 1000).toString());
      return res.status(429).json({ ok: false, error: 'rate_limited', retryAfterMs: retry });
    }
    b.count++;
    next();
  };
}

