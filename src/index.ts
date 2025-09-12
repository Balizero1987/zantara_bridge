import express from 'express';
import registerPlugin from './routes/plugin';
import { pluginLimiter } from './middleware/rateLimit';
import registerDiag from './routes/diag';
import { apiKeyGuard } from './middleware/authPlugin';
import registerNotes from './routes/api/notes';
import registerChat from './routes/api/chat';
import registerDocgen from './routes/api/docgen';
import registerDriveBrief from './routes/api/driveBrief';
import registerGitHubBrief from './routes/api/githubBrief';
import registerWebhooks from './routes/api/webhooks';
import memoryActions from './routes/actions/memory';

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Gestione errori JSON non valido -> 400 immediato (evita stack trace nei log)
app.use((err: any, _req: any, res: any, next: any) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }
  return next(err);
});

// Limite richieste per endpoint sensibili (adatta se necessario)
// Nota: aggiungere qui altre basi di path se serve (es. '/api').
app.use('/actions', pluginLimiter);

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

// Actions endpoints
app.use('/actions/memory', memoryActions);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
