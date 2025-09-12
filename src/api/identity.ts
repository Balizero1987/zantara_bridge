import { Router, Request, Response } from "express";
import crypto from "crypto";

const router = Router();

// In memoria: identità corrente (in deploy reale useresti Redis/DB o Firestore)
let currentUser: { name: string; email?: string; role?: string; token?: string } | null = null;

// Parola magica letta da env
const MAGIC = process.env.AMBARADAM_MAGIC_WORD || "BaliZero2025";

// POST /identity/login
router.post("/identity/login", (req: Request, res: Response) => {
  const { name, magicWord } = req.body || {};
  if (!name || !magicWord) {
    return res.status(400).json({ ok: false, error: "missing_name_or_word" });
  }
  if (magicWord !== MAGIC) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  // Genera un token random (in prod potresti usare JWT)
  const token = crypto.randomBytes(16).toString("hex");

  // Imposta utente corrente con token
  currentUser = { name: String(name), token };
  return res.json({ ok: true, userId: currentUser.name, token });
});

// GET /identity/me
router.get("/identity/me", (req: Request, res: Response) => {
  // Prima controlla se autenticato via login
  if (currentUser) {
    return res.json({
      ok: true,
      data: {
        name: currentUser.name,
        email: currentUser.email || null,
        role: currentUser.role || "user",
        defaults: {
          folderId: process.env.MEMORY_DRIVE_FOLDER_ID || null,
          calendarId: process.env.BALI_ZERO_CALENDAR_ID || null,
        },
        token: currentUser.token,
      },
    });
  }

  // Fallback: usa header/query come nella tua versione originale
  const email = (req.header("x-user-email") || req.query.email || "").toString();
  const role = email === "zero@balizero.com" ? "boss" : "user";

  return res.json({
    ok: true,
    data: {
      email,
      role,
      defaults: {
        folderId: process.env.MEMORY_DRIVE_FOLDER_ID || null,
        calendarId: process.env.BALI_ZERO_CALENDAR_ID || null,
      },
    },
  });
});

// Middleware: blocca se non loggato
export function requireIdentity(req: Request, res: Response, next: Function) {
  const auth = req.header("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!currentUser || !auth || currentUser.token !== auth) {
    return res.status(401).json({ ok: false, error: "AMBARADAM authentication required" });
  }
  next();
}

export default router;

// Accessor used by routes to infer defaults (e.g., Drive folder)
export function getCurrentUser() {
  return currentUser;
}
