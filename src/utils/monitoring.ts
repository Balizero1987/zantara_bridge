/**
 * Monitoring minimalista gratuito per Zantara Bridge
 * Usa solo Google Cloud Logging (incluso gratis)
 */

interface RequestStats {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  timestamp: Date;
  error?: string;
}

interface SystemStats {
  totalRequests: number;
  totalErrors: number;
  avgResponseTime: number;
  errorRate: number;
  uptime: number;
  lastError?: string;
  health: 'OK' | 'DEGRADED' | 'DOWN';
}

class MonitoringService {
  private stats: SystemStats;
  private startTime: Date;
  private recentRequests: RequestStats[] = [];
  private readonly MAX_RECENT = 100;

  constructor() {
    this.startTime = new Date();
    this.stats = {
      totalRequests: 0,
      totalErrors: 0,
      avgResponseTime: 0,
      errorRate: 0,
      uptime: 0,
      health: 'OK'
    };
  }

  /**
   * Track a request - this is FREE with Cloud Logging
   */
  trackRequest(req: any, res: any, responseTime: number) {
    const stat: RequestStats = {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      userId: req.headers['x-bz-user'],
      timestamp: new Date()
    };

    // Update stats
    this.stats.totalRequests++;
    
    if (res.statusCode >= 400) {
      this.stats.totalErrors++;
      this.stats.lastError = `${req.method} ${req.path} - ${res.statusCode}`;
      stat.error = this.stats.lastError;
    }

    // Calculate moving average for response time
    this.stats.avgResponseTime = 
      (this.stats.avgResponseTime * (this.stats.totalRequests - 1) + responseTime) / 
      this.stats.totalRequests;

    // Calculate error rate
    this.stats.errorRate = this.stats.totalErrors / this.stats.totalRequests;

    // Update health status
    if (this.stats.errorRate > 0.1) {
      this.stats.health = 'DOWN';
    } else if (this.stats.errorRate > 0.05) {
      this.stats.health = 'DEGRADED';
    } else {
      this.stats.health = 'OK';
    }

    // Keep recent requests in memory (last 100)
    this.recentRequests.push(stat);
    if (this.recentRequests.length > this.MAX_RECENT) {
      this.recentRequests.shift();
    }

    // Log to Cloud Logging (FREE)
    console.log(JSON.stringify({
      type: 'REQUEST_METRIC',
      ...stat,
      health: this.stats.health
    }));
  }

  /**
   * Get current stats - useful for health checks
   */
  getStats(): SystemStats {
    this.stats.uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    return this.stats;
  }

  /**
   * Get recent requests for debugging
   */
  getRecentRequests(): RequestStats[] {
    return this.recentRequests;
  }

  /**
   * Simple health check endpoint data
   */
  getHealthCheck() {
    const stats = this.getStats();
    return {
      status: stats.health,
      uptime: stats.uptime,
      requests: stats.totalRequests,
      errorRate: Math.round(stats.errorRate * 100) + '%',
      avgResponseTime: Math.round(stats.avgResponseTime) + 'ms',
      timestamp: new Date()
    };
  }

  /**
   * Daily summary for Cloud Logging
   */
  logDailySummary() {
    const summary = {
      type: 'DAILY_SUMMARY',
      date: new Date().toISOString().split('T')[0],
      ...this.getStats()
    };
    
    console.log(JSON.stringify(summary));
    
    // Reset daily stats
    this.stats.totalRequests = 0;
    this.stats.totalErrors = 0;
    this.stats.avgResponseTime = 0;
    this.stats.errorRate = 0;
  }
}

// Singleton instance
export const monitor = new MonitoringService();

// Middleware per Express
export function monitoringMiddleware(req: any, res: any, next: any) {
  const startTime = Date.now();
  
  // Hook into response finish
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    monitor.trackRequest(req, res, responseTime);
  });
  
  next();
}

// Schedule daily summary (at midnight)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  setTimeout(() => {
    setInterval(() => {
      monitor.logDailySummary();
    }, 24 * 60 * 60 * 1000); // Every 24 hours
  }, getMsUntilMidnight());
}

function getMsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}