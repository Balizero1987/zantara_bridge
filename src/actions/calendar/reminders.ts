import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function calendarRemindersHandler(req: Request, res: Response) {
  try {
    const { calendarId, eventId, minutesBefore, method } = req.body || {};
    if (!calendarId || !eventId || !minutesBefore) return res.status(400).json({ ok: false, error: 'Missing calendarId/eventId/minutesBefore' });
    const m = String(method || 'popup');
    const minutes = parseInt(String(minutesBefore), 10);
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    const { data } = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: { reminders: { useDefault: false, overrides: [{ method: m, minutes }] } } as any,
    } as any);
    (req as any).log?.info?.({ action: 'calendar.reminders', calendarId, eventId, method: m, minutes });
    return res.json({ ok: true, id: data.id, reminders: (data as any)?.reminders });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'calendar.reminders', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'calendar.reminders failed', details: gerr || undefined });
  }
}

