import express from 'express';
import pino from 'pino';
import { pluginCors } from './middleware/corsPlugin.js';
import { pluginLimiter } from './middleware/rateLimit.js';
import { apiKeyGuard } from './middleware/authPlugin.js';
import registerNotes from './routes/api/notes.js';
import registerChat from './routes/api/chat.js';
import registerDocgen from './routes/api/docgen.js';
import registerPlugin from './routes/plugin.js';

const app=express(); app.disable('x-powered-by'); app.use(express.json({limit:'1mb'}));
app.use(pluginCors); app.use(pluginLimiter);

// health/pubbliche
app.get('/health',(_req,res)=>res.json({ok:true}));
app.get('/version',(_req,res)=>res.json({version:process.env.ZANTARA_VERSION||'dev'}));
registerPlugin(app);

// protette
app.use(apiKeyGuard);
registerNotes(app); registerChat(app); registerDocgen(app);

// asset minimi
app.get('/logo.png',(_req,res)=>{res.type('png'); const b=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4BwQACfsD/ed8yQgAAAAASUVORK5CYII=','base64'); res.send(b);});
app.get('/terms',(_req,res)=>res.send('Terms will be provided by Bali Zero.'));

const port=process.env.PORT||8080; app.listen(port,()=>pino().info({message:'plugin.ready',port}));
