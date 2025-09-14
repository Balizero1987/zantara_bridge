const { db } = require('../core/firestore');

class ConversationMemoryService {
  constructor() {
    this.memoryCache = new Map();
    this.MAX_MEMORY_TURNS = 20;
    this.CACHE_TTL = 3600000; // 1 hour
  }

  async getMemory(userId) {
    if (this.memoryCache.has(userId)) {
      const cached = this.memoryCache.get(userId);
      if (Date.now() - cached.lastActive < this.CACHE_TTL) {
        return cached;
      }
    }

    try {
      const doc = await db.collection('userMemory').doc(userId).get();
      if (doc.exists) {
        const data = doc.data();
        this.memoryCache.set(userId, data);
        return data;
      }
    } catch (error) {
      console.error('Error loading memory:', error);
    }

    const newMemory = {
      userId,
      conversations: [],
      preferences: {},
      lastActive: Date.now()
    };
    
    this.memoryCache.set(userId, newMemory);
    return newMemory;
  }

  async addConversation(userId, userMessage, assistantResponse) {
    const memory = await this.getMemory(userId);
    
    memory.conversations.push(
      { role: 'user', content: userMessage, timestamp: Date.now() },
      { role: 'assistant', content: assistantResponse, timestamp: Date.now() }
    );
    
    if (memory.conversations.length > this.MAX_MEMORY_TURNS * 2) {
      memory.conversations = memory.conversations.slice(-this.MAX_MEMORY_TURNS * 2);
    }
    
    memory.lastActive = Date.now();
    
    this.memoryCache.set(userId, memory);
    await this.persistMemory(userId, memory);
  }

  async getContextMessages(userId) {
    const memory = await this.getMemory(userId);
    
    if (memory.conversations.length === 0) {
      return [];
    }
    
    const recentTurns = memory.conversations.slice(-10);
    
    return recentTurns.map(turn => ({
      role: turn.role,
      content: turn.content
    }));
  }

  async persistMemory(userId, memory) {
    try {
      await db.collection('userMemory').doc(userId).set(memory, { merge: true });
    } catch (error) {
      console.error('Error persisting memory:', error);
    }
  }
}

const conversationMemory = new ConversationMemoryService();
module.exports = conversationMemory;