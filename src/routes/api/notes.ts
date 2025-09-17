import type { Router, Request, Response } from 'express';
import { db, NoteEntry } from '../../core/firestore';
import { saveNote, saveNoteWithRequest } from '../../lib/driveSave';

export default function registerNotes(r: Router) {
  // 📌 POST: salva nota su Drive in AMBARADAM/<OWNER>/Notes/
  r.post('/api/notes/save', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'BOSS';
      const title = String(req.body?.title || '').trim() || undefined;
      const content = String(req.body?.content || '').trim();
      if (!content) return res.status(400).json({ ok: false, error: 'content required' });

      // Use working drive upload method instead of problematic legacy method
      const { uploadTextAsDoc } = require('../../services/driveUpload');
      const fileName = title || `Note_${owner}_${Date.now()}`;
      const out = await uploadTextAsDoc(content, fileName, owner);
      return res.json({ ok: true, file: out });
    } catch (e: any) {
      console.error('Save note error:', e);
      return res.status(500).json({ ok: false, error: e?.message || 'save_note_failed' });
    }
  });
  // 📌 POST: crea una nuova nota
  r.post('/api/notes', async (req: Request, res: Response) => {
    const owner = (req as any).canonicalOwner || 'UNKNOWN';
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();

    if (!title || !content) {
      return res.status(400).json({ error: 'title/content required' });
    }

    const ts = Date.now();
    const dateKey =
      req.body?.dateKey || new Date(ts).toISOString().slice(0, 10);

    const note: NoteEntry = {
      canonicalOwner: owner,
      title,
      content,
      ts,
      dateKey,
      tags: []
    };

    const doc = await db.collection('notes').add(note);
    res.json({ id: doc.id, ...note });
  });

  // 📌 GET: recupera note esistenti
  r.get('/api/notes', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const dateKey = String(req.query.dateKey || '');

      let q = db.collection('notes')
        .where('canonicalOwner', '==', owner)
        .orderBy('ts', 'desc');

      if (dateKey) {
        q = q.where('dateKey', '==', dateKey);
      }

      const snap = await q.limit(200).get();

      const items = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          canonicalOwner: data.canonicalOwner,
          title: data.title,
          content: data.content,
          ts: Number(data.ts), // 🔒 sempre numero
          dateKey: data.dateKey,
          tags: data.tags || []
        };
      });

      return res.json({ ok: true, count: items.length, items });
    } catch (e: any) {
      return res.status(500).json({
        ok: false,
        error: e.message || 'list_failed'
      });
    }
  });
}
