import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function quickAddCalendarEventHandler(req: Request, res: Response) {
  try {
    const text = (req.body?.text as string) || '';
    const calendarId = (req.body?.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
    if (!text || !calendarId) return res.status(400).json({ ok: false, error: 'Missing text/calendarId' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    const { data } = await calendar.events.quickAdd({ calendarId, text } as any);
    (req as any).log?.info?.({ action: 'calendar.quickadd', calendarId, id: (data as any)?.id, status: (data as any)?.status });
    return res.json({ id: (data as any)?.id, status: (data as any)?.status, htmlLink: (data as any)?.htmlLink });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'calendar.quickadd', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'calendar.quickadd failed', details: gerr || undefined });
  }
}

