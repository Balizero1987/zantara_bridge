import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Lightweight authentication middleware for zero-cost operation
 * Minimal logging, no enterprise features, optimized for cost
 */

interface LightweightAuthConfig {
  validApiKeys: string[];
  enableBasicLogging: boolean;
}

class LightweightAuth {
  private config: LightweightAuthConfig;
  private requestCounts = new Map<string, { count: number; reset: number }>();

  constructor(config: LightweightAuthConfig) {
    this.config = config;
    
    // Cleanup every 10 minutes (less frequent than enterprise version)
    setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);
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

  private secureCompare(provided: string, valid: string): boolean {
    if (provided.length !== valid.length) return false;
    return timingSafeEqual(Buffer.from(provided), Buffer.from(valid));
  }

  private validateApiKey(token: string): boolean {
    if (!token || token.length < 16 || token.length > 256) return false;
    return this.config.validApiKeys.some(validKey => this.secureCompare(token, validKey));
  }

  private checkRateLimit(keyHash: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;
    
    const entry = this.requestCounts.get(keyHash);
    
    if (!entry || now > entry.reset) {
      this.requestCounts.set(keyHash, { count: 1, reset: now + windowMs });
      return true;
    }
    
    if (entry.count >= maxRequests) return false;
    
    entry.count++;
    return true;
  }

  private logBasic(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.config.enableBasicLogging) return;
    
    // MINIMAL logging - only essential info
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'zantara-bridge',
      ...data
    };
    
    // Only log to stdout (captured by Cloud Run for free)
    console[level](JSON.stringify(logEntry));
  }

  public authenticate = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Extract API key (X-API-KEY or Bearer)
      const apiKey = req.headers['x-api-key'] as string;
      const authHeader = req.headers.authorization as string;
      const token = apiKey || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '');

      if (!token) {
        this.logBasic('warn', 'auth_missing', { ip: req.ip });
        res.status(401).json({ 
          ok: false, 
          error: 'Authentication required',
          code: 'MISSING_AUTH'
        });
        return;
      }

      if (!this.validateApiKey(token)) {
        this.logBasic('warn', 'auth_invalid', { ip: req.ip });
        res.status(403).json({ 
          ok: false, 
          error: 'Invalid API key',
          code: 'INVALID_KEY'
        });
        return;
      }

      const keyHash = this.hashKey(token);
      
      if (!this.checkRateLimit(keyHash)) {
        this.logBasic('warn', 'rate_limit', { keyHash, ip: req.ip });
        res.status(429).json({ 
          ok: false, 
          error: 'Rate limit exceeded',
          code: 'RATE_LIMITED'
        });
        return;
      }

      // Minimal context for request
      (req as any).auth = { keyHash, timestamp: Date.now() };
      
      // Success - minimal logging
      this.logBasic('info', 'auth_success', { keyHash });
      next();

    } catch (error) {
      this.logBasic('error', 'auth_error', { error: (error as Error).message });
      res.status(500).json({ 
        ok: false, 
        error: 'Authentication system error',
        code: 'AUTH_ERROR'
      });
    }
  };
}

// Factory function
export function createLightweightAuth(): LightweightAuth {
  const config: LightweightAuthConfig = {
    validApiKeys: [
      process.env.ZANTARA_PLUGIN_API_KEY,
      process.env.API_KEY,
      ...(process.env.VALID_API_KEYS?.split(',') || [])
    ].filter(Boolean),
    enableBasicLogging: process.env.NODE_ENV === 'production'
  };

  if (config.validApiKeys.length === 0) {
    throw new Error('No valid API keys configured');
  }

  return new LightweightAuth(config);
}

// Simple middleware function for drop-in replacement
export function lightweightAuth(req: Request, res: Response, next: NextFunction) {
  if (!(global as any).__lightweightAuth) {
    (global as any).__lightweightAuth = createLightweightAuth();
  }
  
  return (global as any).__lightweightAuth.authenticate(req, res, next);
}

export default LightweightAuth;