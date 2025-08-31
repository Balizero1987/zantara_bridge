
import { Request, Response } from 'express';
import { Firestore } from '@google-cloud/firestore';

export async function memoryEntrySearchHandler(req: Request, res: Response) {
  try {
    const { userId, query, tags } = { userId: req.query.userId || req.body?.userId, query: req.query.query || req.query.q || req.body?.query, tags: req.query.tags || req.body?.tags } as any;
    if (!userId || !query) return res.status(400).json({ ok: false, error: 'Missing userId/query' });
    const db = new Firestore();
    const snap = await db.collection('memory_entries').doc(String(userId)).collection('entries').orderBy('ts','desc').limit(500).get();
    const q = String(query).toLowerCase();
    const tagSet = Array.isArray(tags) ? new Set(tags.map((t: any)=>String(t).toLowerCase())) : null;
    const items = snap.docs.map(d=>d.data()).filter((e:any)=> String(e.text||'').toLowerCase().includes(q) && (!tagSet || (Array.isArray(e.tags)&&e.tags.some((t:string)=>tagSet.has(String(t).toLowerCase())))) );
    return res.json({ ok: true, items });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'memory.entry.search failed' });
  }
}
