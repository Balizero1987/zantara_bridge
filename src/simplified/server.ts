/**
 * 🚀 ZANTARA BRIDGE - SIMPLIFIED UNIVERSAL SERVER
 * Single entry point with mode-based configuration
 * Replaces: index.ts + server.ts + lightBridgeServer.ts
 */

import express from 'express';
import { createConfig } from './config/environments';
import { initializeMiddleware } from './middleware';
import { initializeRoutes } from './routes';
import { startServices } from './services';

const app = express();

// Initialize configuration based on environment
const config = createConfig();

console.log(`🚀 Starting Zantara Bridge in ${config.mode} mode`);
console.log(`📊 Features enabled: ${config.features.join(', ')}`);

// Initialize middleware based on mode
initializeMiddleware(app, config);

// Initialize routes based on enabled features
initializeRoutes(app, config);

// Start background services if needed
if (config.mode !== 'minimal') {
  startServices(config);
}

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error:', err);
  
  res.status(500).json({
    ok: false,
    error: config.mode === 'enterprise' ? err.message : 'Internal server error',
    service: `zantara-bridge-${config.mode}`,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found',
    service: `zantara-bridge-${config.mode}`,
    path: req.originalUrl,
    availableEndpoints: config.mode === 'light' ? 
      ['/', '/health', '/bridge/status', '/call'] :
      ['/', '/health', '/api/*', '/actions/*']
  });
});

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`🌉 Zantara Bridge (${config.mode}) listening on port ${port}`);
  console.log(`🔧 Auth mode: ${config.auth}`);
  console.log(`📈 Monitoring: ${config.monitoring}`);
  console.log(`⚡ Rate limiting: ${config.rateLimit}`);
});

export default app;