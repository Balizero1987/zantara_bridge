import { firestore } from '../firebase';
import * as admin from 'firebase-admin';
import { getCollaboratorProfile } from './collaboratorService';
import { analyzeMessage, saveOptimizedMessage, cacheConversation, getCachedConversation } from "../utils/conversationOptimizer";
import { generateSummary } from "../utils/summarizer";
import { 
  Conversation, 
  ConversationMessage, 
  ConversationArtifact, 
  ConversationQuery, 
  ConversationAnalysis,
  ConversationMetrics,
  MoodType,
  ConversationStatus
} from '../types/conversations';

export class ConversationService {
  private db = firestore;
  private conversationsRef = this.db.collection('conversations');

  /**
   * Create a new conversation
   */
  async createConversation(collab: string, initialMessage?: string): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversationId = `conv_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}_${collab}_${String(Date.now()).slice(-3)}`;

    // Recupera profilo collaboratore per personalizzazione
    const profile = await getCollaboratorProfile(collab);
    
    const conversation: Conversation = {
      id: conversationId,
      collab: collab.toUpperCase(),
      startedAt: now,
      lastMessageAt: now,
      status: 'open',
      tags: profile ? [profile.role.split(' - ')[1] || 'general'] : [],
      moodTrend: [],
      messageCount: 0,
      artifactCount: 0,
      collaboratorBadge: profile?.badge || '👤',
      collaboratorTone: profile?.tone || 'neutral'
    };

    await this.conversationsRef.doc(conversationId).set(conversation);

    // Add initial message if provided
    if (initialMessage) {
      await this.addMessage(conversationId, 'collab', initialMessage);
    }

