import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { summarizeConversations } from './jobs/cronConversationSummarizer';
import { generateMonthlyReport } from './jobs/cronMonthlyReport';
import { generateWeeklyDigest } from './jobs/cronWeeklyDigest';
import { startGmailMonitorJob } from './jobs/cronGmailMonitor';
import { startCalendarDeadlinesJob } from './jobs/cronCalendarDeadlines';
import { startMonitoringCron } from './jobs/cronMonitoring';
import registerPlugin from './routes/plugin';
import registerDiag from './routes/diag';
import { apiKeyGuard } from './middleware/authPlugin';
import registerNotes from './routes/api/notes';
import registerChat from './routes/api/chat';
import registerDocgen from './routes/api/docgen';
import registerDriveBrief from './routes/api/driveBrief';
import drive, { driveDiagRouter } from './api/drive';
import registerGitHubBrief from './routes/api/githubBrief';
import registerWebhooks from './routes/api/webhooks';
import { saveNote, saveNoteWithRequest } from './lib/driveSave';
import registerChatEnhanced from './routes/api/chatEnhanced';
import registerFileOperations from './routes/api/fileOperations';
import registerTeamWorkspace from './routes/api/teamWorkspace';
import registerTemplates from './routes/api/templates';
import registerTeamNotifications from './routes/api/teamNotifications';
import registerKnowledgeBase from './routes/api/knowledgeBase';
import registerTeamAnalytics from './routes/api/teamAnalytics';
import registerPersonalMemory from './routes/api/personalMemory';
import registerRelationshipBuilder from './routes/api/relationshipBuilder';
import registerEmotionalIntelligence from './routes/api/emotionalIntelligence';
import registerDriveIntegration from './routes/api/driveIntegration';
import registerAssistant from './routes/api/assistant';
import registerCompliance from './routes/api/compliance';
import registerGmailMonitor from './routes/api/gmailMonitor';
import registerCalendarDeadlines from './routes/api/calendarDeadlines';
import registerCron from './routes/api/cron';
import registerSaveMemory from './routes/api/saveMemory';
import { analyticsRouter } from './routes/analytics';
import { usersRouter } from './routes/users';
import { searchRouter } from './routes/search';
import { dashboardRouter } from './routes/dashboard';
import { webhooksRouter } from './routes/webhooks';
import { aiRouter } from './routes/ai';
import stats from './api/stats';
import conversationRouter from './routes/conversationRouter';
import conversationStats from './api/conversationStats';
import monitoring from './api/monitoring';

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// 🔧 Global middleware: Force X-BZ-USER = BOSS se mancante
app.use((req, res, next) => {
  if (!req.headers['x-bz-user']) {
    req.headers['x-bz-user'] = 'BOSS';  // fallback hardcoded
    console.log('🛠️ Forced X-BZ-USER = BOSS for path:', req.path);
  }
  next();
});

// Health check pubblico (per GCP e uptime probe)
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

// Health check interno (protetto)
app.get('/internal/health', apiKeyGuard as any, (_req, res) => {
  res.status(200).json({ ok: true, service: "zantara-bridge", ts: Date.now() });
});

// Plugin pubblico
registerPlugin(app);

// Rotte diagnostiche (solo se abilitate)
if (process.env.ENABLE_DIAG === 'true') {
  registerDiag(app);
  // Additional Drive diagnostics (check/find-folder)
  app.use('/diag/drive', driveDiagRouter);
}

// Middleware protetti (API Key obbligatoria)
app.use(apiKeyGuard as any);

// API protette
registerNotes(app);
registerChat(app);
registerChatEnhanced(app); // Enhanced chat with Drive integration
registerFileOperations(app); // File operations: delete, summarize, analyze
registerTeamWorkspace(app); // Team workspace setup and management
registerTemplates(app); // Business templates system
registerTeamNotifications(app); // Team notifications and webhooks
registerKnowledgeBase(app); // Shared knowledge base
registerTeamAnalytics(app); // Team analytics and dashboard
registerPersonalMemory(app); // Personal memory and relationship tracking
registerRelationshipBuilder(app); // Advanced relationship building
registerEmotionalIntelligence(app); // Emotional intelligence and wellness
registerDriveIntegration(app); // Google Drive integration endpoints
registerAssistant(app); // OpenAI Assistant with persistent threads
registerCompliance(app);
registerGmailMonitor(app); // Gmail monitoring for government emails
registerCalendarDeadlines(app); // Calendar deadlines and reminders
registerCron(app); // Cron job triggers and manual endpoints
registerSaveMemory(app); // Apps Script direct integration endpoint
registerDocgen(app);
registerDriveBrief(app);
registerGitHubBrief(app);
registerWebhooks(app);

// New API routes
app.use('/api/analytics', analyticsRouter);
app.use('/api/users', usersRouter);
app.use('/api/search', searchRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/ai', aiRouter);
app.use('/api/stats', stats);
app.use('/api/conversations', conversationRouter);
app.use('/api/conversations/stats', conversationStats);
app.use('/api/monitoring', monitoring);

// Actions: Drive upload (requires API key guard)
app.use('/actions/drive', drive as any);

// Back-compat alias: /actions/memory/save → same semantics as /api/notes/save
app.post('/actions/memory/save', async (req, res) => {
  try {
    const owner = (req as any).canonicalOwner || 'BOSS';
    const title = String(req.body?.title || '').trim() || undefined;
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ ok: false, error: 'content required' });
    const out = await saveNoteWithRequest(req, content, title);
    return res.json({ ok: true, file: out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'save_note_failed' });
  }
});

// Cron job: Conversation Summarizer ogni giorno alle 23:55
cron.schedule("55 23 * * *", async () => {
  console.log("⏰ Job programmato: Conversation Summarizer");
  await summarizeConversations();
});

// Cron job: Monthly Report ogni primo del mese alle 08:00
cron.schedule("0 8 1 * *", async () => {
  console.log("⏰ Job programmato: Monthly Report");
  await generateMonthlyReport();
});

// Cron job: Weekly Digest ogni lunedì alle 08:00
cron.schedule("0 8 * * 1", async () => {
  console.log("⏰ Job programmato: Weekly Digest");
  await generateWeeklyDigest();
});

// Start Gmail monitoring job
startGmailMonitorJob();

// Start Calendar deadlines monitoring job
startCalendarDeadlinesJob();

// Start system monitoring heartbeat
startMonitoringCron();

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
