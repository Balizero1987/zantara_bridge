import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function emailDeleteHandler(req: Request, res: Response) {
  try {
    const { messageId, threadId } = req.body || {};
    if (!messageId && !threadId) return res.status(400).json({ ok: false, error: 'Provide messageId or threadId' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.modify']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    if (threadId) {
      await gmail.users.threads.delete({ userId: 'me', id: String(threadId) });
      return res.json({ ok: true, deleted: { threadId } });
    }
    await gmail.users.messages.delete({ userId: 'me', id: String(messageId) });
    return res.json({ ok: true, deleted: { messageId } });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    return res.status(status).json({ ok: false, error: e?.message || 'email.delete failed' });
  }
}

