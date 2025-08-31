
import { Request, Response } from 'express';
import { Firestore } from '@google-cloud/firestore';

export async function memoryWeeklySummaryHandler(req: Request, res: Response) {
  try {
    const userId = (req.query.userId as string) || (req.body?.userId as string) || '';
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing userId' });
    const db = new Firestore();
    const now = Date.now();
    const weekAgo = now - 7*24*60*60*1000;
    const snap = await db.collection('memory_entries').doc(String(userId)).collection('entries').where('ts','>=', weekAgo).orderBy('ts','desc').limit(1000).get();
    const items = snap.docs.map(d=>d.data() as any);
    // naive summary: list titles/bullets from first sentence chunks
    const bullets = items.slice(0,50).map(e => `• ${new Date(e.ts).toISOString().slice(0,10)}: ${String(e.text).split('
')[0].slice(0,120)}`);
    const summary = bullets.join('
');
    return res.json({ ok: true, userId, count: items.length, summary });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'memory.weeklySummary failed' });
  }
}
