import { Router, Request, Response } from 'express';

const router = Router();

// Manifest JSON (ai-plugin.json)
router.get('/.well-known/ai-plugin.json', (_req: Request, res: Response) => {
  res.json({
    schema_version: "v1",
    name_for_human: "ZANTARA Bridge",
    name_for_model: "zantara_bridge",
    description_for_human: "Gestisci note, chat AI e genera brief in Drive.",
    description_for_model: "Plugin per gestire note, usare chat contestuale e creare brief DOCX su Drive.",
    auth: {
      type: "api_key",
      api_key: { name: "X-API-KEY" }
    },
    api: {
      type: "openapi",
      url: "/.well-known/openapi.json",
      is_user_authenticated: true
    },
    logo_url: "/logo.png",
    contact_email: "ops@balizero.com",
    legal_info_url: "/terms"
  });
});

// OpenAPI JSON
router.get('/.well-known/openapi.json', (_req: Request, res: Response) => {
  res.json({
    openapi: "3.1.0",
    info: {
      title: "ZANTARA Bridge API",
      version: "1.0.0"
    },
    servers: [{ url: "/" }],
    paths: {
      "/api/notes": {
        get: {
          summary: "List notes",
          responses: { "200": { description: "OK" } }
        },
        post: {
          summary: "Create note",
          responses: { "200": { description: "Created" } }
        }
      },
      "/api/chat": {
        post: {
          summary: "Chat with ZANTARA (RIRI mode optional)",
          responses: { "200": { description: "OK" } }
        }
      },
      "/api/docgen": {
        post: {
          summary: "Generate .docx file",
          responses: { "200": { description: "OK" } }
        }
      },
      "/api/drive/brief": {
        post: {
          summary: "Generate and upload brief DOCX to Drive",
          responses: { "200": { description: "Created with webViewLink" } }
        }
      }
    },
    components: {
      securitySchemes: {
        apiKey: { type: "apiKey", in: "header", name: "X-API-KEY" }
      }
    }
  });
});

export default function registerPlugin(app: any) {
  app.use(router);
}
