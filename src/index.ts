import express from 'express';
import registerPlugin from './routes/plugin';
import registerDiag from './routes/diag';
import { apiKeyGuard } from './middleware/authPlugin';
import registerNotes from './routes/api/notes';
import registerChat from './routes/api/chat';
import registerDocgen from './routes/api/docgen';
import registerDriveBrief from './routes/api/driveBrief';
import registerGitHubBrief from './routes/api/githubBrief';
import registerWebhooks from './routes/api/webhooks';

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Plugin pubblico
registerPlugin(app);

// Rotte diagnostiche (solo se abilitate)
if (process.env.ENABLE_DIAG === 'true') {
  registerDiag(app);
}

// Middleware protetti (API Key obbligatoria)
app.use(apiKeyGuard as any);

// API protette
registerNotes(app);
registerChat(app);
registerDocgen(app);
registerDriveBrief(app);
registerGitHubBrief(app);
registerWebhooks(app);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
