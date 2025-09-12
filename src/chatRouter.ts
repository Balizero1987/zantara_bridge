import type { Router } from 'express';
import registerNotes from './routes/api/notes';
import registerDriveBrief from './routes/api/driveBrief';

/**
 * Chat router: raggruppa tutte le rotte API protette
 */
export default function registerChatRoutes(r: Router) {
  registerNotes(r);
  registerDriveBrief(r);
}
