import enhancedLanguageTraining from '../services/enhancedLanguageTraining';
import languageDetection from '../services/languageDetection';
import { getUserProfile } from './userProfiles';

interface LanguageModule {
  name: string;
  priority: number;
  supports: string[];
  process: (input: LanguageInput) => Promise<LanguageOutput>;
}

interface LanguageInput {
  text: string;
  userId: string;
  context?: {
    previousMessages?: string[];
    topic?: string;
    urgency?: 'low' | 'medium' | 'high';
    formality?: 'formal' | 'informal' | 'mixed';
  };
  metadata?: {
    timestamp: number;
    source: string;
    platform?: string;
  };
}

interface LanguageOutput {
  processedText: string;
  detectedLanguage: string;
  confidence: number;
  suggestions?: string[];
  culturalNotes?: string[];
  nextActions?: string[];
  adaptedResponse?: {
    text: string;
    formality: string;
    culturalContext: string[];
  };
}

interface ModuleConfig {
  enabled: boolean;
  weight: number;
  fallback?: boolean;
  dependencies?: string[];
}

class ModularLanguageEngine {
  private modules: Map<string, LanguageModule> = new Map();
  private moduleConfigs: Map<string, ModuleConfig> = new Map();
  private processingChain: string[] = [];

  constructor() {
    this.initializeDefaultModules();
  }

  private initializeDefaultModules(): void {
    // Core language detection module
    this.registerModule({
      name: 'detection',
      priority: 100,
      supports: ['it', 'id', 'en', 'es', 'pt'],
      process: async (input: LanguageInput): Promise<LanguageOutput> => {
        const detection = languageDetection.detect(input.text);
        return {
          processedText: input.text,
          detectedLanguage: detection.language,
          confidence: detection.confidence,
          suggestions: detection.confidence < 0.7 
            ? ['Consider providing more context for better language detection']
            : []
        };
      }
    });

    // Enhanced training module
    this.registerModule({
      name: 'enhanced_training',
      priority: 90,
      supports: ['it', 'id', 'en', 'es', 'pt'],
      process: async (input: LanguageInput): Promise<LanguageOutput> => {
        const learningData = await enhancedLanguageTraining.analyzeUserLanguageProfile(
          input.userId, 
          input.text
        );
        
        const baseResponse = await this.generateBaseResponse(input, learningData.detectedLanguage);
        const adaptiveResponse = await enhancedLanguageTraining.generateAdaptiveResponse(
          input.text,
          learningData,
          baseResponse
        );

        return {
          processedText: input.text,
          detectedLanguage: learningData.detectedLanguage,
          confidence: learningData.confidence,
          adaptedResponse: {
            text: adaptiveResponse.primary,
            formality: adaptiveResponse.formality,
            culturalContext: learningData.culturalContext
          },
          culturalNotes: this.generateCulturalNotes(learningData.culturalContext, learningData.detectedLanguage),
          nextActions: this.generateNextActions(learningData)
        };
      }
    });

    // Context awareness module
    this.registerModule({
      name: 'context_awareness',
      priority: 80,
      supports: ['it', 'id', 'en', 'es', 'pt'],
      process: async (input: LanguageInput): Promise<LanguageOutput> => {
        const contextualInsights = await this.analyzeContext(input);
        
        return {
          processedText: input.text,
          detectedLanguage: contextualInsights.language,
          confidence: contextualInsights.confidence,
          suggestions: contextualInsights.suggestions,
          nextActions: contextualInsights.recommendedActions
        };
      }
    });

    // Business compliance module
    this.registerModule({
      name: 'business_compliance',
      priority: 70,
      supports: ['it', 'id', 'en'],
      process: async (input: LanguageInput): Promise<LanguageOutput> => {
        const complianceContext = this.analyzeBusinessCompliance(input.text);
        
        return {
          processedText: input.text,
          detectedLanguage: 'id', // Default for business compliance
          confidence: 0.9,
          suggestions: complianceContext.suggestions,
          nextActions: complianceContext.nextActions,
          culturalNotes: complianceContext.culturalNotes
        };
      }
    });

    // Initialize module configurations
    this.setModuleConfig('detection', { enabled: true, weight: 1.0 });
    this.setModuleConfig('enhanced_training', { enabled: true, weight: 0.9 });
    this.setModuleConfig('context_awareness', { enabled: true, weight: 0.8 });
    this.setModuleConfig('business_compliance', { enabled: true, weight: 0.7 });

    // Set processing chain
    this.processingChain = ['detection', 'enhanced_training', 'context_awareness', 'business_compliance'];
  }

