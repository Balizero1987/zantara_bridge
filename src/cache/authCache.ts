// File: src/cache/authCache.ts
import { Redis } from 'ioredis';

const AUTH_TTL = {
  TOKEN: 3600,        // 1 hour
  SESSION: 7200,      // 2 hours
  CLIENT: 1800        // 30 minutes
};

export class AuthCache {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  // Google Auth token caching
  async getCachedToken(user: string, scopes: string[]): Promise<any | null> {
    const scopeHash = Buffer.from(scopes.join(',')).toString('base64');
    const key = `auth:token:${user}:${scopeHash}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setCachedToken(user: string, scopes: string[], token: any): Promise<void> {
    const scopeHash = Buffer.from(scopes.join(',')).toString('base64');
    const key = `auth:token:${user}:${scopeHash}`;
    await this.redis.setex(key, AUTH_TTL.TOKEN, JSON.stringify(token));
  }

  // Impersonated client caching
  async getCachedClient(user: string): Promise<any | null> {
    const key = `auth:client:${user}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setCachedClient(user: string, client: any): Promise<void> {
    const key = `auth:client:${user}`;
    // Store serializable client data only
    const clientData = {
      user,
      email: client.email,
      expires: Date.now() + (AUTH_TTL.CLIENT * 1000)
    };
    await this.redis.setex(key, AUTH_TTL.CLIENT, JSON.stringify(clientData));
  }

  // Session management
  async getSession(sessionId: string): Promise<any | null> {
    const key = `session:${sessionId}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setSession(sessionId: string, data: any): Promise<void> {
    const key = `session:${sessionId}`;
    await this.redis.setex(key, AUTH_TTL.SESSION, JSON.stringify(data));
  }

  // Cleanup expired sessions
  async cleanupExpiredSessions(): Promise<number> {
    const pattern = 'session:*';
    const keys = await this.redis.keys(pattern);
    let deleted = 0;

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl <= 0) {
        await this.redis.del(key);
        deleted++;
      }
    }

    return deleted;
  }
}