import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function emailLabelsHandler(req: Request, res: Response) {
  try {
    const { mode, labelName, color } = req.body || {};
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/gmail.settings.basic']);
    const gmail = google.gmail({ version: 'v1', auth: ic.auth });
    if (mode === 'create') {
      if (!labelName) return res.status(400).json({ ok: false, error: 'Missing labelName' });
      const requestBody: any = { name: String(labelName) };
      if (color) requestBody.color = color;
      const { data } = await gmail.users.labels.create({ userId: 'me', requestBody });
      return res.json({ ok: true, label: data });
    }
    // default: list
    const { data } = await gmail.users.labels.list({ userId: 'me' });
    return res.json({ ok: true, labels: data.labels || [] });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    return res.status(status).json({ ok: false, error: e?.message || 'email.labels failed' });
  }
}

