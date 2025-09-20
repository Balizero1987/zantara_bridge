import { db } from '../core/firestore';
import enhancedLanguageTraining from './enhancedLanguageTraining';
import modularLanguageEngine, { LanguageInput } from '../core/modularLanguageEngine';

interface ConversationContext {
  userId: string;
  sessionId: string;
  language: string;
  messages: ContextualMessage[];
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high';
  culturalMarkers: string[];
  businessContext?: BusinessContext;
  learningProgress: UserLearningContext;
}

interface ContextualMessage {
  text: string;
  timestamp: number;
  language: string;
  confidence: number;
  intent: string;
  entities: ExtractedEntity[];
  sentiment: number; // -1 to 1
}

interface ExtractedEntity {
  type: 'person' | 'company' | 'document' | 'location' | 'date' | 'visa_type' | 'tax_type';
  value: string;
  confidence: number;
  context: string;
}

interface BusinessContext {
  companyType: 'PT_PMA' | 'PT_Local' | 'CV' | 'Individual' | 'Other';
  industry: string;
  complianceStatus: 'current' | 'needs_attention' | 'critical';
  activeDocuments: string[];
  deadlines: {
    type: string;
    date: string;
    priority: 'low' | 'medium' | 'high';
  }[];
}

interface UserLearningContext {
  languageProficiency: Record<string, number>; // 0-100 for each language
  topicsLearned: string[];
  strugglingAreas: string[];
  preferredExplanationStyle: 'technical' | 'simple' | 'examples' | 'visual';
  responseTimePreference: 'immediate' | 'detailed' | 'researched';
}

interface ContextualResponse {
  text: string;
  language: string;
  confidence: number;
  adaptations: {
    cultural: string[];
    formality: string;
    businessFocus: string[];
  };
  recommendations: ContextualRecommendation[];
  followUp: FollowUpAction[];
}

interface ContextualRecommendation {
  type: 'learning' | 'compliance' | 'cultural' | 'procedural';
  title: string;
  description: string;
  priority: number;
  actionable: boolean;
  relatedTopics: string[];
}

interface FollowUpAction {
  action: string;
  deadline?: string;
  importance: 'low' | 'medium' | 'high';
  automated: boolean;
  requiresUserInput: boolean;
}

