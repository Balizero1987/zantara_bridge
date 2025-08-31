
import { Request, Response } from 'express';
import { Firestore } from '@google-cloud/firestore';

export async function memoryEntryRestoreHandler(req: Request, res: Response) {
  try {
    const { userId, timestamp } = req.body || {};
    if (!userId || !timestamp) return res.status(400).json({ ok: false, error: 'Missing userId/timestamp' });
    const db = new Firestore();
    await db.collection('memory_entries').doc(String(userId)).collection('entries').doc(String(timestamp)).set({ deleted: false }, { merge: true });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'memory.entry.restore failed' });
  }
}
