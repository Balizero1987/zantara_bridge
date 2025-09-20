import { db } from '../core/firestore';
import languageDetection from './languageDetection';
import { ofetch } from 'ofetch';

interface LanguageLearningData {
  userId: string;
  detectedLanguage: string;
  confidence: number;
  contextClues: string[];
  correctionHistory: LanguageCorrection[];
  preferredFormality: 'formal' | 'informal' | 'mixed';
  culturalContext: string[];
  learningProgress: {
    vocabulary: number;
    grammar: number;
    cultural: number;
  };
}

interface LanguageCorrection {
  original: string;
  corrected: string;
  reason: string;
  timestamp: number;
  language: string;
}

interface LanguagePattern {
  pattern: RegExp;
  confidence: number;
  context: string;
  culturalNote?: string;
}

interface MultilingualResponse {
  primary: string;
  translations?: Record<string, string>;
  culturalAdaptations?: Record<string, string>;
  formality: 'formal' | 'informal' | 'mixed';
}

class EnhancedLanguageTrainingService {
  private readonly advancedPatterns: Record<string, LanguagePattern[]> = {
    it: [
      { pattern: /\b(lei|voi)\b/i, confidence: 0.9, context: 'formality_pronouns' },
      { pattern: /\b(cortesemente|cordialmente)\b/i, confidence: 0.8, context: 'formal_courtesy' },
      { pattern: /\b(ciao|salve|buongiorno)\b/i, confidence: 0.7, context: 'greeting_formality' },
      { pattern: /per favore|per piacere/i, confidence: 0.8, context: 'politeness_markers' },
      { pattern: /\b(bello|bellissimo|fantastico)\b/i, confidence: 0.6, context: 'emotional_expression' }
    ],
    id: [
      { pattern: /\b(bapak|ibu|pak|bu)\b/i, confidence: 0.9, context: 'respect_titles' },
      { pattern: /mohon|tolong/i, confidence: 0.8, context: 'politeness_request' },
      { pattern: /selamat\s+(pagi|siang|malam)/i, confidence: 0.8, context: 'time_greetings' },
      { pattern: /terima kasih\s+(banyak|sekali)?/i, confidence: 0.7, context: 'gratitude_levels' },
      { pattern: /maaf\s+(ya|nih)?/i, confidence: 0.7, context: 'apology_markers' }
    ],
    en: [
      { pattern: /\b(please|kindly)\b/i, confidence: 0.8, context: 'politeness_formal' },
      { pattern: /\b(thanks|thank you|appreciate)\b/i, confidence: 0.7, context: 'gratitude_expression' },
      { pattern: /\b(could|would|might)\b/i, confidence: 0.8, context: 'conditional_politeness' },
      { pattern: /\b(sir|madam|mr|ms)\b/i, confidence: 0.9, context: 'formal_address' }
    ]
  };

  private readonly culturalContexts: Record<string, string[]> = {
    it: ['business_formality', 'family_warmth', 'regional_dialects', 'meal_culture'],
    id: ['hierarchical_respect', 'indirect_communication', 'religious_context', 'collective_harmony'],
    en: ['directness_preference', 'individual_autonomy', 'time_consciousness', 'casual_professionalism'],
    es: ['personal_relationships', 'expressive_communication', 'family_orientation', 'honor_respect'],
    pt: ['warmth_friendliness', 'relationship_building', 'indirect_hints', 'social_hierarchy']
  };

  async analyzeUserLanguageProfile(userId: string, messageText: string): Promise<LanguageLearningData> {
    const detection = languageDetection.detect(messageText);
    const contextClues = this.extractContextClues(messageText, detection.language);
    
    // Retrieve existing learning data
    const existingData = await this.getUserLearningData(userId);
    
    // Analyze formality level
    const formality = this.detectFormality(messageText, detection.language);
    
    // Extract cultural markers
    const culturalMarkers = this.extractCulturalMarkers(messageText, detection.language);
    
    const learningData: LanguageLearningData = {
      userId,
      detectedLanguage: detection.language,
      confidence: detection.confidence,
      contextClues,
      correctionHistory: existingData?.correctionHistory || [],
      preferredFormality: formality,
      culturalContext: culturalMarkers,
      learningProgress: existingData?.learningProgress || {
        vocabulary: 0,
        grammar: 0,
        cultural: 0
      }
    };

    // Update learning progress based on interaction
    this.updateLearningProgress(learningData, messageText);
    
    // Store updated data
    await this.storeLearningData(learningData);
    
    return learningData;
  }

