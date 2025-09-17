import paroleSegrete from '../config/paroleSegrete.json';
import { db } from '../core/firestore';

export interface SecretWord {
  secretWord: string;
  ritual: string;
}

export interface UserSecretWord extends SecretWord {
  userId: string;
  createdAt?: number;
  lastUsed?: number;
  useCount?: number;
}

/**
 * Service per gestire le parole segrete personalizzate di ogni collaboratore
 */
export class ParoleSegreteService {
  private static defaultSecrets: Record<string, SecretWord> = paroleSegrete;
  private static COLLECTION = 'secret_words';

  /**
   * Ottiene la parola segreta di un utente (da default o Firestore)
   */
  static async getUserSecretWord(userId: string): Promise<UserSecretWord | null> {
    try {
      // Prima controlla Firestore per parole personalizzate
      const doc = await db.collection(this.COLLECTION).doc(userId.toUpperCase()).get();
      
      if (doc.exists && doc.data()?.secretWord) {
        return doc.data() as UserSecretWord;
      }

      // Fallback ai default (generalmente vuoti)
      const defaultSecret = this.defaultSecrets[userId.toUpperCase()];
      if (defaultSecret && defaultSecret.secretWord) {
        return {
          userId: userId.toUpperCase(),
          ...defaultSecret
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting secret word:', error);
      return null;
    }
  }

  /**
   * Imposta o aggiorna la parola segreta di un utente
   */
  static async setUserSecretWord(userId: string, secretWord: string, ritual: string): Promise<void> {
    const userSecretWord: UserSecretWord = {
      userId: userId.toUpperCase(),
      secretWord,
      ritual,
      createdAt: Date.now(),
      lastUsed: 0,
      useCount: 0
    };

    await db.collection(this.COLLECTION).doc(userId.toUpperCase()).set(userSecretWord);
  }

  /**
   * Controlla se un messaggio contiene la parola segreta di un utente
   */
  static async checkSecretWord(userId: string, message: string): Promise<boolean> {
    const userSecret = await this.getUserSecretWord(userId);
    if (!userSecret || !userSecret.secretWord) return false;

    // Controlla sia parole che emoji
    return message.includes(userSecret.secretWord);
  }

  /**
   * Ottiene il rituale da eseguire per la parola segreta
   */
  static async getSecretRitual(userId: string, message: string): Promise<string | null> {
    const isSecretWord = await this.checkSecretWord(userId, message);
    if (!isSecretWord) return null;

    const userSecret = await this.getUserSecretWord(userId);
    if (!userSecret) return null;

    // Aggiorna statistiche di utilizzo
    await this.incrementUsage(userId);

    return userSecret.ritual;
  }

  /**
   * Incrementa il contatore di utilizzo
   */
  private static async incrementUsage(userId: string): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION).doc(userId.toUpperCase());
      await docRef.update({
        lastUsed: Date.now(),
        useCount: (await docRef.get()).data()?.useCount + 1 || 1
      });
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  }

  /**
   * Rimuove la parola segreta di un utente
   */
  static async removeUserSecretWord(userId: string): Promise<void> {
    await db.collection(this.COLLECTION).doc(userId.toUpperCase()).delete();
  }

  /**
   * Ottiene tutti gli utenti con parole segrete attive
   */
  static async getAllActiveSecrets(): Promise<UserSecretWord[]> {
    try {
      const snapshot = await db.collection(this.COLLECTION).get();
      return snapshot.docs
        .map(doc => doc.data() as UserSecretWord)
        .filter(secret => secret.secretWord && secret.ritual);
    } catch (error) {
      console.error('Error getting all secrets:', error);
      return [];
    }
  }

  /**
   * Ottiene statistiche per debug
   */
  static async getStats() {
    const activeSecrets = await this.getAllActiveSecrets();
    return {
      totalUsers: Object.keys(this.defaultSecrets).length,
      activeSecrets: activeSecrets.length,
      mostUsed: activeSecrets
        .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
        .slice(0, 5)
        .map(s => ({ userId: s.userId, useCount: s.useCount || 0, secretWord: s.secretWord }))
    };
  }

  /**
   * Esempio di setup per testing
   */
  static async setupExamples(): Promise<void> {
    const examples = [
      { userId: 'DEA', secretWord: '✨', ritual: 'Dea, sparkle lo always lo porti! Keep shining ✨' },
      { userId: 'VINO', secretWord: '🎨', ritual: 'Vino, kreativitas lo memang luar biasa! Art is life 🎨' },
      { userId: 'ARI', secretWord: '💍', ritual: 'Ri, selamat ya untuk milestone baru! Semoga bahagia selalu 💍' }
    ];

    for (const example of examples) {
      await this.setUserSecretWord(example.userId, example.secretWord, example.ritual);
    }
  }
}

export default ParoleSegreteService;