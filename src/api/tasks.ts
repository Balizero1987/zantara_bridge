import { Express, Request, Response } from 'express';
import { requireApiKey } from '../middleware/auth';
import { generateReportDocx, listNotes, ymd } from '../notes';
import { Firestore } from '@google-cloud/firestore';
import OpenAI from 'openai';

function listDistinctOwnersFromNotes(notes: any[]): string[] {
  const s = new Set<string>();
  notes.forEach(n => s.add(n.owner));
  return Array.from(s);
}

export function taskRoutes(app: Express) {
  // Endpoint to generate daily reports for all owners with notes
  app.post('/tasks/summarize-daily', requireApiKey, async (req: Request, res: Response) => {
    try {
      const dateStr = (req.body?.date as string) || ymd();
      const owners = (req.body?.owners as string[] | undefined) || null;

      // Collect owners: if provided, use them; otherwise discover dynamically from Firestore for this date
      const allOwners = owners && owners.length ? owners : await (async () => {
        const db = new Firestore();
        const snap = await db.collection('notes').where('dateKey', '==', dateStr).get();
        const set = new Set<string>();
        snap.docs.forEach(d => {
          const o = (d.data() as any)?.owner;
          if (o) set.add(String(o));
        });
        return Array.from(set);
      })();

      if (!process.env.MEMORY_DRIVE_FOLDER_ID) {
        (req as any).log?.warn?.({ module: 'tasks.summarize-daily', warning: 'Missing MEMORY_DRIVE_FOLDER_ID' });
      }
      const openaiKey = process.env.OPENAI_API_KEY || '';
      const useAi = (process.env.USE_AI_SUMMARY || 'true').toLowerCase() !== 'false';
      const ai = (useAi && openaiKey) ? new OpenAI({ apiKey: openaiKey }) : null;

      const out: any[] = [];
  (req as any).log?.info?.({ module: 'tasks.summarize-daily', phase: 'start', date: dateStr, owners: allOwners });
      for (const owner of allOwners) {
        // gather notes
        const notes = await listNotes(owner, dateStr);
        if (!notes.length) { 
          (req as any).log?.info?.({ module: 'tasks.summarize-daily', phase: 'no-notes', owner, date: dateStr });
          out.push({ owner, date: dateStr, skipped: true }); 
          continue; 
        }

        // build a concise bullet-point summary using OpenAI if available
        let summary = '';
        if (ai) {
          try {
            const content = notes.map(n => `- ${n.title}: ${n.content}`).join('\n');
            const completion = await ai.chat.completions.create({
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Sei un assistente che crea un riepilogo di fine giornata, sintetico e discorsivo, con bullet di qualità e verbi all’infinito. Lingua italiana.' },
                { role: 'user', content: `Riepiloga le seguenti note del giorno in 6-10 bullet:\n${content}` }
              ],
              temperature: 0.5,
            });
            summary = completion.choices[0].message?.content || '';
          } catch {
            summary = notes.map(n => `• ${n.title}: ${n.content}`).join('\n');
          }
        } else {
          summary = notes.map(n => `• ${n.title}: ${n.content}`).join('\n');
        }

        const report: any = await generateReportDocx(owner, dateStr, summary);
  (req as any).log?.info?.({ module: 'tasks.summarize-daily.report', owner, date: dateStr, notesCount: notes.length, aiUsed: !!ai, fileId: report.fileId });
        out.push({ owner, date: dateStr, fileId: report.fileId });
      }

      res.json({ ok: true, date: dateStr, results: out });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });
}
