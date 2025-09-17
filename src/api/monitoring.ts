import { Router } from "express";
import fetch from "node-fetch";

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

    res.json({ ok: true, monitoring: results, ts: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;