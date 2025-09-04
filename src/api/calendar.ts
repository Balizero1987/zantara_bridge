import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Create calendar event
 * Body: { summary, start, end, attendees? }
 * Responds with minimal envelope for upstream handling.
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { summary, start, end, attendees } = req.body || {};
    if (!summary) return res.status(400).json({ ok: false, error: 'missing_summary' });
    // Nota: la logica reale di integrazione con Google Calendar è altrove.
    return res.status(201).json({ ok: true, action: 'calendar.create', data: { summary, start, end, attendees: attendees || [] } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'internal_error', details: String(e) });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  return res.json({ ok: true, service: 'calendar', status: 'healthy' });
});

// Export shape: { prefix, router }
export default { prefix: '/actions/calendar', router };
