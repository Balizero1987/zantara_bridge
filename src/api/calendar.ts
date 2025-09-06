// src/api/calendar.ts

import calendarAvailabilityHandler from '../actions/calendar/availability';
import { Request, Response, Router } from 'express';
import { google } from 'googleapis';
import { impersonatedClient } from '../google';
import { requireAuth as requireApiKey } from '../middleware/auth';
import { quickAddCalendarEventHandler } from '../actions/calendar/quickadd';
import { calendarSubscribeHandler } from '../actions/calendar/subscribe';
import { calendarFreebusyHandler } from '../actions/calendar/freebusy';
import { calendarRemindersHandler } from '../actions/calendar/reminders';

const router = Router();

/**
 * Backup all events from a calendar to JSON
 */
router.get('/actions/calendar/backup', requireApiKey, async (req: Request, res: Response) => {
  // ... codice esistente ...
});

/**
 * Restore events from JSON array
 */
router.post('/actions/calendar/restore', requireApiKey, async (req: Request, res: Response) => {
  // ... codice esistente ...
});

/**
 * Create event
 */
router.post('/actions/calendar/create', requireApiKey, async (req: Request, res: Response) => {
  // ... codice esistente ...
});

/**
 * Get event
 */
router.get('/actions/calendar/get', requireApiKey, async (req: Request, res: Response) => {
  // ... codice esistente ...
});

/**
 * List events for a given day (UTC)
 */
router.get('/actions/calendar/list', requireApiKey, async (req: Request, res: Response) => {
  // ... codice esistente ...
});

/**
 * Update event
 */
router.post('/actions/calendar/update', requireApiKey, async (req: Request, res: Response) => {
  // ... codice esistente ...
});

/**
 * Delete event
 */
router.post('/actions/calendar/delete', requireApiKey, async (req: Request, res: Response) => {
  // ... codice esistente ...
});

/** Quick add & other actions */
router.post('/actions/calendar/quickadd', requireApiKey, quickAddCalendarEventHandler);
router.post('/actions/calendar/availability', requireApiKey, calendarAvailabilityHandler);
router.post('/actions/calendar/subscribe', requireApiKey, calendarSubscribeHandler);
router.post('/actions/calendar/freebusy', requireApiKey, calendarFreebusyHandler);
router.post('/actions/calendar/reminders', requireApiKey, calendarRemindersHandler);

export default router;
