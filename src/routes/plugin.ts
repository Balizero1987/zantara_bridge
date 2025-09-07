import type { Router, Request, Response } from 'express';
function baseUrl(req:Request){ const proto=(req.headers['x-forwarded-proto'] as string)||'https';
  const host=(req.headers['x-forwarded-host'] as string)||req.headers.host||'localhost:8080'; return `${proto}://${host}`; }
export default function registerPlugin(r:Router){
  r.get('/.well-known/ai-plugin.json',(req:Request,res:Response)=>{
    const url=baseUrl(req);
    res.json({ schema_version:"v1", name_for_human:"ZANTARA Bridge", name_for_model:"zantara",
      description_for_human:"Notes, chat and brief generator aligned with Bali Zero identity.",
      description_for_model:"Create and list notes, chat with contextual identity, and generate daily briefs.",
      auth:{type:"api_key",api_key:{name:"X-API-KEY"}}, api:{type:"openapi",url:`${url}/.well-known/openapi.json`,is_user_authenticated:true},
      logo_url:`${url}/logo.png`, contact_email:"zero@balizero.com", legal_info_url:`${url}/terms` });
  });
  r.get('/.well-known/openapi.json',(req:Request,res:Response)=>{
    const url=baseUrl(req);
    res.json({ openapi:"3.1.0", info:{title:"ZANTARA Bridge API",version:"0.1.0"}, servers:[{url}],
      paths:{
        "/api/notes":{ get:{summary:"List notes",responses:{"200":{description:"OK"}}},
                       post:{summary:"Create note",responses:{"200":{description:"Created"}}} },
        "/api/chat": { post:{summary:"Chat with ZANTARA (RIRI)",responses:{"200":{description:"OK"}}} },
        "/api/docgen": { post:{summary:"Generate .docx",responses:{"200":{description:"OK"}}} }
      },
      components:{ securitySchemes:{ apiKey:{type:"apiKey",in:"header",name:"X-API-KEY"} } }
    });
  });
}
