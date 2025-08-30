import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function listEmailsHandler(req: Request, res: Response) {
  try {
    const labelIds = (req.query.labelId as string) ? [String(req.query.labelId)] : ['INBOX'];
    const maxResults = Math.max(1, Math.min(parseInt(String(req.query.maxResults || '10'), 10) || 10, 50));
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.readonly']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    const list = await gmail.users.messages.list({ userId: 'me', labelIds, maxResults });
    const messages = list.data.messages || [];
    const details = await Promise.all(messages.map(async (m) => {
      const g = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'metadata', metadataHeaders: ['Subject','From','Date'] });
      const headers = (g.data.payload?.headers || []) as any[];
      const h = (name: string) => headers.find(x => x.name === name)?.value || null;
      return { id: g.data.id, threadId: g.data.threadId, subject: h('Subject'), from: h('From'), date: h('Date'), snippet: g.data.snippet };
    }));
    (req as any).log?.info?.({ action: 'email.list', labelIds, count: details.length });
    return res.json({ ok: true, items: details });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'email.list', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'email.list failed', details: gerr || undefined });
  }
}

