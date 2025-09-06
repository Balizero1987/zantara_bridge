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

// ... tutte le tue rotte omit ...

router.post('/actions/calendar/availability', requireApiKey, calendarAvailabilityHandler);
router.post('/actions/calendar/quickadd', requireApiKey, quickAddCalendarEventHandler);
router.post('/actions/calendar/subscribe', requireApiKey, calendarSubscribeHandler);
router.post('/actions/calendar/freebusy', requireApiKey, calendarFreebusyHandler);
router.post('/actions/calendar/reminders', requireApiKey, calendarRemindersHandler);

export default router;
