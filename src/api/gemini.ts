import express, { Request, Response } from "express";
import { geminiService } from "../services/geminiService";

const router = express.Router();

/**
 * Endpoint POST /api/gemini/generate
 * Body: { prompt: string }
 * Returns: { text: string, error?: string }
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ 
        error: "Missing required field: prompt" 
      });
    }

    const response = await geminiService.generateContent(prompt);
    
    if (response.error) {
      return res.status(500).json({
        error: response.error
      });
    }

    res.json({
      text: response.text,
      model: "gemini-pro"
    });

  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  }
});

/**
 * Endpoint GET /api/gemini/status
 * Returns service availability status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const isAvailable = await geminiService.isAvailable();
    
    res.json({
      available: isAvailable,
      model: "gemini-pro",
      service: "Google Gemini AI"
    });
    
  } catch (error) {
    console.error("Gemini status check error:", error);
    res.status(500).json({
      available: false,
      error: "Service check failed"
    });
  }
});

export default router;