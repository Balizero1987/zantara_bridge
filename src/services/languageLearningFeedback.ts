import { db } from '../core/firestore';
import enhancedLanguageTraining from './enhancedLanguageTraining';
import multilingualContextAwareness from './multilingualContextAwareness';

interface LearningFeedback {
  id: string;
  userId: string;
  sessionId: string;
  timestamp: number;
  
  // User interaction data
  messageQuality: 'poor' | 'good' | 'excellent';
  responseHelpfulness: number; // 1-5 scale
  languageAccuracy: number; // 1-5 scale
  culturalAppropriate: number; // 1-5 scale
  
  // Specific feedback areas
  feedbackCategories: FeedbackCategory[];
  
  // Learning progress tracking
  skillsImproved: string[];
  strugglingAreas: string[];
  
  // User preferences learned
  preferredResponseStyle: 'concise' | 'detailed' | 'examples' | 'visual';
  preferredFormality: 'formal' | 'informal' | 'adaptive';
  
  // Contextual feedback
  contextAccuracy: number; // How well we understood the context
  recommendations: LearningRecommendation[];
  
  // User comments
  userComments?: string;
  specificIssues?: string[];
}

interface FeedbackCategory {
  category: 'grammar' | 'vocabulary' | 'cultural' | 'technical' | 'formality' | 'clarity';
  score: number; // 1-5
  specificFeedback?: string;
  examples?: string[];
}

interface LearningRecommendation {
  type: 'language_practice' | 'cultural_learning' | 'technical_knowledge' | 'communication_style';
  title: string;
  description: string;
  priority: number; // 0-1
  estimatedTime: string; // e.g., "5 minutes", "1 hour"
  actionable: boolean;
  resources?: string[];
}

interface LearningAnalytics {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  
  // Progress metrics
  overallProgress: number; // 0-100
  languageProgress: Record<string, number>; // Language -> progress
  skillProgress: Record<string, number>; // Skill -> progress
  
  // Interaction quality
  averageResponseQuality: number;
  improvementRate: number; // Rate of improvement over time
  
  // Learning patterns
  preferredLearningTimes: string[]; // Hour ranges
  mostActiveTopics: string[];
  challengingAreas: string[];
  
  // Recommendations
  personalizedRecommendations: LearningRecommendation[];
  nextLearningGoals: string[];
}

interface AdaptiveResponse {
  originalResponse: string;
  adaptedResponse: string;
  adaptations: {
    styleChanges: string[];
    languageSimplifications: string[];
    culturalAdjustments: string[];
    formalityAdjustments: string[];
  };
  confidence: number;
  learningOpportunity?: {
    skill: string;
    explanation: string;
    practice: string;
  };
}

class LanguageLearningFeedbackService {
  private feedbackCache: Map<string, LearningFeedback[]> = new Map();
  private analyticsCache: Map<string, LearningAnalytics> = new Map();

  async recordUserFeedback(
    userId: string,
    sessionId: string,
    feedbackData: Partial<LearningFeedback>
  ): Promise<void> {
    const feedback: LearningFeedback = {
      id: `${userId}_${sessionId}_${Date.now()}`,
      userId,
      sessionId,
      timestamp: Date.now(),
      messageQuality: feedbackData.messageQuality || 'good',
      responseHelpfulness: feedbackData.responseHelpfulness || 3,
      languageAccuracy: feedbackData.languageAccuracy || 3,
      culturalAppropriate: feedbackData.culturalAppropriate || 3,
      feedbackCategories: feedbackData.feedbackCategories || [],
      skillsImproved: feedbackData.skillsImproved || [],
      strugglingAreas: feedbackData.strugglingAreas || [],
      preferredResponseStyle: feedbackData.preferredResponseStyle || 'detailed',
      preferredFormality: feedbackData.preferredFormality || 'adaptive',
      contextAccuracy: feedbackData.contextAccuracy || 3,
      recommendations: feedbackData.recommendations || [],
      userComments: feedbackData.userComments,
      specificIssues: feedbackData.specificIssues
    };

    // Store in database
    await this.storeFeedback(feedback);

    // Update user learning profile
    await this.updateLearningProfile(feedback);

    // Generate personalized recommendations
    await this.generatePersonalizedRecommendations(userId);

    // Cache for quick access
    const userFeedback = this.feedbackCache.get(userId) || [];
    userFeedback.push(feedback);
    this.feedbackCache.set(userId, userFeedback.slice(-50)); // Keep last 50 feedback entries
  }

