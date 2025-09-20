import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: Date;
  blocked: boolean;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private limits: Map<string, Map<string, RateLimitEntry>> = new Map();
  private globalConfig: RateLimitConfig;

  private constructor() {
    this.globalConfig = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      message: 'Too many requests, please try again later'
    };

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  create(name: string, config: Partial<RateLimitConfig> = {}) {
    const finalConfig: RateLimitConfig = {
      ...this.globalConfig,
      ...config
    };

    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.generateKey(req, finalConfig);
      const limitMap = this.getLimitMap(name);
      const now = new Date();
      
      let entry = limitMap.get(key);

      // Initialize or reset entry
      if (!entry || entry.resetTime < now) {
        entry = {
          count: 0,
          resetTime: new Date(now.getTime() + finalConfig.windowMs),
          blocked: false
        };
        limitMap.set(key, entry);
      }

      // Check if blocked
      if (entry.blocked) {
        return this.sendRateLimitResponse(res, entry, finalConfig);
      }

      // Increment count
      entry.count++;

      // Check limit
      if (entry.count > finalConfig.maxRequests) {
        entry.blocked = true;
        return this.sendRateLimitResponse(res, entry, finalConfig);
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', finalConfig.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, finalConfig.maxRequests - entry.count).toString());
      res.setHeader('X-RateLimit-Reset', entry.resetTime.toISOString());

      next();
    };
  }

  private generateKey(req: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }

    // Default: IP + User ID (if authenticated)
    const ip = this.getClientIp(req);
    const userId = (req as any).user?.id || 'anonymous';
    return `${ip}:${userId}`;
  }

  private getClientIp(req: Request): string {
    // Handle various proxy headers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    }
    
    return req.headers['x-real-ip'] as string ||
           req.socket?.remoteAddress ||
           'unknown';
  }

  private getLimitMap(name: string): Map<string, RateLimitEntry> {
    if (!this.limits.has(name)) {
      this.limits.set(name, new Map());
    }
    return this.limits.get(name)!;
  }

  private sendRateLimitResponse(res: Response, entry: RateLimitEntry, config: RateLimitConfig) {
    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', entry.resetTime.toISOString());
    res.setHeader('Retry-After', Math.ceil((entry.resetTime.getTime() - Date.now()) / 1000).toString());
    
    return res.status(429).json({
      ok: false,
      error: config.message,
      retryAfter: entry.resetTime.toISOString()
    });
  }

  private cleanup() {
    const now = new Date();
    for (const [, limitMap] of this.limits) {
      for (const [key, entry] of limitMap) {
        if (entry.resetTime < now) {
          limitMap.delete(key);
        }
      }
    }
  }

  // Predefined rate limiters
  static strict() {
    return RateLimiter.getInstance().create('strict', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
      message: 'Rate limit exceeded. Maximum 10 requests per minute.'
    });
  }

  static standard() {
    return RateLimiter.getInstance().create('standard', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60,
      message: 'Rate limit exceeded. Maximum 60 requests per minute.'
    });
  }

  static relaxed() {
    return RateLimiter.getInstance().create('relaxed', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 200,
      message: 'Rate limit exceeded. Maximum 200 requests per minute.'
    });
  }

  static perUser() {
    return RateLimiter.getInstance().create('perUser', {
      windowMs: 60 * 1000,
      maxRequests: 100,
      message: 'User rate limit exceeded.',
      keyGenerator: (req: Request) => {
        const user = (req as any).user;
        return user?.id || 'anonymous';
      }
    });
  }

  static perIp() {
    return RateLimiter.getInstance().create('perIp', {
      windowMs: 60 * 1000,
      maxRequests: 30,
      message: 'IP rate limit exceeded.',
      keyGenerator: (req: Request) => {
        return RateLimiter.getInstance().getClientIp(req);
      }
    });
  }

  static perEndpoint(endpoint: string, maxRequests: number = 10) {
    return RateLimiter.getInstance().create(`endpoint:${endpoint}`, {
      windowMs: 60 * 1000,
      maxRequests,
      message: `Endpoint rate limit exceeded for ${endpoint}.`
    });
  }
}

// Advanced rate limiter with sliding window
export class SlidingWindowRateLimiter {
  private static instance: SlidingWindowRateLimiter;
  private windows: Map<string, number[]> = new Map();

  private constructor() {
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  static getInstance(): SlidingWindowRateLimiter {
    if (!SlidingWindowRateLimiter.instance) {
      SlidingWindowRateLimiter.instance = new SlidingWindowRateLimiter();
    }
    return SlidingWindowRateLimiter.instance;
  }

  create(name: string, windowMs: number, maxRequests: number) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.generateKey(req, name);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get or create window
      if (!this.windows.has(key)) {
        this.windows.set(key, []);
      }

      const timestamps = this.windows.get(key)!;
      
      // Remove old timestamps
      const validTimestamps = timestamps.filter(t => t > windowStart);
      
      // Check if limit exceeded
      if (validTimestamps.length >= maxRequests) {
        const oldestValid = validTimestamps[0];
        const resetTime = new Date(oldestValid + windowMs);
        
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', resetTime.toISOString());
        res.setHeader('Retry-After', Math.ceil((resetTime.getTime() - now) / 1000).toString());
        
        return res.status(429).json({
          ok: false,
          error: 'Rate limit exceeded',
          retryAfter: resetTime.toISOString()
        });
      }

      // Add current timestamp
      validTimestamps.push(now);
      this.windows.set(key, validTimestamps);

      // Set headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - validTimestamps.length).toString());

      next();
    };
  }

  private generateKey(req: Request, name: string): string {
    const ip = this.getClientIp(req);
    const userId = (req as any).user?.id || 'anonymous';
    return `${name}:${ip}:${userId}`;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    }
    return req.headers['x-real-ip'] as string || req.socket?.remoteAddress || 'unknown';
  }

  private cleanup() {
    const now = Date.now();
    const maxWindow = 5 * 60 * 1000; // 5 minutes max window
    
    for (const [key, timestamps] of this.windows) {
      const validTimestamps = timestamps.filter(t => t > now - maxWindow);
      if (validTimestamps.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, validTimestamps);
      }
    }
  }
}

// Export singleton instances
export const rateLimiter = RateLimiter.getInstance();
export const slidingWindowLimiter = SlidingWindowRateLimiter.getInstance();