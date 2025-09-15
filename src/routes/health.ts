import { Request, Response, Router } from 'express';
import { broadcastWebhookEvent, WebhookEvent } from './webhooks';

const router = Router();

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: any;
  lastChecked: string;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheck[];
  resources: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      load: number[];
    };
    disk: {
      used: string;
      free: string;
      percentage: number;
    };
  };
  dependencies: {
    openai: 'healthy' | 'degraded' | 'unhealthy';
    googleApis: 'healthy' | 'degraded' | 'unhealthy';
    redis: 'healthy' | 'degraded' | 'unhealthy';
  };
}

// Health check history
const healthHistory: SystemHealth[] = [];
const MAX_HISTORY = 100;

// GET /api/health - Comprehensive health check
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Run all health checks
    const checks = await Promise.all([
      checkMemory(),
      checkCPU(),
      checkDisk(),
      checkOpenAI(),
      checkGoogleAPIs(),
      checkRedis(),
      checkDatabase()
    ]);

    // Calculate overall status
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    // Get system resources
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const systemHealth: SystemHealth = {
      overall,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.1.0-enhanced',
      environment: process.env.NODE_ENV || 'development',
      checks,
      resources: {
        memory: {
          used: memUsage.rss,
          total: Math.round(memUsage.rss * 4), // Estimate
          percentage: Math.round((memUsage.rss / (memUsage.rss * 4)) * 100)
        },
        cpu: {
          usage: Math.round(cpuUsage.user / 1000000), // Convert to ms
          load: [0.1, 0.2, 0.15] // Mock load averages
        },
        disk: {
          used: '2.5GB',
          free: '47.5GB',
          percentage: 5
        }
      },
      dependencies: {
        openai: checks.find(c => c.service === 'openai')?.status || 'healthy',
        googleApis: checks.find(c => c.service === 'google-apis')?.status || 'healthy',
        redis: checks.find(c => c.service === 'redis')?.status || 'degraded'
      }
    };

    // Store in history
    healthHistory.push(systemHealth);
    if (healthHistory.length > MAX_HISTORY) {
      healthHistory.shift();
    }

    // Broadcast webhook if status changed or unhealthy
    if (overall !== 'healthy') {
      await broadcastWebhookEvent(WebhookEvent.SYSTEM_ALERT, {
        level: overall,
        message: `System health is ${overall}`,
        checks: checks.filter(c => c.status !== 'healthy'),
        timestamp: systemHealth.timestamp
      });
    }

    // Set appropriate HTTP status
    const httpStatus = overall === 'healthy' ? 200 : 
                      overall === 'degraded' ? 206 : 503;

    res.status(httpStatus).json(systemHealth);

  } catch (error: any) {
    res.status(500).json({
      overall: 'unhealthy',
      error: 'Health check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/health/history - Health check history
router.get('/history', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const recentHistory = healthHistory.slice(-limit);
  
  res.json({
    history: recentHistory,
    count: recentHistory.length,
    total: healthHistory.length
  });
});

// GET /api/health/status - Simple status check
router.get('/status', (req: Request, res: Response) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    uptime: `${Math.round(uptime / 60)} minutes`,
    memory: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    timestamp: new Date().toISOString(),
    version: '2.1.0-enhanced'
  });
});

// GET /api/health/ready - Readiness probe
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Quick checks for readiness
    const isReady = process.uptime() > 10; // At least 10 seconds uptime
    
    if (isReady) {
      res.json({
        ready: true,
        message: 'Service is ready to handle requests',
        uptime: process.uptime()
      });
    } else {
      res.status(503).json({
        ready: false,
        message: 'Service is starting up',
        uptime: process.uptime()
      });
    }
  } catch (error: any) {
    res.status(503).json({
      ready: false,
      error: error.message
    });
  }
});

// GET /api/health/live - Liveness probe
router.get('/live', (req: Request, res: Response) => {
  res.json({
    alive: true,
    pid: process.pid,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Individual health check functions
async function checkMemory(): Promise<HealthCheck> {
  const startTime = Date.now();
  const memUsage = process.memoryUsage();
  const usedMB = Math.round(memUsage.rss / 1024 / 1024);
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (usedMB > 1000) {
    status = 'unhealthy';
  } else if (usedMB > 500) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return {
    service: 'memory',
    status,
    responseTime: Date.now() - startTime,
    details: {
      usedMB,
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    },
    lastChecked: new Date().toISOString()
  };
}

async function checkCPU(): Promise<HealthCheck> {
  const startTime = Date.now();
  const cpuUsage = process.cpuUsage();
  const userTime = cpuUsage.user / 1000000; // Convert to ms
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (userTime > 5000) {
    status = 'unhealthy';
  } else if (userTime > 2000) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return {
    service: 'cpu',
    status,
    responseTime: Date.now() - startTime,
    details: {
      userTime,
      systemTime: cpuUsage.system / 1000000,
      uptime: process.uptime()
    },
    lastChecked: new Date().toISOString()
  };
}

async function checkDisk(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  // Mock disk check - in production, use actual disk usage tools
  const diskUsage = Math.random() * 100;
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (diskUsage > 90) {
    status = 'unhealthy';
  } else if (diskUsage > 75) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return {
    service: 'disk',
    status,
    responseTime: Date.now() - startTime,
    details: {
      usage: `${Math.round(diskUsage)}%`,
      available: '50GB'
    },
    lastChecked: new Date().toISOString()
  };
}

async function checkOpenAI(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Simple check - verify API key exists
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    return {
      service: 'openai',
      status: hasApiKey ? 'healthy' : 'unhealthy',
      responseTime: Date.now() - startTime,
      details: {
        configured: hasApiKey,
        model: 'gpt-3.5-turbo'
      },
      lastChecked: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      service: 'openai',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: { error: error.message },
      lastChecked: new Date().toISOString()
    };
  }
}

async function checkGoogleAPIs(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const hasServiceAccount = !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64
    );
    
    return {
      service: 'google-apis',
      status: hasServiceAccount ? 'healthy' : 'degraded',
      responseTime: Date.now() - startTime,
      details: {
        configured: hasServiceAccount,
        services: ['drive', 'sheets']
      },
      lastChecked: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      service: 'google-apis',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: { error: error.message },
      lastChecked: new Date().toISOString()
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const url = process.env.REDIS_URL || '';
    if (!url) {
      return {
        service: 'redis',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        details: { configured: false, message: 'REDIS_URL not set - using in-memory' },
        lastChecked: new Date().toISOString(),
      };
    }
    const Redis = require('ioredis');
    const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1500 });
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    const ok = String(pong || '').toUpperCase().includes('PONG');
    return {
      service: 'redis',
      status: ok ? 'healthy' : 'degraded',
      responseTime: Date.now() - startTime,
      details: { configured: true, ping: pong },
      lastChecked: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      service: 'redis',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: { error: e?.message || String(e) },
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  // Using in-memory storage currently
  return {
    service: 'database',
    status: 'degraded',
    responseTime: Date.now() - startTime,
    details: {
      type: 'in-memory',
      message: 'Using in-memory storage - data not persistent'
    },
    lastChecked: new Date().toISOString()
  };
}

export { router as healthRouter };
