import { db } from './firestore';
import { getUserProfile, updateUserProfile } from './userProfiles';

// ============================
// CONTEXTUAL MEMORY TYPES
// ============================

export interface ConversationContext {
  canonicalOwner: string;
  sessionId: string;
  timestamp: number;
  message: string;
  response: string;
  topic: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  complexity: 'simple' | 'medium' | 'complex';
  responseTime: number;
  satisfaction?: number; // 1-5 rating
  relatedMemoryIds?: string[];
  crossReferences?: {
    similarTopics: number;
    lastSimilar: number;
    connectionStrength: number;
  };
}

export interface TopicFrequency {
  topic: string;
  count: number;
  lastMention: number;
  avgSatisfaction: number;
}

export interface UserContext {
  recentInteractions: ConversationContext[];
  currentSession: string;
  activeTopics: string[];
  workContext: {
    currentProjects: string[];
    urgentTasks: string[];
    preferences: Record<string, any>;
  };
}

// ============================
// CONTEXT EXTRACTION
// ============================

export function extractTopics(message: string): string[] {
  const topicKeywords: Record<string, string[]> = {
    'technical': ['code', 'bug', 'api', 'database', 'deploy', 'server', 'development'],
    'business': ['revenue', 'growth', 'strategy', 'market', 'customer', 'sales'],
    'project': ['deadline', 'milestone', 'task', 'meeting', 'planning', 'timeline'],
    'team': ['team', 'hire', 'management', 'collaboration', 'communication'],
    'personal': ['help', 'learn', 'understand', 'explain', 'how to'],
    'urgent': ['urgent', 'asap', 'emergency', 'critical', 'immediate', 'now'],
    'creative': ['design', 'innovative', 'creative', 'brainstorm', 'idea']
  };
  
  const messageLower = message.toLowerCase();
  const extractedTopics: string[] = [];
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => messageLower.includes(keyword))) {
      extractedTopics.push(topic);
    }
  }
  
  return extractedTopics.length > 0 ? extractedTopics : ['general'];
}

