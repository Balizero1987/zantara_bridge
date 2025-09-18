import { Router } from "express";
import fetch from "node-fetch";
import { openai, DEFAULT_MODEL } from "../core/openai";
import { driveAsUser } from "../core/impersonation";

const router = Router();
const BASE_URL =
  process.env.BASE_URL ||
  "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app";

router.get("/", async (req, res) => {
  try {
    const results: Record<string, any> = {};

    // Health check
    try {
      const r = await fetch(`${BASE_URL}/health`);
      results.health = await r.json();
    } catch (err: any) {
      results.health = { ok: false, error: err.message };
    }

    // Stats
    try {
      const r = await fetch(`${BASE_URL}/api/stats`, {
        headers: { "X-API-KEY": process.env.ZANTARA_PLUGIN_API_KEY || "" }
      });
      results.stats = await r.json();
    } catch (err: any) {
      results.stats = { ok: false, error: err.message };
    }

    // Assistant
    try {
      const r = await fetch(`${BASE_URL}/api/assistant/status`);
      results.assistant = await r.json();
    } catch (err: any) {
      results.assistant = { ok: false, error: err.message };
    }

    // Gmail
    try {
      const r = await fetch(`${BASE_URL}/api/gmail/monitor/status`, {
        headers: { "X-API-KEY": process.env.ZANTARA_PLUGIN_API_KEY || "" }
      });
      results.gmail = await r.json();
    } catch (err: any) {
      results.gmail = { ok: false, error: err.message };
    }

    // Calendar
    try {
      const r = await fetch(`${BASE_URL}/api/calendar/status`, {
        headers: { "X-API-KEY": process.env.ZANTARA_PLUGIN_API_KEY || "" }
      });
      results.calendar = await r.json();
    } catch (err: any) {
      results.calendar = { ok: false, error: err.message };
    }

    // Conversation Stats (new!)
    try {
      const r = await fetch(`${BASE_URL}/api/conversations/stats`, {
        headers: { "X-API-KEY": process.env.ZANTARA_PLUGIN_API_KEY || "" }
      });
      results.conversations = await r.json();
    } catch (err: any) {
      results.conversations = { ok: false, error: err.message };
    }

    // OpenAI reachability
    try {
      // quick, low-cost call: list models with short timeout
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3000);
      // SDK does not accept AbortController directly for list(); perform a tiny completion with minimal tokens
      const r = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0
      });
      clearTimeout(t);
      results.openai = { ok: true, model: r.model, id: r.id };
    } catch (err: any) {
      results.openai = { ok: false, error: err?.message || String(err) };
    }

    // Drive with impersonation check
    try {
      const drive = driveAsUser();
      const about = await drive.about.get({ 
        fields: 'user(emailAddress,displayName),storageQuota' 
      });
      const user = about.data.user;
      const quota = (about.data as any).storageQuota;
      
      results.drive = {
        ok: true,
        user,
        quota,
        isImpersonated: !!process.env.IMPERSONATE_USER && 
          user?.emailAddress?.toLowerCase() === process.env.IMPERSONATE_USER?.toLowerCase(),
        impersonateUser: process.env.IMPERSONATE_USER
      };
    } catch (e: any) {
      results.drive = { 
        ok: false, 
        error: e?.message || String(e),
        impersonateUser: process.env.IMPERSONATE_USER
      };
    }

    res.json({ ok: true, monitoring: results, ts: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
