import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import router from "./chatRouter";
import identity from "./api/identity";
import { apiKeyGuard } from "./middleware/authPlugin";
import gmail from "./api/gmail";
import calendar from "./api/calendar";
import assistant from "./api/assistant";
import drive, { driveDiagRouter } from "./api/drive";
import chat from "./api/chat";
import memory from "./api/memory";
import conversations from "./api/conversations";
import gmailMonitoring from "./api/gmailMonitoring";
import calendarIntegration from "./api/calendarIntegration";
import heartbeat from "./api/heartbeat";
import { conversationMiddleware, conversationSummaryMiddleware } from "./middleware/conversationMiddleware";
import { startCronTestSalvataffio } from "./jobs/cronTestSalvataffio";

const app = express();

// Essential middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Basic rate limiting for light bridge - zero cost friendly
const basicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Conservative limit for light bridge
  message: {
    error: 'Rate limit exceeded',
    retryAfter: '15 minutes',
    limit: 100,
    window: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and diagnostics
    return req.path === '/health' || req.path.startsWith('/diag/');
  }
});

// Stricter rate limiting for resource-intensive operations
const strictRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Very conservative for heavy operations
  message: {
    error: 'Heavy operation rate limit exceeded',
    retryAfter: '5 minutes',
    limit: 10,
    window: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply basic rate limiting globally
app.use(basicRateLimit);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Rotte principali (Codex, Drive, Calendar…)
app.use(router);

// Health check
app.get("/health", (_req, res) => res.json({ ok: true, service: "zantara-bridge" }));

// Identity (login/me)
app.use(identity);

// Azioni che richiedono API Key authentication
app.use("/actions/gmail", apiKeyGuard, gmail);
app.use("/actions/memory", apiKeyGuard, memory);
app.use("/actions/drive", strictRateLimit, apiKeyGuard, drive); // Apply strict rate limiting to drive operations
app.use("/actions/chat", apiKeyGuard, conversationMiddleware, conversationSummaryMiddleware, chat);
// Calendar + Assistant APIs (protected)
app.use("/", calendar);
app.use("/actions/assistant", apiKeyGuard, assistant);

// API endpoints (protected)
app.use("/api/conversations", apiKeyGuard, conversations);
app.use("/api/gmail", apiKeyGuard, gmailMonitoring);
app.use("/api/calendar", apiKeyGuard, calendarIntegration);
app.use("/api/heartbeat", apiKeyGuard, heartbeat);

// Diagnostica Drive (senza API key; usarla per setup/health)
app.use("/diag/drive", driveDiagRouter);

// Start cron jobs
startCronTestSalvataffio();

// Porta
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log("🚀 ZANTARA Bridge listening on port", port);
  console.log("⏰ Heartbeat cron job active (daily at 03:00)");
});

export default app;
