/**
 * 🔐 UNIFIED AUTHENTICATION MIDDLEWARE
 * Replaces: auth.ts + authPlugin.ts + lightweightAuth.ts + zantaraAuth.ts
 * Single middleware with mode-based behavior
 */

import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import type { ZantaraConfig } from '../config/environments';

interface AuthContext {
  keyHash: string;
  user: string;
  timestamp: number;
}

class UnifiedAuth {
  private config: ZantaraConfig;
  private validKeys: string[];
  private requestCounts = new Map<string, { count: number; reset: number }>();

  constructor(config: ZantaraConfig) {
    this.config = config;
    this.validKeys = this.loadApiKeys();
    
    // Cleanup interval based on mode
    const cleanupInterval = config.mode === 'light' ? 10 * 60 * 1000 : 5 * 60 * 1000;
    setInterval(() => this.cleanup(), cleanupInterval);
  }

  private loadApiKeys(): string[] {
    const keys = [
      process.env.ZANTARA_PLUGIN_API_KEY,
      process.env.API_KEY,
      ...(process.env.VALID_API_KEYS?.split(',') || []),
      ...(process.env.API_KEYS?.split(',') || [])
    ].filter(Boolean).map(key => key.trim());

    if (keys.length === 0) {
      throw new Error('No valid API keys configured');
    }

    return keys;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requestCounts.entries()) {
      if (now > entry.reset) {
        this.requestCounts.delete(key);
      }
    }
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex').substring(0, 8);
  }

  private validateApiKey(token: string): boolean {
    if (!token || token.length < 8) return false;
    
    // Different validation based on auth mode
    switch (this.config.auth) {
      case 'full':
        return this.validKeys.some(validKey => 
          validKey.length === token.length && 
          timingSafeEqual(Buffer.from(token), Buffer.from(validKey))
        );
      
      case 'lightweight':
        return this.validKeys.some(validKey => validKey === token);
      
      case 'apikey':
        return this.validKeys.includes(token);
      
      default:
        return false;
    }
  }

  private checkRateLimit(keyHash: string): boolean {
    const now = Date.now();
    const limits = {
      enterprise: { window: 60000, max: 1000 },
      conservative: { window: 60000, max: 100 }, 
      strict: { window: 60000, max: 30 }
    };
    
    const { window, max } = limits[this.config.rateLimit];
    const entry = this.requestCounts.get(keyHash);
    
    if (!entry || now > entry.reset) {
      this.requestCounts.set(keyHash, { count: 1, reset: now + window });
      return true;
    }
    
    if (entry.count >= max) return false;
    
    entry.count++;
    return true;
  }

  private extractToken(req: Request): string {
    // Try multiple sources based on auth mode
    const sources = [
      req.headers['x-api-key'],
      req.headers['X-API-KEY'],
      req.headers.authorization?.replace(/^Bearer\s+/, ''),
      req.query.api_key,
      req.query.apikey
    ];

    return (sources.find(Boolean) as string || '').trim();
  }

  private extractUser(req: Request): string {
    const user = (req.headers['x-bz-user'] || req.headers['X-BZ-USER'] || '').toString().trim();
    
    // Default user based on mode
    if (!user) {
      switch (this.config.mode) {
        case 'light': return 'LIGHT_USER';
        case 'minimal': return 'API_USER';
        default: return 'BOSS';
      }
    }
    
    return user.toUpperCase().replace(/\s+/g, '_');
  }

  public authenticate = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const token = this.extractToken(req);
      
      // Skip auth for health checks in minimal mode
      if (this.config.mode === 'minimal' && ['/health', '/'].includes(req.path)) {
        return next();
      }

      if (!token) {
        return res.status(401).json({
          ok: false,
          error: this.config.mode === 'enterprise' ? 'Authentication required' : 'AMBARADAM authentication required',
          code: 'MISSING_AUTH'
        });
      }

      if (!this.validateApiKey(token)) {
        return res.status(403).json({
          ok: false,
          error: 'Invalid API key',
          code: 'INVALID_KEY'
        });
      }

      const keyHash = this.hashKey(token);
      
      if (!this.checkRateLimit(keyHash)) {
        return res.status(429).json({
          ok: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          retryAfter: '60 seconds'
        });
      }

      // Set auth context
      const user = this.extractUser(req);
      (req as any).auth = { keyHash, user, timestamp: Date.now() };
      (req as any).canonicalOwner = user;

      // Minimal logging based on mode
      if (this.config.monitoring !== 'none') {
        console.log(`Auth success: ${keyHash} (${user})`);
      }

      next();

    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({
        ok: false,
        error: 'Authentication system error',
        code: 'AUTH_ERROR'
      });
    }
  };
}

// Global instance
let authInstance: UnifiedAuth;

export function createUnifiedAuth(config: ZantaraConfig): UnifiedAuth {
  if (!authInstance) {
    authInstance = new UnifiedAuth(config);
  }
  return authInstance;
}

export function unifiedAuth(config: ZantaraConfig) {
  const auth = createUnifiedAuth(config);
  return auth.authenticate;
}