  private extractContextClues(text: string, language: string): string[] {
    const clues: string[] = [];
    const patterns = this.advancedPatterns[language] || [];
    
    for (const pattern of patterns) {
      if (pattern.pattern.test(text)) {
        clues.push(pattern.context);
      }
    }
    
    // Time-based context
    const timeClues = this.extractTimeContext(text);
    clues.push(...timeClues);
    
    // Topic context
    const topicClues = this.extractTopicContext(text);
    clues.push(...topicClues);
    
    return [...new Set(clues)]; // Remove duplicates
  }

  private detectFormality(text: string, language: string): 'formal' | 'informal' | 'mixed' {
    const formalIndicators: Record<string, RegExp[]> = {
      it: [/\blei\b/i, /cortesemente/i, /distinti saluti/i, /spettabile/i],
      id: [/\b(bapak|ibu)\b/i, /dengan hormat/i, /selamat pagi/i, /terima kasih atas/i],
      en: [/\b(sir|madam)\b/i, /\bwould you\b/i, /sincerely/i, /\bregards\b/i]
    };
    
    const informalIndicators: Record<string, RegExp[]> = {
      it: [/\bciao\b/i, /\btu\b/i, /\bcosa fai\b/i],
      id: [/\bhalo\b/i, /\bgimana\b/i, /\byuk\b/i],
      en: [/\bhey\b/i, /\bwanna\b/i, /\bawesome\b/i]
    };
    
    const formal = formalIndicators[language]?.some(pattern => pattern.test(text)) || false;
    const informal = informalIndicators[language]?.some(pattern => pattern.test(text)) || false;
    
    if (formal && informal) return 'mixed';
    if (formal) return 'formal';
    if (informal) return 'informal';
    return 'mixed'; // Default when unclear
  }

  private extractCulturalMarkers(text: string, language: string): string[] {
    const markers: string[] = [];
    const contexts = this.culturalContexts[language] || [];
    
    // Business context markers
    if (/\b(meeting|rapat|riunione|reunião)\b/i.test(text)) {
      markers.push('business_context');
    }
    
    // Family context markers
    if (/\b(family|famiglia|keluarga|família)\b/i.test(text)) {
      markers.push('family_context');
    }
    
    // Religious context markers
    if (/\b(prayer|preghiera|doa|oração)\b/i.test(text)) {
      markers.push('religious_context');
    }
    
    // Food context markers
    if (/\b(food|cibo|makanan|comida)\b/i.test(text)) {
      markers.push('food_culture');
    }
    
    return markers.filter(marker => 
      contexts.some(context => context.includes(marker.split('_')[0]))
    );
  }

  private extractTimeContext(text: string): string[] {
    const timePatterns = [
      { pattern: /\b(morning|mattina|pagi|manhã)\b/i, context: 'morning_greeting' },
      { pattern: /\b(evening|sera|malam|noite)\b/i, context: 'evening_greeting' },
      { pattern: /\b(urgent|urgente|mendesak|urgente)\b/i, context: 'time_pressure' },
      { pattern: /\b(tomorrow|domani|besok|amanhã)\b/i, context: 'future_planning' }
    ];
    
    return timePatterns
      .filter(tp => tp.pattern.test(text))
      .map(tp => tp.context);
  }

  private extractTopicContext(text: string): string[] {
    const topicPatterns = [
      { pattern: /\b(visa|kitas|visto)\b/i, context: 'immigration_topic' },
      { pattern: /\b(business|affari|bisnis|negócio)\b/i, context: 'business_topic' },
      { pattern: /\b(tax|tasse|pajak|imposto)\b/i, context: 'tax_topic' },
      { pattern: /\b(legal|legale|hukum|legal)\b/i, context: 'legal_topic' }
    ];
    
    return topicPatterns
      .filter(tp => tp.pattern.test(text))
      .map(tp => tp.context);
  }