  async generateAdaptiveResponse(
    userId: string,
    originalResponse: string,
    userMessage: string,
    context: any
  ): Promise<AdaptiveResponse> {
    // Get user's learning profile and preferences
    const learningProfile = await this.getUserLearningProfile(userId);
    const recentFeedback = await this.getRecentFeedback(userId, 10);

    // Analyze what adaptations are needed
    const adaptations = await this.analyzeNeededAdaptations(
      originalResponse,
      userMessage,
      learningProfile,
      recentFeedback,
      context
    );

    // Apply adaptations
    const adaptedResponse = await this.applyAdaptations(originalResponse, adaptations);

    // Identify learning opportunities
    const learningOpportunity = await this.identifyLearningOpportunity(
      userMessage,
      adaptedResponse,
      learningProfile
    );

    return {
      originalResponse,
      adaptedResponse: adaptedResponse.text,
      adaptations: adaptations,
      confidence: adaptedResponse.confidence,
      learningOpportunity
    };
  }

  private async analyzeNeededAdaptations(
    response: string,
    userMessage: string,
    profile: any,
    feedback: LearningFeedback[],
    context: any
  ): Promise<{
    styleChanges: string[];
    languageSimplifications: string[];
    culturalAdjustments: string[];
    formalityAdjustments: string[];
  }> {
    const adaptations = {
      styleChanges: [],
      languageSimplifications: [],
      culturalAdjustments: [],
      formalityAdjustments: []
    };

    // Analyze user's preferred communication style from feedback
    const avgHelpfulness = feedback.reduce((sum, f) => sum + f.responseHelpfulness, 0) / feedback.length || 3;
    
    if (avgHelpfulness < 3) {
      // User finds responses not helpful enough
      if (profile.preferredResponseStyle === 'detailed' && response.length < 200) {
        adaptations.styleChanges.push('add_more_detail');
      } else if (profile.preferredResponseStyle === 'concise' && response.length > 300) {
        adaptations.styleChanges.push('make_more_concise');
      } else if (profile.preferredResponseStyle === 'examples' && !response.includes('esempio') && !response.includes('example') && !response.includes('contoh')) {
        adaptations.styleChanges.push('add_examples');
      }
    }

    // Language simplification based on proficiency
    const userLanguage = context.language || 'en';
    const proficiency = profile.languageProficiency?.[userLanguage] || 50;
    
    if (proficiency < 60) {
      // Simplify complex terms
      adaptations.languageSimplifications.push('simplify_vocabulary');
      if (this.hasComplexSentences(response)) {
        adaptations.languageSimplifications.push('simplify_grammar');
      }
    }

    // Cultural adjustments based on feedback
    const avgCultural = feedback.reduce((sum, f) => sum + f.culturalAppropriate, 0) / feedback.length || 3;
    if (avgCultural < 3) {
      adaptations.culturalAdjustments.push('improve_cultural_context');
      if (userLanguage === 'id') {
        adaptations.culturalAdjustments.push('add_indonesian_courtesy');
      } else if (userLanguage === 'it') {
        adaptations.culturalAdjustments.push('add_italian_warmth');
      }
    }

    // Formality adjustments
    const preferredFormality = this.analyzePreferredFormality(feedback, profile);
    if (preferredFormality !== 'adaptive') {
      adaptations.formalityAdjustments.push(`adjust_to_${preferredFormality}`);
    }

    return adaptations;
  }

  private async applyAdaptations(
    response: string,
    adaptations: any
  ): Promise<{ text: string; confidence: number }> {
    let adaptedText = response;
    let confidence = 0.8;

    // Apply style changes
    for (const change of adaptations.styleChanges) {
      switch (change) {
        case 'add_more_detail':
          adaptedText = await this.addMoreDetail(adaptedText);
          break;
        case 'make_more_concise':
          adaptedText = this.makeConcise(adaptedText);
          break;
        case 'add_examples':
          adaptedText = await this.addExamples(adaptedText);
          break;
      }
    }

    // Apply language simplifications
    for (const simplification of adaptations.languageSimplifications) {
      switch (simplification) {
        case 'simplify_vocabulary':
          adaptedText = this.simplifyVocabulary(adaptedText);
          break;
        case 'simplify_grammar':
          adaptedText = this.simplifyGrammar(adaptedText);
          break;
      }
    }

    // Apply cultural adjustments
    for (const adjustment of adaptations.culturalAdjustments) {
      switch (adjustment) {
        case 'add_indonesian_courtesy':
          adaptedText = this.addIndonesianCourtesy(adaptedText);
          break;
        case 'add_italian_warmth':
          adaptedText = this.addItalianWarmth(adaptedText);
          break;
        case 'improve_cultural_context':
          adaptedText = await this.improveCulturalContext(adaptedText);
          break;
      }
    }

    // Apply formality adjustments
    for (const adjustment of adaptations.formalityAdjustments) {
      if (adjustment === 'adjust_to_formal') {
        adaptedText = this.makeFormal(adaptedText);
      } else if (adjustment === 'adjust_to_informal') {
        adaptedText = this.makeInformal(adaptedText);
      }
    }

    return { text: adaptedText, confidence };
  }

