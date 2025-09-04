import express from 'express';
import calendar from './api/calendar';
import codex from './api/codex';
import memory from './api/memory';
import drive from './api/drive';
import gmail from './api/gmail';
import identity from './api/identity';
import openapi from './api/openapi';

const app = express();
app.use(express.json());

function norm(m:any){ return (m && (m as any).default) ? (m as any).default : m; }
function mount(mod:any){
  const api = norm(mod);
  if (!api) return;
  if ((api as any).prefix && (api as any).router) { app.use((api as any).prefix, (api as any).router as any); return; }
  if (typeof api === 'function' || (api as any)?.handle) { app.use(api as any); return; }
}

mount(calendar);
mount(codex);
mount(memory);
mount(drive);
mount(gmail);
mount(identity);
mount(openapi);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'zantara-bridge' }));

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => console.log(`listening ${PORT}`));
export default app;
