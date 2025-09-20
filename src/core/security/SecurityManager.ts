import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

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
}

interface SecurityConfig {
  jwtSecret: string;
  jwtExpiry: string;
  refreshExpiry: string;
  maxSessions: number;
  allowMultipleSessions: boolean;
  requireMFA: boolean;
}

export class SecurityManager {
  private static instance: SecurityManager;
  private sessions: Map<string, Session> = new Map();
  private users: Map<string, User> = new Map();
  private oauthClient: OAuth2Client;
  private config: SecurityConfig;

  private constructor() {
    this.oauthClient = new OAuth2Client();
    this.config = {
      jwtSecret: process.env.JWT_SECRET || this.generateSecret(),
      jwtExpiry: process.env.JWT_EXPIRY || '15m',
      refreshExpiry: process.env.REFRESH_EXPIRY || '7d',
      maxSessions: parseInt(process.env.MAX_SESSIONS || '5'),
      allowMultipleSessions: process.env.ALLOW_MULTIPLE_SESSIONS === 'true',
      requireMFA: process.env.REQUIRE_MFA === 'true'
    };
    
    // Initialize cleanup interval
    setInterval(() => this.cleanupExpiredSessions(), 60000); // Every minute
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async authenticate(credentials: {
    email?: string;
    password?: string;
    googleToken?: string;
    apiKey?: string;
  }): Promise<{ user: User; session: Session }> {
    let user: User | undefined;

    // Google OAuth
    if (credentials.googleToken) {
      user = await this.verifyGoogleToken(credentials.googleToken);
    }
    // API Key authentication
    else if (credentials.apiKey) {
      user = await this.verifyApiKey(credentials.apiKey);
    }
    // Email/Password (placeholder for future implementation)
    else if (credentials.email && credentials.password) {
      user = await this.verifyEmailPassword(credentials.email, credentials.password);
    }

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Create session
    const session = await this.createSession(user);
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

  private async verifyApiKey(apiKey: string): Promise<User> {
    const validKeys = (process.env.API_KEYS || '').split(',').map(k => k.trim());
    
    if (!validKeys.includes(apiKey)) {
      throw new Error('Invalid API key');
    }

    // For API key auth, create a service account user
    return {
      id: crypto.createHash('sha256').update(apiKey).digest('hex'),
      email: 'service@zantara.local',
      name: 'Service Account',
      role: 'service',
      permissions: ['read', 'write']
    };
  }

  private async verifyEmailPassword(email: string, password: string): Promise<User> {
    // Placeholder - implement actual password verification
    // This should check against a secure password store
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

  private async createSession(user: User): Promise<Session> {
    // Check session limits
    const userSessions = Array.from(this.sessions.values())
      .filter(s => s.userId === user.id);

    if (!this.config.allowMultipleSessions && userSessions.length > 0) {
      // Invalidate existing sessions
      userSessions.forEach(s => this.sessions.delete(s.id));
    } else if (userSessions.length >= this.config.maxSessions) {
      // Remove oldest session
      const oldest = userSessions.sort((a, b) => 
        a.createdAt.getTime() - b.createdAt.getTime())[0];
      this.sessions.delete(oldest.id);
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
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
    
    const session: Session = {
      id: sessionId,
      userId: user.id,
      token,
      refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, session);
    this.users.set(user.id, user);

    return session;
  }

  async refreshSession(refreshToken: string): Promise<Session> {
    const session = Array.from(this.sessions.values())
      .find(s => s.refreshToken === refreshToken);

    if (!session) {
      throw new Error('Invalid refresh token');
    }

    const user = this.users.get(session.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create new session
    this.sessions.delete(session.id);
    return this.createSession(user);
  }

  async validateSession(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      const session = this.sessions.get(decoded.sessionId);

      if (!session || session.token !== token) {
        throw new Error('Invalid session');
      }

      if (session.expiresAt < new Date()) {
        this.sessions.delete(session.id);
        throw new Error('Session expired');
      }

      // Update last activity
      session.lastActivity = new Date();

      const user = this.users.get(session.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    Array.from(this.sessions.entries())
      .filter(([_, session]) => session.userId === userId)
      .forEach(([id]) => this.sessions.delete(id));
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    Array.from(this.sessions.entries())
      .filter(([_, session]) => session.expiresAt < now)
      .forEach(([id]) => this.sessions.delete(id));
  }

  // Express middleware
  requireAuth(requiredPermissions: string[] = []): (req: Request, res: Response, next: NextFunction) => void {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const user = await this.validateSession(token);
        
        // Check permissions
        if (requiredPermissions.length > 0) {
          const hasPermission = requiredPermissions.every(perm =>
            user.permissions.includes(perm) || user.permissions.includes('*')
          );

          if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
          }
        }

        // Attach user to request
        (req as any).user = user;
        next();
      } catch (error: any) {
        return res.status(401).json({ error: error.message });
      }
    };
  }

  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check X-API-Key header
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      return apiKey;
    }

    // Check query parameter
    const queryToken = req.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  // Helper method for role-based access
  requireRole(roles: string[]): (req: Request, res: Response, next: NextFunction) => void {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const user = await this.validateSession(token);
        
        if (!roles.includes(user.role)) {
          return res.status(403).json({ error: 'Insufficient role privileges' });
        }

        (req as any).user = user;
        next();
      } catch (error: any) {
        return res.status(401).json({ error: error.message });
      }
    };
  }
}

export default SecurityManager.getInstance();