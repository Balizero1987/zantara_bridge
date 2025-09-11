import { db } from './firestore';
import { getUserProfile, updateUserProfile, LearningMetrics } from './userProfiles';
import { getTopicFrequency, ConversationContext } from './contextualMemory';

// ============================
// LEARNING TYPES
// ============================

export interface InteractionPattern {
  canonicalOwner: string;
  patternType: 'question' | 'request' | 'feedback' | 'exploration';
  pattern: string;
  frequency: number;
  successRate: number;
  avgSatisfaction: number;
  lastOccurrence: number;
  preferredResponseStyle: 'brief' | 'detailed' | 'step-by-step' | 'conceptual';
}

export interface LearningInsight {
  type: 'preference' | 'behavior' | 'satisfaction' | 'pattern';
  insight: string;
  confidence: number; // 0-1
  evidence: string[];
  actionable: boolean;
  recommendation?: string;
}

export interface AdaptiveResponse {
  tone: string;
  length: 'brief' | 'detailed' | 'comprehensive';
  style: 'direct' | 'explanatory' | 'conversational' | 'technical';
  includeExamples: boolean;
  includeNextSteps: boolean;
  personalTouch: string;
}

// ============================
// PATTERN RECOGNITION
// ============================

export async function analyzeInteractionPatterns(canonicalOwner: string): Promise<InteractionPattern[]> {
  try {
    const interactions = await db.collection('conversationHistory')
      .where('canonicalOwner', '==', canonicalOwner)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    
    const patterns: Map<string, InteractionPattern> = new Map();
    
    interactions.docs.forEach(doc => {
      const data = doc.data() as ConversationContext;
      const patternKey = extractPatternKey(data.message);
      const patternType = classifyInteraction(data.message);
      
      if (!patterns.has(patternKey)) {
        patterns.set(patternKey, {
          canonicalOwner,
          patternType,
          pattern: patternKey,
          frequency: 0,
          successRate: 0,
          avgSatisfaction: 0,
          lastOccurrence: 0,
          preferredResponseStyle: 'detailed'
        });
      }
      
      const pattern = patterns.get(patternKey)!;
      pattern.frequency++;
      pattern.lastOccurrence = Math.max(pattern.lastOccurrence, data.timestamp);
      
      if (data.satisfaction) {
        const currentAvg = pattern.avgSatisfaction;
        const currentCount = pattern.frequency - 1;
        pattern.avgSatisfaction = (currentAvg * currentCount + data.satisfaction) / pattern.frequency;
      }
    });
    
    return Array.from(patterns.values()).sort((a, b) => b.frequency - a.frequency);
    
  } catch (error) {
    console.error('Error analyzing interaction patterns:', error);
    return [];
  }
}

function extractPatternKey(message: string): string {
  const normalizedMessage = message.toLowerCase().trim();
  
  // Common question patterns
  if (normalizedMessage.startsWith('how to')) return 'how_to_question';
  if (normalizedMessage.startsWith('what is')) return 'definition_question';
  if (normalizedMessage.startsWith('why')) return 'explanation_question';
  if (normalizedMessage.startsWith('can you')) return 'capability_question';
  if (normalizedMessage.includes('explain')) return 'explanation_request';
  if (normalizedMessage.includes('help')) return 'help_request';
  if (normalizedMessage.includes('create') || normalizedMessage.includes('build')) return 'creation_request';
  if (normalizedMessage.includes('fix') || normalizedMessage.includes('solve')) return 'problem_solving';
  if (normalizedMessage.includes('compare')) return 'comparison_request';
  if (normalizedMessage.includes('recommend') || normalizedMessage.includes('suggest')) return 'recommendation_request';
  
  // Default pattern based on message length and complexity
  const words = normalizedMessage.split(' ').length;
  if (words <= 5) return 'simple_query';
  if (words > 20) return 'complex_query';
  return 'standard_query';
}

function classifyInteraction(message: string): 'question' | 'request' | 'feedback' | 'exploration' {
  const messageLower = message.toLowerCase();
  
  if (messageLower.includes('?')) return 'question';
  if (messageLower.includes('please') || messageLower.includes('can you') || messageLower.includes('help')) return 'request';
  if (messageLower.includes('thank') || messageLower.includes('good') || messageLower.includes('bad')) return 'feedback';
  return 'exploration';
}

// ============================
// ADAPTIVE RESPONSE GENERATION
// ============================

