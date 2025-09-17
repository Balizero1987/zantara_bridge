import { db } from "../core/firestore";
import { Conversation } from "../types/conversationSchema";

/**
 * Recupera conversazioni dell'ultima settimana
 */
export async function getWeeklyConversations(collab?: string): Promise<Conversation[]> {
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);

  let query = db.collection("conversations")
    .where("startedAt", ">=", oneWeekAgo.toISOString())
    .where("startedAt", "<=", now.toISOString());

  if (collab) {
    query = query.where("collab", "==", collab);
  }

  const snapshot = await query.get();

  return snapshot.docs.map(d => ({
    ...(d.data() as Conversation),
    id: d.id
  }));
}

/**
 * Recupera solo summary narrativi dell'ultima settimana
 */
export async function getWeeklyNarratives(collab?: string): Promise<string[]> {
  const conversations = await getWeeklyConversations(collab);

  return conversations
    .filter(conv => conv.summary && conv.summary.narrative)
    .map(conv => `🔮 [${conv.collab}] ${conv.summary.narrative}`);
}