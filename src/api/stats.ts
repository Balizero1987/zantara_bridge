import { Router } from "express";
import { db } from "../core/firestore";

const router = Router();

router.get("/", async (req, res) => {
  try {
    // Conta Note
    const notesFirestore = await db.collection("notes").where("storage", "==", "firestore").get();
    const notesDrive = await db.collection("notes").where("storage", "==", "drive").get();

    // Conta Upload
    const uploadsFirestore = await db.collection("uploads").where("storage", "==", "firestore").get();
    const uploadsDrive = await db.collection("uploads").where("storage", "==", "drive").get();

    // Conta Conversazioni
    const convOpen = await db.collection("conversations").where("status", "==", "open").get();
    const convClosed = await db.collection("conversations").where("status", "==", "closed").get();

    // Conta Quest
    const questAssigned = await db.collectionGroup("quests").where("status", "==", "assigned").get();
    const questCompleted = await db.collectionGroup("quests").where("status", "==", "completed").get();

    return res.json({
      ok: true,
      stats: {
        notes: {
          firestore: notesFirestore.size,
          drive: notesDrive.size
        },
        uploads: {
          firestore: uploadsFirestore.size,
          drive: uploadsDrive.size
        },
        conversations: {
          open: convOpen.size,
          closed: convClosed.size
        },
        quests: {
          assigned: questAssigned.size,
          completed: questCompleted.size
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("❌ Errore Stats:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;