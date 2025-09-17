import curiosita from '../config/curiosita.json';
import { db } from '../core/firestore';

export interface Question {
  id: number;
  text: string;
  category: string;
}

export interface UserAnswer {
  userId: string;
  questionId: number;
  answer: string;
  timestamp: number;
  category: string;
}

/**
 * Service per gestire le domande di curiosità e le risposte personalizzate
 */
export class CuriositaService {
  private static questions: Question[] = curiosita.questions;
  private static COLLECTION = 'zantara_questions';

  /**
   * Ottiene una domanda casuale
   */
  static getRandomQuestion(): Question {
    const randomIndex = Math.floor(Math.random() * this.questions.length);
    return this.questions[randomIndex];
  }

  /**
   * Ottiene una domanda casuale per categoria
   */
  static getRandomQuestionByCategory(category: string): Question | null {
    const categoryQuestions = this.questions.filter(q => q.category === category);
    if (categoryQuestions.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * categoryQuestions.length);
    return categoryQuestions[randomIndex];
  }

  /**
   * Ottiene una domanda specifica per ID
   */
  static getQuestionById(id: number): Question | null {
    return this.questions.find(q => q.id === id) || null;
  }

  /**
   * Ottiene tutte le categorie disponibili
   */
  static getAllCategories(): string[] {
    const categories = new Set(this.questions.map(q => q.category));
    return Array.from(categories).sort();
  }

  /**
   * Salva una risposta dell'utente in Firestore
   */
  static async saveUserAnswer(userId: string, questionId: number, answer: string): Promise<void> {
    const question = this.getQuestionById(questionId);
    if (!question) throw new Error('Question not found');

    const userAnswer: UserAnswer = {
      userId,
      questionId,
      answer,
      timestamp: Date.now(),
      category: question.category
    };

    await db.collection(this.COLLECTION)
      .doc(userId)
      .collection('answers')
      .doc(questionId.toString())
      .set(userAnswer);
  }

  /**
   * Ottiene le risposte di un utente
   */
  static async getUserAnswers(userId: string): Promise<UserAnswer[]> {
    const snapshot = await db.collection(this.COLLECTION)
      .doc(userId)
      .collection('answers')
      .orderBy('timestamp', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data() as UserAnswer);
  }

  /**
   * Ottiene risposte per categoria
   */
  static async getUserAnswersByCategory(userId: string, category: string): Promise<UserAnswer[]> {
    const snapshot = await db.collection(this.COLLECTION)
      .doc(userId)
      .collection('answers')
      .where('category', '==', category)
      .orderBy('timestamp', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data() as UserAnswer);
  }

  /**
   * Controlla se un utente ha già risposto a una domanda
   */
  static async hasUserAnswered(userId: string, questionId: number): Promise<boolean> {
    const doc = await db.collection(this.COLLECTION)
      .doc(userId)
      .collection('answers')
      .doc(questionId.toString())
      .get();

    return doc.exists;
  }

  /**
   * Ottiene una domanda che l'utente non ha ancora risposto
   */
  static async getUnansweredQuestion(userId: string): Promise<Question | null> {
    const userAnswers = await this.getUserAnswers(userId);
    const answeredQuestionIds = new Set(userAnswers.map(a => a.questionId));
    
    const unansweredQuestions = this.questions.filter(q => !answeredQuestionIds.has(q.id));
    
    if (unansweredQuestions.length === 0) {
      // Tutti risposti, restituisce una domanda casuale
      return this.getRandomQuestion();
    }

    const randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
    return unansweredQuestions[randomIndex];
  }

  /**
   * Statistiche per debug
   */
  static getStats() {
    return {
      totalQuestions: this.questions.length,
      categories: this.getAllCategories(),
      categoryCounts: this.getAllCategories().reduce((acc, cat) => {
        acc[cat] = this.questions.filter(q => q.category === cat).length;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export default CuriositaService;