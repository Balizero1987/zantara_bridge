import { Request, Response, Express } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { sendEmailHandler } from '../actions/email/send';
import { saveEmailDraftHandler } from '../actions/email/draft';

// Helper per logging strutturato
function logGmailAction(action: string, details: any) {
  console.log(`[GMAIL] ${action}`, JSON.stringify(details));
}

export const gmailRoutes = (app: Express) => {
  // New alias endpoint
  app.post('/actions/email/send', sendEmailHandler);
  app.post('/actions/email/draft', saveEmailDraftHandler);

  app.post('/actions/gmail/send', async (req: Request, res: Response) => {
    try {
      const { to, subject, text } = req.body;
      if (!to || !subject || !text) {
        logGmailAction('send.fail', { reason: 'missing fields', to, subject });
        return res.status(400).json({ ok: false, error: 'Missing to/subject/text' });
      }
      const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
      const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.send']);
      const gmail = google.gmail({ version: 'v1', auth: ic.auth });
      const from = process.env.GMAIL_SENDER || user;
      const mime =
        `From: ${from}\r\n` +
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: text/plain; charset="UTF-8"\r\n` +
        `Content-Transfer-Encoding: 7bit\r\n` +
        `\r\n` +
        `${text}`;
      const raw = Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const r = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw }
      });
      (req as any).log?.info?.({ action: 'gmail.send', to, subject, id: r.data.id });
      res.json({ ok: true, id: r.data.id });
    } catch (e: any) {
      (req as any).log?.error?.({ action: 'gmail.send', error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });
};
