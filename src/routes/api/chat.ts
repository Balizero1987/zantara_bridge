import type { Router, Request, Response } from 'express';
import { openai, DEFAULT_MODEL } from '../../core/openai';
import { buildMessages } from '../../core/promptBuilder';
import { askNameId, welcomeFor, ownerLang } from '../../core/greetings';
import { db } from '../../core/firestore';
import { storeConversationContext } from '../../core/contextualMemory';
import { updateLearningMetrics } from '../../core/learningEngine';
import { saveChatMessageToDrive, writeBossLog, saveNote, createBrief } from '../../lib/driveSave';

export default function registerChat(r: Router) {
  r.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const headerOwner = (req as any).canonicalOwner || '';
      const { message = '', ririMode = false, sessionId, saveAs = 'chat', title } = req.body || {};

      const dateKey = new Date().toISOString().slice(0,10);
      const sess = String(sessionId || '');

      // Try resolve owner from header or session store
      let owner = headerOwner || '';
      if (!owner && sess) {
        const sid = `session:${sess}:${dateKey}`;
        const doc = await db.collection('chatSessions').doc(sid).get();
        if (doc.exists) owner = (doc.data() as any)?.canonicalOwner || '';
      }

      // Command to change owner: /cambia <nome>
      const lcmsg = message.trim();
      const changeMatch = /^\s*\/cambia\s+(.+)$/i.exec(lcmsg);
      if (changeMatch) {
        const newName = changeMatch[1].trim().toUpperCase().replace(/\s+/g,'_');
        owner = newName;
        if (sess) await db.collection('chatSessions').doc(`session:${sess}:${dateKey}`).set({ canonicalOwner: owner, ts: Date.now() }, { merge: true });
        const lang = ownerLang(owner);
        const welcome = welcomeFor(owner.replace(/_/g,' '), lang);
        // Save welcome as first entry of the day
        await saveChatMessageToDrive({ chatId: sess || String(Date.now()), author: owner, text: welcome, title: 'Welcome' });
        return res.json({ ok: true, text: welcome, responseTime: 0, savedAs: 'chat', owner });
      }

      // If still no owner, treat message as potential name (single line)
      if (!owner) {
        const maybeName = lcmsg.replace(/[\n\r]+/g,' ').trim();
        // Accept as name if not empty and shorter than 40 chars
        if (maybeName && maybeName.length <= 40) {
          owner = maybeName.toUpperCase().replace(/\s+/g,'_');
          if (sess) await db.collection('chatSessions').doc(`session:${sess}:${dateKey}`).set({ canonicalOwner: owner, ts: Date.now() }, { merge: true });
          const lang = ownerLang(owner);
          const welcome = welcomeFor(owner.replace(/_/g,' '), lang);
          await saveChatMessageToDrive({ chatId: sess || String(Date.now()), author: owner, text: welcome, title: 'Welcome' });
          return res.json({ ok: true, text: welcome, responseTime: 0, savedAs: 'chat', owner });
        }
        // Ask name (Indonesian) and stop here
        const ask = askNameId();
        return res.json({ ok: true, text: ask, need_user: true, responseTime: 0 });
      }

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
