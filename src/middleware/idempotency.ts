import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "";
const redis = redisUrl ? new Redis(redisUrl) : null;
const mem = new Map<string, any>();

export async function requireIdempotency(req: Request, res: Response, next: NextFunction) {
  const key = (req.header("X-Idempotency-Key") || "").trim();
  if (!key) return res.status(400).json({ ok: false, error: "missing_idempotency_key" });

  // try redis
  if (redis) {
    const existing = await redis.get(`idem:${key}`);
    if (existing) {
      return res.json(JSON.parse(existing));
    }
    // mark with placeholder to avoid races. store TTL 1h
    await redis.set(`idem:${key}`, JSON.stringify({ status: "processing" }), "EX", 3600, "NX");
    // attach key to req for handler to set final value
    (req as any).idempotencyKey = key;
    return next();
  }

  // memory fallback
  if (mem.has(key)) return res.json(mem.get(key));
  mem.set(key, { status: "processing" });
  (req as any).idempotencyKey = key;
  return next();
}

// helper to save response after success
export async function storeIdempotencyResult(req: Request, result: any) {
  const key = (req as any).idempotencyKey;
  if (!key) return;
  if (redis) {
    await redis.set(`idem:${key}`, JSON.stringify(result), "EX", 60 * 60);
    return;
  }
  mem.set(key, result);
}