    return conversation;
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const doc = await this.conversationsRef.doc(conversationId).get();
    return doc.exists ? (doc.data() as Conversation) : null;
  }

  /**
   * Get or create active conversation for collaborator
   */
  async getOrCreateActiveConversation(collab: string): Promise<Conversation> {
    const query = await this.conversationsRef
      .where('collab', '==', collab.toUpperCase())
      .where('status', '==', 'open')
      .orderBy('lastMessageAt', 'desc')
      .limit(1)
      .get();

    if (!query.empty) {
      return query.docs[0].data() as Conversation;
    }

    return this.createConversation(collab);
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    conversationId: string, 
    sender: 'collab' | 'zantara' | 'system', 
    text: string,
    mood?: MoodType,
    trigger?: string
  ): Promise<ConversationMessage> {
    const now = new Date().toISOString();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const message: ConversationMessage = {
      id: messageId,
      sender,
      text,
      timestamp: now,
      mood,
      trigger
    };

    // Add message to subcollection
    await this.conversationsRef
      .doc(conversationId)
      .collection('messages')
      .doc(messageId)
      .set(message);

    // Update conversation metadata
    const updateData: any = {
      lastMessageAt: now,
      messageCount: admin.firestore.FieldValue.increment(1)
    };

    if (mood) {
      updateData.moodTrend = admin.firestore.FieldValue.arrayUnion(mood);
    }

    await this.conversationsRef.doc(conversationId).update(updateData);

    return message;
  }

  /**
   * Add artifact to conversation
   */
  async addArtifact(
    conversationId: string, 
    artifact: Omit<ConversationArtifact, 'id' | 'createdAt'>
  ): Promise<ConversationArtifact> {
    const now = new Date().toISOString();
    const artifactId = `art_${Date.now()}_${artifact.type}`;

    const fullArtifact: ConversationArtifact = {
      id: artifactId,
      createdAt: now,
      ...artifact
    };

    // Add artifact to subcollection
    await this.conversationsRef
      .doc(conversationId)
      .collection('artifacts')
      .doc(artifactId)
      .set(fullArtifact);

    // Update conversation artifact count
    await this.conversationsRef.doc(conversationId).update({
      artifactCount: admin.firestore.FieldValue.increment(1)
    });

    return fullArtifact;
  }

  /**
   * Update conversation summary
   */
  async updateSummary(
    conversationId: string, 
    summary: { short?: string; bullets?: string[]; narrative?: string }
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const updatedSummary = {
      short: summary.short || conversation.summary?.short || '',
      bullets: summary.bullets || conversation.summary?.bullets || [],
      narrative: summary.narrative || conversation.summary?.narrative || ''
    };

    await this.conversationsRef.doc(conversationId).update({
      summary: updatedSummary
    });
  }

  /**
   * Add tags to conversation
   */
  async addTags(conversationId: string, tags: string[]): Promise<void> {
    await this.conversationsRef.doc(conversationId).update({
      tags: admin.firestore.FieldValue.arrayUnion(...tags)
    });
  }

  /**
   * Close conversation
   */
  async closeConversation(conversationId: string, reason?: string): Promise<void> {
    const updateData: any = {
      status: 'closed' as ConversationStatus,
      closedAt: new Date().toISOString()
    };

    if (reason) {
      updateData.closeReason = reason;
    }

    await this.conversationsRef.doc(conversationId).update(updateData);
  }

  /**
   * Query conversations
   */
  async queryConversations(query: ConversationQuery): Promise<Conversation[]> {
    let firestoreQuery: admin.firestore.Query = this.conversationsRef.orderBy('lastMessageAt', 'desc');

    if (query.collab) {
      firestoreQuery = firestoreQuery.where('collab', '==', query.collab.toUpperCase());
    }

    if (query.status) {
      firestoreQuery = firestoreQuery.where('status', '==', query.status);
    }

    if (query.tags && query.tags.length > 0) {
      firestoreQuery = firestoreQuery.where('tags', 'array-contains-any', query.tags);
    }

    if (query.limit) {
      firestoreQuery = firestoreQuery.limit(query.limit);
    }

    const snapshot = await firestoreQuery.get();
    return snapshot.docs.map(doc => doc.data() as Conversation);
  }

  /**
   * Get conversation messages
   */
  async getMessages(conversationId: string, limit = 50): Promise<ConversationMessage[]> {
    const snapshot = await this.conversationsRef
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data() as ConversationMessage);
  }

  /**
   * Get conversation artifacts
   */
  async getArtifacts(conversationId: string): Promise<ConversationArtifact[]> {
    const snapshot = await this.conversationsRef
      .doc(conversationId)
      .collection('artifacts')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data() as ConversationArtifact);
  }

  /**
   * Analyze conversation for insights
   */
  async analyzeConversation(conversationId: string): Promise<ConversationAnalysis> {
    const messages = await this.getMessages(conversationId);
    const artifacts = await this.getArtifacts(conversationId);

    // Extract keywords from messages
    const allText = messages.map(m => m.text).join(' ');
    const words = allText.toLowerCase().match(/\b\w+\b/g) || [];
    const wordCount: Record<string, number> = {};
    
    words.forEach(word => {
      if (word.length > 3) { // Ignore short words
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });

    const extractedKeywords = Object.entries(wordCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([word]) => word);

    // Suggest tags based on keywords and existing patterns
    const suggestedTags = this.generateSuggestedTags(extractedKeywords, messages);

    // Analyze mood patterns
    const moods = messages.filter(m => m.mood).map(m => m.mood!);
    const moodCounts = moods.reduce((acc, mood) => {
      acc[mood] = (acc[mood] || 0) + 1;
      return acc;
    }, {} as Record<MoodType, number>);

    const primaryMood = Object.entries(moodCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] as MoodType || 'casual';

    // Detect mood shifts
    const moodShifts = [];
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];
      if (prev.mood && curr.mood && prev.mood !== curr.mood) {
        moodShifts.push({
          from: prev.mood,
          to: curr.mood,
          messageId: curr.id
        });
      }
    }

    return {
      extractedKeywords,
      suggestedTags,
      knowledgeSnippets: this.extractKnowledgeSnippets(messages),
      questSuggestions: this.generateQuestSuggestions(messages, extractedKeywords),
      moodAnalysis: {
        primaryMood,
        moodShifts,
        overallSentiment: this.calculateSentiment(moods)
      }
    };
  }

  /**
   * Get conversation metrics
   */
  async getMetrics(timeframe?: { start: string; end: string }): Promise<ConversationMetrics> {
    let query: admin.firestore.Query = this.conversationsRef;

    if (timeframe) {
      query = query
        .where('startedAt', '>=', timeframe.start)
        .where('startedAt', '<=', timeframe.end);
    }

    const snapshot = await query.get();
    const conversations = snapshot.docs.map(doc => doc.data() as Conversation);

    // Calculate metrics
    const totalConversations = conversations.length;
    const activeConversations = conversations.filter(c => c.status === 'open').length;

    // Mood distribution
    const moodDistribution: Record<MoodType, number> = {} as Record<MoodType, number>;
    conversations.forEach(conv => {
      conv.moodTrend.forEach(mood => {
        moodDistribution[mood] = (moodDistribution[mood] || 0) + 1;
      });
    });

    // Collaborator stats
    const collabStatsMap: Record<string, any> = {};
    conversations.forEach(conv => {
      if (!collabStatsMap[conv.collab]) {
        collabStatsMap[conv.collab] = {
          collab: conv.collab,
          conversations: 0,
          lastActive: conv.lastMessageAt,
          avgMood: 'casual' as MoodType,
          questsGenerated: 0
        };
      }
      collabStatsMap[conv.collab].conversations++;
      if (conv.lastMessageAt > collabStatsMap[conv.collab].lastActive) {
        collabStatsMap[conv.collab].lastActive = conv.lastMessageAt;
      }
    });

    return {
      totalConversations,
      activeConversations,
      avgResponseTime: 0, // TODO: Calculate from message timestamps
      topTriggers: [], // TODO: Aggregate from messages
      moodDistribution,
      artifactGeneration: {
        notes: 0,
        quests: 0,
        events: 0,
        total: 0
      }, // TODO: Calculate from artifacts
      collabStats: Object.values(collabStatsMap)
    };
  }

  private generateSuggestedTags(keywords: string[], messages: ConversationMessage[]): string[] {
    const complianceKeywords = ['visa', 'kitas', 'kitap', 'voa', 'tax', 'pt', 'pma', 'permit', 'deadline', 'document'];
    const moodKeywords = ['stress', 'urgent', 'deadline', 'help', 'confused', 'thank'];
    const processKeywords = ['apply', 'submit', 'renew', 'extend', 'process', 'status'];

    const tags = [];

    // Check for compliance-related keywords
    if (keywords.some(k => complianceKeywords.includes(k))) {
      tags.push('compliance');
    }

    // Check for process-related keywords  
    if (keywords.some(k => processKeywords.includes(k))) {
      tags.push('process');
    }

    // Check for mood indicators
    if (keywords.some(k => moodKeywords.includes(k))) {
      tags.push('support');
    }

    // Check for specific document types
    if (keywords.some(k => ['kitas', 'visa'].includes(k))) {
      tags.push('visa');
    }

    if (keywords.some(k => ['tax', 'pajak'].includes(k))) {
      tags.push('tax');
    }

    return tags;
  }

  private extractKnowledgeSnippets(messages: ConversationMessage[]): Array<{
    content: string;
    category: string;
    reusability: 'high' | 'medium' | 'low';
  }> {
    // TODO: Implement AI-based knowledge extraction
    return [];
  }

  private generateQuestSuggestions(messages: ConversationMessage[], keywords: string[]): Array<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    estimatedDuration: string;
  }> {
    // TODO: Implement AI-based quest generation
    return [];
  }

  private calculateSentiment(moods: MoodType[]): 'positive' | 'negative' | 'neutral' {
    const positiveMoods = ['excited', 'relieved', 'confident', 'casual'];
    const negativeMoods = ['stressed', 'frustrated', 'confused', 'urgent'];

    const positiveCount = moods.filter(m => positiveMoods.includes(m)).length;
    const negativeCount = moods.filter(m => negativeMoods.includes(m)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Aggiungi messaggio con ottimizzazioni (mood score, trigger, cache)
   */
  async addOptimizedMessage(conversationId: string, message: ConversationMessage): Promise<void> {
    const analysis = analyzeMessage(message.text);
    const optimized = {
      ...message,
      moodScore: analysis.moodScore,
      trigger: analysis.trigger
    };

    await saveOptimizedMessage(conversationId, optimized);
  }

  /**
   * Recupera conversazione ottimizzata con cache e summary AI
   */
  async getOptimizedConversation(conversationId: string): Promise<any> {
    const cached = getCachedConversation(conversationId);
    if (cached) return cached;

    const doc = await this.conversationsRef.doc(conversationId).get();
    if (!doc.exists) return null;

    const messagesSnap = await this.conversationsRef.doc(conversationId).collection("messages").get();
    const messages = messagesSnap.docs.map(d => d.data().text);

    const summary = await generateSummary(messages);

    const result = { ...doc.data(), summary };
    cacheConversation(conversationId, result);
    return result;
  }
}

export const conversationService = new ConversationService();