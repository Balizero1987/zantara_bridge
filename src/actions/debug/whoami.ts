import { Request, Response } from 'express';
import { whoami } from '../../core/drive';

export async function actionsWhoamiHandler(req: Request, res: Response) {
  try {
    const info = await whoami();
    return res.json(info);
  } catch (e: any) {
    const status = e?.response?.status || 500;
    return res.status(status).json({
      ok: false,
      error: e?.message || 'whoami failed',
    });
  }
}
