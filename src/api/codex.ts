import { Router, Request, Response } from 'express';
import { requireApiKey } from '../middleware/auth';
const router = Router();
router.use(requireApiKey as any);

router.post('/dispatch', (req: Request, res: Response) => {
  const { event_type, payload } = req.body || {};
  return res.status(202).json({ ok: true, data: { request_id: 'rq_stub', status: 'queued', event_type, payload } });
});

router.get('/status/:request_id', (req: Request, res: Response) => {
  const { request_id } = req.params;
  return res.json({ ok: true, data: { request_id, status: 'done', output: { note: 'stub' } } });
});

export default { prefix: '/actions/codex', router };
