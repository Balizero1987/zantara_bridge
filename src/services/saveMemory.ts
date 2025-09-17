import fetch from "node-fetch";

const BASE_URL =
  process.env.BASE_URL ||
  "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app";

/**
 * Salva memoria in AMBARADAM forzando sempre X-BZ-USER=BOSS
 */
export async function saveMemory(payload: {
  title: string;
  content: string;
  tags?: string[];
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/notes/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.ZANTARA_PLUGIN_API_KEY || "",
      "X-BZ-USER": "BOSS" // ⚡ forzato sempre
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SaveMemory failed: ${res.status} - ${text}`);
  }

  return res.json();
}