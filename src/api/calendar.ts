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

// Qui andrebbero inserite tutte le altre route esistenti:
// Esempio:
// router.post('/actions/calendar/create', requireApiKey, createCalendarEventHandler);
// router.get('/actions/calendar/list', requireApiKey, listCalendarEventsHandler);
// router.post('/actions/calendar/update', requireApiKey, updateCalendarEventHandler);
// router.post('/actions/calendar/delete', requireApiKey, deleteCalendarEventHandler);
// ...

// Quick add & other actions
router.post('/actions/calendar/availability', requireApiKey, calendarAvailabilityHandler);
router.post('/actions/calendar/quickadd', requireApiKey, quickAddCalendarEventHandler);
router.post('/actions/calendar/subscribe', requireApiKey, calendarSubscribeHandler);
router.post('/actions/calendar/freebusy', requireApiKey, calendarFreebusyHandler);
router.post('/actions/calendar/reminders', requireApiKey, calendarRemindersHandler);

export default router;
