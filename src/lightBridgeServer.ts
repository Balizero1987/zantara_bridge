import express from "express";
import cors from "cors";
import { lightweightAuth } from "./middleware/lightweightAuth";
import router from "./chatRouter";
import { apiKeyGuard } from "./middleware/authPlugin";
import drive from "./api/drive";
import chat from "./api/chat";
import memory from "./api/memory";

const app = express();

// Set trust proxy for Cloud Run
app.set('trust proxy', true);
app.disable('x-powered-by');

// Minimal CORS for light bridge
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Lightweight JSON parsing
app.use(express.json({ limit: '1mb' }));

// Essential security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Light bridge status tracking
const startTime = Date.now();
let callCount = 0;
let dedupHits = 0;

// Request counter middleware
app.use((req, res, next) => {
  callCount++;
  next();
});

// Root endpoint with service info
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: "zantara-light-bridge",
    version: "1.0.0",
    description: "Lightweight Zantara Bridge - Zero-cost optimized",
    endpoints: {
      status: "/bridge/status",
      health: "/health",
      call: "/call",
      memory: "/actions/memory/save",
      drive: "/actions/drive/upload"
    },
    uptime: Date.now() - startTime,
    calls: callCount
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    ok: true, 
    status: "healthy",
    service: "zantara-light-bridge",
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime
  });
});

// Bridge status endpoint (detailed metrics)
app.get("/bridge/status", (req, res) => {
  res.json({
    ok: true,
    service: "zantara-light-bridge",
    startedAt: startTime,
    uptimeMs: Date.now() - startTime,
    calls: callCount,
    dedupHits: dedupHits,
    sharedDrive: process.env.DRIVE_FOLDER_ID
  });
});

// Main chat router (includes /call endpoint)
// app.use(router); // Commented out to avoid router issues

// Manual /call endpoint for light bridge
app.post('/call', lightweightAuth, async (req, res) => {
  try {
    callCount++;
    
    const { key, params, message, model } = req.body;
    
    if (!message && !key) {
      return res.status(400).json({
        ok: false,
        error: "Message or action key required",
        service: "zantara-light-bridge"
      });
    }

    // Basic response for testing
    res.json({
      ok: true,
      service: "zantara-light-bridge",
      response: `Light bridge processed: ${message || key}`,
      timestamp: new Date().toISOString(),
      sharedDrive: process.env.DRIVE_FOLDER_ID
    });
    
  } catch (error) {
    console.error('Call endpoint error:', error);
    res.status(500).json({
      ok: false,
      error: "Call processing failed",
      service: "zantara-light-bridge"
    });
  }
});

// Protected endpoints with lightweight auth
app.use(lightweightAuth);

// Memory actions
app.use("/actions/memory", memory);

// Drive actions  
app.use("/actions/drive", drive);

// Chat actions
app.use("/actions/chat", chat);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    ok: false,
    error: "Endpoint not found",
    service: "zantara-light-bridge",
    path: req.originalUrl,
    availableEndpoints: ["/", "/health", "/bridge/status", "/call"]
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Light Bridge Error:', err);
  res.status(500).json({
    ok: false,
    error: "Internal server error",
    service: "zantara-light-bridge",
    timestamp: new Date().toISOString()
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🌉 Zantara Light Bridge listening on port ${port}`);
  console.log(`🚀 Zero-cost optimization enabled`);
  console.log(`📊 Shared Drive: ${process.env.DRIVE_FOLDER_ID || 'Not configured'}`);
});

export default app;