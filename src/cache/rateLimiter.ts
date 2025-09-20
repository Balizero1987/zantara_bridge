// File: src/cache/rateLimiter.ts
import { Redis } from 'ioredis';

export class RateLimiter {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  async checkLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - current);
    const allowed = current <= limit;

    return { allowed, remaining };
  }

  async getDriveApiLimit(user: string): Promise<{ allowed: boolean; remaining: number }> {
    return this.checkLimit(`rate:drive:${user}`, 100, 60); // 100 calls per minute
  }

  async getAuthLimit(user: string): Promise<{ allowed: boolean; remaining: number }> {
    return this.checkLimit(`rate:auth:${user}`, 10, 60); // 10 auth calls per minute
  }
}