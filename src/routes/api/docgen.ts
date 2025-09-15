import type { Router, Request, Response } from 'express';
import { db, handleFirestoreError } from '../../core/firestore';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
export default function registerDocgen(r:Router){
  r.post('/api/docgen', async (req:Request,res:Response)=>{
    try {
      const owner=(req as any).canonicalOwner||'BOSS';
      const dateKey=String(req.body?.dateKey||new Date().toISOString().slice(0,10));
      const snap=await db.collection('notes').where('canonicalOwner','==',owner).where('dateKey','==',dateKey).orderBy('ts','asc').get();
      const children=[ new Paragraph({text:`Brief of ${owner} – ${dateKey}`,heading:HeadingLevel.HEADING_1}) ];
      if(snap.empty){ children.push(new Paragraph('No notes found for the selected date.')); }
      snap.forEach(d=>{
        const n=d.data() as any;
        children.push(new Paragraph({text:n.title,heading:HeadingLevel.HEADING_2}));
        children.push(new Paragraph({text:n.content}));
      });
      const doc=new Document({sections:[{children}]});
      const buf=await Packer.toBuffer(doc);
      res.json({owner,dateKey,fileName:`Brief-${owner}-${dateKey}.docx`,docxBase64:buf.toString('base64'),size:buf.length});
    } catch (err: any) {
      handleFirestoreError(err);
      return res.status(500).json({ ok: false, error: err?.message || 'docgen failed' });
    }
  });
}
