import type { Router, Request, Response } from 'express';
import { db, NoteEntry } from '../../core/firestore';

export default function registerNotes(r: Router) {
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
