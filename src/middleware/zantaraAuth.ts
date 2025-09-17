import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';

interface AuthConfig {
  validApiKeys: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  enableBearerSupport: boolean;
  logAuthAttempts: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class ZantaraAuthMiddleware {
  private config: AuthConfig;
  private rateLimitStore = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: AuthConfig) {
    this.config = config;
    
    // Cleanup rate limit store every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupRateLimit();
    }, 5 * 60 * 1000);
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private secureCompare(provided: string, valid: string): boolean {
    if (provided.length !== valid.length) {
      return false;
    }
    
    const providedBuffer = Buffer.from(provided, 'utf8');
    const validBuffer = Buffer.from(valid, 'utf8');
    
    return timingSafeEqual(providedBuffer, validBuffer);
  }

  private extractAuthToken(req: Request): { token: string; method: string } | null {
    // Primary: X-API-KEY header (case-insensitive check)
    const apiKey = req.headers['x-api-key'] || req.headers['X-Api-Key'];
    if (apiKey && typeof apiKey === 'string') {
      return { token: apiKey.trim(), method: 'X-API-KEY' };
    }

    // Secondary: Authorization Bearer (if enabled)
    if (this.config.enableBearerSupport) {
      const authHeader = req.headers.authorization;
      if (authHeader && typeof authHeader === 'string') {
        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch) {
          return { token: bearerMatch[1].trim(), method: 'Bearer' };
        }
      }
    }

    return null;
  }

  private validateApiKey(token: string): boolean {
    // Input validation
    if (!token || typeof token !== 'string' || token.length < 16 || token.length > 256) {
      return false;
    }

    // Check against valid keys using timing-safe comparison
    return this.config.validApiKeys.some(validKey => 
      this.secureCompare(token, validKey)
    );
  }

  private checkRateLimit(keyHash: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.rateLimitStore.get(keyHash);

    if (!entry || now > entry.resetTime) {
      // Create new entry
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.config.rateLimitWindowMs
      };
      this.rateLimitStore.set(keyHash, newEntry);
      return {
        allowed: true,
        remaining: this.config.rateLimitMaxRequests - 1,
        resetTime: newEntry.resetTime
      };
    }

    if (entry.count >= this.config.rateLimitMaxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.config.rateLimitMaxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  private cleanupRateLimit(): void {
    const now = Date.now();
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  private logAuthAttempt(req: Request, success: boolean, method: string, reason?: string): void {
    if (!this.config.logAuthAttempts) return;

    const logData = {
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      method,
      success,
      reason,
      endpoint: req.path,
      // Never log actual tokens
      hasToken: !!this.extractAuthToken(req)
    };

    try {
      if (success) {
        console.log('AUTH_SUCCESS', JSON.stringify(logData));
      } else {
        console.warn('AUTH_FAILURE', JSON.stringify(logData));
      }
    } catch (e) {
      // Silent fallback if logging fails
    }
  }

  public authenticate = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Extract authentication token
      const authData = this.extractAuthToken(req);
      
      if (!authData) {
        this.logAuthAttempt(req, false, 'none', 'missing_auth_header');
        res.status(401).json({
          ok: false,
          error: 'Authentication required',
          message: 'Provide X-API-KEY header or Authorization: Bearer token',
          code: 'MISSING_AUTH'
        });
        return;
      }

      const { token, method } = authData;

      // Validate API key format and value
      if (!this.validateApiKey(token)) {
        this.logAuthAttempt(req, false, method, 'invalid_key');
        res.status(403).json({
          ok: false,
          error: 'Invalid API key',
          message: 'The provided API key is not valid',
          code: 'INVALID_KEY'
        });
        return;
      }

      // Rate limiting
      const keyHash = this.hashKey(token);
      const rateLimitResult = this.checkRateLimit(keyHash);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': this.config.rateLimitMaxRequests.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
      });

      if (!rateLimitResult.allowed) {
        this.logAuthAttempt(req, false, method, 'rate_limit_exceeded');
        res.status(429).json({
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Limit: ${this.config.rateLimitMaxRequests} per ${this.config.rateLimitWindowMs / 1000}s`,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        });
        return;
      }

      // Success - add auth info to request
      (req as any).auth = {
        method,
        keyHash: keyHash.substring(0, 8), // First 8 chars for logging
        timestamp: Date.now()
      };

      this.logAuthAttempt(req, true, method);
      next();

    } catch (error) {
      console.error('AUTH_MIDDLEWARE_ERROR', error);
      res.status(500).json({
        ok: false,
        error: 'Authentication system error',
        code: 'AUTH_SYSTEM_ERROR'
      });
    }
  };

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.rateLimitStore.clear();
  }
}

// Factory function for easy configuration
export function createZantaraAuth(options: Partial<AuthConfig> = {}): ZantaraAuthMiddleware {
  const defaultConfig: AuthConfig = {
    validApiKeys: process.env.VALID_API_KEYS?.split(',') || [
      process.env.ZANTARA_PLUGIN_API_KEY,
      process.env.API_KEY
    ].filter(Boolean),
    rateLimitWindowMs: 60 * 1000, // 1 minute
    rateLimitMaxRequests: 100,
    enableBearerSupport: true,
    logAuthAttempts: process.env.NODE_ENV !== 'test'
  };

  const config = { ...defaultConfig, ...options };

  if (config.validApiKeys.length === 0) {
    throw new Error('No valid API keys configured. Set ZANTARA_PLUGIN_API_KEY or VALID_API_KEYS environment variable.');
  }

  return new ZantaraAuthMiddleware(config);
}

// Enhanced version of requireApiKey with security features
export function requireApiKeyEnhanced(req: Request, res: Response, next: NextFunction) {
  // Get singleton instance or create new one
  if (!(global as any).__zantaraAuth) {
    try {
      (global as any).__zantaraAuth = createZantaraAuth();
    } catch (error) {
      console.error('Failed to create Zantara auth middleware:', error);
      // Fallback to basic auth if enhanced fails
      return requireApiKeyBasic(req, res, next);
    }
  }
  
  return (global as any).__zantaraAuth.authenticate(req, res, next);
}

// Basic fallback authentication (existing logic)
export function requireApiKeyBasic(req: Request, res: Response, next: NextFunction) {
  const envKeys: string[] = [];

  // Primary API key
  if (process.env.ZANTARA_PLUGIN_API_KEY && process.env.ZANTARA_PLUGIN_API_KEY.trim()) {
    envKeys.push(process.env.ZANTARA_PLUGIN_API_KEY.trim());
  }
  
  // Legacy support for API_KEYS CSV
  const csvKeys = ((process.env.API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean));
  envKeys.push(...csvKeys);
  
  // Legacy CODEX token
  if (process.env.CODEX_DISPATCH_TOKEN && process.env.CODEX_DISPATCH_TOKEN.trim()) {
    envKeys.push(process.env.CODEX_DISPATCH_TOKEN.trim());
  }

  const bearer = (req.header('authorization') || '')
    .replace(/\s+/g, ' ')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const headerKey = (req.header('x-api-key') || req.header('X-Api-Key') || '').toString().trim();
  const queryKey = (req.query.api_key as string) || (req.query.apikey as string) || '';
  const provided = (headerKey || bearer || queryKey || '').trim();

  if (!envKeys.length) {
    return res.status(500).json({ ok: false, error: 'Missing ZANTARA_PLUGIN_API_KEY' });
  }
  if (!provided) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const match = envKeys.some(k => k && k === provided);
  if (!match) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  return next();
}

export default ZantaraAuthMiddleware;