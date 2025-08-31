import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

export async function listCalendarEventsHandler(req: Request, res: Response) {
  try {
    const calendarId = (req.query.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
    if (!calendarId) return res.status(400).json({ ok: false, error: 'Missing calendarId and BALI_ZERO_CALENDAR_ID' });

    const timeMin = (req.query.timeMin as string) || new Date().toISOString();
    const maxResults = Math.max(1, Math.min(parseInt(String(req.query.maxResults || '10'), 10) || 10, 100));

    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });

    const { data } = await calendar.events.list({
      calendarId,
      timeMin,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    } as any);

    const events = (data.items || []).map((ev: any) => ({
      id: ev.id,
      summary: ev.summary,
      start: ev.start?.dateTime || ev.start?.date || null,
      end: ev.end?.dateTime || ev.end?.date || null,
      location: ev.location || null,
      attendees: Array.isArray(ev.attendees) ? ev.attendees.map((a: any) => ({ email: a.email, responseStatus: a.responseStatus })) : undefined,
      htmlLink: ev.htmlLink,
    }));

    (req as any).log?.info?.({ action: 'calendar.list', calendarId, timeMin, maxResults, count: events.length });
    return res.json({ ok: true, events });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'calendar.list', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'calendar.list failed', details: gerr || undefined });
  }
}

