import { db } from "../core/firestore";

export async function getTopTriggers(limit = 5): Promise<any[]> {
  const snapshot = await db.collection("triggers").get();
  const triggers: { name: string; count: number }[] = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    triggers.push({ name: doc.id, count: data.count || 0 });
  });

  return triggers.sort((a, b) => b.count - a.count).slice(0, limit);
}