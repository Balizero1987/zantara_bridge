import { db } from '../core/firestore';
import { cacheService } from './cache';

interface ConversationEntry {
  userId: string;
  message: string;
  reply: string;
  timestamp: Date;
  language?: string;
  metadata?: Record<string, any>;
}

class ConversationMemoryService {
  private readonly COLLECTION_NAME = 'conversations';
  private readonly MAX_CONTEXT_MESSAGES = 10;
  private readonly MEMORY_CACHE_TTL = 3600; // 1 hour

  async addConversation(
    userId: string,
    message: string,
    reply: string,
    language?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const entry: ConversationEntry = {
        userId,
        message,
        reply,
        timestamp: new Date(),
        language,
        metadata
      };

      // Save to Firestore
      await db.collection(this.COLLECTION_NAME).add(entry);

      // Invalidate user's context cache
      const cacheKey = `context_${userId}`;
      await cacheService.delete(cacheKey);

      console.log(`Saved conversation for user: ${userId}`);
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }

  async getContextMessages(userId: string): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      // Check cache first
      const cacheKey = `context_${userId}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Query recent conversations
      const snapshot = await db.collection(this.COLLECTION_NAME)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(this.MAX_CONTEXT_MESSAGES)
        .get();

      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      // Build context messages in chronological order
      const conversations = snapshot.docs.reverse();
      
      for (const doc of conversations) {
        const data = doc.data() as ConversationEntry;
        messages.push(
          { role: 'user', content: data.message },
          { role: 'assistant', content: data.reply }
        );
      }

      // Cache the context
      await cacheService.set(
        cacheKey,
        JSON.stringify(messages),
        this.MEMORY_CACHE_TTL,
        'context',
        'system'
      );

      return messages;
    } catch (error) {
      console.error('Failed to get context messages:', error);
      return [];
    }
  }

  async getUserConversations(
    userId: string,
    limit: number = 20
  ): Promise<ConversationEntry[]> {
    try {
      const snapshot = await db.collection(this.COLLECTION_NAME)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => doc.data() as ConversationEntry);
    } catch (error) {
      console.error('Failed to get user conversations:', error);
      return [];
    }
  }

  async clearUserConversations(userId: string): Promise<number> {
    try {
      const snapshot = await db.collection(this.COLLECTION_NAME)
        .where('userId', '==', userId)
        .get();

      const batch = db.batch();
      let count = 0;

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        count++;
      });

      await batch.commit();

      // Clear cache
      const cacheKey = `context_${userId}`;
      await cacheService.delete(cacheKey);

      console.log(`Cleared ${count} conversations for user: ${userId}`);
      return count;
    } catch (error) {
      console.error('Failed to clear conversations:', error);
      return 0;
    }
  }

  async getConversationStats(userId?: string): Promise<{
    totalConversations: number;
    uniqueUsers: number;
    averageLength: number;
    languages: Record<string, number>;
  }> {
    try {
      let query = db.collection(this.COLLECTION_NAME);
      
      if (userId) {
        query = query.where('userId', '==', userId) as any;
      }

      const snapshot = await query.get();
      
      const stats = {
        totalConversations: snapshot.size,
        uniqueUsers: 0,
        averageLength: 0,
        languages: {} as Record<string, number>
      };

      const users = new Set<string>();
      let totalLength = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data() as ConversationEntry;
        users.add(data.userId);
        totalLength += data.message.length + data.reply.length;
        
        if (data.language) {
          stats.languages[data.language] = (stats.languages[data.language] || 0) + 1;
        }
      });

      stats.uniqueUsers = users.size;
      stats.averageLength = snapshot.size > 0 ? Math.round(totalLength / snapshot.size) : 0;

      return stats;
    } catch (error) {
      console.error('Failed to get conversation stats:', error);
      return {
        totalConversations: 0,
        uniqueUsers: 0,
        averageLength: 0,
        languages: {}
      };
    }
  }
}

export default new ConversationMemoryService();