  private updateLearningProgress(data: LanguageLearningData, text: string): void {
    // Update vocabulary score based on word complexity
    const wordComplexity = this.analyzeWordComplexity(text, data.detectedLanguage);
    data.learningProgress.vocabulary = Math.min(100, data.learningProgress.vocabulary + wordComplexity);
    
    // Update grammar score based on sentence structure
    const grammarComplexity = this.analyzeGrammarComplexity(text, data.detectedLanguage);
    data.learningProgress.grammar = Math.min(100, data.learningProgress.grammar + grammarComplexity);
    
    // Update cultural score based on cultural markers
    const culturalAwareness = data.culturalContext.length * 2;
    data.learningProgress.cultural = Math.min(100, data.learningProgress.cultural + culturalAwareness);
  }

  private analyzeWordComplexity(text: string, language: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let complexity = 0;
    
    for (const word of words) {
      if (word.length > 8) complexity += 2; // Long words
      if (word.length > 12) complexity += 3; // Very long words
    }
    
    return Math.min(10, complexity);
  }

  private analyzeGrammarComplexity(text: string, language: string): number {
    let complexity = 0;
    
    // Count subordinate clauses
    const subordinateMarkers = ['che', 'quando', 'dove', 'perché', 'while', 'because', 'when', 'yang', 'ketika'];
    for (const marker of subordinateMarkers) {
      const regex = new RegExp(`\\b${marker}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) complexity += matches.length * 2;
    }
    
    // Count conditional structures
    const conditionalMarkers = ['if', 'se', 'jika', 'kalau'];
    for (const marker of conditionalMarkers) {
      const regex = new RegExp(`\\b${marker}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) complexity += matches.length * 3;
    }
    
    return Math.min(10, complexity);
  }

  async generateAdaptiveResponse(
    userMessage: string, 
    learningData: LanguageLearningData,
    baseResponse: string
  ): Promise<MultilingualResponse> {
    const { detectedLanguage, preferredFormality, culturalContext } = learningData;
    
    // Adapt response based on user's formality preference
    const adaptedResponse = this.adaptFormality(baseResponse, preferredFormality, detectedLanguage);
    
    // Add cultural adaptations
    const culturallyAdapted = this.addCulturalAdaptations(adaptedResponse, culturalContext, detectedLanguage);
    
    // Generate translations for key languages if needed
    const translations = await this.generateTranslations(culturallyAdapted, detectedLanguage);
    
    return {
      primary: culturallyAdapted,
      translations,
      culturalAdaptations: this.getCulturalAdaptations(culturalContext, detectedLanguage),
      formality: preferredFormality
    };
  }

  private adaptFormality(text: string, formality: string, language: string): string {
    const formalityAdaptations: Record<string, Record<string, Record<string, string>>> = {
      it: {
        formal: {
          'ciao': 'buongiorno/buonasera',
          'come va?': 'come sta?',
          'grazie': 'la ringrazio'
        },
        informal: {
          'buongiorno': 'ciao',
          'come sta?': 'come va?',
          'la ringrazio': 'grazie'
        }
      },
      id: {
        formal: {
          'halo': 'selamat pagi/siang/malam',
          'gimana': 'bagaimana',
          'makasih': 'terima kasih'
        },
        informal: {
          'selamat pagi': 'halo',
          'bagaimana': 'gimana',
          'terima kasih': 'makasih'
        }
      }
    };
    
    const adaptations = formalityAdaptations[language]?.[formality] || {};
    let adaptedText = text;
    
    for (const [from, to] of Object.entries(adaptations)) {
      const regex = new RegExp(from, 'gi');
      adaptedText = adaptedText.replace(regex, to);
    }
    
    return adaptedText;
  }

