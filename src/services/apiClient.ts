/**
 * API client service for calling ZANTARA endpoints with proper authentication
 */

const BASE_URL = process.env.BASE_URL || 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app';

export async function saveMemory(payload: any, user = "BOSS") {
  const res = await fetch(`${BASE_URL}/actions/memory/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ZANTARA_PLUGIN_API_KEY || "",
      "X-BZ-USER": user
    },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function saveNote(payload: any, user = "BOSS") {
  const res = await fetch(`${BASE_URL}/api/notes/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ZANTARA_PLUGIN_API_KEY || "",
      "X-BZ-USER": user
    },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function uploadToDrive(payload: any, user = "BOSS") {
  const res = await fetch(`${BASE_URL}/actions/drive/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ZANTARA_PLUGIN_API_KEY || "",
      "X-BZ-USER": user
    },
    body: JSON.stringify(payload)
  });
  return res.json();
}