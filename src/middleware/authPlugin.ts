import type { Request, Response, NextFunction } from 'express';
const ONE=(process.env.BACKEND_API_KEY||process.env.PLUGIN_API_KEY||'').trim();
const CSV=(process.env.PLUGIN_API_KEYS_CSV||'').split(',').map(s=>s.trim()).filter(Boolean);
export function apiKeyGuard(req:Request,res:Response,next:NextFunction){
  const got=(req.header('X-API-KEY')||req.header('x-api-key')||'').trim();
  if(!got) return res.status(401).json({error:'missing X-API-KEY'});
  const ok=(ONE && got===ONE) || (CSV.length && CSV.includes(got));
  if(!ok) return res.status(403).json({error:'invalid api key'});
  (req as any).canonicalOwner=(req.header('X-BZ-USER')||'UNKNOWN').toUpperCase().replace(/\s+/g,'_');
  return next();
}
