import express from 'express';
import pino from 'pino';

// Middleware
import { pluginCors } from './middleware/corsPlugin';
import { pluginLimiter } from './middleware/rateLimit';
import { apiKeyGuard } from './middleware/authPlugin';

// Routes API
import registerNotes from './routes/api/notes';
import registerChat from './routes/api/chat';
import registerDocgen from './routes/api/docgen';
import registerDriveBrief from './routes/api/driveBrief';

        hotfix/fix-node-modules
// Public/plugin manifest
import registerPlugin from './routes/plugin';


        codex/update-ci/cd-workflow-for-cloud-run-deployment
// Routes pubbliche
import registerPlugin from './routes/plugin';

// Public/plugin manifest
import registerPlugin from './routes/plugin.js';
        main

        main
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Middleware pubblici
app.use(pluginCors);
app.use(pluginLimiter);

// Healthcheck e info pubbliche
        hotfix/fix-node-modules
app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'zantara-bridge' })
);
app.get('/version', (_req, res) =>
  res.json({ version: process.env.ZANTARA_VERSION || 'dev' })
);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'zantara-bridge' }));
app.get('/version', (_req, res) => res.json({ version: process.env.ZANTARA_VERSION || 'dev' }));
        main

// Manifest e OpenAPI
registerPlugin(app);

// Middleware protetti (API Key obbligatoria)
app.use(apiKeyGuard);

// API protette
registerNotes(app);
registerChat(app);
registerDocgen(app);
registerDriveBrief(app);

// Asset minimi
app.get('/logo.png', (_req, res) => {
  res.type('png');
  const b = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4BwQACfsD/ed8yQgAAAAASUVORK5CYII=',
    'base64'
  );
  res.send(b);
});

        hotfix/fix-node-modules
app.get('/terms', (_req, res) =>
  res.send('Terms will be provided by Bali Zero.')
);

// Avvio server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`✅ ZANTARA Bridge listening on :${port}`);
  pino().info({ message: 'plugin.ready', port });
});

app.get('/terms', (_req, res) => res.send('Terms will be provided by Bali Zero.'));

const port = process.env.PORT || 8080;
app.listen(port, () => pino().info({ message: 'plugin.ready', port }));
        main
