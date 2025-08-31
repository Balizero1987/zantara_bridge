import request = require('supertest');
import express = require('express');
import { calendarRoutes } from './api/calendar';

describe('Calendar integration (real Google Calendar)', () => {
  let app: express.Express;
  let createdEventId: string | null = null;
  const calendarId = process.env.BALI_ZERO_CALENDAR_ID || 'primary';
  beforeAll(() => {
    app = express();
    app.use(express.json());
    calendarRoutes(app);
  });

  it('should create an event', async () => {
    const res = await request(app)
      .post('/actions/calendar/create')
      .send({ calendarId, summary: 'Test Event', attendees: [] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.eventId).toBeDefined();
    createdEventId = res.body.eventId;
  });

  it('should update the event', async () => {
    if (!createdEventId) return;
    const res = await request(app)
      .post('/actions/calendar/update')
      .send({ calendarId, eventId: createdEventId, updates: { summary: 'Updated Event' } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.event.id).toBe(createdEventId);
    expect(res.body.event.summary).toBe('Updated Event');
  });

  it('should get the event', async () => {
    if (!createdEventId) return;
    const res = await request(app)
      .get('/actions/calendar/get')
      .query({ calendarId, eventId: createdEventId });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.event.id).toBe(createdEventId);
  });

  it('should delete the event', async () => {
    if (!createdEventId) return;
    const res = await request(app)
      .post('/actions/calendar/delete')
      .send({ calendarId, eventId: createdEventId });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
