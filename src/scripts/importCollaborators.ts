import { db } from "../core/firestore";
import fs from "fs";
import path from "path";

async function importCollaborators() {
  try {
    const filePath = path.resolve(__dirname, "../../data/collaboratori.json");
    const rawData = fs.readFileSync(filePath, "utf8");
    const collaborators = JSON.parse(rawData);

    console.log("🚀 Avvio import collaboratori in Firestore...");

    for (const [name, profile] of Object.entries(collaborators)) {
      const docRef = db.collection("collaborators").doc(name);

      await docRef.set({
        name,
        ...(profile as any),
        createdAt: new Date().toISOString()
      });

      console.log(`✅ Importato: ${name} (${(profile as any)["role"]})`);
    }

    console.log("🎉 Import completato con successo!");
  } catch (err: any) {
    console.error("❌ Errore import collaboratori:", err.message);
    process.exit(1);
  }
}

importCollaborators();