import { Router, Request, Response } from "express";
const r = Router();
r.get("/actions/calendar/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, service: "calendar" });
});
r.post("/actions/calendar/echo", (req: Request, res: Response) => {
  res.status(200).json({ ok: true, input: req.body ?? null });
});
export default r;
