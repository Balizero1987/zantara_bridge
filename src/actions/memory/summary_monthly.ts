
import { Request, Response } from 'express';
import { Firestore } from '@google-cloud/firestore';

export async function memoryMonthlySummaryHandler(req: Request, res: Response) {
  try {
    const userId = (req.query.userId as string) || (req.body?.userId as string) || '';
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing userId' });
    const month = (req.query.month as string) || (new Date().toISOString().slice(0,7)); // YYYY-MM
    const [y,m] = month.split('-').map((x:string)=>parseInt(x,10));
    const start = new Date(Date.UTC(y, m-1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    const db = new Firestore();
    const snap = await db.collection('memory_entries').doc(String(userId)).collection('entries')
      .where('ts','>=', start.getTime()).where('ts','<=', end.getTime()).orderBy('ts','desc').limit(2000).get();
    const items = snap.docs.map(d=>d.data() as any).filter(e => !e.deleted);
    const bullets = items.slice(0,200).map(e => `• ${new Date(e.ts).toISOString().slice(0,10)}: ${String(e.text).split('
')[0].slice(0,140)}`);
    return res.json({ ok: true, userId, month, count: items.length, summary: bullets.join('
') });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'memory.summary.monthly failed' });
  }
}