export async function generateAdaptiveResponse(
  canonicalOwner: string,
  message: string,
  baseResponse: string
): Promise<AdaptiveResponse> {
  try {
    const profile = await getUserProfile(canonicalOwner);
    const patterns = await analyzeInteractionPatterns(canonicalOwner);
    const currentPattern = extractPatternKey(message);
    
    // Find matching pattern for this user
    const matchingPattern = patterns.find(p => p.pattern === currentPattern);
    
    // Determine optimal response characteristics
    const adaptiveResponse: AdaptiveResponse = {
      tone: determineOptimalTone(profile, matchingPattern),
      length: determineOptimalLength(profile, matchingPattern, message),
      style: determineOptimalStyle(profile, matchingPattern),
      includeExamples: shouldIncludeExamples(profile, matchingPattern),
      includeNextSteps: shouldIncludeNextSteps(profile, matchingPattern),
      personalTouch: generatePersonalTouch(profile, matchingPattern)
    };
    
    return adaptiveResponse;
    
  } catch (error) {
    console.error('Error generating adaptive response:', error);
    return {
      tone: 'warm',
      length: 'detailed',
      style: 'conversational',
      includeExamples: true,
      includeNextSteps: true,
      personalTouch: ''
    };
  }
}

function determineOptimalTone(profile: any, pattern?: InteractionPattern): string {
  // High satisfaction with formal tone
  if (pattern && pattern.avgSatisfaction > 4 && profile.preferences.tone === 'formal') {
    return 'formal';
  }
  
  // Executive users prefer assertive tone
  if (profile.context.role === 'CEO' || profile.context.role === 'CTO') {
    return 'assertive';
  }
  
  // Default to user preference
  return profile.preferences.tone;
}

function determineOptimalLength(profile: any, pattern?: InteractionPattern, message?: string): 'brief' | 'detailed' | 'comprehensive' {
  // CEO/Executive prefer brief unless asking for explanation
  if (profile.context.role === 'CEO' && !message?.includes('explain')) {
    return 'brief';
  }
  
  // Complex questions get detailed responses
  if (message && extractPatternKey(message) === 'complex_query') {
    return 'comprehensive';
  }
  
  // Use pattern success rate to determine length
  if (pattern && pattern.avgSatisfaction > 4) {
    return pattern.preferredResponseStyle === 'brief' ? 'brief' : 'detailed';
  }
  
  return profile.preferences.responseLength;
}

function determineOptimalStyle(profile: any, pattern?: InteractionPattern): 'direct' | 'explanatory' | 'conversational' | 'technical' {
  // Technical roles prefer technical style
  if (profile.context.role === 'Developer' || profile.context.role === 'CTO') {
    return 'technical';
  }
  
  // Business roles prefer direct style
  if (profile.context.role === 'CEO' || profile.context.department === 'Sales') {
    return 'direct';
  }
  
  // Default to explanatory for learning patterns
  if (pattern && pattern.patternType === 'question') {
    return 'explanatory';
  }
  
  return 'conversational';
}

function shouldIncludeExamples(profile: any, pattern?: InteractionPattern): boolean {
  // Beginners always get examples
  if (profile.preferences.expertise === 'beginner') return true;
  
  // Experts skip examples unless satisfaction is low
  if (profile.preferences.expertise === 'expert') {
    return pattern ? pattern.avgSatisfaction < 3 : false;
  }
  
  // Default true for intermediate
  return true;
}

function shouldIncludeNextSteps(profile: any, pattern?: InteractionPattern): boolean {
  // Action-oriented roles get next steps
  if (profile.context.role === 'Manager' || profile.context.role === 'CEO') return true;
  
  // Help requests get next steps
  if (pattern && (pattern.pattern === 'help_request' || pattern.pattern === 'how_to_question')) {
    return true;
  }
  
  return false;
}

function generatePersonalTouch(profile: any, pattern?: InteractionPattern): string {
  const timeOfDay = new Date().getHours();
  const greeting = timeOfDay < 12 ? 'Buongiorno' : timeOfDay < 18 ? 'Buon pomeriggio' : 'Buonasera';
  
  // For frequent patterns, add continuity
  if (pattern && pattern.frequency > 5) {
    return `${greeting} ${profile.canonicalOwner}! Vedo che questo è un tema che ti interessa spesso.`;
  }
  
  // For executives, be more formal
  if (profile.context.role === 'CEO' || profile.context.role === 'CTO') {
    return `${greeting} ${profile.canonicalOwner}.`;
  }
  
  return `${greeting} ${profile.canonicalOwner}!`;
}

// ============================
// LEARNING ANALYTICS
// ============================

