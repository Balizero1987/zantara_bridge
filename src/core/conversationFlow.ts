import { db } from "../core/firestore";
import { salutoEpico } from "../utils/salutiEpici";
import { assegnaQuest } from "../utils/questEngine";

const PORTE_MAGICHE = ["AMBARADAM", "CONTRACTS", "BRIEF"];

export async function startConversation(userName: string, firstMessage: string): Promise<string> {
  const collab = userName.toUpperCase();
  const msg = firstMessage.toUpperCase();

  // Verifica parola magica
  const haPorta = PORTE_MAGICHE.some(p => msg.includes(p));
  if (!haPorta) {
    return `🚪 La porta resta chiusa.\n❓ Pronuncia la parola magica per entrare.`;
  }

  // Recupera profilo collaboratore da Firestore
  const doc = await db.collection("collaborators").doc(collab).get();
  if (!doc.exists) {
    return `🚪 La porta si apre, ma ${collab} non è ancora registrato in AMBARADAM.`;
  }
  const profile = doc.data();

  // Saluto epico
  const saluto = salutoEpico(collab);

  // Quest personalizzata
  const quest = await assegnaQuest(collab);

  return `✨ La porta dell'AMBARADAM si apre… ${collab} (${profile?.badge || "?"}) varca la soglia.\n${saluto}\n🗡️ Quest: ${quest}`;
}