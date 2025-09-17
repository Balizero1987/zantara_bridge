import { db } from "../core/firestore";
import { Conversation } from "../types/conversationSchema";
import { generateDoc } from "../services/driveService"; // wrapper Google Drive

export async function generateWeeklyDigest() {
  console.log("📖 Avvio cron job: Weekly Digest");

  const now = new Date();
  const weekStart = new Date();
  weekStart.setDate(now.getDate() - 7);

  // Recupera conversazioni dell'ultima settimana
  const snapshot = await db.collection("conversations")
    .where("startedAt", ">=", weekStart.toISOString())
    .where("startedAt", "<=", now.toISOString())
    .get();

  if (snapshot.empty) {
    console.log("✅ Nessuna conversazione da includere nel digest settimanale.");
    return;
  }

  const conversations: Conversation[] = snapshot.docs.map(d => ({
    ...(d.data() as Conversation),
    id: d.id
  }));

  // Costruisci contenuto del digest
  let digestContent = `# 📊 Weekly Digest AMBARADAM — Settimana ${weekStart.toLocaleDateString("it-IT")} - ${now.toLocaleDateString("it-IT")}\n\n`;

  conversations.forEach(conv => {
    if (conv.summary?.short) {
      digestContent += `- **${conv.collab}**: ${conv.summary.short}\n`;
    }
  });

  // Upload su Drive
  try {
    const docResult = await generateDoc("BOSS", `${now.getFullYear()}-W${getWeekNumber(now)}`, digestContent);
    console.log("✅ Digest settimanale generato su Drive:", docResult.webViewLink);
    return docResult;
  } catch (err: any) {
    console.error("❌ Errore creazione digest:", err.message);
  }
}

/**
 * Helper: numero della settimana
 */
function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
}