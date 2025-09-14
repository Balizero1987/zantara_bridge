import express from 'express';
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
import { saveNote } from './lib/driveSave';
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
import { analyticsRouter } from './routes/analytics';
import { usersRouter } from './routes/users';
import { searchRouter } from './routes/search';
import { dashboardRouter } from './routes/dashboard';
import { webhooksRouter } from './routes/webhooks';
import { aiRouter } from './routes/ai';

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

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

// Actions: Drive upload (requires API key guard)
app.use('/actions/drive', drive as any);

// Back-compat alias: /actions/memory/save → same semantics as /api/notes/save
app.post('/actions/memory/save', async (req, res) => {
  try {
    const owner = (req as any).canonicalOwner || 'BOSS';
    const title = String(req.body?.title || '').trim() || undefined;
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ ok: false, error: 'content required' });
    const out = await saveNote(owner, content, title);
    return res.json({ ok: true, file: out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'save_note_failed' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