export function analyzeSentiment(message: string): 'positive' | 'neutral' | 'negative' {
  const positiveWords = ['good', 'great', 'excellent', 'perfect', 'amazing', 'love', 'happy'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'problem', 'issue', 'wrong', 'error'];
  
  const messageLower = message.toLowerCase();
  const positiveCount = positiveWords.filter(word => messageLower.includes(word)).length;
  const negativeCount = negativeWords.filter(word => messageLower.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

export function assessComplexity(message: string): 'simple' | 'medium' | 'complex' {
  const words = message.split(/\s+/).length;
  const hasQuestions = (message.match(/\?/g) || []).length;
  const hasMultipleParts = message.includes('and') || message.includes('also') || message.includes('plus');
  
  if (words < 10 && hasQuestions <= 1 && !hasMultipleParts) return 'simple';
  if (words > 30 || hasQuestions > 2 || hasMultipleParts) return 'complex';
  return 'medium';
}

// ============================
// MEMORY STORAGE & RETRIEVAL
// ============================

export async function storeConversationContext(
  canonicalOwner: string,
  message: string,
  response: string,
  responseTime: number,
  sessionId: string = generateSessionId()
): Promise<void> {
  try {
    const topics = extractTopics(message);
    const sentiment = analyzeSentiment(message);
    const complexity = assessComplexity(message);
    
    // Cross-reference with existing memories
    const relatedMemories = await findRelatedMemories(canonicalOwner, topics, message);
    
    const context: ConversationContext = {
      canonicalOwner,
      sessionId,
      timestamp: Date.now(),
      message,
      response,
      topic: topics[0] || 'general',
      sentiment,
      complexity,
      responseTime,
      relatedMemoryIds: relatedMemories.map(m => m.id),
      crossReferences: relatedMemories.length > 0 ? {
        similarTopics: relatedMemories.length,
        lastSimilar: relatedMemories[0]?.timestamp || 0,
        connectionStrength: calculateConnectionStrength(topics, relatedMemories)
      } : undefined
    };
    
    // Store in conversation history
    await db.collection('conversationHistory').add(context);
    
    // Update user profile memory
    const profile = await getUserProfile(canonicalOwner);
    const updatedMemory = {
      ...profile.memory,
      lastInteraction: Date.now(),
      recentTopics: [...new Set([...topics, ...profile.memory.recentTopics])].slice(0, 10),
      commonQuestions: updateCommonQuestions(profile.memory.commonQuestions, message)
    };
    
    await updateUserProfile(canonicalOwner, { memory: updatedMemory });
    
  } catch (error) {
    console.error('Error storing conversation context:', error);
  }
}

export async function getRecentUserContext(
  canonicalOwner: string,
  hours: number = 24
): Promise<UserContext> {
  try {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    const recentInteractions = await db.collection('conversationHistory')
      .where('canonicalOwner', '==', canonicalOwner)
      .where('timestamp', '>=', cutoff)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();
    
    const interactions = recentInteractions.docs.map(doc => doc.data() as ConversationContext);
    const activeTopics = [...new Set(interactions.map(i => i.topic))];
    
    // Get current session (last 30 minutes)
    const sessionCutoff = Date.now() - (30 * 60 * 1000);
    const currentSession = interactions.find(i => i.timestamp >= sessionCutoff)?.sessionId || generateSessionId();
    
    return {
      recentInteractions: interactions,
      currentSession,
      activeTopics,
      workContext: {
        currentProjects: extractProjects(interactions),
        urgentTasks: extractUrgentTasks(interactions),
        preferences: {}
      }
    };
    
  } catch (error) {
    console.error('Error getting recent user context:', error);
    return {
      recentInteractions: [],
      currentSession: generateSessionId(),
      activeTopics: [],
      workContext: { currentProjects: [], urgentTasks: [], preferences: {} }
    };
  }
}

// ============================
// HELPER FUNCTIONS
// ============================

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function updateCommonQuestions(existing: string[], newMessage: string): string[] {
  if (!newMessage.includes('?')) return existing;
  
  const questions = [...existing, newMessage].slice(-10); // Keep last 10 questions
  return [...new Set(questions)]; // Remove duplicates
}

function extractProjects(interactions: ConversationContext[]): string[] {
  const projectKeywords = ['project', 'build', 'develop', 'create', 'implement'];
  const projects: string[] = [];
  
  interactions.forEach(interaction => {
    const message = interaction.message.toLowerCase();
    projectKeywords.forEach(keyword => {
      if (message.includes(keyword)) {
        // Simple extraction - could be enhanced with NLP
        const words = interaction.message.split(' ');
        const keywordIndex = words.findIndex(word => word.toLowerCase().includes(keyword));
        if (keywordIndex >= 0 && keywordIndex < words.length - 1) {
          projects.push(words.slice(keywordIndex, keywordIndex + 3).join(' '));
        }
      }
    });
  });
  
  return [...new Set(projects)].slice(0, 5);
}

function extractUrgentTasks(interactions: ConversationContext[]): string[] {
  return interactions
    .filter(i => i.topic === 'urgent' || i.message.toLowerCase().includes('urgent'))
    .map(i => i.message)
    .slice(0, 3);
}

// ============================
// ANALYTICS
// ============================

export async function getTopicFrequency(canonicalOwner: string, days: number = 30): Promise<TopicFrequency[]> {
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const interactions = await db.collection('conversationHistory')
      .where('canonicalOwner', '==', canonicalOwner)
      .where('timestamp', '>=', cutoff)
      .get();
    
    const topicCounts: Record<string, { count: number; lastMention: number; satisfactionSum: number; satisfactionCount: number }> = {};
    
    interactions.docs.forEach(doc => {
      const data = doc.data() as ConversationContext;
      const topic = data.topic;
      
      if (!topicCounts[topic]) {
        topicCounts[topic] = { count: 0, lastMention: 0, satisfactionSum: 0, satisfactionCount: 0 };
      }
      
      topicCounts[topic].count++;
      topicCounts[topic].lastMention = Math.max(topicCounts[topic].lastMention, data.timestamp);
      
      if (data.satisfaction) {
        topicCounts[topic].satisfactionSum += data.satisfaction;
        topicCounts[topic].satisfactionCount++;
      }
    });
    
    return Object.entries(topicCounts)
      .map(([topic, data]) => ({
        topic,
        count: data.count,
        lastMention: data.lastMention,
        avgSatisfaction: data.satisfactionCount > 0 ? data.satisfactionSum / data.satisfactionCount : 0
      }))
      .sort((a, b) => b.count - a.count);
      
  } catch (error) {
    console.error('Error getting topic frequency:', error);
    return [];
  }
}

async function findRelatedMemories(canonicalOwner: string, topics: string[], message: string): Promise<any[]> {
  try {
    // Search by similar topics in notes
    const notesSnap = await db.collection('notes')
      .where('canonicalOwner', '==', canonicalOwner)
      .where('tags', 'array-contains-any', topics.slice(0, 3))
      .orderBy('timestamp', 'desc')
      .limit(3)
      .get();
    
    // Search by keywords in conversation history  
    const keywords = extractKeywords(message);
    const historySnap = await db.collection('conversationHistory')
      .where('canonicalOwner', '==', canonicalOwner)
      .where('topic', 'in', topics.slice(0, 3))
      .orderBy('timestamp', 'desc')
      .limit(2)
      .get();
    
    const related: any[] = [];
    
    notesSnap.forEach(doc => {
      related.push({ id: doc.id, ...doc.data(), type: 'note' });
    });
    
    historySnap.forEach(doc => {
      related.push({ id: doc.id, ...doc.data(), type: 'conversation' });
    });
    
    return related.slice(0, 5); // Max 5 related items
    
  } catch (error) {
    console.error('Error finding related memories:', error);
    return [];
  }
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !['this', 'that', 'with', 'from', 'they', 'were', 'been', 'have', 'what', 'when', 'where'].includes(word))
    .slice(0, 5);
}

function calculateConnectionStrength(topics: string[], relatedMemories: any[]): number {
  if (relatedMemories.length === 0) return 0;
  
  let strength = 0;
  const topicSet = new Set(topics);
  
  relatedMemories.forEach(memory => {
    if (memory.tags) {
      const overlap = memory.tags.filter((tag: string) => topicSet.has(tag)).length;
      strength += (overlap / Math.max(topics.length, memory.tags.length)) * 0.3;
    }
    
    // Recency bonus
    const daysSince = (Date.now() - memory.timestamp) / (24 * 60 * 60 * 1000);
    if (daysSince < 7) strength += 0.2;
    else if (daysSince < 30) strength += 0.1;
  });
  
  return Math.min(strength, 1.0);
}