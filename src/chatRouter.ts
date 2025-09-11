import { Router } from 'express';
import { apiKeyGuard } from './middleware/authPlugin';
import registerNotes from './routes/api/notes';
import registerChat from './routes/api/chat';
import registerDocgen from './routes/api/docgen';
import registerDriveBrief, { registerDriveDebug } from './routes/api/driveBrief';

// Expose a router that mirrors the protected API surface
const router = Router();

// Apply API key guard to everything under this router
router.use(apiKeyGuard as any);

registerNotes(router as any);
registerChat(router as any);
registerDocgen(router as any);
registerDriveBrief(router as any);
registerDriveDebug(router as any);

export default router;
