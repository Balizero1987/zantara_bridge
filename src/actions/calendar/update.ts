import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

function normalizeAttendees(input?: string[] | string): { email: string }[] | undefined {
  if (!input) return undefined;
  const toArray = Array.isArray(input) ? input : String(input).split(',').map(s => s.trim()).filter(Boolean);
  const unique = Array.from(new Set(toArray.map(s => s.toLowerCase())));
  return unique.map(email => ({ email }));
}

export async function updateCalendarEventHandler(req: Request, res: Response) {
  try {
    const { eventId } = req.body || {};
    const calendarId = (req.body?.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
    if (!calendarId || !eventId) return res.status(400).json({ ok: false, error: 'Missing calendarId/eventId' });
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });

    const { title, start, end, attendees, description } = req.body || {};
    const requestBody: any = {};
    if (title) requestBody.summary = String(title);
    if (description) requestBody.description = String(description);
    if (start) requestBody.start = { dateTime: String(start) };
    if (end) requestBody.end = { dateTime: String(end) };
    const atts = normalizeAttendees(attendees);
    if (atts) requestBody.attendees = atts;

    const { data } = await calendar.events.patch({ calendarId, eventId, requestBody } as any);
    (req as any).log?.info?.({ action: 'calendar.update', calendarId, eventId, status: data.status });
    return res.json({ id: data.id, status: data.status, htmlLink: data.htmlLink });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'calendar.update', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'calendar.update failed', details: gerr || undefined });
  }
}

