import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function deleteCalendarEventHandler(req: Request, res: Response) {
  try {
    const { eventId } = req.body || {};
    const calendarId = (req.body?.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
    if (!calendarId || !eventId) return res.status(400).json({ ok: false, error: 'Missing calendarId/eventId' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    await calendar.events.delete({ calendarId, eventId } as any);
    (req as any).log?.info?.({ action: 'calendar.delete', calendarId, eventId });
    return res.json({ ok: true });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'calendar.delete', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'calendar.delete failed', details: gerr || undefined });
  }
}