  private addCulturalAdaptations(text: string, culturalContext: string[], language: string): string {
    let adaptedText = text;
    
    // Add cultural greetings based on context
    if (culturalContext.includes('morning_greeting') && language === 'id') {
      adaptedText = adaptedText.replace(/^/, 'Selamat pagi! ');
    }
    
    // Add respect markers for Indonesian
    if (language === 'id' && culturalContext.includes('business_context')) {
      adaptedText = adaptedText.replace(/\byou\b/g, 'Bapak/Ibu');
    }
    
    // Add warmth for Italian
    if (language === 'it' && culturalContext.includes('family_context')) {
      adaptedText = adaptedText.replace(/\bthanks\b/g, 'grazie mille');
    }
    
    return adaptedText;
  }

  private async generateTranslations(text: string, primaryLanguage: string): Promise<Record<string, string>> {
    // This would integrate with a translation service
    // For now, return basic translations
    const basicTranslations: Record<string, Record<string, string>> = {
      it: {
        en: 'Thank you for your message',
        id: 'Terima kasih atas pesan Anda'
      },
      id: {
        en: 'Thank you for your message',
        it: 'Grazie per il tuo messaggio'
      },
      en: {
        it: 'Grazie per il tuo messaggio',
        id: 'Terima kasih atas pesan Anda'
      }
    };
    
    return basicTranslations[primaryLanguage] || {};
  }

  private getCulturalAdaptations(culturalContext: string[], language: string): Record<string, string> {
    const adaptations: Record<string, string> = {};
    
    if (culturalContext.includes('business_context')) {
      adaptations.business = language === 'id' 
        ? 'Menggunakan sapaan formal yang sesuai dengan budaya bisnis Indonesia'
        : 'Using appropriate business formality';
    }
    
    if (culturalContext.includes('family_context')) {
      adaptations.family = language === 'it'
        ? 'Aggiungendo calore familiare tipico della cultura italiana'
        : 'Adding family warmth typical of Italian culture';
    }
    
    return adaptations;
  }

  async recordLanguageCorrection(
    userId: string,
    original: string,
    corrected: string,
    reason: string,
    language: string
  ): Promise<void> {
    const learningData = await this.getUserLearningData(userId);
    if (!learningData) return;
    
    const correction: LanguageCorrection = {
      original,
      corrected,
      reason,
      timestamp: Date.now(),
      language
    };
    
    learningData.correctionHistory.push(correction);
    
    // Keep only last 50 corrections
    if (learningData.correctionHistory.length > 50) {
      learningData.correctionHistory = learningData.correctionHistory.slice(-50);
    }
    
    await this.storeLearningData(learningData);
  }

  private async getUserLearningData(userId: string): Promise<LanguageLearningData | null> {
    try {
      const doc = await db.collection('languageLearning').doc(userId).get();
      return doc.exists ? doc.data() as LanguageLearningData : null;
    } catch (error) {
      console.error('Error fetching language learning data:', error);
      return null;
    }
  }

  private async storeLearningData(data: LanguageLearningData): Promise<void> {
    try {
      await db.collection('languageLearning').doc(data.userId).set(data, { merge: true });
    } catch (error) {
      console.error('Error storing language learning data:', error);
    }
  }

  // Public method to get user's language preferences for personalization
  async getUserLanguagePreferences(userId: string): Promise<{
    primaryLanguage: string;
    formality: string;
    culturalContext: string[];
    learningLevel: 'beginner' | 'intermediate' | 'advanced';
  }> {
    const data = await this.getUserLearningData(userId);
    if (!data) {
      return {
        primaryLanguage: 'en',
        formality: 'mixed',
        culturalContext: [],
        learningLevel: 'beginner'
      };
    }
    
    const totalProgress = (data.learningProgress.vocabulary + data.learningProgress.grammar + data.learningProgress.cultural) / 3;
    const learningLevel = totalProgress < 30 ? 'beginner' : totalProgress < 70 ? 'intermediate' : 'advanced';
    
    return {
      primaryLanguage: data.detectedLanguage,
      formality: data.preferredFormality,
      culturalContext: data.culturalContext,
      learningLevel
    };
  }
}

export default new EnhancedLanguageTrainingService();