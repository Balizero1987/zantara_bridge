import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp(); // usa ADC su Cloud Run o credenziali locali
}
const db = admin.firestore();

async function main() {
  const snap = await db.collection("fileIndex").limit(5).get();
  if (snap.empty) {
    console.log("⚠️ Nessun documento trovato in fileIndex");
    return;
  }
  snap.forEach((doc) => {
    console.log("📄", doc.id, doc.data());
  });
}

main().catch((e) => {
  console.error("❌ Errore:", e);
  process.exit(1);
});
