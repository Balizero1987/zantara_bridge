import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function emailStarHandler(req: Request, res: Response) {
  try {
    const { messageId, action } = req.body || {};
    if (!messageId || !action) return res.status(400).json({ ok: false, error: 'Missing messageId/action' });
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.modify']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    const reqBody: any = { addLabelIds: [], removeLabelIds: [] };
    if (String(action) === 'star') reqBody.addLabelIds = ['STARRED'];
    else if (String(action) === 'unstar') reqBody.removeLabelIds = ['STARRED'];
    else return res.status(400).json({ ok: false, error: 'action must be star|unstar' });
    const { data } = await gmail.users.messages.modify({ userId: 'me', id: String(messageId), requestBody: reqBody });
    return res.json({ ok: true, result: data });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    return res.status(status).json({ ok: false, error: e?.message || 'email.star failed' });
  }
}

