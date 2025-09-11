import type { Router, Request, Response } from 'express';
import { openai, DEFAULT_MODEL } from '../../core/openai';
import { buildMessages } from '../../core/promptBuilder';
import { storeConversationContext } from '../../core/contextualMemory';
import { updateLearningMetrics } from '../../core/learningEngine';
import { saveChatMessageToDrive, writeBossLog } from '../../lib/driveSave';

export default function registerChat(r: Router) {
  r.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const owner = (req as any).canonicalOwner || 'BOSS';
      const { message = '', ririMode = false, sessionId } = req.body || {};

      if (!message.trim()) {
        return res.status(400).json({ error: 'message required' });
      }

      // Costruisci il contesto della conversazione
      const messages = await buildMessages(owner, message, !!ririMode);

      // Chiamata al modello OpenAI
      const out = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
      });
      const text: string = out.choices?.[0]?.message?.content || '';
      const responseTime = Date.now() - startTime;

      // Persisti contesto conversazione e metriche
      // storeConversationContext si aspetta un numero → usiamo la lunghezza del testo
      await storeConversationContext(owner, sessionId, message, text.length);

      // updateLearningMetrics idem → passiamo numero, non stringa
      await updateLearningMetrics(owner, message, text.length);

      // Auto-save su Drive (best effort, non blocca la risposta)
      try {
        saveChatMessageToDrive({
          chatId: sessionId || String(Date.now()),
          author: owner,
          text,
          title: 'Chat Zantara',
        })
          .then((r) => {
            (req as any).log?.info?.({
              action: 'drive.autosave.ok',
              fileId: r.id,
              link: r.webViewLink,
            });
          })
          .catch((e) => {
            (req as any).log?.warn?.({
              action: 'drive.autosave.err',
              error: e?.message,
            });
          });

        // Boss logs automatici
        if (owner === 'BOSS') {
          const snippet = text.length > 200 ? text.slice(0, 200) + '…' : text;
          writeBossLog(`chat ${sessionId || 'no-session'}: ${snippet}`).catch(() => {/* ignore */});
        }
      } catch (e: any) {
        (req as any).log?.warn?.({
          action: 'drive.autosave.catch',
          error: e?.message,
        });
      }

      // Risposta all’utente
      return res.json({
        ok: true,
        text,
        responseTime,
      });
    } catch (e: any) {
      return res.status(500).json({
        ok: false,
        error: e?.message || 'chat failed',
      });
    }
  });
}
