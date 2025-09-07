import type { Router, Request, Response } from 'express';
import { openai, DEFAULT_MODEL } from '../../core/openai.js';
import { buildMessages } from '../../core/promptBuilder.js';
export default function registerChat(r:Router){
  r.post('/api/chat', async (req:Request,res:Response)=>{
    try{
      const owner=(req as any).canonicalOwner||'BOSS';
      const {message='', ririMode=false}=req.body||{};
      if(!message.trim()) return res.status(400).json({error:'message required'});
      const messages=await buildMessages(owner,message,!!ririMode);
      const out=await openai.chat.completions.create({model:DEFAULT_MODEL, messages});
      const text=out.choices?.[0]?.message?.content||'';
      res.json({owner,text,model:DEFAULT_MODEL});
    }catch(e:any){ res.status(500).json({error:'llm_error',detail:String(e?.message||e)}); }
  });
}
