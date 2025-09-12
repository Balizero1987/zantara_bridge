import type { Router, Request, Response } from 'express';
import profileMemoryStore from '../../store/profileMemory';
import profileFirestoreStore from '../../store/profileFirestore';
import { buildPersonaSystemPrompt } from '../../prompt/templates';
import { openai, DEFAULT_MODEL } from '../../core/openai';
import { buildMessages } from '../../core/promptBuilder';
import { askNameId, welcomeFor, ownerLang } from '../../core/greetings';
import { GoogleAuth } from 'google-auth-library';
import { db } from '../../core/firestore';
import { storeConversationContext } from '../../core/contextualMemory';
import { updateLearningMetrics } from '../../core/learningEngine';
import { saveChatMessageToDrive, writeBossLog, saveNote, createBrief } from '../../lib/driveSave';
function chooseProfileStore(){
  const useFs = String(process.env.PROFILE_STORE || '').toLowerCase();
  if (useFs === 'firestore') return profileFirestoreStore;
  return profileMemoryStore;
}

export default function registerChat(r: Router) {
  r.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const headerOwner = (req as any).canonicalOwner || String(req.header('X-BZ-USER') || req.header('x-bz-user') || '').trim();
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
        const proposed = changeMatch[1].trim().toUpperCase().replace(/\s+/g,'_');
        const validated = await resolveOwnerFromDrive(proposed);
        if (!validated) {
          const ask = askNameId();
          return res.json({ ok: true, text: ask, need_user: true, responseTime: 0 });
        }
        owner = validated.canonical;
        if (sess) await db.collection('chatSessions').doc(`session:${sess}:${dateKey}`).set({ canonicalOwner: owner, ts: Date.now() }, { merge: true });
        const lang = ownerLang(owner);
        const welcome = welcomeFor(validated.display, lang);
        // Save welcome as first entry of the day
        await saveChatMessageToDrive({ chatId: sess || String(Date.now()), author: owner, text: welcome, title: 'Welcome' });
        return res.json({ ok: true, text: welcome, responseTime: 0, savedAs: 'chat', owner });
      }

      // If still no owner, treat message as potential name (single line)
      if (!owner) {
        const maybeName = lcmsg.replace(/[\n\r]+/g,' ').trim();
        // Accept as name if not empty and shorter than 40 chars
        if (maybeName && maybeName.length <= 40) {
          const proposed = maybeName.toUpperCase().replace(/\s+/g,'_');
          const validated = await resolveOwnerFromDrive(proposed);
          if (!validated) {
            const ask = askNameId();
            return res.json({ ok: true, text: ask, need_user: true, responseTime: 0 });
          }
          owner = validated.canonical;
          if (sess) await db.collection('chatSessions').doc(`session:${sess}:${dateKey}`).set({ canonicalOwner: owner, ts: Date.now() }, { merge: true });
          const lang = ownerLang(owner);
          const welcome = welcomeFor(validated.display, lang);
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

      // Costruisci il contesto della conversazione con persona
      const store = chooseProfileStore();
      const profile = owner ? await store.get(owner) : null;
      const persona = buildPersonaSystemPrompt(profile);
      const messages = await buildMessages(owner, message, !!ririMode);

      // Chiamata al modello OpenAI
      const out = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
      });
      const text: string = out.choices?.[0]?.message?.content || '';
      const responseTime = Date.now() - startTime;

      // In dev/test, opzionalmente allega traccia persona per i test live
      const echoPersona = process.env.CHAT_ECHO_PERSONA === 'true' && process.env.NODE_ENV !== 'production';
      const personaTrace = profile ? `<!-- persona: ${JSON.stringify({
        userId: profile.userId,
        lang: (profile.locale || '').slice(0,2) || null,
        tone: profile.meta?.rawTone || null,
        signature: profile.meta?.signature || null,
      })} -->` : '';
      const textWithTrace = echoPersona ? `${text}\n${personaTrace}` : text;

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
      return res.json({ ok: true, text: textWithTrace, responseTime, savedAs: String(saveAs || 'chat') });
    } catch (e: any) {
      return res.status(500).json({
        ok: false,
        error: e?.message || 'chat failed',
      });
    }
  });
}

// ===== Owner resolution helpers =====
function aliasMap(): Record<string,string> {
  const map: Record<string,string> = {};
  const raw = (process.env.DRIVE_OWNER_MAP || '').trim();
  if (!raw) return map;
  for (const pair of raw.split(',')) {
    const [k,v] = pair.split(':').map(s => (s||'').trim());
    if (k && v) map[k.toUpperCase()] = v;
  }
  return map;
}

async function resolveOwnerFromDrive(proposedCanonical: string): Promise<{ canonical: string; display: string } | null> {
  // Apply alias map (input uppercase underscore)
  const mp = aliasMap();
  const alias = mp[proposedCanonical];
  const displayCandidate = (alias || proposedCanonical).replace(/_/g,' ').trim();

  // Verify folder exists under AMBARADAM
  const token = await getAccessToken();
  const driveId = (process.env.DRIVE_ID_AMBARADAM || '').trim();
  if (!driveId) return null;
  let ambRoot = (process.env.DRIVE_FOLDER_AMBARADAM || '').trim() || null;
  if (!ambRoot) ambRoot = await findFolderByNameInDrive(token, driveId, 'AMBARADAM');
  if (!ambRoot) return null;

  const exists = await findFolderByNameInParent(token, ambRoot, displayCandidate);
  if (!exists) return null;
  return { canonical: displayCandidate.toUpperCase().replace(/\s+/g,'_'), display: displayCandidate };
}

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  const client: any = await auth.getClient();
  const tok: any = await client.getAccessToken();
  const token = typeof tok === 'string' ? tok : (tok?.token || tok?.access_token || '');
  if (!token) throw new Error('No access token');
  return token;
}

async function findFolderByNameInDrive(token: string, driveId: string, name: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('corpora', 'drive');
  url.searchParams.set('driveId', driveId);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data: any = await res.json();
  return data?.files?.[0]?.id || null;
}

async function findFolderByNameInParent(token: string, parentId: string, name: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data: any = await res.json();
  return data?.files?.[0]?.id || null;
}
