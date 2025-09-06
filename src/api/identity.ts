import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";

const router = Router();

// In memoria: identità corrente (in deploy reale useresti Redis/DB o Firestore)
let currentUser: { name: string; email?: string; role?: string; session_token?: string } | null = null;

// Parola magica letta da env
const MAGIC = process.env.AMBARADAM_MAGIC_WORD || "BaliZero2025";

// Secret per firmare il token
const SECRET = process.env.AMBARADAM_BOOTSTRAP_TOKEN || "secret-fallback";

// Helper: genera token JWT valido 12h
function generateSessionToken(userId: string) {
  return jwt.sign(
    { userId, role: userId === "Boss" ? "boss" : "user" },
    SECRET,
    { expiresIn: "12h" }
  );
}

// POST /identity/login
router.post("/identity/login", (req: Request, res: Response) => {
  const { name, magicWord } = req.body || {};
  if (!name || !magicWord) {
    return res
      .status(400)
      .json({ ok: false, error: "missing_name_or_word" });
  }
  if (magicWord !== MAGIC) {
    return res
      .status(401)
      .json({ ok: false, error: "unauthorized" });
  }

  // Genera session token
  const session_token = generateSessionToken(String(name));

  // Imposta utente corrente
  currentUser = { name: String(name), role: name === "Boss" ? "boss" : "user", session_token };

  return res.json({
    ok: true,
    userId: currentUser.name,
    session_token,
  });
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
        session_token: currentUser.session_token || null,
        defaults: {
          folderId: process.env.MEMORY_DRIVE_FOLDER_ID || null,
          calendarId: process.env.BALI_ZERO_CALENDAR_ID || null,
        },
      },
    });
  }

  // Fallback: usa header/query come nella tua versione originale
  const email =
    (req.header("x-user-email") || req.query.email || "").toString();
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
export function requireIdentity(
  req: Request,
  res: Response,
  next: Function
) {
  if (!currentUser || !currentUser.session_token) {
    return res
      .status(401)
      .json({ ok: false, error: "AMBARADAM authentication required" });
  }
  next();
}

export default router;
