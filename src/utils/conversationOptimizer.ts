import NodeCache from "node-cache";
import { db } from "../core/firestore";

const cache = new NodeCache({ stdTTL: 600 }); // 10 min cache

export interface OptimizedMessage {
  id: string;
  sender: "collab" | "zantara" | "system";
  text: string;
  timestamp: string;
  moodScore: number; // da -1 (negativo) a +1 (positivo)
  trigger?: string;
}

/**
 * Analizza un messaggio: trigger + moodScore
 */
export function analyzeMessage(text: string): { moodScore: number; trigger?: string } {
  const lower = text.toLowerCase();
  let score = 0;

  if (lower.includes("stress") || lower.includes("panic")) score = -0.6;
  else if (lower.includes("deadline")) score = -0.3;
  else if (lower.includes("ok") || lower.includes("yes")) score = 0.3;
  else if (lower.includes("thanks") || lower.includes("terima kasih")) score = 0.6;

  let trigger;
  if (lower.includes("kitas")) trigger = "KITAS";
  if (lower.includes("pajak")) trigger = "TAX";
  if (lower.includes("meeting")) trigger = "MEETING";

  return { moodScore: score, trigger };
}

/**
 * Salva messaggio in Firestore + aggiorna statistiche trigger
 */
export async function saveOptimizedMessage(convId: string, msg: OptimizedMessage) {
  await db.collection("conversations").doc(convId).collection("messages").add(msg);

  if (msg.trigger) {
    await db.collection("triggers").doc(msg.trigger).set(
      { count: 1 },
      { merge: true }
    );
  }
}

/**
 * Cache di conversazioni recenti per risposte veloci
 */
export function cacheConversation(convId: string, data: any) {
  cache.set(convId, data);
}

export function getCachedConversation(convId: string) {
  return cache.get(convId);
}