import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import FirestoreManager from '../persistence/FirestoreManager';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent?: string;
}

interface SecurityConfig {
  jwtSecret: string;
  jwtExpiry: string;
  refreshExpiry: string;
  maxSessions: number;
  allowMultipleSessions: boolean;
  requireMFA: boolean;
}

export class SecurityManagerV2 {
  private static instance: SecurityManagerV2;
  private oauthClient: OAuth2Client;
  private config: SecurityConfig;
  private firestore: typeof FirestoreManager;

  private constructor() {
    this.oauthClient = new OAuth2Client();
    this.firestore = FirestoreManager;
    
    this.config = {
      jwtSecret: process.env.JWT_SECRET || this.generateSecret(),
      jwtExpiry: process.env.JWT_EXPIRY || '15m',
      refreshExpiry: process.env.REFRESH_EXPIRY || '7d',
      maxSessions: parseInt(process.env.MAX_SESSIONS || '5'),
      allowMultipleSessions: process.env.ALLOW_MULTIPLE_SESSIONS === 'true',
      requireMFA: process.env.REQUIRE_MFA === 'true'
    };
    
    // Initialize Firestore
    this.firestore.initialize().catch(console.error);
  }

  static getInstance(): SecurityManagerV2 {
    if (!SecurityManagerV2.instance) {
      SecurityManagerV2.instance = new SecurityManagerV2();
    }
    return SecurityManagerV2.instance;
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async authenticate(credentials: {
    email?: string;
    password?: string;
    googleToken?: string;
    apiKey?: string;
  }, req: Request): Promise<{ user: User; session: Session }> {
    let user: User | undefined;

    // Log authentication attempt
    await this.firestore.logAuditEvent({
      type: 'AUTH_ATTEMPT',
      severity: 'INFO',
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path,
      message: `Authentication attempt via ${Object.keys(credentials).filter(k => credentials[k]).join(', ')}`,
      requestId: crypto.randomUUID()
    });

    // Google OAuth
    if (credentials.googleToken) {
      user = await this.verifyGoogleToken(credentials.googleToken);
    }
    // API Key authentication
    else if (credentials.apiKey) {
      user = await this.verifyApiKey(credentials.apiKey, req);
    }
    // Email/Password
    else if (credentials.email && credentials.password) {
      user = await this.verifyEmailPassword(credentials.email, credentials.password);
    }

    if (!user) {
      await this.firestore.logAuditEvent({
        type: 'AUTH_FAILURE',
        severity: 'WARNING',
        ip: this.getClientIp(req),
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        message: 'Invalid credentials',
        requestId: crypto.randomUUID()
      });
      throw new Error('Invalid credentials');
    }

    // Create session in Firestore
    const session = await this.createSession(user, req);
    
    // Log successful auth
    await this.firestore.logAuditEvent({
      type: 'AUTH_SUCCESS',
      severity: 'INFO',
      userId: user.id,
      userEmail: user.email,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path,
      message: 'Authentication successful',
      requestId: crypto.randomUUID()
    });

    return { user, session };
  }

  private async verifyGoogleToken(token: string): Promise<User> {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      
      const payload = ticket.getPayload();
      if (!payload) throw new Error('Invalid token payload');

      return {
        id: payload.sub,
        email: payload.email!,
        name: payload.name || payload.email!.split('@')[0],
        role: this.determineRole(payload.email!),
        permissions: this.getPermissions(payload.email!)
      };
    } catch (error) {
      throw new Error('Invalid Google token');
    }
  }

