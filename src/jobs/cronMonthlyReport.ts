import { db } from "../core/firestore";
import { Conversation } from "../types/conversationSchema";
import { generateDoc } from "../services/driveService"; // wrapper per Google Drive API

export async function generateMonthlyReport() {
  console.log("📖 Avvio cron job: Monthly Report Narrativo");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Recupera conversazioni del mese
  const snapshot = await db.collection("conversations")
    .where("startedAt", ">=", firstDay.toISOString())
    .where("startedAt", "<=", lastDay.toISOString())
    .get();

  if (snapshot.empty) {
    console.log("✅ Nessuna conversazione da includere nel report mensile.");
    return;
  }

  const conversations: Conversation[] = snapshot.docs.map(d => ({
    ...(d.data() as Conversation),
    id: d.id
  }));

  // Costruisci contenuto narrativo
  let reportContent = `# 📖 Report Narrativo AMBARADAM — ${now.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}\n\n`;

  conversations.forEach(conv => {
    if (conv.summary?.narrative) {
      reportContent += `## 🔮 Collaboratore: ${conv.collab}\n`;
      reportContent += `${conv.summary.narrative}\n\n`;
    }
  });

  // Upload su Drive
  try {
    const docResult = await generateDoc("BOSS", `${firstDay.getFullYear()}-${firstDay.getMonth()+1}`, reportContent);

    console.log("✅ Report generato su Drive:", docResult.webViewLink);
    return docResult;
  } catch (err: any) {
    console.error("❌ Errore creazione report:", err.message);
  }
}