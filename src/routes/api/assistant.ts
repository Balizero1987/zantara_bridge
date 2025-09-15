import type { Router, Request, Response } from 'express';
import { client } from '../../core/openai';

export default function registerAssistant(r: Router) {
  
  /**
   * GET /api/assistant/status
   * Get assistant status and info  
   */
  r.get('/api/assistant/status', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        status: {
          initialized: true,
          compliance_docs: {
            kitas: true,
            pt_pma: true,
            tax: true
          },
          model: "gpt-4o-mini",
          ready: true
        }
      });
      
    } catch (error: any) {
      console.error('Failed to get assistant status:', error);
      res.status(500).json({ 
        error: 'Failed to get assistant status',
        details: error.message || 'Unknown error'
      });
    }
  });

  /**
   * GET /api/assistant/status (simplified)
   */
  r.get('/status', async (_req: Request, res: Response) => {
    res.json({
      ok: true,
      services: ["KITAS", "PT PMA", "Tax"],
      message: "Assistant ready"
    });
  });

  /**
   * POST /api/assistant/ask
   * Endpoint semplificato per domande dirette
   */
  r.post('/ask', async (req: Request, res: Response) => {
    const { question, userId } = req.body;

    if (!question) {
      return res.status(400).json({ ok: false, error: "Missing question" });
    }

    try {
      // Create a simple chat completion for immediate testing
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are ZANTARA, an AI assistant specialized in Indonesian compliance matters including KITAS, PT PMA, and Tax regulations. Provide helpful and accurate information in Italian or English as needed."
          },
          {
            role: "user", 
            content: question
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });
      
      const answer = completion.choices[0]?.message?.content || 'No response generated';
      
      res.json({
        ok: true,
        question,
        answer,
        model: "gpt-4o-mini",
        userId: userId || 'anonymous'
      });
      
    } catch (error: any) {
      console.error('Assistant ask failed:', error);
      
      // Fallback response if OpenAI fails
      const fakeAnswer = `ZANTARA Assistant temporary response for: "${question}" (user: ${userId || "anonymous"})`;
      
      res.json({
        ok: true,
        question,
        answer: fakeAnswer,
        fallback: true,
        error: error.message
      });
    }
  });

  /**
   * POST /api/assistant/compliance/ask
   * Quick compliance query endpoint
   */
  r.post('/compliance/ask', async (req: Request, res: Response) => {
    const { question, userId, language = 'en' } = req.body;

    if (!question || !userId) {
      return res.status(400).json({ 
        error: 'question and userId are required' 
      });
    }

    try {
      const systemPrompt = language === 'it' 
        ? "Sei ZANTARA, un assistente AI specializzato in compliance indonesiana (KITAS, PT PMA, tasse). Rispondi in italiano."
        : "You are ZANTARA, an AI assistant specialized in Indonesian compliance (KITAS, PT PMA, Tax). Respond in English.";

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: question
          }
        ],
        max_tokens: 600,
        temperature: 0.7
      });
      
      const answer = completion.choices[0]?.message?.content || 'No response generated';
      
      res.json({
        success: true,
        question,
        answer,
        language,
        model: "gpt-4o-mini"
      });
      
    } catch (error: any) {
      console.error('Failed to process compliance question:', error);
      res.status(500).json({ 
        error: 'Failed to process compliance question',
        details: error.message || 'Unknown error'
      });
    }
  });
}