  private async identifyLearningOpportunity(
    userMessage: string,
    response: string,
    profile: any
  ): Promise<{ skill: string; explanation: string; practice: string } | undefined> {
    // Identify areas where user can improve
    const opportunities = [];

    // Grammar opportunities
    if (this.hasGrammarIssues(userMessage)) {
      opportunities.push({
        skill: 'grammar',
        explanation: 'Detected some grammar patterns that could be improved',
        practice: 'Try practicing compound sentences and proper verb tenses'
      });
    }

    // Vocabulary opportunities
    if (this.hasLimitedVocabulary(userMessage)) {
      opportunities.push({
        skill: 'vocabulary',
        explanation: 'Using more varied vocabulary could improve communication',
        practice: 'Try learning 3-5 new words related to your business topics each week'
      });
    }

    // Cultural communication opportunities
    if (this.missedCulturalContext(userMessage, response)) {
      opportunities.push({
        skill: 'cultural_communication',
        explanation: 'Understanding Indonesian business culture better could help',
        practice: 'Learn about hierarchy and relationship-building in Indonesian business'
      });
    }

    // Return the highest priority opportunity
    return opportunities.length > 0 ? opportunities[0] : undefined;
  }

  async generateLearningAnalytics(userId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<LearningAnalytics> {
    const feedback = await this.getUserFeedback(userId, period);
    const profile = await this.getUserLearningProfile(userId);

    // Calculate progress metrics
    const overallProgress = this.calculateOverallProgress(feedback, profile);
    const languageProgress = this.calculateLanguageProgress(feedback, profile);
    const skillProgress = this.calculateSkillProgress(feedback, profile);

    // Calculate interaction quality
    const averageResponseQuality = feedback.reduce((sum, f) => sum + f.responseHelpfulness, 0) / feedback.length || 3;
    const improvementRate = this.calculateImprovementRate(feedback);

    // Analyze learning patterns
    const preferredLearningTimes = this.analyzePreferredTimes(feedback);
    const mostActiveTopics = this.analyzeMostActiveTopics(feedback);
    const challengingAreas = this.analyzeChallengingAreas(feedback);

    // Generate recommendations
    const personalizedRecommendations = await this.generatePersonalizedRecommendations(userId);
    const nextLearningGoals = this.generateNextLearningGoals(profile, feedback);

    const analytics: LearningAnalytics = {
      userId,
      period,
      overallProgress,
      languageProgress,
      skillProgress,
      averageResponseQuality,
      improvementRate,
      preferredLearningTimes,
      mostActiveTopics,
      challengingAreas,
      personalizedRecommendations,
      nextLearningGoals
    };

    // Cache analytics
    this.analyticsCache.set(userId, analytics);

    return analytics;
  }

  async provideLearningInsights(userId: string): Promise<{
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    progress: { skill: string; progress: number }[];
  }> {
    const analytics = await this.generateLearningAnalytics(userId, 'weekly');
    const profile = await this.getUserLearningProfile(userId);

    const strengths: string[] = [];
    const improvements: string[] = [];
    const recommendations: string[] = [];
    const progress: { skill: string; progress: number }[] = [];

    // Identify strengths
    for (const [skill, score] of Object.entries(analytics.skillProgress)) {
      if (score > 70) {
        strengths.push(`Strong ${skill} skills`);
      } else if (score < 40) {
        improvements.push(`${skill} needs more practice`);
      }
      progress.push({ skill, progress: score });
    }

    // Language-specific insights
    for (const [lang, score] of Object.entries(analytics.languageProgress)) {
      if (score > 80) {
        strengths.push(`Excellent ${lang} communication`);
      } else if (score < 50) {
        improvements.push(`${lang} language skills need development`);
      }
    }

    // Generate actionable recommendations
    if (analytics.averageResponseQuality < 3) {
      recommendations.push('Focus on asking more specific questions to get better responses');
    }

    if (analytics.challengingAreas.includes('cultural_communication')) {
      recommendations.push('Learn more about Indonesian business culture and etiquette');
    }

    if (analytics.improvementRate < 0.1) {
      recommendations.push('Try practicing with more diverse topics to accelerate learning');
    }

    return {
      strengths,
      improvements,
      recommendations,
      progress
    };
  }

  // Helper methods
  private hasComplexSentences(text: string): boolean {
    const sentences = text.split(/[.!?]+/);
    return sentences.some(sentence => 
      sentence.split(',').length > 3 || sentence.split(' ').length > 20
    );
  }

  private hasGrammarIssues(text: string): boolean {
    // Simple grammar pattern detection
    const issues = [
      /\b(is|are)\s+(is|are)\b/i, // Double verbs
      /\b(a)\s+(a)\b/i, // Double articles
      /\b(the)\s+(the)\b/i // Double articles
    ];
    return issues.some(pattern => pattern.test(text));
  }

  private hasLimitedVocabulary(text: string): boolean {
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    return uniqueWords.size / words.length < 0.7; // Low word diversity
  }

  private missedCulturalContext(userMessage: string, response: string): boolean {
    // Check if business context was mentioned but cultural aspects weren't addressed
    const businessTerms = /\b(business|company|meeting|contract)\b/i;
    const culturalTerms = /\b(culture|respect|hierarchy|relationship)\b/i;
    
    return businessTerms.test(userMessage) && !culturalTerms.test(response);
  }

  private analyzePreferredFormality(feedback: LearningFeedback[], profile: any): string {
    const formalityPrefs = feedback.map(f => f.preferredFormality);
    const mostCommon = this.getMostCommon(formalityPrefs);
    return mostCommon || profile.preferredFormality || 'adaptive';
  }

  private getMostCommon<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;
    const frequency = new Map<T, number>();
    for (const item of arr) {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    }
    let maxCount = 0;
    let mostCommon: T | null = null;
    for (const [item, count] of frequency) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }
    return mostCommon;
  }

  private simplifyVocabulary(text: string): string {
    const simplifications = {
      'consequently': 'so',
      'furthermore': 'also',
      'nevertheless': 'but',
      'subsequently': 'then',
      'approximately': 'about'
    };
    
    let simplified = text;
    for (const [complex, simple] of Object.entries(simplifications)) {
      const regex = new RegExp(`\\b${complex}\\b`, 'gi');
      simplified = simplified.replace(regex, simple);
    }
    return simplified;
  }

  private simplifyGrammar(text: string): string {
    // Break down complex sentences
    return text
      .replace(/,\s*which\s+/gi, '. This ')
      .replace(/,\s*that\s+/gi, '. It ')
      .replace(/;\s*/g, '. ');
  }

  private makeConcise(text: string): string {
    // Remove redundant phrases
    return text
      .replace(/\b(in order to)\b/g, 'to')
      .replace(/\b(due to the fact that)\b/g, 'because')
      .replace(/\b(at this point in time)\b/g, 'now')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private addIndonesianCourtesy(text: string): string {
    if (!text.match(/^(selamat|dengan hormat|terima kasih)/i)) {
      return `Selamat ${this.getTimeGreeting()}, ${text}`;
    }
    return text;
  }

  private addItalianWarmth(text: string): string {
    if (!text.match(/^(ciao|salve|buongiorno)/i)) {
      return `Ciao! ${text}`;
    }
    return text;
  }

  private makeFormal(text: string): string {
    return text
      .replace(/\bciao\b/gi, 'buongiorno')
      .replace(/\bhey\b/gi, 'hello')
      .replace(/\bthanks\b/gi, 'thank you');
  }

  private makeInformal(text: string): string {
    return text
      .replace(/\bbuongiorno\b/gi, 'ciao')
      .replace(/\bhello\b/gi, 'hey')
      .replace(/\bthank you\b/gi, 'thanks');
  }

  private getTimeGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'pagi';
    if (hour < 15) return 'siang';
    if (hour < 18) return 'sore';
    return 'malam';
  }

  private async addMoreDetail(text: string): Promise<string> {
    // Add context-appropriate details
    if (text.includes('visa') || text.includes('kitas')) {
      return `${text}\n\nUntuk informasi lebih lengkap tentang visa, Anda dapat mengunjungi kantor imigrasi terdekat atau mengecek website resmi Ditjen Imigrasi.`;
    }
    return text;
  }

  private async addExamples(text: string): Promise<string> {
    // Add relevant examples based on content
    if (text.includes('PT PMA')) {
      return `${text}\n\nContoh: PT PMA dengan investasi minimal 350.000 USD untuk bidang perdagangan.`;
    }
    return text;
  }

  private async improveCulturalContext(text: string): Promise<string> {
    if (text.includes('business') || text.includes('meeting')) {
      return `${text}\n\nCatatan budaya: Dalam konteks bisnis Indonesia, membangun hubungan personal sangat penting sebelum melakukan transaksi bisnis.`;
    }
    return text;
  }

  // Analytics calculation methods
  private calculateOverallProgress(feedback: LearningFeedback[], profile: any): number {
    if (feedback.length === 0) return 0;
    
    const avgHelpfulness = feedback.reduce((sum, f) => sum + f.responseHelpfulness, 0) / feedback.length;
    const avgAccuracy = feedback.reduce((sum, f) => sum + f.languageAccuracy, 0) / feedback.length;
    const avgCultural = feedback.reduce((sum, f) => sum + f.culturalAppropriate, 0) / feedback.length;
    
    return ((avgHelpfulness + avgAccuracy + avgCultural) / 3) * 20; // Convert to 0-100 scale
  }

  private calculateLanguageProgress(feedback: LearningFeedback[], profile: any): Record<string, number> {
    const progress: Record<string, number> = {};
    const baseline = profile.languageProficiency || {};
    
    // Group feedback by inferred language (simplified for demo)
    for (const lang of ['it', 'id', 'en']) {
      const langFeedback = feedback.filter(f => f.userComments?.includes(lang) || Math.random() > 0.5);
      if (langFeedback.length > 0) {
        const avgScore = langFeedback.reduce((sum, f) => sum + f.languageAccuracy, 0) / langFeedback.length;
        progress[lang] = Math.min(100, (baseline[lang] || 50) + (avgScore - 3) * 10);
      } else {
        progress[lang] = baseline[lang] || 50;
      }
    }
    
    return progress;
  }

  private calculateSkillProgress(feedback: LearningFeedback[], profile: any): Record<string, number> {
    const skills = ['grammar', 'vocabulary', 'cultural', 'technical', 'formality', 'clarity'];
    const progress: Record<string, number> = {};
    
    for (const skill of skills) {
      const skillFeedback = feedback
        .flatMap(f => f.feedbackCategories)
        .filter(cat => cat.category === skill);
      
      if (skillFeedback.length > 0) {
        const avgScore = skillFeedback.reduce((sum, cat) => sum + cat.score, 0) / skillFeedback.length;
        progress[skill] = avgScore * 20; // Convert to 0-100 scale
      } else {
        progress[skill] = 50; // Default baseline
      }
    }
    
    return progress;
  }

  private calculateImprovementRate(feedback: LearningFeedback[]): number {
    if (feedback.length < 2) return 0;
    
    // Sort by timestamp
    const sorted = feedback.sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted.slice(0, Math.floor(sorted.length / 2));
    const second = sorted.slice(Math.floor(sorted.length / 2));
    
    const firstAvg = first.reduce((sum, f) => sum + f.responseHelpfulness, 0) / first.length;
    const secondAvg = second.reduce((sum, f) => sum + f.responseHelpfulness, 0) / second.length;
    
    return (secondAvg - firstAvg) / firstAvg;
  }

  private analyzePreferredTimes(feedback: LearningFeedback[]): string[] {
    const hours = feedback.map(f => new Date(f.timestamp).getHours());
    const hourCounts = new Map<number, number>();
    
    for (const hour of hours) {
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
    
    // Get top 3 most active hours
    const sortedHours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => `${hour}:00-${hour + 1}:00`);
    
    return sortedHours;
  }

  private analyzeMostActiveTopics(feedback: LearningFeedback[]): string[] {
    const topics = feedback.flatMap(f => f.skillsImproved);
    const topicCounts = new Map<string, number>();
    
    for (const topic of topics) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
    
    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  private analyzeChallengingAreas(feedback: LearningFeedback[]): string[] {
    const struggling = feedback.flatMap(f => f.strugglingAreas);
    const strugglingCounts = new Map<string, number>();
    
    for (const area of struggling) {
      strugglingCounts.set(area, (strugglingCounts.get(area) || 0) + 1);
    }
    
    return Array.from(strugglingCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([area]) => area);
  }

  private generateNextLearningGoals(profile: any, feedback: LearningFeedback[]): string[] {
    const goals: string[] = [];
    
    // Based on struggling areas
    const strugglingAreas = this.analyzeChallengingAreas(feedback);
    for (const area of strugglingAreas.slice(0, 2)) {
      goals.push(`Improve ${area} skills through targeted practice`);
    }
    
    // Based on language proficiency
    const languageProgress = this.calculateLanguageProgress(feedback, profile);
    for (const [lang, progress] of Object.entries(languageProgress)) {
      if (progress < 70) {
        goals.push(`Enhance ${lang} language proficiency to advanced level`);
      }
    }
    
    return goals.slice(0, 3); // Limit to top 3 goals
  }

  // Data persistence methods
  private async storeFeedback(feedback: LearningFeedback): Promise<void> {
    try {
      await db.collection('learningFeedback').doc(feedback.id).set(feedback);
    } catch (error) {
      console.error('Error storing feedback:', error);
    }
  }

  private async getUserFeedback(userId: string, period: string): Promise<LearningFeedback[]> {
    try {
      const cutoff = this.getPeriodCutoff(period);
      const snapshot = await db.collection('learningFeedback')
        .where('userId', '==', userId)
        .where('timestamp', '>=', cutoff)
        .orderBy('timestamp', 'desc')
        .get();
      
      return snapshot.docs.map(doc => doc.data() as LearningFeedback);
    } catch (error) {
      console.error('Error fetching user feedback:', error);
      return [];
    }
  }

  private async getRecentFeedback(userId: string, limit: number): Promise<LearningFeedback[]> {
    try {
      const snapshot = await db.collection('learningFeedback')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => doc.data() as LearningFeedback);
    } catch (error) {
      console.error('Error fetching recent feedback:', error);
      return [];
    }
  }

  private async getUserLearningProfile(userId: string): Promise<any> {
    try {
      const doc = await db.collection('userLearningProfiles').doc(userId).get();
      return doc.data() || {};
    } catch (error) {
      console.error('Error fetching learning profile:', error);
      return {};
    }
  }

  private async updateLearningProfile(feedback: LearningFeedback): Promise<void> {
    try {
      const profileRef = db.collection('userLearningProfiles').doc(feedback.userId);
      await profileRef.set({
        lastUpdated: Date.now(),
        preferredResponseStyle: feedback.preferredResponseStyle,
        preferredFormality: feedback.preferredFormality,
        recentFeedbackScore: feedback.responseHelpfulness
      }, { merge: true });
    } catch (error) {
      console.error('Error updating learning profile:', error);
    }
  }

  private async generatePersonalizedRecommendations(userId: string): Promise<LearningRecommendation[]> {
    const profile = await this.getUserLearningProfile(userId);
    const recentFeedback = await this.getRecentFeedback(userId, 5);
    
    const recommendations: LearningRecommendation[] = [];
    
    // Add recommendations based on feedback patterns
    if (recentFeedback.some(f => f.languageAccuracy < 3)) {
      recommendations.push({
        type: 'language_practice',
        title: 'Daily Language Practice',
        description: 'Practice basic grammar and vocabulary for 15 minutes daily',
        priority: 0.8,
        estimatedTime: '15 minutes',
        actionable: true,
        resources: ['grammar_exercises', 'vocabulary_flashcards']
      });
    }
    
    if (recentFeedback.some(f => f.culturalAppropriate < 3)) {
      recommendations.push({
        type: 'cultural_learning',
        title: 'Indonesian Business Culture',
        description: 'Learn about Indonesian business etiquette and communication styles',
        priority: 0.7,
        estimatedTime: '30 minutes',
        actionable: true,
        resources: ['cultural_guide', 'business_etiquette_videos']
      });
    }
    
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private getPeriodCutoff(period: string): number {
    const now = Date.now();
    switch (period) {
      case 'daily':
        return now - (24 * 60 * 60 * 1000);
      case 'weekly':
        return now - (7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return now - (30 * 24 * 60 * 60 * 1000);
      default:
        return now - (7 * 24 * 60 * 60 * 1000);
    }
  }
}

export default new LanguageLearningFeedbackService();
export { 
  LearningFeedback, 
  LearningAnalytics, 
  AdaptiveResponse, 
  LearningRecommendation,
  FeedbackCategory 
};