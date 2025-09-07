import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function calendarFreebusyHandler(req: Request, res: Response) {
  try {
    const { calendarIds, start, end } = req.body || {};
    if (!Array.isArray(calendarIds) || !calendarIds.length || !start || !end) {
      return res.status(400).json({ ok: false, error: 'Missing calendarIds/start/end' });
    }
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    const items = calendarIds.map((id: string) => ({ id }));
    const { data } = await calendar.freebusy.query({ requestBody: { timeMin: String(start), timeMax: String(end), items } as any });
    return res.json({ ok: true, result: data });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'calendar.freebusy', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'calendar.freebusy failed', details: gerr || undefined });
  }
}

