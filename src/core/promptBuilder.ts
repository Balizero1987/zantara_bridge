import { db } from './firestore';
export async function buildMessages(owner:string,message:string,riri:boolean){
  const man=await db.collection('memory.global').doc('manifesto').get();
  const preset=await db.collection('memory.byOwner').doc('RIRI').collection('entries').doc('seed-preset').get();
  const manifesto=(man.exists? man.data()?.content : '')||'';
  const ririPreset=(preset.exists? preset.data()?.content : '')||'';
  const persona=riri?`Persona: {"tone":"delicato-assertivo-caldo","archetype":"ZAN_RIRI"}`:'';
  const system=[
    'You are ZANTARA, the operational brain of Bali Zero.',
    'Honor Indonesian cultural values. Defend the Constitution. Be precise, useful, kind.',
    manifesto?`Manifesto: ${manifesto}`:'', ririPreset?`Preset: ${ririPreset}`:'', persona
  ].filter(Boolean).join('\n');
  return [{role:'system',content:system},{role:'user',content:message}] as any;
}