export async function updateLearningMetrics(
  canonicalOwner: string,
  messageResponseTime: number,
  satisfaction?: number
): Promise<void> {
  try {
    const profile = await getUserProfile(canonicalOwner);
    const patterns = await analyzeInteractionPatterns(canonicalOwner);
    const topicFreq = await getTopicFrequency(canonicalOwner);
    
    // Calculate new metrics
    const totalInteractions = profile.learning.totalInteractions + 1;
    const avgResponseTime = ((profile.learning.avgResponseTime * profile.learning.totalInteractions) + messageResponseTime) / totalInteractions;
    
    // Update topic frequency map
    const topicFrequency: Record<string, number> = {};
    topicFreq.forEach(tf => {
      topicFrequency[tf.topic] = tf.count;
    });
    
    // Calculate engagement level
    const engagementLevel = calculateEngagementLevel(totalInteractions, avgResponseTime, satisfaction);
    
    // Update feedback score
    let feedbackScore = profile.learning.feedbackScore;
    if (satisfaction) {
      feedbackScore = ((feedbackScore * (totalInteractions - 1)) + satisfaction) / totalInteractions;
    }
    
    // Calculate learning progress
    const learningProgress = calculateLearningProgress(patterns, topicFreq, totalInteractions);
    
    const updatedLearning: LearningMetrics = {
      totalInteractions,
      avgResponseTime,
      topicFrequency,
      feedbackScore,
      engagementLevel,
      learningProgress
    };
    
    await updateUserProfile(canonicalOwner, { learning: updatedLearning });
    
  } catch (error) {
    console.error('Error updating learning metrics:', error);
  }
}

function calculateEngagementLevel(interactions: number, avgResponseTime: number, satisfaction?: number): 'low' | 'medium' | 'high' {
  let score = 0;
  
  // Interaction frequency score
  if (interactions > 50) score += 2;
  else if (interactions > 20) score += 1;
  
  // Response time score (faster = more engaged)
  if (avgResponseTime < 2000) score += 2;
  else if (avgResponseTime < 5000) score += 1;
  
  // Satisfaction score
  if (satisfaction && satisfaction > 4) score += 2;
  else if (satisfaction && satisfaction > 3) score += 1;
  
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function calculateLearningProgress(patterns: InteractionPattern[], topics: any[], interactions: number): number {
  let progress = 0;
  
  // Diversity of topics (shows exploration)
  progress += Math.min(topics.length * 5, 30);
  
  // Pattern sophistication (complex queries show growth)
  const complexPatterns = patterns.filter(p => p.pattern.includes('complex') || p.pattern.includes('comparison'));
  progress += Math.min(complexPatterns.length * 10, 40);
  
  // Interaction volume
  progress += Math.min(interactions * 0.5, 30);
  
  return Math.min(progress, 100);
}

// ============================
// INSIGHTS GENERATION
// ============================

export async function generateLearningInsights(canonicalOwner: string): Promise<LearningInsight[]> {
  try {
    const profile = await getUserProfile(canonicalOwner);
    const patterns = await analyzeInteractionPatterns(canonicalOwner);
    const topicFreq = await getTopicFrequency(canonicalOwner);
    
    const insights: LearningInsight[] = [];
    
    // Most frequent topic insight
    if (topicFreq.length > 0) {
      const topTopic = topicFreq[0];
      insights.push({
        type: 'behavior',
        insight: `You frequently ask about ${topTopic.topic} topics (${topTopic.count} times)`,
        confidence: Math.min(topTopic.count / 10, 1),
        evidence: [`${topTopic.count} interactions about ${topTopic.topic}`],
        actionable: true,
        recommendation: `I can prepare more detailed resources about ${topTopic.topic} for you.`
      });
    }
    
    // Satisfaction pattern insight
    const avgSatisfaction = patterns.reduce((sum, p) => sum + p.avgSatisfaction, 0) / patterns.length;
    if (avgSatisfaction > 4) {
      insights.push({
        type: 'satisfaction',
        insight: `You consistently rate our interactions highly (${avgSatisfaction.toFixed(1)}/5)`,
        confidence: 0.9,
        evidence: [`Average satisfaction: ${avgSatisfaction.toFixed(1)}`],
        actionable: false
      });
    }
    
    // Learning progress insight
    if (profile.learning.learningProgress > 70) {
      insights.push({
        type: 'pattern',
        insight: 'You show strong learning progression with increasingly complex queries',
        confidence: 0.8,
        evidence: [`Learning progress: ${profile.learning.learningProgress}%`],
        actionable: true,
        recommendation: 'I can introduce more advanced topics that match your growing expertise.'
      });
    }
    
    return insights;
    
  } catch (error) {
    console.error('Error generating learning insights:', error);
    return [];
  }
}