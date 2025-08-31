import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import onFinished from 'on-finished';

// declare module fix for 'on-finished'
declare module 'on-finished';

/**
 * Middleware di logging/audit unificato
 * - Logga azione, endpoint, utente impersonato, requestId
 * - Logga risposta (status, durata)
 * - Traccia errori uncaught
 * - Salva log in req.zlog per uso modulare
 * - Output JSON, pronto per GCP Logging
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  (req as any).requestId = requestId;

  const impersonated = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || null;

  // Log base
  const logEntry: any = {
    ts: new Date().toISOString(),
    requestId,
    method: req.method,
    endpoint: req.originalUrl,
    action: `${req.method} ${req.originalUrl}`,
    impersonated,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
    body: req.body,
    status: undefined,
    durationMs: undefined,
    error: undefined,
  };
  // Salva log su req per uso nei moduli
  (req as any).zlog = logEntry;
  console.log('[AUDIT]', JSON.stringify({ ...logEntry, phase: 'request' }));

  // Logga risposta e durata
  onFinished(res, (err: Error | null, res: Response) => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    logEntry.status = res.statusCode;
    logEntry.durationMs = durationMs;
    if (err) {
      logEntry.error = err.message || String(err);
    }
    console.log('[AUDIT]', JSON.stringify({ ...logEntry, phase: 'response' }));
  });

  // Catch errori uncaught (Express li passa a next(err))
  try {
    next();
  } catch (err: any) {
    logEntry.error = err?.message || String(err);
    logEntry.status = 500;
    logEntry.durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log('[AUDIT]', JSON.stringify({ ...logEntry, phase: 'error' }));
    throw err;
  }
}
