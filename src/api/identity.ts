import { Router, Request, Response } from 'express';
const router = Router();
router.get('/identity/me', (req:Request,res:Response)=>{
  const email = (req.header('x-user-email') || req.query.email || '').toString();
  const role = email==='zero@balizero.com' ? 'boss' : 'user';
  res.json({ ok:true, data:{ email, role, defaults:{ folderId: process.env.MEMORY_DRIVE_FOLDER_ID||null, calendarId: process.env.BALI_ZERO_CALENDAR_ID||null } } });
});
export default router;
