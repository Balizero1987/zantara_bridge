import { Router } from "express";
import { startConversation } from "../core/conversationFlow";
import { continueConversation } from "../core/continueConversation";

const router = Router();

/**
 * Avvia una nuova conversazione
 * POST /api/conversations/start
 * Body: { userName: string, message: string }
 */
router.post("/start", async (req, res) => {
  try {
    const { userName, message } = req.body;

    if (!userName || !message) {
      return res.status(400).json({ ok: false, error: "Missing userName or message" });
    }

    const reply = await startConversation(userName, message);
    return res.json({ ok: true, reply });
  } catch (err: any) {
    console.error("❌ Errore startConversation:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Continua una conversazione esistente
 * POST /api/conversations/continue
 * Body: { userName: string, message: string }
 */
router.post("/continue", async (req, res) => {
  try {
    const { userName, message } = req.body;

    if (!userName || !message) {
      return res.status(400).json({ ok: false, error: "Missing userName or message" });
    }

    const reply = await continueConversation(userName, message);
    return res.json({ ok: true, reply });
  } catch (err: any) {
    console.error("❌ Errore continueConversation:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;