  registerModule(module: LanguageModule): void {
    this.modules.set(module.name, module);
  }

  setModuleConfig(moduleName: string, config: ModuleConfig): void {
    this.moduleConfigs.set(moduleName, config);
  }

  enableModule(moduleName: string): void {
    const config = this.moduleConfigs.get(moduleName);
    if (config) {
      config.enabled = true;
    }
  }

  disableModule(moduleName: string): void {
    const config = this.moduleConfigs.get(moduleName);
    if (config) {
      config.enabled = false;
    }
  }

  async processLanguageInput(input: LanguageInput): Promise<LanguageOutput> {
    let result: LanguageOutput = {
      processedText: input.text,
      detectedLanguage: 'en',
      confidence: 0
    };

    // Process through enabled modules in priority order
    const enabledModules = this.processingChain
      .filter(moduleName => {
        const config = this.moduleConfigs.get(moduleName);
        return config && config.enabled;
      })
      .map(moduleName => this.modules.get(moduleName)!)
      .filter(Boolean)
      .sort((a, b) => b.priority - a.priority);

    for (const module of enabledModules) {
      try {
        const moduleConfig = this.moduleConfigs.get(module.name)!;
        
        // Check if module supports the detected language
        if (result.detectedLanguage && !module.supports.includes(result.detectedLanguage)) {
          continue;
        }

        const moduleResult = await module.process(input);
        
        // Merge results with weighted confidence
        result = this.mergeResults(result, moduleResult, moduleConfig.weight);
        
      } catch (error) {
        console.error(`Error in module ${module.name}:`, error);
        // Continue with other modules
      }
    }

    return result;
  }

  private mergeResults(
    existing: LanguageOutput, 
    newResult: LanguageOutput, 
    weight: number
  ): LanguageOutput {
    return {
      processedText: newResult.processedText || existing.processedText,
      detectedLanguage: newResult.confidence > existing.confidence 
        ? newResult.detectedLanguage 
        : existing.detectedLanguage,
      confidence: Math.max(existing.confidence, newResult.confidence * weight),
      suggestions: [
        ...(existing.suggestions || []),
        ...(newResult.suggestions || [])
      ].slice(0, 5), // Keep top 5 suggestions
      culturalNotes: [
        ...(existing.culturalNotes || []),
        ...(newResult.culturalNotes || [])
      ].slice(0, 3), // Keep top 3 cultural notes
      nextActions: [
        ...(existing.nextActions || []),
        ...(newResult.nextActions || [])
      ].slice(0, 4), // Keep top 4 actions
      adaptedResponse: newResult.adaptedResponse || existing.adaptedResponse
    };
  }

  private async generateBaseResponse(input: LanguageInput, language: string): Promise<string> {
    const greetings = {
      it: 'Ciao! Come posso aiutarti con le questioni di compliance in Indonesia?',
      id: 'Halo! Bagaimana saya bisa membantu Anda dengan kepatuhan bisnis di Indonesia?',
      en: 'Hello! How can I help you with Indonesia business compliance?',
      es: '¡Hola! ¿Cómo puedo ayudarte con el cumplimiento empresarial en Indonesia?',
      pt: 'Olá! Como posso ajudá-lo com a conformidade empresarial na Indonésia?'
    };

    return greetings[language as keyof typeof greetings] || greetings.en;
  }

  private generateCulturalNotes(culturalContext: string[], language: string): string[] {
    const notes: string[] = [];
    
    if (culturalContext.includes('business_context')) {
      const businessNotes = {
        it: 'In Indonesia, le relazioni commerciali si basano molto sulla fiducia personale',
        id: 'Di Indonesia, hubungan bisnis sangat bergantung pada kepercayaan personal',
        en: 'In Indonesia, business relationships rely heavily on personal trust'
      };
      notes.push(businessNotes[language as keyof typeof businessNotes] || businessNotes.en);
    }

    if (culturalContext.includes('formal_context')) {
      const formalNotes = {
        it: 'Il rispetto per la gerarchia è fondamentale nella cultura indonesiana',
        id: 'Menghormati hierarki sangat penting dalam budaya Indonesia',
        en: 'Respect for hierarchy is fundamental in Indonesian culture'
      };
      notes.push(formalNotes[language as keyof typeof formalNotes] || formalNotes.en);
    }

    return notes;
  }

