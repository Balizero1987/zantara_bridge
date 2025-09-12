import rateLimit from 'express-rate-limit';

// Rate limit con configurazione sicura per Cloud Run.
// In src/index.ts l'app usa `app.set('trust proxy', true)` per ottenere l'IP reale dal GFE.
// express-rate-limit richiede di impostare esplicitamente `trustProxy` quando Express
// ha `trust proxy` attivo, altrimenti genera un ValidationError.
export const pluginLimiter = rateLimit({
  windowMs: 60_000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  // esplicita la chiave: IP del client (coerente con trust proxy)
  keyGenerator: (req) => req.ip || 'unknown',
});
