import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function calendarSubscribeHandler(req: Request, res: Response) {
  try {
    const { calendarId, colorId, selected } = req.body || {};
    if (!calendarId) return res.status(400).json({ ok: false, error: 'Missing calendarId' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    const requestBody: any = { id: String(calendarId) };
    if (colorId) requestBody.colorId = String(colorId);
    if (typeof selected !== 'undefined') requestBody.selected = !!selected;
    const { data } = await calendar.calendarList.insert({ requestBody } as any);
    (req as any).log?.info?.({ action: 'calendar.subscribe', calendarId, resultId: data.id });
    return res.json({ ok: true, calendarListEntry: data });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'calendar.subscribe', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'calendar.subscribe failed', details: gerr || undefined });
  }
}

