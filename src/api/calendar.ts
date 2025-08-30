import { Request, Response, Express } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { requireApiKey } from '../middleware/auth';
import { createCalendarEventHandler } from '../actions/calendar/create';
import { listCalendarEventsHandler } from '../actions/calendar/list';

function logCalendarAction(action: string, details: any) {
  console.log(`[CALENDAR] ${action}`, JSON.stringify(details));
}

export const calendarRoutes = (app: Express) => {
  app.post('/actions/calendar/create', requireApiKey, createCalendarEventHandler);

  // Leggi evento per verifica post-creazione
  app.get('/actions/calendar/get', requireApiKey, async (req: Request, res: Response) => {
    try {
      const calendarId = (req.query.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
      if (!calendarId) {
        (req as any).log?.warn?.({ module: 'calendar.get', phase: 'input', error: 'Missing calendarId and BALI_ZERO_CALENDAR_ID' });
        return res.status(400).json({ ok: false, error: 'Missing calendarId and BALI_ZERO_CALENDAR_ID' });
      }
      const eventId = (req.query.eventId as string) || '';
      if (!eventId) {
        (req as any).log?.warn?.({ module: 'calendar.get', phase: 'input', calendarId, error: 'Missing eventId' });
        return res.status(400).json({ ok: false, error: 'Missing eventId' });
      }
      const user = process.env.IMPERSONATE_USER || '';
      const tokenScopes = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar'];
      (req as any).log?.info?.({ module: 'calendar.get', phase: 'start', calendarId, eventId, subject: user || null, tokenScopes });
      const ic = await impersonatedClient(user, tokenScopes);
      const calendar = google.calendar({ version: 'v3', auth: ic.auth });
      const { data } = await calendar.events.get({ calendarId, eventId });
      (req as any).log?.info?.({
        module: 'calendar.get',
        calendarId,
        eventId,
        status: 200,
        tokenScopes,
        organizer: (data as any)?.organizer?.email || null,
        eventStatus: (data as any)?.status || null,
        summary: (data as any)?.summary || null,
      });
      res.json({ ok: true, action: 'calendar.get', event: data });
    } catch (e: any) {
      const status = e?.response?.status || 500;
      const errPayload = e?.response?.data || null;
      (req as any).log?.warn?.({
        module: 'calendar.get',
        phase: 'error',
        calendarId: (req.query.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID || null,
        eventId: (req.query.eventId as string) || null,
        status,
        error: e?.message,
        tokenScopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar'],
        error_payload: errPayload,
      });
      res.status(500).json({ ok: false, error: e?.message || 'calendar.get failed' });
    }
  });

  // List upcoming events with optional overrides
  app.get('/actions/calendar/list', requireApiKey, listCalendarEventsHandler);
};
