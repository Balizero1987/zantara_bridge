import { Router } from 'express';
const r = Router();
const yaml = `openapi: 3.0.0\ninfo:\n  title: Zantara API\n  version: 1.0.0\npaths:\n  /health:\n    get:\n      summary: Health\n      responses:\n        "200":\n          description: OK\n`;
r.get('/.well-known/openapi.yaml', (_req,res)=>res.type('text/yaml').send(yaml));
export default r;
