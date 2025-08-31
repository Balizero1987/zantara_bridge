
import { Request, Response } from 'express';
import { Firestore } from '@google-cloud/firestore';

export async function memoryEntryTagHandler(req: Request, res: Response) {
  try {
    const { userId, entryId, tags } = req.body || {};
    if (!userId || !entryId || !Array.isArray(tags)) return res.status(400).json({ ok: false, error: 'Missing userId/entryId/tags[]' });
    const db = new Firestore();
    await db.collection('memory_entries').doc(String(userId)).collection('entries').doc(String(entryId)).update({ tags });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'memory.entry.tag failed' });
  }
}
