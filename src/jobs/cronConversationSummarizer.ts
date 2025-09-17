import { db } from "../core/firestore";
import { Conversation } from "../types/conversationSchema";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function summarizeConversations() {
  console.log("🔄 Avvio cron job: Conversation Summarizer");

  // Recupera tutte le conversazioni aperte
  const snapshot = await db.collection("conversations")
    .where("status", "==", "open")
    .get();

  if (snapshot.empty) {
    console.log("✅ Nessuna conversazione aperta da riassumere.");
    return;
  }

  for (const doc of snapshot.docs) {
    const data = doc.data() as Conversation;

    // Recupera messaggi
    const msgSnap = await db.collection("conversations")
      .doc(doc.id)
      .collection("messages")
      .get();

    const messages = msgSnap.docs.map(d => d.data().text).join("\n");

    try {
      const prompt = `
Sei ZANTARA, Guardiano dell'AMBARADAM. Riassumi questa conversazione in tre livelli:
1. Short (1 frase)
2. Bullet (5 punti)
3. Narrative (stile epico-saga AMBARADAM).

Conversazione:
${messages}
`;

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400
      });

      const text = response.choices[0].message?.content || "";
      const [short, bulletsRaw, narrative] = text.split("\n\n");

      const bullets = bulletsRaw
        .split("\n")
        .filter(line => line.trim().startsWith("-"))
        .map(line => line.replace(/^- /, "").trim());

      await doc.ref.update({
        summary: {
          short: short.replace("Short:", "").trim(),
          bullets,
          narrative: narrative.replace("Narrative:", "").trim()
        }
      });

      console.log(`✅ Conversazione ${doc.id} riassunta con successo.`);
    } catch (err: any) {
      console.error(`❌ Errore riassunto conversazione ${doc.id}:`, err.message);
    }
  }
}