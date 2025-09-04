import express from 'express';

// Import API modules (some export { prefix, router }, some export Router directly)
import calendarApi from './api/calendar';
import driveApi from './api/drive';
import gmailApi from './api/gmail';
import memoryApi from './api/memory';
import tasksApi from './api/tasks';
import codexApi from './api/codex';

const router = express.Router();

// Helper: mount various export shapes
const apis: any[] = [calendarApi, driveApi, gmailApi, memoryApi, tasksApi, codexApi];

for (const api of apis) {
  if (!api) continue;
  try {
    // shape { prefix, router }
    if (api.prefix && api.router) {
      router.use(api.prefix, api.router);
      continue;
    }
    // shape { router }
    if (api.router) {
      router.use(api.router);
      continue;
    }
    // default export is a Router function / middleware
    router.use(api as any);
  } catch (err) {
    // last-resort: mount as any to avoid TS/runtime fail
    router.use(api as any);
  }
}

export default router;
