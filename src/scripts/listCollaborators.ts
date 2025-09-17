import { db } from "../core/firestore";

async function listCollaborators() {
  try {
    console.log("📋 Lettura collaboratori da Firestore...");

    const snapshot = await db.collection("collaborators").get();

    if (snapshot.empty) {
      console.log("⚠️ Nessun collaboratore trovato in Firestore.");
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`✅ ${data.name} | ${data.role} | ${data.badge} | ${data.tone}`);
    });

    console.log("🎉 Verifica completata!");
  } catch (err: any) {
    console.error("❌ Errore nella lettura collaboratori:", err.message);
    process.exit(1);
  }
}

listCollaborators();