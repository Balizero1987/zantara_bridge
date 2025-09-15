import { Router, Request, Response } from "express";
import { google } from 'googleapis';
import { impersonatedClient } from '../google';

const router = Router();

// POST /actions/gmail/send { to, subject, body }
router.post("/send", async (req: Request, res: Response) => {
  try {
    const { to, subject, body } = req.body || {};
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    if (!user) return res.status(500).json({ ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER' });
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.send']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    const raw = Buffer.from([
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      body || '',
    ].join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const { data } = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return res.json({ ok: true, data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'gmail.send failed' });
  }
});

// POST /actions/gmail/watch { labelIds?, topicName? }
router.post('/watch', async (req: Request, res: Response) => {
  try {
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const topicName = (req.body?.topicName || process.env.GMAIL_PUBSUB_TOPIC || '').toString();
    const labelIds = (req.body?.labelIds || ['INBOX']) as string[];
    if (!user) return res.status(500).json({ ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER' });
    if (!topicName) return res.status(400).json({ ok: false, error: 'Missing topicName or GMAIL_PUBSUB_TOPIC' });
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.readonly']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    const { data } = await gmail.users.watch({ userId: 'me', requestBody: { topicName, labelIds } });
    return res.json({ ok: true, data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'gmail.watch failed' });
  }
});

// POST /actions/gmail/stop
router.post('/stop', async (_req: Request, res: Response) => {
  try {
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    if (!user) return res.status(500).json({ ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER' });
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.readonly']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    await gmail.users.stop({ userId: 'me' });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'gmail.stop failed' });
  }
});

// POST /actions/gmail/poll { query? }
// Example default: from:go.id OR from:@kemnaker.go.id is:unread newer_than:7d
router.post('/poll', async (req: Request, res: Response) => {
  try {
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    if (!user) return res.status(500).json({ ok: false, error: 'Missing IMPERSONATE_USER/GMAIL_SENDER' });
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.readonly']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    const query = (req.body?.query || 'from:(go.id OR @kemnaker.go.id OR @kemenkumham.go.id) is:unread newer_than:14d').toString();
    const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 25 });
    const messages = list.data.messages || [];
    return res.json({ ok: true, count: messages.length, messages });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'gmail.poll failed' });
  }
});

export default router;
