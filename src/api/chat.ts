import express from 'express';
import { chatAutoSave } from '../middleware/chatAutoSave';

const router = express.Router();

// Auto-save middleware applies to all chat routes
router.use(chatAutoSave as any);

// Minimal /actions/chat/recap endpoint
router.post('/recap', async (req, res) => {
  // Business logic for recap can live here; we just ACK to not break callers
  return res.json({ ok: true, recap: req.body?.recap || req.body?.content || null });
});

export default router;
