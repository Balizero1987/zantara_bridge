import { db } from '../core/firestore';

type Quest = {
  quest: string;
};

const questMap: Record<string, Quest> = {
  "DEA": { quest: "Fai sorridere 3 persone oggi e raccontamelo domani. ✨" },
  "KRISHNA": { quest: "Completa una lista di 5 cose e cancella almeno 4 entro stasera. ✅" },
  "VINO": { quest: "Proponi un'idea out-of-the-box anche se sembra folle. 🎨" },
  "FAISHA": { quest: "Trova una norma nuova uscita questa settimana e spiegamela in 2 frasi. 🧾" },
  "RINA": { quest: "Scrivi il saluto più accogliente che ti viene in mente per un ospite immaginario. 🌸" },
  "ARI": { quest: "Segna un nuovo milestone personale della tua vita e condividilo. 💍" },
  "SURYA": { quest: "Spiega un concetto complesso in esattamente 3 step. 📚" },
  "AMANDA": { quest: "Organizza una mini-agenda di oggi in 3 punti. 📒" },
  "ADIT": { quest: "Risolvi un problema veloce… poi ripensalo con calma. ⚡" },
  "ANTON": { quest: "Prendi una decisione oggi senza fronzoli: solo sì o no. 🎯" },
  "MARTA": { quest: "Analizza una situazione da 3 punti di vista diversi. 🧐" },
  "VERONIKA": { quest: "Trova l'ordine perfetto in una situazione caotica. 📊" },
  "ANGEL": { quest: "Esamina un dettaglio che tutti hanno trascurato. 🔎" },
  "KADEK": { quest: "Costruisci una logica per risolvere un problema complesso. 📐" },
  "DEWA_AYU": { quest: "Organizza 3 elementi disordinati in perfetta armonia. 🗂️" },
  "OLENA": { quest: "Visualizza la strategia più ampia dietro un piccolo problema. 🌐" },
  "NINA": { quest: "Racconta una storia che ispiri il tuo team. 🎤" },
  "SAHIRA": { quest: "Trasforma una preoccupazione in un'opportunità di crescita. 🌟" },
  "RUSLANA": { quest: "Guida con l'esempio in una situazione difficile. 👑" },
  "BOSS": { quest: "Esplora una possibilità che nessuno ha ancora immaginato. 🌀" }
};

export interface QuestRecord {
  quest: string;
  assignedAt: string;
  status: 'assigned' | 'completed' | 'skipped';
  completedAt?: string;
  response?: string;
}

export async function assegnaQuest(collaboratore: string): Promise<string> {
  try {
    const doc = await db.collection("collaborators").doc(collaboratore.toUpperCase()).get();
    
    if (!doc.exists) {
      return "Completa la registrazione in AMBARADAM per ricevere la tua quest personale.";
    }

    const profile = doc.data();
    return profile?.quest || "Scopri il tuo destino nell'AMBARADAM.";
  } catch (error) {
    console.error("Errore nel recuperare la quest:", error);
    return "Le stelle non sono allineate. Riprova più tardi.";
  }
}

/**
 * Completa una quest e registra il completamento
 */
export async function completeQuest(collab: string): Promise<string> {
  try {
    const doc = await db.collection("collaborators").doc(collab.toUpperCase()).get();
    
    if (!doc.exists) {
      return `👤 ${collab} non è registrato in AMBARADAM.`;
    }

    const profile = doc.data();
    const questText = profile?.quest || "Quest sconosciuta";

    // Registra il completamento
    await db.collection("quest_completions").add({
      collab: collab.toUpperCase(),
      questText,
      completedAt: new Date().toISOString(),
      badge: profile?.badge || "👤"
    });

    return `🏆 Quest completata per ${collab} (${profile?.badge}): "${questText}"`;
  } catch (error) {
    console.error("Errore nel completare la quest:", error);
    return "❌ Errore nel completare la quest. Le pergamene magiche sono temporaneamente illeggibili.";
  }
}

export async function completaQuest(collaboratore: string, questId: string, response: string): Promise<void> {
  const collab = collaboratore.toUpperCase();
  const now = new Date().toISOString();

  await db
    .collection("collaborators")
    .doc(collab)
    .collection("quests")
    .doc(questId)
    .update({
      status: "completed",
      completedAt: now,
      response: response
    });
}

export async function getActiveQuests(collaboratore: string): Promise<QuestRecord[]> {
  const collab = collaboratore.toUpperCase();
  
  const snapshot = await db
    .collection("collaborators")
    .doc(collab)
    .collection("quests")
    .where("status", "==", "assigned")
    .orderBy("assignedAt", "desc")
    .limit(5)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestRecord & { id: string }));
}

export async function getQuestStats(collaboratore?: string): Promise<any> {
  if (collaboratore) {
    const collab = collaboratore.toUpperCase();
    const snapshot = await db
      .collection("collaborators")
      .doc(collab)
      .collection("quests")
      .get();

    const quests = snapshot.docs.map(doc => doc.data() as QuestRecord);
    const completed = quests.filter(q => q.status === 'completed').length;
    const total = quests.length;

    return {
      collaboratore: collab,
      totalQuests: total,
      completedQuests: completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      recentQuests: quests.slice(0, 3)
    };
  }

  // Global stats per tutti i collaboratori
  const allCollabs = Object.keys(questMap);
  const stats = await Promise.all(
    allCollabs.map(async (collab) => {
      return await getQuestStats(collab);
    })
  );

  return {
    totalCollaborators: allCollabs.length,
    collaboratorStats: stats,
    mostActive: stats
      .filter(s => s.totalQuests > 0)
      .sort((a, b) => b.completedQuests - a.completedQuests)
      .slice(0, 5)
  };
}