import { db } from "../core/firestore";
import collaboratori from "../data/collaboratori.json";

export interface CollaboratorProfile {
  role: string;
  badge: string;
  tone: string;
  ritual: string;
  quest: string;
}

/**
 * Importa tutti i profili collaboratori in Firestore
 */
export async function importCollaborators(): Promise<void> {
  console.log("🔄 Importazione profili collaboratori...");

  const batch = db.batch();
  
  for (const [name, profile] of Object.entries(collaboratori)) {
    const docRef = db.collection("collaborators").doc(name);
    batch.set(docRef, {
      name,
      ...profile,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  await batch.commit();
  console.log(`✅ Importati ${Object.keys(collaboratori).length} profili collaboratori`);
}

/**
 * Recupera profilo di un collaboratore
 */
export async function getCollaboratorProfile(name: string): Promise<CollaboratorProfile | null> {
  const doc = await db.collection("collaborators").doc(name.toUpperCase()).get();
  
  if (!doc.exists) {
    return null;
  }

  return doc.data() as CollaboratorProfile;
}

/**
 * Lista tutti i collaboratori
 */
export async function getAllCollaborators(): Promise<Record<string, CollaboratorProfile>> {
  const snapshot = await db.collection("collaborators").get();
  const result: Record<string, CollaboratorProfile> = {};

  snapshot.docs.forEach(doc => {
    result[doc.id] = doc.data() as CollaboratorProfile;
  });

  return result;
}

/**
 * Aggiorna profilo di un collaboratore
 */
export async function updateCollaboratorProfile(
  name: string, 
  updates: Partial<CollaboratorProfile>
): Promise<void> {
  await db.collection("collaborators")
    .doc(name.toUpperCase())
    .update({
      ...updates,
      updatedAt: new Date().toISOString()
    });

  console.log(`✅ Profilo ${name} aggiornato`);
}

/**
 * Filtra collaboratori per ruolo
 */
export async function getCollaboratorsByRole(roleFilter: string): Promise<Record<string, CollaboratorProfile>> {
  const snapshot = await db.collection("collaborators")
    .where("role", ">=", roleFilter)
    .where("role", "<=", roleFilter + '\uf8ff')
    .get();

  const result: Record<string, CollaboratorProfile> = {};
  
  snapshot.docs.forEach(doc => {
    result[doc.id] = doc.data() as CollaboratorProfile;
  });

  return result;
}