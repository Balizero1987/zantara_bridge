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
import registerDriveBrief, { registerDriveDebug } from './routes/api/driveBrief';
import registerUserPreferences from './routes/api/userPreferences';

// Public/plugin manifest
import registerPlugin from './routes/plugin';

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Public middleware
app.use(pluginCors);
app.use(pluginLimiter);

// Public health/info
app.get('/health', (_req, res) => res.json({ ok: true, service: 'zantara-bridge' }));
app.get('/version', (_req, res) => res.json({ version: process.env.ZANTARA_VERSION || 'dev' }));

// Manifest + OpenAPI
registerPlugin(app);

// Protected area (API key)
app.use(apiKeyGuard);
registerNotes(app);
registerChat(app);
registerDocgen(app);
registerDriveBrief(app);
registerDriveDebug(app);
registerUserPreferences(app);

// Minimal assets
app.get('/logo.png', (_req, res) => {
  res.type('png');
  const b = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4BwQACfsD/ed8yQgAAAAASUVORK5CYII=',
    'base64'
  );
  res.send(b);
});
app.get('/terms', (_req, res) => res.send('Terms will be provided by Bali Zero.'));

// Start server
const port = process.env.PORT || 8080;
app.listen(port, () => pino().info({ message: 'plugin.ready', port }));

export default app;
