/**
 * 🏠 CORE ROUTES - Essential endpoints
 * Consolidates: health, status, root endpoints
 */

import { Router } from 'express';
import type { ZantaraConfig } from '../config/environments';

export function createCoreRoutes(config: ZantaraConfig): Router {
  const router = Router();
  
  // Service metrics
  const startTime = Date.now();
  let callCount = 0;

  // Request counter middleware
  router.use((req, res, next) => {
    callCount++;
    next();
  });

  // Root endpoint - service information
  router.get('/', (req, res) => {
    const serviceInfo = {
      ok: true,
      service: `zantara-bridge-${config.mode}`,
      version: '2.0.0-simplified',
      description: `Zantara Bridge ${config.mode} mode - Simplified architecture`,
      mode: config.mode,
      features: config.features,
      endpoints: getAvailableEndpoints(config),
      uptime: Date.now() - startTime,
      calls: callCount
    };

    // Add mode-specific info
    if (config.mode === 'light') {
      serviceInfo.sharedDrive = process.env.DRIVE_FOLDER_ID || '0AJC3-SJL03OOUk9PVA';
    }

    res.json(serviceInfo);
  });

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({
      ok: true,
      status: 'healthy',
      service: `zantara-bridge-${config.mode}`,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
      mode: config.mode
    });
  });

  // Bridge status endpoint (for light mode compatibility)
  if (config.mode === 'light') {
    router.get('/bridge/status', (req, res) => {
      res.json({
        ok: true,
        service: 'zantara-light-bridge',
        startedAt: startTime,
        uptimeMs: Date.now() - startTime,
        calls: callCount,
        dedupHits: 0,
        sharedDrive: process.env.DRIVE_FOLDER_ID || '0AJC3-SJL03OOUk9PVA',
        mode: 'simplified'
      });
    });
  }

  // Configuration endpoint (enterprise only)
  if (config.mode === 'enterprise') {
    router.get('/config', (req, res) => {
      res.json({
        ok: true,
        config: {
          mode: config.mode,
          auth: config.auth,
          features: config.features,
          monitoring: config.monitoring,
          rateLimit: config.rateLimit,
          resources: config.resources
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          region: process.env.REGION || 'unknown',
          version: process.env.SERVICE_VERSION || 'development'
        }
      });
    });
  }

  return router;
}

function getAvailableEndpoints(config: ZantaraConfig): Record<string, string> {
  const endpoints: Record<string, string> = {
    root: '/',
    health: '/health'
  };

  if (config.features.includes('ai')) {
    endpoints.chat = '/api/chat';
    endpoints.call = '/call';
  }

  if (config.features.includes('storage')) {
    endpoints.drive = '/actions/drive/upload';
    endpoints.memory = '/actions/memory/save';
    endpoints.notes = '/api/notes';
  }

  if (config.features.includes('communication')) {
    endpoints.email = '/actions/email/send';
    endpoints.calendar = '/api/calendar/deadline';
  }

  if (config.features.includes('admin')) {
    endpoints.monitoring = '/api/monitoring';
    endpoints.analytics = '/api/analytics';
  }

  if (config.mode === 'light') {
    endpoints.status = '/bridge/status';
  }

  return endpoints;
}