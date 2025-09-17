import { Router, Request, Response } from 'express';
import { monitor } from '../utils/monitoring';

const router = Router();

/**
 * Health check endpoint - PUBBLICO (per uptime monitoring)
 */
router.get('/health', (req: Request, res: Response) => {
  const health = monitor.getHealthCheck();
  const statusCode = health.status === 'OK' ? 200 : 
                     health.status === 'DEGRADED' ? 206 : 503;
  
  res.status(statusCode).json(health);
});

/**
 * Stats endpoint - PROTETTO (richiede API key)
 */
router.get('/stats', (req: Request, res: Response) => {
  // Check API key
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey || apiKey !== process.env.ZANTARA_PLUGIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.json({
    stats: monitor.getStats(),
    recent: monitor.getRecentRequests()
  });
});

/**
 * Metrics endpoint for Prometheus format (se mai servirà)
 * GRATIS da usare con Google Cloud Monitoring
 */
router.get('/metrics', (req: Request, res: Response) => {
  const stats = monitor.getStats();
  
  const metrics = `
# HELP zantara_requests_total Total number of requests
# TYPE zantara_requests_total counter
zantara_requests_total ${stats.totalRequests}

# HELP zantara_errors_total Total number of errors
# TYPE zantara_errors_total counter
zantara_errors_total ${stats.totalErrors}

# HELP zantara_response_time_avg Average response time in ms
# TYPE zantara_response_time_avg gauge
zantara_response_time_avg ${stats.avgResponseTime}

# HELP zantara_error_rate Current error rate
# TYPE zantara_error_rate gauge
zantara_error_rate ${stats.errorRate}

# HELP zantara_uptime_seconds Uptime in seconds
# TYPE zantara_uptime_seconds counter
zantara_uptime_seconds ${stats.uptime}
`;

  res.type('text/plain').send(metrics.trim());
});

export { router as monitoringRouter };