import { Router, Request, Response } from "express";

const router = Router();

// POST /actions/memory/save
router.post("/save", async (req: Request, res: Response) => {
  // placeholder: qui andrà l’integrazione con Drive/Firestore
  return res.json({ ok: true, data: { driveLink: "mock://drive/link" } });
});

// GET /actions/memory/search
router.get("/search", async (req: Request, res: Response) => {
  // placeholder: qui andrà la query su Firestore
  return res.json({ ok: true, data: { items: [] } });
});

export default router;
