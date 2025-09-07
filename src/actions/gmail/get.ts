import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function getEmailHandler(req: Request, res: Response) {
  try {
    const id = (req.query.id as string) || (req.body?.id as string) || '';
    if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.readonly']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    (req as any).log?.info?.({ action: 'email.get', id, threadId: data.threadId });
    return res.json({ ok: true, message: data });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'email.get', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'email.get failed', details: gerr || undefined });
  }
}

