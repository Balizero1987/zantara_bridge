import rituali from '../config/rituali.json';
import badges from '../config/badges.json';

export interface Ritual {
  trigger: string[];
  ritual: string;
  example: string;
}

export interface RitualiData {
  [userId: string]: Ritual;
}

/**
 * Service per gestire i rituali personalizzati di ogni collaboratore
 */
export class RitualiService {
  private static rituali: RitualiData = rituali as RitualiData;

  /**
   * Ottiene il rituale per un utente specifico
   */
  static getRitual(userId: string): Ritual | null {
    const userRitual = this.rituali[userId.toUpperCase()];
    return userRitual || null;
  }

  /**
   * Controlla se un messaggio contiene trigger per un utente
   */
  static checkTrigger(userId: string, message: string): boolean {
    const ritual = this.getRitual(userId);
    if (!ritual) return false;

    const messageWords = message.toLowerCase().split(' ');
    return ritual.trigger.some(trigger => 
      messageWords.includes(trigger.toLowerCase()) ||
      message.toLowerCase().includes(trigger.toLowerCase())
    );
  }

  /**
   * Ottiene esempio di risposta personalizzata
   */
  static getExample(userId: string): string | null {
    const ritual = this.getRitual(userId);
    return ritual?.example || null;
  }

  /**
   * Ottiene la descrizione del rituale
   */
  static getRitualDescription(userId: string): string | null {
    const ritual = this.getRitual(userId);
    return ritual?.ritual || null;
  }

  /**
   * Lista tutti gli utenti con rituali definiti
   */
  static getAllUsers(): string[] {
    return Object.keys(this.rituali);
  }

  /**
   * Ottiene tutti i trigger per debug/testing
   */
  static getAllTriggers(): Record<string, string[]> {
    const triggers: Record<string, string[]> = {};
    Object.entries(this.rituali).forEach(([userId, ritual]) => {
      triggers[userId] = ritual.trigger;
    });
    return triggers;
  }

  /**
   * Ottiene il badge personalizzato per un utente
   */
  static getBadge(userId: string): string | null {
    return badges[userId.toUpperCase() as keyof typeof badges] || null;
  }

  /**
   * Ottiene il nome formattato con badge
   */
  static getFormattedName(userId: string, name?: string): string {
    const badge = this.getBadge(userId);
    const displayName = name || userId;
    return badge ? `${badge} ${displayName}` : displayName;
  }

  /**
   * Ottiene tutti i badges per debug/testing
   */
  static getAllBadges(): Record<string, string> {
    return { ...badges };
  }
}

export default RitualiService;