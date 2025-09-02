import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/actions/codex/dispatch', requireAuth, async (req: Request, res: Response) => {
  const { title, body, patch_b64, branch } = req.body || {};
  if (!title || !patch_b64) return res.status(400).json({ ok:false, error:'Missing fields' });

  const requestId = Math.random().toString(36).slice(2);
  const head = branch || `codex/update-${requestId}`;
  const payload = {
    event_type: 'codex-apply-patch',
    client_payload: {
      branch: head,
      title,
      body: `${body || ''}\n\nZANTARA req: ${requestId}`,
      patch_b64,
      requestId
    }
  };

  const repo = process.env.CODEX_DISPATCH_REPO || 'Balizero1987/zantara_bridge';
  const token = process.env.CODEX_DISPATCH_TOKEN || '';
  const gh = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!gh.ok) {
    const txt = await gh.text().catch(()=>'');
    return res.status(502).json({ ok:false, error:'GitHub dispatch failed', status: gh.status, details: txt });
  }
  return res.json({ ok:true, requestId, branch: head });
});

export default router;
