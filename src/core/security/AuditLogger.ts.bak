import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export enum AuditEventType {
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  DATA_CREATE = 'DATA_CREATE',
  DATA_READ = 'DATA_READ',
  DATA_UPDATE = 'DATA_UPDATE',
  DATA_DELETE = 'DATA_DELETE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userEmail?: string;
  ip: string;
  userAgent?: string;
  method: string;
  path: string;
  query?: Record<string, any>;
  body?: Record<string, any>;
  statusCode?: number;
  message: string;
  metadata?: Record<string, any>;
  duration?: number;
  requestId: string;
}

interface AuditLoggerConfig {
  storageBackend: 'file' | 'console' | 'firestore' | 'all';
  logLevel: AuditSeverity;
  sensitiveFields: string[];
  maxFileSize: number;
  retentionDays: number;
  enableCompression: boolean;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private config: AuditLoggerConfig;
  private currentLogFile: string;
  private eventQueue: AuditEvent[] = [];
  private flushInterval: NodeJS.Timeout;

  private constructor() {
    this.config = {
      storageBackend: (process.env.AUDIT_STORAGE as any) || 'all',
      logLevel: (process.env.AUDIT_LOG_LEVEL as any) || AuditSeverity.INFO,
      sensitiveFields: ['password', 'token', 'secret', 'apiKey', 'authorization'],
      maxFileSize: parseInt(process.env.AUDIT_MAX_FILE_SIZE || '10485760'), // 10MB
      retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '90'),
      enableCompression: process.env.AUDIT_ENABLE_COMPRESSION === 'true'
    };

    this.currentLogFile = this.getLogFileName();
    
    // Flush queue every 5 seconds
    this.flushInterval = setInterval(() => this.flushQueue(), 5000);

    // Cleanup old logs daily
    setInterval(() => this.cleanupOldLogs(), 24 * 60 * 60 * 1000);
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  private getLogFileName(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    return path.join(process.cwd(), 'logs', 'audit', `audit-${dateStr}.log`);
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.config.sensitiveFields.some(field => 
          key.toLowerCase().includes(field.toLowerCase()))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  async log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'requestId'>): Promise<void> {
    const severityOrder = [AuditSeverity.INFO, AuditSeverity.WARNING, AuditSeverity.ERROR, AuditSeverity.CRITICAL];
    const configLevel = severityOrder.indexOf(this.config.logLevel);
    const eventLevel = severityOrder.indexOf(event.severity);

    if (eventLevel < configLevel) {
      return; // Skip events below configured level
    }

    const fullEvent: AuditEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      requestId: (event as any).requestId || crypto.randomUUID(),
      body: this.sanitizeData(event.body),
      query: this.sanitizeData(event.query),
      metadata: this.sanitizeData(event.metadata)
    };

    this.eventQueue.push(fullEvent);

