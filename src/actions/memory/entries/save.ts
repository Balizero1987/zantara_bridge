
import { Request, Response } from 'express';
import { Firestore } from '@google-cloud/firestore';

export async function memoryEntrySaveHandler(req: Request, res: Response) {
  try {
    const { userId, source, text, tags } = req.body || {};
    if (!userId || !text) return res.status(400).json({ ok: false, error: 'Missing userId/text' });
    const db = new Firestore();
    const ts = Date.now();
    const entry = { userId, source: source || null, text: String(text), tags: Array.isArray(tags) ? tags : [], ts };
    await db.collection('memory_entries').doc(String(userId)).collection('entries').doc(String(ts)).set(entry);
    (req as any).log?.info?.({ action: 'memory.entry.save', userId, ts });
    return res.json({ ok: true, id: String(ts) });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'memory.entry.save failed' });
  }
}
