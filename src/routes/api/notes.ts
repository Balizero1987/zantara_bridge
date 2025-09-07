import type { Router, Request, Response } from 'express';
import { db, NoteEntry } from '../../core/firestore.js';
export default function registerNotes(r:Router){
  r.post('/api/notes', async (req:Request,res:Response)=>{
    const owner=(req as any).canonicalOwner||'UNKNOWN';
    const title=String(req.body?.title||'').trim();
    const content=String(req.body?.content||'').trim();
    if(!title||!content) return res.status(400).json({error:'title/content required'});
    const ts=Date.now(), dateKey=(req.body?.dateKey||new Date(ts).toISOString().slice(0,10));
    const note:NoteEntry={canonicalOwner:owner,title,content,ts,dateKey,tags:[]};
    const doc=await db.collection('notes').add(note);
    res.json({id:doc.id,...note});
  });
  r.get('/api/notes', async (req:Request,res:Response)=>{
    const owner=(req as any).canonicalOwner||'UNKNOWN';
    const dateKey=String(req.query.dateKey||'');
    let q=db.collection('notes').where('canonicalOwner','==',owner).orderBy('ts','desc');
    if(dateKey) q=q.where('dateKey','==',dateKey);
    const snap=await q.limit(200).get();
    res.json({items:snap.docs.map(d=>({id:d.id,...d.data()}))});
  });
}