  private async verifyApiKey(apiKey: string, req: Request): Promise<User> {
    // Check API key in Firestore
    const apiKeyDoc = await this.firestore.validateApiKey(apiKey);
    
    if (!apiKeyDoc) {
      throw new Error('Invalid API key');
    }

    // Check rate limit
    const rateLimitResult = await this.firestore.checkRateLimit(
      `api-key:${apiKey}`,
      apiKeyDoc.rateLimit || 100,
      60000 // 1 minute window
    );

    if (!rateLimitResult.allowed) {
      await this.firestore.logAuditEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'WARNING',
        ip: this.getClientIp(req),
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        message: `Rate limit exceeded for API key ${apiKeyDoc.name}`,
        metadata: { remaining: rateLimitResult.remaining, resetAt: rateLimitResult.resetAt },
        requestId: crypto.randomUUID()
      });
      throw new Error('Rate limit exceeded');
    }

    // Return service account user
    return {
      id: apiKeyDoc.id,
      email: `service-${apiKeyDoc.name}@zantara.local`,
      name: apiKeyDoc.name,
      role: 'service',
      permissions: apiKeyDoc.permissions
    };
  }

  private async verifyEmailPassword(email: string, password: string): Promise<User> {
    // This would check against Firestore user collection
    // For now, throw not implemented
    throw new Error('Email/password authentication not yet implemented');
  }

  private determineRole(email: string): string {
    if (email === 'zero@balizero.com') return 'admin';
    if (email.endsWith('@balizero.com')) return 'staff';
    return 'user';
  }

  private getPermissions(email: string): string[] {
    const role = this.determineRole(email);
    
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'],
      staff: ['read', 'write', 'delete'],
      user: ['read', 'write'],
      service: ['read', 'write']
    };

    return rolePermissions[role] || ['read'];
  }

  private async createSession(user: User, req: Request): Promise<Session> {
    // Check existing sessions
    const userSessions = await this.firestore.getUserSessions(user.id);

    if (!this.config.allowMultipleSessions && userSessions.length > 0) {
      // Delete existing sessions
      await this.firestore.deleteUserSessions(user.id);
    } else if (userSessions.length >= this.config.maxSessions) {
      // Delete oldest session
      const oldest = userSessions.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      await this.firestore.deleteSession(oldest.id);
    }

    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role,
        sessionId 
      },
      this.config.jwtSecret,
      { expiresIn: this.config.jwtExpiry }
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');
    
    // Save to Firestore
    const session = await this.firestore.createSession({
      userId: user.id,
      token,
      refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      createdAt: new Date(),
      lastActivity: new Date()
    });

    return session;
  }

  async refreshSession(refreshToken: string, req: Request): Promise<Session> {
    // Find session by refresh token in Firestore
    const sessions = await this.firestore.getUserSessions('*'); // Would need to search by token
    const session = sessions.find(s => s.refreshToken === refreshToken);

    if (!session) {
      await this.firestore.logAuditEvent({
        type: 'AUTH_FAILURE',
        severity: 'WARNING',
        ip: this.getClientIp(req),
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        message: 'Invalid refresh token',
        requestId: crypto.randomUUID()
      });
      throw new Error('Invalid refresh token');
    }

    // Delete old session
    await this.firestore.deleteSession(session.id);

    // Create new session (would need user data)
    // For now, simplified
    throw new Error('Refresh not fully implemented');
  }

  async validateSession(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      
      // Get session from Firestore
      const session = await this.firestore.getSession(decoded.sessionId);

      if (!session || session.token !== token) {
        throw new Error('Invalid session');
      }

      // Return user (simplified for now)
      return {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.email.split('@')[0],
        role: decoded.role,
        permissions: this.getPermissions(decoded.email)
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.firestore.deleteSession(sessionId);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.firestore.deleteUserSessions(userId);
  }

  // Express middleware with Firestore
  requireAuth(requiredPermissions: string[] = []): (req: Request, res: Response, next: NextFunction) => void {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);
        if (!token) {
          await this.firestore.logAuditEvent({
            type: 'ACCESS_DENIED',
            severity: 'WARNING',
            ip: this.getClientIp(req),
            userAgent: req.headers['user-agent'],
            method: req.method,
            path: req.path,
            message: 'No token provided',
            requestId: crypto.randomUUID()
          });
          return res.status(401).json({ error: 'No token provided' });
        }

        const user = await this.validateSession(token);
        
        // Check permissions
        if (requiredPermissions.length > 0) {
          const hasPermission = requiredPermissions.every(perm =>
            user.permissions.includes(perm) || user.permissions.includes('*')
          );

          if (!hasPermission) {
            await this.firestore.logAuditEvent({
              type: 'ACCESS_DENIED',
              severity: 'WARNING',
              userId: user.id,
              userEmail: user.email,
              ip: this.getClientIp(req),
              userAgent: req.headers['user-agent'],
              method: req.method,
              path: req.path,
              message: 'Insufficient permissions',
              metadata: { required: requiredPermissions, had: user.permissions },
              requestId: crypto.randomUUID()
            });
            return res.status(403).json({ error: 'Insufficient permissions' });
          }
        }

        // Log successful access
        await this.firestore.logAuditEvent({
          type: 'ACCESS_GRANTED',
          severity: 'INFO',
          userId: user.id,
          userEmail: user.email,
          ip: this.getClientIp(req),
          userAgent: req.headers['user-agent'],
          method: req.method,
          path: req.path,
          message: 'Access granted',
          requestId: crypto.randomUUID()
        });

        // Attach user to request
        (req as any).user = user;
        next();
      } catch (error: any) {
        await this.firestore.logAuditEvent({
          type: 'AUTH_ERROR',
          severity: 'ERROR',
          ip: this.getClientIp(req),
          userAgent: req.headers['user-agent'],
          method: req.method,
          path: req.path,
          message: error.message,
          requestId: crypto.randomUUID()
        });
        return res.status(401).json({ error: error.message });
      }
    };
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      return apiKey;
    }

    const queryToken = req.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    }
    return req.headers['x-real-ip'] as string || 
           req.socket?.remoteAddress || 
           'unknown';
  }

  // Admin methods
  async getAuditLogs(filters: any): Promise<any[]> {
    return this.firestore.getAuditLogs(filters);
  }

  async getAuditStats(timeRange: 'hour' | 'day' | 'week' | 'month'): Promise<any> {
    return this.firestore.getAuditStats(timeRange);
  }

  async createApiKey(name: string, permissions: string[]): Promise<any> {
    const key = crypto.randomBytes(32).toString('hex');
    return this.firestore.createApiKey({
      key,
      name,
      permissions,
      rateLimit: 100,
      active: true
    });
  }

  async rotateApiKey(oldKeyId: string): Promise<any> {
    return this.firestore.rotateApiKey(oldKeyId);
  }
}

export default SecurityManagerV2.getInstance();