    // Immediate flush for critical events
    if (event.severity === AuditSeverity.CRITICAL) {
      await this.flushQueue();
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await Promise.all([
        this.writeToConsole(events),
        this.writeToFile(events),
        this.writeToFirestore(events)
      ]);
    } catch (error) {
      console.error('Failed to flush audit queue:', error);
      // Re-queue events that failed to write
      this.eventQueue.unshift(...events);
    }
  }

  private async writeToConsole(events: AuditEvent[]): Promise<void> {
    if (!['console', 'all'].includes(this.config.storageBackend)) return;

    for (const event of events) {
      const logMethod = event.severity === AuditSeverity.ERROR || 
                       event.severity === AuditSeverity.CRITICAL ? 
                       console.error : console.log;
      
      logMethod(`[AUDIT] ${event.severity} - ${event.type}:`, {
        timestamp: event.timestamp.toISOString(),
        userId: event.userId,
        ip: event.ip,
        path: event.path,
        message: event.message,
        metadata: event.metadata
      });
    }
  }

  private async writeToFile(events: AuditEvent[]): Promise<void> {
    if (!['file', 'all'].includes(this.config.storageBackend)) return;

    const logDir = path.dirname(this.currentLogFile);
    
    try {
      await fs.mkdir(logDir, { recursive: true });
      
      const lines = events.map(event => JSON.stringify(event) + '\n').join('');
      await fs.appendFile(this.currentLogFile, lines);

      // Check file size and rotate if needed
      const stats = await fs.stat(this.currentLogFile);
      if (stats.size > this.config.maxFileSize) {
        await this.rotateLogFile();
      }
    } catch (error) {
      console.error('Failed to write audit log to file:', error);
    }
  }

  private async writeToFirestore(events: AuditEvent[]): Promise<void> {
    if (!['firestore', 'all'].includes(this.config.storageBackend)) return;

    try {
      const { Firestore } = require('@google-cloud/firestore');
      const db = new Firestore();
      const batch = db.batch();

      for (const event of events) {
        const docRef = db.collection('audit_logs').doc(event.id);
        batch.set(docRef, {
          ...event,
          timestamp: event.timestamp.toISOString()
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Failed to write audit log to Firestore:', error);
    }
  }

  private async rotateLogFile(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = this.currentLogFile.replace('.log', `-${timestamp}.log`);
    
    try {
      await fs.rename(this.currentLogFile, rotatedFile);
      
      if (this.config.enableCompression) {
        const zlib = require('zlib');
        const pipeline = require('util').promisify(require('stream').pipeline);
        const gzip = zlib.createGzip();
        const source = await fs.open(rotatedFile, 'r');
        const destination = await fs.open(`${rotatedFile}.gz`, 'w');
        
        await pipeline(source.createReadStream(), gzip, destination.createWriteStream());
        await fs.unlink(rotatedFile);
      }
      
      this.currentLogFile = this.getLogFileName();
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    const logDir = path.dirname(this.currentLogFile);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    try {
      const files = await fs.readdir(logDir);
      
      for (const file of files) {
        if (!file.startsWith('audit-')) continue;
        
        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`Deleted old audit log: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  // Express middleware for automatic request/response logging
  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = crypto.randomUUID();
      
      // Attach request ID
      (req as any).requestId = requestId;

      // Log request
      await this.log({
        type: AuditEventType.ACCESS_GRANTED,
        severity: AuditSeverity.INFO,
        userId: (req as any).user?.id,
        userEmail: (req as any).user?.email,
        ip: this.getClientIp(req),
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        message: `Request to ${req.method} ${req.path}`,
        requestId
      });

      // Capture response
      const originalSend = res.send;
      res.send = function(data: any) {
        res.send = originalSend;
        
        // Log response
        const duration = Date.now() - startTime;
        const severity = res.statusCode >= 400 ? 
          (res.statusCode >= 500 ? AuditSeverity.ERROR : AuditSeverity.WARNING) : 
          AuditSeverity.INFO;

        AuditLogger.getInstance().log({
          type: res.statusCode >= 400 ? AuditEventType.ACCESS_DENIED : AuditEventType.ACCESS_GRANTED,
          severity,
          userId: (req as any).user?.id,
          userEmail: (req as any).user?.email,
          ip: AuditLogger.getInstance().getClientIp(req),
          userAgent: req.headers['user-agent'],
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          message: `Response ${res.statusCode} for ${req.method} ${req.path}`,
          duration,
          requestId
        });

        return res.send(data);
      };

      next();
    };
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

  // Helper methods for specific event types
  async logAuthSuccess(req: Request, userId: string, method: string): Promise<void> {
    await this.log({
      type: AuditEventType.AUTH_SUCCESS,
      severity: AuditSeverity.INFO,
      userId,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path,
      message: `Authentication successful via ${method}`,
      metadata: { authMethod: method }
    });
  }

  async logAuthFailure(req: Request, reason: string): Promise<void> {
    await this.log({
      type: AuditEventType.AUTH_FAILURE,
      severity: AuditSeverity.WARNING,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path,
      message: `Authentication failed: ${reason}`,
      metadata: { reason }
    });
  }

  async logSuspiciousActivity(req: Request, activity: string, details?: any): Promise<void> {
    await this.log({
      type: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: AuditSeverity.WARNING,
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path,
      message: `Suspicious activity detected: ${activity}`,
      metadata: { activity, details }
    });
  }

  async logDataOperation(
    req: Request, 
    operation: 'create' | 'read' | 'update' | 'delete',
    resource: string,
    resourceId?: string
  ): Promise<void> {
    const typeMap = {
      create: AuditEventType.DATA_CREATE,
      read: AuditEventType.DATA_READ,
      update: AuditEventType.DATA_UPDATE,
      delete: AuditEventType.DATA_DELETE
    };

    await this.log({
      type: typeMap[operation],
      severity: AuditSeverity.INFO,
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path,
      message: `${operation.toUpperCase()} operation on ${resource}`,
      metadata: { resource, resourceId, operation }
    });
  }

  destroy(): void {
    clearInterval(this.flushInterval);
  }
}

export const auditLogger = AuditLogger.getInstance();