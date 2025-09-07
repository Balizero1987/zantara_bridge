import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function emailSearchHandler(req: Request, res: Response) {
  try {
    const { query, labelIds, from, to, subject, limit } = (req.method === 'GET' ? req.query : req.body) as any;
    const max = Math.min(parseInt(String(limit || '20'), 10) || 20, 100);
    const terms: string[] = [];
    if (query) terms.push(String(query));
    if (from) terms.push(`from:${from}`);
    if (to) terms.push(`to:${to}`);
    if (subject) terms.push(`subject:${subject}`);
    const q = terms.join(' ').trim() || undefined;
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.readonly']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    const list = await gmail.users.messages.list({ userId: 'me', maxResults: max, q, labelIds: Array.isArray(labelIds) ? labelIds : (labelIds ? [String(labelIds)] : undefined) } as any);
    return res.json({ ok: true, result: list.data });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    return res.status(status).json({ ok: false, error: e?.message || 'email.search failed' });
  }
}

