import { Request, Response, Router } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { requireAuth as requireApiKey } from '../middleware/auth';
import { quickAddCalendarEventHandler } from '../actions/calendar/quickadd';
import { calendarAvailabilityHandler } from '../actions/calendar/availability';
import { calendarSubscribeHandler } from '../actions/calendar/subscribe';
import { calendarFreebusyHandler } from '../actions/calendar/freebusy';
import { calendarRemindersHandler } from '../actions/calendar/reminders';

const router = Router();

/**
 * Backup all events from a calendar to JSON
 */
router.get('/actions/calendar/backup', requireApiKey, async (req: Request, res: Response) => {
  try {
    const calendarId = (req.query.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
    if (!calendarId) return res.status(400).json({ ok: false, error: 'Missing calendarId and BALI_ZERO_CALENDAR_ID' });
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar',
    ]);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    let events: any[] = [];
    let pageToken: string | undefined = undefined;
    do {
      const { data } = await calendar.events.list({
        calendarId,
        maxResults: 2500,
        pageToken,
        singleEvents: true,
      });
      events = events.concat(data.items || []);
      pageToken = data.nextPageToken as string | undefined;
    } while (pageToken);
    res.json({ ok: true, calendarId, count: events.length, events });
  } catch (e: any) {
    (req as any).log?.error?.({ module: 'calendar.backup', error: e.message });
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * Restore events from JSON array
 */
router.post('/actions/calendar/restore', requireApiKey, async (req: Request, res: Response) => {
  try {
    const calendarId = (req.body?.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
    const events = req.body?.events;
    if (!calendarId || !Array.isArray(events)) {
      (req as any).log?.warn?.({ module: 'calendar.restore', error: 'Missing calendarId or events' });
      return res.status(400).json({ ok: false, error: 'Missing calendarId or events' });
    }
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    let success = 0,
      failed = 0,
      errors: any[] = [];
    for (const ev of events) {
      try {
        await calendar.events.insert({ calendarId, requestBody: ev });
        success++;
      } catch (err: any) {
        failed++;
        errors.push({ event: ev?.id || null, error: err.message });
      }
    }
    (req as any).log?.info?.({ module: 'calendar.restore', calendarId, success, failed });
    res.json({ ok: true, calendarId, success, failed, errors });
  } catch (e: any) {
    (req as any).log?.error?.({ module: 'calendar.restore', error: e.message });
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * Create event
 */
router.post('/actions/calendar/create', requireApiKey, async (req: Request, res: Response) => {
  try {
    const calendarId = (req.body?.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
    if (!calendarId) {
      return res.status(400).json({ ok: false, error: 'Missing calendarId and BALI_ZERO_CALENDAR_ID' });
    }
    const now = new Date();
    const startIso = (req.body?.start as string) || now.toISOString();
    const endIso = (req.body?.end as string) || new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const summary = (req.body?.summary as string) || 'Zantara SmokeTest';
    const attendees = (req.body?.attendees as string[]) || ['zero@balizero.com'];
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    const insertRes = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
        attendees: attendees.map((email) => ({ email })),
        reminders: { useDefault: true },
      },
      sendUpdates: 'none',
    });
    const data = insertRes.data as any;
    const status = (data?.status || '').toLowerCase();
    const logEntry = {
      module: 'calendar.create',
      phase: 'resp',
      calendarId,
      id: data?.id,
      organizer: data?.organizer?.email || null,
      status: data?.status || null,
      summary: data?.summary || summary,
      htmlLink: data?.htmlLink || null,
    };
    if (status && status !== 'confirmed') {
      (req as any).log?.warn?.(logEntry);
    } else {
      (req as any).log?.info?.(logEntry);
    }
    res.json({
      ok: true,
      action: 'calendar.create',
      eventId: data?.id,
      htmlLink: data?.htmlLink,
      calendarId,
      organizer: data?.organizer?.email || null,
      status: data?.status || null,
      summary: data?.summary || summary,
    });
  } catch (e: any) {
    (req as any).log?.error?.({ module: 'calendar.create', error: e.message });
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * Get event
 */
router.get('/actions/calendar/get', requireApiKey, async (req: Request, res: Response) => {
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

/**
 * List events for a given day (UTC)
 */
router.get('/actions/calendar/list', requireApiKey, async (req: Request, res: Response) => {
  try {
    const calendarId = (req.query.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
    if (!calendarId) return res.status(400).json({ ok: false, error: 'Missing calendarId and BALI_ZERO_CALENDAR_ID' });
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const timeMin = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59.999Z`).toISOString();

    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar',
    ]);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    const { data } = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });
    const items = (data.items || []).map((ev) => ({
      id: ev.id,
      summary: ev.summary,
      organizer: (ev as any)?.organizer?.email || null,
      status: ev.status,
      start: ev.start?.dateTime || ev.start?.date || null,
      end: ev.end?.dateTime || ev.end?.date || null,
      htmlLink: ev.htmlLink,
    }));
    (req as any).log?.info?.({ module: 'calendar.list', calendarId, date: dateStr, count: items.length });
    res.json({ ok: true, action: 'calendar.list', calendarId, date: dateStr, events: items });
  } catch (e: any) {
    (req as any).log?.error?.({ module: 'calendar.list', error: e.message });
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * Update event
 */
router.post('/actions/calendar/update', requireApiKey, async (req: Request, res: Response) => {
  try {
    const calendarId = (req.body?.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
    const eventId = (req.body?.eventId as string) || '';
    if (!calendarId || !eventId) {
      (req as any).log?.warn?.({ module: 'calendar.update', phase: 'input', error: 'Missing calendarId or eventId' });
      return res.status(400).json({ ok: false, error: 'Missing calendarId or eventId' });
    }
    const updates = req.body?.updates || {};
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    const updateRes = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: updates,
    });
    const data = updateRes.data;
    (req as any).log?.info?.({ module: 'calendar.update', calendarId, eventId, updates, status: (data as any)?.status || null });
    res.json({ ok: true, action: 'calendar.update', event: data });
  } catch (e: any) {
    (req as any).log?.error?.({ module: 'calendar.update', error: e.message });
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * Delete event
 */
router.post('/actions/calendar/delete', requireApiKey, async (req: Request, res: Response) => {
  try {
    const calendarId = (req.body?.calendarId as string) || process.env.BALI_ZERO_CALENDAR_ID;
    const eventId = (req.body?.eventId as string) || '';
    if (!calendarId || !eventId) {
      (req as any).log?.warn?.({ module: 'calendar.delete', phase: 'input', error: 'Missing calendarId or eventId' });
      return res.status(400).json({ ok: false, error: 'Missing calendarId or eventId' });
    }
    const user = process.env.IMPERSONATE_USER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    await calendar.events.delete({ calendarId, eventId });
    (req as any).log?.info?.({ module: 'calendar.delete', calendarId, eventId, status: 'deleted' });
    res.json({ ok: true, action: 'calendar.delete', eventId });
  } catch (e: any) {
    (req as any).log?.error?.({ module: 'calendar.delete', error: e.message });
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** Quick add & other actions */
router.post('/actions/calendar/quickadd', requireApiKey, quickAddCalendarEventHandler);
router.post('/actions/calendar/availability', requireApiKey, calendarAvailabilityHandler);
router.post('/actions/calendar/subscribe', requireApiKey, calendarSubscribeHandler);
router.post('/actions/calendar/freebusy', requireApiKey, calendarFreebusyHandler);
router.post('/actions/calendar/reminders', requireApiKey, calendarRemindersHandler);

export default router;