class MultilingualContextAwareness {
  private activeContexts: Map<string, ConversationContext> = new Map();
  private contextCleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old contexts every hour
    this.contextCleanupInterval = setInterval(() => {
      this.cleanupOldContexts();
    }, 60 * 60 * 1000);
  }

  async analyzeMessage(
    userId: string,
    messageText: string,
    sessionId: string = 'default'
  ): Promise<ConversationContext> {
    const contextKey = `${userId}:${sessionId}`;
    let context = this.activeContexts.get(contextKey);

    if (!context) {
      context = await this.initializeContext(userId, sessionId);
    }

    // Process the new message
    const processedMessage = await this.processMessage(messageText, context);
    context.messages.push(processedMessage);

    // Update context based on the new message
    await this.updateContext(context, processedMessage);

    // Store updated context
    this.activeContexts.set(contextKey, context);
    await this.persistContext(context);

    return context;
  }

  private async initializeContext(userId: string, sessionId: string): Promise<ConversationContext> {
    // Load user's historical preferences and learning data
    const userPreferences = await enhancedLanguageTraining.getUserLanguagePreferences(userId);
    const businessContext = await this.loadBusinessContext(userId);
    const learningContext = await this.loadLearningContext(userId);

    return {
      userId,
      sessionId,
      language: userPreferences.primaryLanguage,
      messages: [],
      topics: [],
      sentiment: 'neutral',
      urgency: 'low',
      culturalMarkers: userPreferences.culturalContext,
      businessContext,
      learningProgress: learningContext
    };
  }

  private async processMessage(
    messageText: string,
    context: ConversationContext
  ): Promise<ContextualMessage> {
    // Use the modular language engine for comprehensive analysis
    const languageInput: LanguageInput = {
      text: messageText,
      userId: context.userId,
      context: {
        previousMessages: context.messages.map(m => m.text).slice(-5),
        topic: context.topics[0],
        urgency: context.urgency,
        formality: context.culturalMarkers.includes('formal_context') ? 'formal' : 'informal'
      },
      metadata: {
        timestamp: Date.now(),
        source: 'chat',
        platform: 'zantara'
      }
    };

    const processed = await modularLanguageEngine.processLanguageInput(languageInput);

    // Extract entities and intent
    const entities = this.extractEntities(messageText, processed.detectedLanguage);
    const intent = this.classifyIntent(messageText, entities);
    const sentiment = this.analyzeSentiment(messageText, processed.detectedLanguage);

    return {
      text: messageText,
      timestamp: Date.now(),
      language: processed.detectedLanguage,
      confidence: processed.confidence,
      intent,
      entities,
      sentiment
    };
  }

  private extractEntities(text: string, language: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Company patterns
    const companyPatterns = {
      it: /\b(società|azienda|ditta|pt\s+pma|pt)\s+([a-zA-Z\s]+)/gi,
      id: /\b(pt\s+pma|pt|cv|perusahaan)\s+([a-zA-Z\s]+)/gi,
      en: /\b(company|corporation|pt\s+pma|business)\s+([a-zA-Z\s]+)/gi
    };

    const companyPattern = companyPatterns[language as keyof typeof companyPatterns];
    if (companyPattern) {
      let match;
      while ((match = companyPattern.exec(text)) !== null) {
        entities.push({
          type: 'company',
          value: match[2].trim(),
          confidence: 0.8,
          context: match[1]
        });
      }
    }

    // Document patterns
    const documentPatterns = {
      it: /\b(kitas|kitap|visa|permesso|documento|certificato)\b/gi,
      id: /\b(kitas|kitap|visa|izin|dokumen|sertifikat)\b/gi,
      en: /\b(kitas|kitap|visa|permit|document|certificate)\b/gi
    };

    const docPattern = documentPatterns[language as keyof typeof documentPatterns];
    if (docPattern) {
      let match;
      while ((match = docPattern.exec(text)) !== null) {
        entities.push({
          type: 'document',
          value: match[0],
          confidence: 0.9,
          context: 'immigration'
        });
      }
    }

    // Date patterns
    const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b/g;
    let dateMatch;
    while ((dateMatch = datePattern.exec(text)) !== null) {
      entities.push({
        type: 'date',
        value: dateMatch[0],
        confidence: 0.7,
        context: 'temporal'
      });
    }

    // Location patterns
    const locationPatterns = {
      it: /\b(bali|jakarta|indonesia|ufficio|sede)\b/gi,
      id: /\b(bali|jakarta|indonesia|kantor|alamat)\b/gi,
      en: /\b(bali|jakarta|indonesia|office|address)\b/gi
    };

    const locPattern = locationPatterns[language as keyof typeof locationPatterns];
    if (locPattern) {
      let match;
      while ((match = locPattern.exec(text)) !== null) {
        entities.push({
          type: 'location',
          value: match[0],
          confidence: 0.8,
          context: 'geographic'
        });
      }
    }

    return entities;
  }

  private classifyIntent(text: string, entities: ExtractedEntity[]): string {
    const intentPatterns = [
      { intent: 'visa_inquiry', patterns: [/\b(visa|kitas|kitap|permit)\b/i, /\b(renew|extend|apply)\b/i] },
      { intent: 'tax_question', patterns: [/\b(tax|pajak|tasse)\b/i, /\b(calculate|pay|due)\b/i] },
      { intent: 'company_setup', patterns: [/\b(pt pma|company|start|setup)\b/i] },
      { intent: 'compliance_check', patterns: [/\b(compliance|legal|requirement)\b/i] },
      { intent: 'document_help', patterns: [/\b(document|paperwork|form)\b/i] },
      { intent: 'general_inquiry', patterns: [/\b(help|question|info|information)\b/i] }
    ];

    for (const { intent, patterns } of intentPatterns) {
      if (patterns.every(pattern => pattern.test(text))) {
        return intent;
      }
    }

    // Check entity-based intent
    if (entities.some(e => e.type === 'document')) return 'document_help';
    if (entities.some(e => e.type === 'company')) return 'company_setup';
    if (entities.some(e => e.type === 'date')) return 'deadline_inquiry';

    return 'general_inquiry';
  }

  private analyzeSentiment(text: string, language: string): number {
    const positiveWords = {
      it: ['grazie', 'perfetto', 'ottimo', 'bene', 'fantastico'],
      id: ['terima kasih', 'bagus', 'baik', 'sempurna', 'hebat'],
      en: ['thanks', 'good', 'great', 'perfect', 'excellent']
    };

    const negativeWords = {
      it: ['problema', 'difficoltà', 'errore', 'sbagliato', 'aiuto'],
      id: ['masalah', 'kesulitan', 'error', 'salah', 'bantuan'],
      en: ['problem', 'issue', 'error', 'wrong', 'help']
    };

    const positive = positiveWords[language as keyof typeof positiveWords] || [];
    const negative = negativeWords[language as keyof typeof negativeWords] || [];

    let score = 0;
    const lowerText = text.toLowerCase();

    positive.forEach(word => {
      if (lowerText.includes(word)) score += 0.2;
    });

    negative.forEach(word => {
      if (lowerText.includes(word)) score -= 0.2;
    });

    // Normalize to -1 to 1 range
    return Math.max(-1, Math.min(1, score));
  }

  private async updateContext(
    context: ConversationContext,
    newMessage: ContextualMessage
  ): Promise<void> {
    // Update language preference
    if (newMessage.confidence > 0.8) {
      context.language = newMessage.language;
    }

    // Update topics
    this.updateTopics(context, newMessage);

    // Update sentiment
    this.updateSentiment(context, newMessage);

    // Update urgency
    this.updateUrgency(context, newMessage);

    // Update cultural markers
    this.updateCulturalMarkers(context, newMessage);

    // Update business context
    await this.updateBusinessContext(context, newMessage);
  }

  private updateTopics(context: ConversationContext, message: ContextualMessage): void {
    // Extract topics from intent and entities
    const topicMapping = {
      'visa_inquiry': 'immigration',
      'tax_question': 'taxation',
      'company_setup': 'business_setup',
      'compliance_check': 'compliance',
      'document_help': 'documentation'
    };

    const topic = topicMapping[message.intent as keyof typeof topicMapping];
    if (topic && !context.topics.includes(topic)) {
      context.topics.unshift(topic);
      // Keep only the 5 most recent topics
      context.topics = context.topics.slice(0, 5);
    }
  }

  private updateSentiment(context: ConversationContext, message: ContextualMessage): void {
    // Average sentiment over last 3 messages
    const recentMessages = context.messages.slice(-2).concat(message);
    const avgSentiment = recentMessages.reduce((sum, msg) => sum + msg.sentiment, 0) / recentMessages.length;

    if (avgSentiment > 0.3) context.sentiment = 'positive';
    else if (avgSentiment < -0.3) context.sentiment = 'negative';
    else context.sentiment = 'neutral';
  }

  private updateUrgency(context: ConversationContext, message: ContextualMessage): void {
    const urgentPatterns = [
      /\b(urgent|asap|immediately|subito|urgente|segera)\b/i,
      /\b(deadline|scadenza|tenggat)\b/i,
      /\b(expire|expires|scade|habis)\b/i
    ];

    const highUrgencyEntities = message.entities.filter(e => 
      e.type === 'date' && this.isNearFutureDate(e.value)
    );

    if (urgentPatterns.some(pattern => pattern.test(message.text)) || highUrgencyEntities.length > 0) {
      context.urgency = 'high';
    } else if (message.intent.includes('deadline') || message.intent.includes('renew')) {
      context.urgency = 'medium';
    }
  }

  private updateCulturalMarkers(context: ConversationContext, message: ContextualMessage): void {
    const formalMarkers = [
      /\b(sir|madam|bapak|ibu|signore|signora)\b/i,
      /\b(please|per favore|mohon|tolong)\b/i
    ];

    const businessMarkers = [
      /\b(company|azienda|perusahaan|pt pma)\b/i,
      /\b(meeting|riunione|rapat)\b/i
    ];

    if (formalMarkers.some(pattern => pattern.test(message.text))) {
      if (!context.culturalMarkers.includes('formal_context')) {
        context.culturalMarkers.push('formal_context');
      }
    }

    if (businessMarkers.some(pattern => pattern.test(message.text))) {
      if (!context.culturalMarkers.includes('business_context')) {
        context.culturalMarkers.push('business_context');
      }
    }
  }

  private async updateBusinessContext(
    context: ConversationContext,
    message: ContextualMessage
  ): Promise<void> {
    if (!context.businessContext) {
      context.businessContext = {
        companyType: 'Other',
        industry: 'unknown',
        complianceStatus: 'current',
        activeDocuments: [],
        deadlines: []
      };
    }

    // Update company type based on entities
    const companyEntities = message.entities.filter(e => e.type === 'company');
    if (companyEntities.length > 0) {
      const companyText = companyEntities[0].context.toLowerCase();
      if (companyText.includes('pt pma')) {
        context.businessContext.companyType = 'PT_PMA';
      } else if (companyText.includes('pt')) {
        context.businessContext.companyType = 'PT_Local';
      } else if (companyText.includes('cv')) {
        context.businessContext.companyType = 'CV';
      }
    }

    // Add documents from entities
    const docEntities = message.entities.filter(e => e.type === 'document');
    docEntities.forEach(doc => {
      if (!context.businessContext!.activeDocuments.includes(doc.value)) {
        context.businessContext!.activeDocuments.push(doc.value);
      }
    });

    // Add deadlines from date entities with urgent context
    const dateEntities = message.entities.filter(e => e.type === 'date');
    if (dateEntities.length > 0 && (message.intent.includes('deadline') || context.urgency === 'high')) {
      dateEntities.forEach(date => {
        context.businessContext!.deadlines.push({
          type: message.intent,
          date: date.value,
          priority: context.urgency as 'low' | 'medium' | 'high'
        });
      });
    }
  }

  async generateContextualResponse(
    context: ConversationContext,
    baseResponse: string
  ): Promise<ContextualResponse> {
    // Generate culturally and contextually appropriate response
    const culturalAdaptations = this.generateCulturalAdaptations(context);
    const formality = this.determineFormalityLevel(context);
    const businessFocus = this.generateBusinessFocus(context);
    
    // Generate recommendations based on context
    const recommendations = this.generateRecommendations(context);
    
    // Generate follow-up actions
    const followUp = this.generateFollowUpActions(context);

    // Adapt the response text
    const adaptedText = this.adaptResponseText(
      baseResponse,
      context.language,
      formality,
      culturalAdaptations
    );

    return {
      text: adaptedText,
      language: context.language,
      confidence: 0.9,
      adaptations: {
        cultural: culturalAdaptations,
        formality,
        businessFocus
      },
      recommendations,
      followUp
    };
  }

  private generateCulturalAdaptations(context: ConversationContext): string[] {
    const adaptations: string[] = [];

    if (context.culturalMarkers.includes('formal_context')) {
      adaptations.push('formal_address');
    }

    if (context.culturalMarkers.includes('business_context')) {
      adaptations.push('business_courtesy');
    }

    if (context.language === 'id') {
      adaptations.push('indonesian_hierarchy');
    }

    if (context.language === 'it') {
      adaptations.push('italian_warmth');
    }

    return adaptations;
  }

  private determineFormalityLevel(context: ConversationContext): string {
    if (context.culturalMarkers.includes('formal_context') || 
        context.businessContext?.companyType !== 'Other') {
      return 'formal';
    }

    if (context.sentiment === 'positive' && 
        context.messages.length > 3) {
      return 'friendly_formal';
    }

    return 'polite_informal';
  }

  private generateBusinessFocus(context: ConversationContext): string[] {
    const focus: string[] = [];

    if (context.topics.includes('immigration')) {
      focus.push('visa_compliance');
    }

    if (context.topics.includes('taxation')) {
      focus.push('tax_obligations');
    }

    if (context.businessContext?.companyType === 'PT_PMA') {
      focus.push('foreign_investment_rules');
    }

    if (context.urgency === 'high') {
      focus.push('immediate_action_required');
    }

    return focus;
  }

  private generateRecommendations(context: ConversationContext): ContextualRecommendation[] {
    const recommendations: ContextualRecommendation[] = [];

    // Learning recommendations
    if (context.learningProgress.languageProficiency[context.language] < 70) {
      recommendations.push({
        type: 'learning',
        title: 'Improve Language Skills',
        description: `Continue practicing ${context.language} for better communication`,
        priority: 0.6,
        actionable: true,
        relatedTopics: ['language_learning']
      });
    }

    // Compliance recommendations
    if (context.businessContext?.complianceStatus === 'needs_attention') {
      recommendations.push({
        type: 'compliance',
        title: 'Review Compliance Status',
        description: 'Some documents may need updating',
        priority: 0.8,
        actionable: true,
        relatedTopics: ['compliance', 'documentation']
      });
    }

    // Cultural recommendations
    if (!context.culturalMarkers.includes('business_context') && 
        context.topics.includes('business_setup')) {
      recommendations.push({
        type: 'cultural',
        title: 'Indonesian Business Culture',
        description: 'Learn about hierarchy and relationship building',
        priority: 0.7,
        actionable: true,
        relatedTopics: ['culture', 'business']
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private generateFollowUpActions(context: ConversationContext): FollowUpAction[] {
    const actions: FollowUpAction[] = [];

    if (context.urgency === 'high' && context.topics.includes('immigration')) {
      actions.push({
        action: 'Check visa expiration date',
        deadline: this.calculateDeadline(30), // 30 days from now
        importance: 'high',
        automated: false,
        requiresUserInput: true
      });
    }

    if (context.businessContext?.deadlines.length || 0 > 0) {
      actions.push({
        action: 'Review upcoming deadlines',
        importance: 'medium',
        automated: true,
        requiresUserInput: false
      });
    }

    return actions;
  }

  private adaptResponseText(
    baseText: string,
    language: string,
    formality: string,
    adaptations: string[]
  ): string {
    let adaptedText = baseText;

    // Add formal greetings if needed
    if (formality === 'formal' && !adaptedText.match(/^(dear|caro|dengan hormat)/i)) {
      const formalGreetings = {
        it: 'Gentile utente, ',
        id: 'Dengan hormat, ',
        en: 'Dear valued client, '
      };
      const greeting = formalGreetings[language as keyof typeof formalGreetings] || '';
      adaptedText = greeting + adaptedText;
    }

    // Add cultural politeness markers
    if (adaptations.includes('indonesian_hierarchy')) {
      adaptedText = adaptedText.replace(/\byou\b/g, 'Bapak/Ibu');
    }

    return adaptedText;
  }

  // Utility methods
  private isNearFutureDate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 30; // Within next 30 days
    } catch {
      return false;
    }
  }

  private calculateDeadline(daysFromNow: number): string {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + daysFromNow);
    return deadline.toISOString().split('T')[0];
  }

  private cleanupOldContexts(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, context] of this.activeContexts) {
      const lastMessageTime = context.messages[context.messages.length - 1]?.timestamp || 0;
      if (lastMessageTime < cutoffTime) {
        this.activeContexts.delete(key);
      }
    }
  }

  // Data persistence methods
  private async persistContext(context: ConversationContext): Promise<void> {
    try {
      await db.collection('conversationContexts')
        .doc(`${context.userId}_${context.sessionId}`)
        .set(context, { merge: true });
    } catch (error) {
      console.error('Error persisting context:', error);
    }
  }

  private async loadBusinessContext(userId: string): Promise<BusinessContext | undefined> {
    try {
      const doc = await db.collection('userProfiles').doc(userId).get();
      return doc.data()?.businessContext;
    } catch (error) {
      console.error('Error loading business context:', error);
      return undefined;
    }
  }

  private async loadLearningContext(userId: string): Promise<UserLearningContext> {
    try {
      const doc = await db.collection('userLearning').doc(userId).get();
      return doc.data() as UserLearningContext || {
        languageProficiency: { en: 50, it: 30, id: 20 },
        topicsLearned: [],
        strugglingAreas: [],
        preferredExplanationStyle: 'simple',
        responseTimePreference: 'immediate'
      };
    } catch (error) {
      console.error('Error loading learning context:', error);
      return {
        languageProficiency: { en: 50, it: 30, id: 20 },
        topicsLearned: [],
        strugglingAreas: [],
        preferredExplanationStyle: 'simple',
        responseTimePreference: 'immediate'
      };
    }
  }

  // Public API methods
  getActiveContexts(): number {
    return this.activeContexts.size;
  }

  async getContextSummary(userId: string, sessionId: string = 'default'): Promise<{
    language: string;
    topics: string[];
    sentiment: string;
    urgency: string;
    messageCount: number;
  } | null> {
    const contextKey = `${userId}:${sessionId}`;
    const context = this.activeContexts.get(contextKey);
    
    if (!context) return null;

    return {
      language: context.language,
      topics: context.topics,
      sentiment: context.sentiment,
      urgency: context.urgency,
      messageCount: context.messages.length
    };
  }
}

export default new MultilingualContextAwareness();
export { 
  ConversationContext, 
  ContextualResponse, 
  ContextualRecommendation, 
  FollowUpAction,
  BusinessContext,
  UserLearningContext 
};