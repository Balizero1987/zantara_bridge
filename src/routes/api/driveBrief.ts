import type { Router, Request, Response } from 'express';

export default function registerDriveBrief(r: Router) {
  r.post('/api/drive/brief', async (_req: Request, res: Response) => {
    res.json({
      ok: true,
      webViewLink: "https://drive.google.com/file/d/example/view"
    });
  });
}
