import { Router, Request, Response } from "express";

const router = Router();

// POST /actions/gmail/send
router.post("/send", async (req: Request, res: Response) => {
  // placeholder: qui andrà l’integrazione Gmail reale
  return res.json({ ok: true, data: { messageId: "mock-123" } });
});

export default router;