  private generateNextActions(learningData: any): string[] {
    const actions: string[] = [];
    
    if (learningData.confidence < 0.7) {
      actions.push('Consider providing more context about your specific situation');
    }
    
    if (learningData.culturalContext.includes('immigration_topic')) {
      actions.push('Review your current visa status and requirements');
    }
    
    if (learningData.culturalContext.includes('business_topic')) {
      actions.push('Check your business compliance status');
    }
    
    if (learningData.learningProgress.cultural < 50) {
      actions.push('Learn more about Indonesian business culture');
    }
    
    return actions;
  }

  private async analyzeContext(input: LanguageInput): Promise<{
    language: string;
    confidence: number;
    suggestions: string[];
    recommendedActions: string[];
  }> {
    const { text, userId, context } = input;
    
    // Analyze previous conversation context
    let contextualLanguage = 'en';
    let confidence = 0.6;
    
    if (context?.previousMessages) {
      const languageFrequency = new Map<string, number>();
      
      for (const message of context.previousMessages) {
        const detection = languageDetection.detect(message);
        languageFrequency.set(
          detection.language, 
          (languageFrequency.get(detection.language) || 0) + 1
        );
      }
      
      // Find most frequent language
      let maxCount = 0;
      for (const [lang, count] of languageFrequency) {
        if (count > maxCount) {
          maxCount = count;
          contextualLanguage = lang;
          confidence = Math.min(0.9, 0.6 + (count * 0.1));
        }
      }
    }

    const suggestions: string[] = [];
    const recommendedActions: string[] = [];

    // Topic-based suggestions
    if (context?.topic === 'immigration') {
      suggestions.push('Focus on visa and permit requirements');
      recommendedActions.push('Check KITAS/KITAP status');
    }

    if (context?.urgency === 'high') {
      suggestions.push('Prioritize immediate compliance requirements');
      recommendedActions.push('Schedule urgent consultation');
    }

    return {
      language: contextualLanguage,
      confidence,
      suggestions,
      recommendedActions
    };
  }

  private analyzeBusinessCompliance(text: string): {
    suggestions: string[];
    nextActions: string[];
    culturalNotes: string[];
  } {
    const suggestions: string[] = [];
    const nextActions: string[] = [];
    const culturalNotes: string[] = [];

    // Check for specific compliance topics
    if (/\b(pt pma|perusahaan|company|società)\b/i.test(text)) {
      suggestions.push('Review PT PMA compliance requirements');
      nextActions.push('Verify company registration status');
      culturalNotes.push('Indonesian companies require local partnerships for foreign ownership');
    }

    if (/\b(tax|pajak|tasse|imposto)\b/i.test(text)) {
      suggestions.push('Ensure tax compliance is up to date');
      nextActions.push('Review monthly tax obligations');
      culturalNotes.push('Indonesian tax system requires monthly reporting');
    }

    if (/\b(visa|kitas|permit|izin)\b/i.test(text)) {
      suggestions.push('Check visa/permit validity dates');
      nextActions.push('Review immigration status');
      culturalNotes.push('Indonesian immigration requires proactive renewal processes');
    }

    return { suggestions, nextActions, culturalNotes };
  }

  // Public methods for module management
  getAvailableModules(): string[] {
    return Array.from(this.modules.keys());
  }

  getModuleStatus(moduleName: string): { enabled: boolean; weight: number } | null {
    const config = this.moduleConfigs.get(moduleName);
    return config ? { enabled: config.enabled, weight: config.weight } : null;
  }

  updateProcessingChain(newChain: string[]): void {
    // Validate that all modules exist
    const validModules = newChain.filter(name => this.modules.has(name));
    this.processingChain = validModules;
  }

  async testModule(moduleName: string, input: LanguageInput): Promise<LanguageOutput | null> {
    const module = this.modules.get(moduleName);
    if (!module) return null;

    try {
      return await module.process(input);
    } catch (error) {
      console.error(`Error testing module ${moduleName}:`, error);
      return null;
    }
  }

  // Analytics and monitoring
  getProcessingStats(): {
    totalModules: number;
    enabledModules: number;
    processingChainLength: number;
    averageConfidence: number;
  } {
    const totalModules = this.modules.size;
    const enabledModules = Array.from(this.moduleConfigs.values())
      .filter(config => config.enabled).length;
    
    return {
      totalModules,
      enabledModules,
      processingChainLength: this.processingChain.length,
      averageConfidence: 0.8 // This would be calculated from actual usage
    };
  }
}

export default new ModularLanguageEngine();
export { LanguageInput, LanguageOutput, LanguageModule, ModuleConfig };