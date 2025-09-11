import type { Router, Request, Response } from 'express';
import { openai, DEFAULT_MODEL } from '../../core/openai';
import { buildMessages } from '../../core/promptBuilder';
import { storeConversationContext } from '../../core/contextualMemory';
import { updateLearningMetrics } from '../../core/learningEngine';

export default function registerChat(r:Router){
  r.post('/api/chat', async (req:Request,res:Response)=>{
    try{
      const startTime = Date.now();
      const owner=(req as any).canonicalOwner||'BOSS';
      const {message='', ririMode=false, sessionId}=req.body||{};
      
      if(!message.trim()) return res.status(400).json({error:'message required'});
      
      const messages=await buildMessages(owner,message,!!ririMode);
      const out=await openai.chat.completions.create({model:DEFAULT_MODEL, messages});
      const text=out.choices?.[0]?.message?.content||'';
      const responseTime = Date.now() - startTime;
      
      // Store conversation context and update learning metrics
      await Promise.all([
        storeConversationContext(owner, message, text, responseTime, sessionId),
        updateLearningMetrics(owner, responseTime)
      ]);
      
      res.json({
        owner,
        text,
        model:DEFAULT_MODEL,
        responseTime,
        session: sessionId
      });
      
    }catch(e:any){ 
      res.status(500).json({
        error:'llm_error',
        detail:String(e?.message||e)
      }); 
    }
  });
}
