import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

type CreateBody = {
  calendarId?: string;
  title: string;
  start: string;
  end: string;
  attendees?: string[] | string;
  description?: string;
};

function normalizeAttendees(input?: string[] | string): { email: string }[] | undefined {
  if (!input) return undefined;
  const toArray = Array.isArray(input)
    ? input
    : String(input)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
  if (!toArray.length) return undefined;
  const unique = Array.from(new Set(toArray.map(s => s.toLowerCase())));
  return unique.map(email => ({ email }));
}

export async function createCalendarEventHandler(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as Partial<CreateBody>;
    const calendarId = body.calendarId || process.env.BALI_ZERO_CALENDAR_ID;
    if (!calendarId) {
      return res.status(400).json({ ok: false, error: 'Missing calendarId and BALI_ZERO_CALENDAR_ID' });
    }

    const title = (body.title || '').toString().trim();
    const start = (body.start || '').toString().trim();
    const end = (body.end || '').toString().trim();
    if (!title || !start || !end) {
      return res.status(400).json({ ok: false, error: 'Missing required fields: title, start, end' });
    }

    const attendees = normalizeAttendees(body.attendees);
    const description = (body.description || '').toString() || undefined;

    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });

    const insertRes = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: title,
        description,
        start: { dateTime: start },
        end: { dateTime: end },
        attendees,
        reminders: { useDefault: true },
      },
      sendUpdates: 'none',
    } as any);

    const data: any = insertRes.data || {};
    const payload = {
      id: data.id as string | undefined,
      status: (data.status as string | undefined) || undefined,
      htmlLink: (data.htmlLink as string | undefined) || undefined,
    };
    (req as any).log?.info?.({ action: 'calendar.create', calendarId, title, status: payload.status, eventId: payload.id, htmlLink: payload.htmlLink });
    return res.json(payload);
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'calendar.create', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'calendar.create failed', details: gerr || undefined });
  }
}
