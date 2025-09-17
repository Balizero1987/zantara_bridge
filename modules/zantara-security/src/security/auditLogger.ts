import { Logging } from '@google-cloud/logging';

interface AuditEvent {
  eventType: string;
  userId?: string;
  serviceAccount?: string;
  action: string;
  resource?: string;
  timestamp: Date;
  success: boolean;
  metadata?: Record<string, any>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface SecurityMetrics {
  failedLogins: number;
  suspiciousActivities: number;
  keyRotations: number;
  unauthorizedAccess: number;
}

export class ComprehensiveAuditLogger {
  private logging: Logging;
  private securityLog: any;
  private metrics: SecurityMetrics;
  
  constructor() {
    this.logging = new Logging();
    this.securityLog = this.logging.log('zantara-security-audit');
    this.metrics = {
      failedLogins: 0,
      suspiciousActivities: 0,
      keyRotations: 0,
      unauthorizedAccess: 0
    };
  }

  async logSecurityEvent(event: AuditEvent): Promise<void> {
    try {
      // Enrich event with context
      const enrichedEvent = {
        ...event,
        timestamp: event.timestamp.toISOString(),
        sessionId: this.getCurrentSessionId(),
        requestId: this.getCurrentRequestId(),
        userAgent: this.getCurrentUserAgent(),
        ipAddress: this.getCurrentIP(),
        traceId: this.getCurrentTraceId()
      };

      // Create structured log entry
      const logEntry = this.securityLog.entry({
        severity: this.mapRiskToSeverity(event.riskLevel),
        resource: { 
          type: 'cloud_run_revision',
          labels: {
            service_name: 'zantara-bridge',
            revision_name: process.env.K_REVISION || 'local'
          }
        },
        jsonPayload: enrichedEvent,
        labels: {
          component: 'security',
          event_type: event.eventType,
          risk_level: event.riskLevel
        }
      });

      // Write to Cloud Logging
      await this.securityLog.write(logEntry);

      // Update metrics
      this.updateSecurityMetrics(event);

      // Trigger alerts for high-risk events
      if (event.riskLevel === 'HIGH' || event.riskLevel === 'CRITICAL') {
        await this.triggerSecurityAlert(enrichedEvent);
      }

      console.log(`🔒 Security event logged: ${event.eventType} [${event.riskLevel}]`);
    } catch (error) {
      // Never let audit logging failure break the main flow
      console.error('❌ Failed to log security event:', error);
    }
  }

  async logCredentialAccess(
    keyName: string, 
    success: boolean, 
    reason?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'CREDENTIAL_ACCESS',
      serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      action: 'ACCESS_API_KEY',
      resource: keyName,
      timestamp: new Date(),
      success,
      metadata: { 
        reason,
        environment: process.env.NODE_ENV || 'unknown'
      },
      riskLevel: success ? 'LOW' : 'HIGH'
    });
  }

  async logImpersonationAttempt(
    targetUser: string,
    success: boolean,
    scopes: string[]
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'USER_IMPERSONATION',
      serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      userId: targetUser,
      action: 'IMPERSONATE_USER',
      timestamp: new Date(),
      success,
      metadata: {
        scopes,
        domain: targetUser.split('@')[1]
      },
      riskLevel: success ? 'MEDIUM' : 'CRITICAL'
    });
  }

  async logDataAccess(
    operation: string,
    resourceId: string,
    userId: string,
    success: boolean
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'DATA_ACCESS',
      userId,
      action: operation,
      resource: resourceId,
      timestamp: new Date(),
      success,
      metadata: {
        operationType: operation,
        resourceType: 'google_drive_file'
      },
      riskLevel: operation.includes('DELETE') ? 'HIGH' : 'LOW'
    });
  }

  async logApiKeyRotation(keyName: string, success: boolean): Promise<void> {
    this.metrics.keyRotations++;
    
    await this.logSecurityEvent({
      eventType: 'KEY_ROTATION',
      action: 'ROTATE_API_KEY',
      resource: keyName,
      timestamp: new Date(),
      success,
      metadata: {
        rotationCount: this.metrics.keyRotations,
        automatedRotation: true
      },
      riskLevel: success ? 'LOW' : 'HIGH'
    });
  }

  async getSecurityDashboard(): Promise<SecurityMetrics & { recentEvents: any[] }> {
    // Query recent security events
    const recentEvents = await this.queryRecentEvents(24); // Last 24 hours
    
    return {
      ...this.metrics,
      recentEvents
    };
  }

  async detectAnomalies(): Promise<string[]> {
    const anomalies: string[] = [];
    
    // Check for suspicious patterns
    if (this.metrics.failedLogins > 10) {
      anomalies.push('High number of failed login attempts detected');
    }
    
    if (this.metrics.unauthorizedAccess > 0) {
      anomalies.push('Unauthorized access attempts detected');
    }
    
    // Query for unusual activity patterns
    const recentEvents = await this.queryRecentEvents(1);
    const eventsByHour = this.groupEventsByHour(recentEvents);
    
    // Detect unusual spikes
    const avgEventsPerHour = Object.values(eventsByHour).reduce((a, b) => a + b, 0) / 24;
    for (const [hour, count] of Object.entries(eventsByHour)) {
      if (count > avgEventsPerHour * 3) {
        anomalies.push(`Unusual activity spike detected at ${hour}:00`);
      }
    }
    
    return anomalies;
  }

  private mapRiskToSeverity(riskLevel: string): string {
    switch (riskLevel) {
      case 'CRITICAL': return 'CRITICAL';
      case 'HIGH': return 'ERROR';
      case 'MEDIUM': return 'WARNING';
      case 'LOW': return 'INFO';
      default: return 'DEFAULT';
    }
  }

  private updateSecurityMetrics(event: AuditEvent): void {
    if (!event.success) {
      if (event.eventType === 'USER_IMPERSONATION') {
        this.metrics.failedLogins++;
      } else if (event.eventType === 'DATA_ACCESS') {
        this.metrics.unauthorizedAccess++;
      }
    }
    
    if (event.riskLevel === 'HIGH' || event.riskLevel === 'CRITICAL') {
      this.metrics.suspiciousActivities++;
    }
  }

  private async triggerSecurityAlert(event: any): Promise<void> {
    // In production, this would integrate with PagerDuty, Slack, etc.
    console.error(`🚨 SECURITY ALERT: ${event.eventType} - ${event.action}`);
    console.error(`Details:`, JSON.stringify(event, null, 2));
    
    // Could send to monitoring system, email, Slack webhook, etc.
  }

  private getCurrentSessionId(): string {
    return process.env.SESSION_ID || 'unknown-session';
  }

  private getCurrentRequestId(): string {
    return process.env.REQUEST_ID || crypto.randomUUID();
  }

  private getCurrentUserAgent(): string {
    return process.env.USER_AGENT || 'zantara-bridge/1.0';
  }

  private getCurrentIP(): string {
    return process.env.CLIENT_IP || '127.0.0.1';
  }

  private getCurrentTraceId(): string {
    return process.env.TRACE_ID || crypto.randomUUID();
  }

  private async queryRecentEvents(hours: number): Promise<any[]> {
    // In production, query Cloud Logging
    // For demo, return empty array
    return [];
  }

  private groupEventsByHour(events: any[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      groups[i.toString()] = 0;
    }
    return groups;
  }
}

// Export singleton
export const auditLogger = new ComprehensiveAuditLogger();