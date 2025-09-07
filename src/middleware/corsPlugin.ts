import cors from 'cors';
const ALLOWED=(process.env.PLUGIN_CORS_WHITELIST||'https://chat.openai.com,https://gpts.openai.com')
  .split(',').map(s=>s.trim()).filter(Boolean);
export const pluginCors=cors({
  origin:(origin,cb)=>{
    if(!origin) return cb(null,true); // tools/no-origin (curl)
    try{ new URL(origin); }catch{ return cb(null,false); }
    cb(null, ALLOWED.includes(origin));
  },
  credentials:false, methods:['GET','POST','OPTIONS'],
  allowedHeaders:['Content-Type','X-API-KEY','X-BZ-USER']
});
