import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

function toArray(input: string | string[] | undefined): string[] {
  if (!input) return [];
  return (Array.isArray(input) ? input : String(input).split(',')).map(s => s.trim()).filter(Boolean);
}

function buildMime(opts: { from: string; to: string[]; subject: string; text: string; cc?: string[] }) {
  const headers: string[] = [];
  headers.push(`From: ${opts.from}`);
  if (opts.to.length) headers.push(`To: ${opts.to.join(', ')}`);
  if (opts.cc && opts.cc.length) headers.push(`Cc: ${opts.cc.join(', ')}`);
  headers.push(`Subject: ${opts.subject}`);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push('Content-Transfer-Encoding: 7bit');
  const head = headers.join('\r\n');
  return `${head}\r\n\r\n${opts.text}`;
}

export async function sendEmailHandler(req: Request, res: Response) {
  try {
    const { to, subject, text, cc } = req.body || {};
    const toList = toArray(to);
    const ccList = toArray(cc);
    if (!toList.length || !subject || !text) {
      return res.status(400).json({ ok: false, error: 'Missing to/subject/text' });
    }
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const from = process.env.GMAIL_SENDER || user || 'me';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.send']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    const mime = buildMime({ from, to: toList, subject: String(subject), text: String(text), cc: ccList });
    const raw = Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const { data } = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    (req as any).log?.info?.({ action: 'email.send', to: toList, subject, id: data.id, threadId: data.threadId });
    return res.json({ id: data.id, threadId: data.threadId, labelIds: data.labelIds });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'email.send', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'email.send failed', details: gerr || undefined });
  }
}

