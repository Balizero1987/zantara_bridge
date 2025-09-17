import express from "express";
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
app.use(express.json());

// Rotte principali (Codex, Drive, Calendar…)
app.use(router);

// Health check
app.get("/health", (_req, res) => res.json({ ok: true, service: "zantara-bridge" }));

// Identity (login/me)
app.use(identity);

// Azioni che richiedono API Key authentication
app.use("/actions/gmail", apiKeyGuard, gmail);
app.use("/actions/memory", apiKeyGuard, memory);
app.use("/actions/drive", apiKeyGuard, drive);
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
