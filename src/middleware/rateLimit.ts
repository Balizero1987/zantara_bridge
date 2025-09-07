import rateLimit from 'express-rate-limit';
export const pluginLimiter=rateLimit({windowMs:60_000,max:90,legacyHeaders:false});
