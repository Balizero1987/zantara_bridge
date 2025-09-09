import type { Router, Request, Response } from 'express';

export default function registerDriveBrief(r: Router) {
  r.post('/api/drive/brief', async (req: Request, res: Response) => {
    res.json({
      ok: true,
      owner: (req as any).canonicalOwner || 'UNKNOWN',
      dateKey: req.body?.dateKey || new Date().toISOString().slice(0,10),
      webViewLink: 'https://drive.google.com/file/d/example/view'
    });
  });
}
