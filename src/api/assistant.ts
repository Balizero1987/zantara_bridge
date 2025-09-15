import { Router, Request, Response } from 'express';
import { assistantService } from '../core/assistant';

const router = Router();

// POST /actions/assistant/setup
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { name, instructions, model } = req.body || {};
    const out = await assistantService.ensureAssistant({ name, instructions, model });
    return res.json({ ok: true, ...out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'assistant.setup failed' });
  }
});

// POST /actions/assistant/sync-drive { path: "AMBARADAM/COMPLIANCE_KNOWLEDGE" }
router.post('/sync-drive', async (req: Request, res: Response) => {
  try {
    const path = (req.body?.path || 'AMBARADAM/COMPLIANCE_KNOWLEDGE').toString();
    const out = await assistantService.ingestDriveDocsFromPath(path);
    return res.json({ ok: true, path, ...out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'assistant.sync-drive failed' });
  }
});

// POST /actions/assistant/chat { message }
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const message = (req.body?.message || '').toString().trim();
    if (!message) return res.status(400).json({ ok: false, error: 'Missing message' });
    const out = await assistantService.runSimple(message);
    return res.json({ ok: true, ...out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'assistant.chat failed' });
  }
});

export default router;

