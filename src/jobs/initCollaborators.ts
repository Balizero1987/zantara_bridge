import { importCollaborators } from "../services/collaboratorService";

/**
 * Job di inizializzazione per importare i profili collaboratori
 * Da eseguire una volta per popolare Firestore
 */
export async function initializeCollaborators() {
  console.log("🚀 Inizializzazione profili collaboratori AMBARADAM");
  
  try {
    await importCollaborators();
    console.log("✅ Profili collaboratori inizializzati con successo!");
  } catch (error: any) {
    console.error("❌ Errore inizializzazione collaboratori:", error.message);
    throw error;
  }
}

// Auto-run se chiamato direttamente
if (require.main === module) {
  initializeCollaborators()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}