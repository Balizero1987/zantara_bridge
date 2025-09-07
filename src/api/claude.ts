import express, { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

// Inizializza il client Claude con la chiave salvata in Secret Manager
const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

/**
 * Endpoint POST /api/claude/ask
 * Body: { prompt: string, max_tokens?: number }
 * Ritorna: { reply: string }
 */
router.post("/ask", async (req: Request, res: Response) => {
  try {
    const { prompt, max_tokens = 500 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt in body" });
    }

    const response = await client.messages.create({
      model: "claude-3-sonnet-20240229", // modello Claude Sonnet
      max_tokens,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Estrae la risposta testuale dal payload
    const text = response.content[0].text;

    return res.json({
      reply: text,
      model: response.model,
      usage: response.usage,
    });
  } catch (err: any) {
    console.error("Claude error:", err);
    return res.status(500).json({
      error: err.message || "Unknown error",
    });
  }
});

export default router;
