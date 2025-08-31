import { Request, Response } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../../google';

type Slot = { start: string; end: string };

function iso(d: Date) { return d.toISOString(); }

export async function calendarAvailabilityHandler(req: Request, res: Response) {
  try {
    const { email, start, end, durationMin } = req.body || {};
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    const dur = parseInt(String(durationMin || '30'), 10) || 30;
    if (!email || !s || !e || e <= s) return res.status(400).json({ ok: false, error: 'Missing/invalid email/start/end' });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || '';
    const ic = await impersonatedClient(user, ['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth: ic.auth });
    const fb = await calendar.freebusy.query({ requestBody: { timeMin: iso(s), timeMax: iso(e), items: [{ id: String(email) }] } as any });
    const busy = (fb.data as any)?.calendars?.[email]?.busy || [];
    let cursor = s.getTime();
    const endMs = e.getTime();
    const busyMs = busy.map((b: any) => ({ s: new Date(b.start as string).getTime(), e: new Date(b.end as string).getTime() }));
    const slots: Slot[] = [];
    while (cursor + dur * 60000 <= endMs) {
      const slotEnd = cursor + dur * 60000;
      const overlaps = busyMs.some(b => !(slotEnd <= b.s || cursor >= b.e));
      if (!overlaps) slots.push({ start: new Date(cursor).toISOString(), end: new Date(slotEnd).toISOString() });
      cursor += dur * 60000;
    }
    return res.json({ ok: true, email, start: iso(s), end: iso(e), durationMin: dur, slots });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'calendar.availability', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'calendar.availability failed', details: gerr || undefined });
  }
}

