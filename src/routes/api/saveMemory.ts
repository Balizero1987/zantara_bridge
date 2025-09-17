import type { Router, Request, Response } from 'express';
import { saveNoteWithRequest } from '../../lib/driveSave';

/**
 * Apps Script Integration - Save Memory Endpoint
 * Direct integration for Google Apps Script calls
 */
export default function registerSaveMemory(r: Router) {
  // POST /saveMemory - Apps Script friendly endpoint
  r.post('/saveMemory', async (req: Request, res: Response) => {
    try {
      const user = req.header('X-BZ-USER') || process.env.DEFAULT_USER || 'BOSS';
      if (!user) {
        return res.status(400).json({ ok: false, error: 'X-BZ-USER required' });
      }

      const { title, content, tags } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ ok: false, error: 'Missing title or content' });
      }

      // Set the canonical owner for the request
      (req as any).canonicalOwner = user;
      
      const result = await saveNoteWithRequest(req, content, title);

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error('SaveMemory error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}