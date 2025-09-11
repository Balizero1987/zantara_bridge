import type { Request, Response, NextFunction } from 'express';

const SINGLE=(process.env.ZANTARA_PLUGIN_API_KEY||'').trim();
const CSV=(process.env.API_KEYS||'')
  .split(',').map(s=>s.trim()).filter(Boolean);

export function apiKeyGuard(req:Request,res:Response,next:NextFunction){
  const got=(req.header('X-API-KEY')||req.header('x-api-key')||'').trim();
  if(!got) return res.status(401).json({ error:'missing X-API-KEY' });
  const ok=(SINGLE && got===SINGLE) || (CSV.length && CSV.includes(got));
  if(!ok) return res.status(403).json({ error:'invalid api key' });

  const user=(req.header('X-BZ-USER')||'').trim();
  if(!user) return res.status(400).json({ error:'X-BZ-USER required' });
  (req as any).canonicalOwner=user.toUpperCase().replace(/\s+/g,'_');
  return next();
}
