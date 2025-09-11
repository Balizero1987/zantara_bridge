import type { Router, Request, Response } from 'express';
import { openai, DEFAULT_MODEL } from '../../core/openai';
import { buildMessages } from '../../core/promptBuilder';
import { storeConversationContext } from '../../core/contextualMemory';
import { updateLearningMetrics } from '../../core/learningEngine';
import { saveChatMessageToDrive, writeBossLog, saveNote, createBrief } from '../../lib/driveSave';

export default function registerChat(r: Router) {
  r.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const owner = (req as any).canonicalOwner || 'BOSS';
      const { message = '', ririMode = false, sessionId, saveAs = 'chat', title } = req.body || {};

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

      // Salvataggi unificati (best effort, non blocca la risposta)
      try {
        const kind = String(saveAs || 'chat').toLowerCase();
        let saved: any = null;
        if (kind === 'note') {
          saveNote(owner, text, title)
            .then((r) => { saved = r; (req as any).log?.info?.({ action: 'drive.note.ok', fileId: r.id }); })
            .catch((e) => { (req as any).log?.warn?.({ action: 'drive.note.err', error: e?.message }); });
        } else if (kind === 'brief') {
          createBrief(owner, text, title)
            .then((r) => { saved = r; (req as any).log?.info?.({ action: 'drive.brief.ok', fileId: r.id, link: r.webViewLink }); })
            .catch((e) => { (req as any).log?.warn?.({ action: 'drive.brief.err', error: e?.message }); });
        } else {
          saveChatMessageToDrive({
            chatId: sessionId || String(Date.now()),
            author: owner,
            text,
            title: title || 'Chat Zantara',
          })
            .then((r) => { saved = r; (req as any).log?.info?.({ action: 'drive.chat.ok', fileId: r.id, link: r.webViewLink }); })
            .catch((e) => { (req as any).log?.warn?.({ action: 'drive.chat.err', error: e?.message }); });
        }

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
      return res.json({ ok: true, text, responseTime, savedAs: String(saveAs || 'chat') });
    } catch (e: any) {
      return res.status(500).json({
        ok: false,
        error: e?.message || 'chat failed',
      });
    }
  });
}
