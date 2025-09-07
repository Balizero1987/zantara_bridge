import { Router, Request, Response, NextFunction } from 'express';

function lazy(handlerImport: () => Promise<any>, fnName: string) {
  let cached: any;
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      cached = cached || (await handlerImport())[fnName];
      if (typeof cached !== 'function') throw new Error(`handler ${fnName} not found`);
      return cached(req, res, next);
    } catch (e: any) {
      // Non crashare: rispondi 501 ma consegna SEMPRE una callback valida
      return res.status(501).json({ ok: false, error: `Calendar: ${fnName} not installed`, details: e?.message });
    }
  };
}

const router = Router();

// QuickAdd e Create — disponibili / prioritarie
router.post('/quickadd',  lazy(() => import('../actions/calendar/quickadd'),  'quickAddCalendarEventHandler'));
router.post('/create',    lazy(() => import('../actions/calendar/create'),   'calendarCreateHandler'));

// Le altre rotte possono esserci o meno: non farle crashare
router.post('/update',    lazy(() => import('../actions/calendar/update'),   'calendarUpdateHandler'));
router.post('/delete',    lazy(() => import('../actions/calendar/delete'),   'calendarDeleteHandler'));
router.get('/list',       lazy(() => import('../actions/calendar/list'),     'calendarListHandler'));
router.post('/freebusy',  lazy(() => import('../actions/calendar/freebusy'), 'calendarFreebusyHandler'));
router.post('/reminders', lazy(() => import('../actions/calendar/reminders'),'calendarRemindersHandler'));
router.post('/subscribe', lazy(() => import('../actions/calendar/subscribe'),'calendarSubscribeHandler'));

export default router;
