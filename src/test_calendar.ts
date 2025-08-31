import request = require('supertest');
import express = require('express');
import { calendarRoutes } from './api/calendar';

describe('Calendar endpoints', () => {
  let app: express.Express;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    calendarRoutes(app);
  });

  it('should fail update if missing params', async () => {
    const res = await request(app).post('/actions/calendar/update').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/calendarId|eventId/);
  });

  it('should fail delete if missing params', async () => {
    const res = await request(app).post('/actions/calendar/delete').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/calendarId|eventId/);
  });

  // Integration tests for update/delete would require real Google Calendar setup
});
