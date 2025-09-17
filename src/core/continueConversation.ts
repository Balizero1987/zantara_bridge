import { db } from "../core/firestore";
import { salutoEpico } from "../utils/salutiEpici";
import { completeQuest } from "../utils/questEngine";

export async function continueConversation(userName: string, message: string): Promise<string> {
  const collab = userName.toUpperCase();
  const msg = message.trim();

  // Recupera profilo collaboratore
  const doc = await db.collection("collaborators").doc(collab).get();
  if (!doc.exists) {
    return `👤 ${collab} non è ancora registrato in AMBARADAM.`;
  }
  const profile = doc.data();

  // Controlla se il messaggio completa una quest
  if (msg.toLowerCase().includes("quest selesai") || msg.toLowerCase().includes("quest completa")) {
    return await completeQuest(collab);
  }

  // Controlla parole segrete
  if (profile.secretWord && msg.includes(profile.secretWord)) {
    return `🤫 La parola segreta di ${collab} è stata pronunciata!\n✨ Rituale: ${profile.ritual}`;
  }

  // Altrimenti → risposta con tono del collaboratore
  let rispostaBase = "";
  switch (profile.tone) {
    case "ID_slang":
      rispostaBase = `😎 ${collab}, gue ngerti maksud lo. Santai aja, kita beresin bareng.`;
      break;
    case "UA":
      rispostaBase = `🇺🇦 ${collab}, con orgoglio e forza, affrontiamo insieme questa sfida.`;
      break;
    case "IT_epico":
      rispostaBase = `⚔️ ${collab}, ogni tua parola è un passo verso la leggenda.`;
      break;
    default:
      rispostaBase = `💬 ${collab}, ho ricevuto il tuo messaggio: "${msg}"`;
  }

  // Integra rituale (se definito)
  const rituale = profile.ritual ? `\n🔮 Rituale: ${profile.ritual}` : "";

  return `${rispostaBase}${rituale}`;
}