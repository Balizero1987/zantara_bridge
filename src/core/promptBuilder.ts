import { db } from './firestore';
import { getUserProfile } from './userProfiles';
import { getRecentUserContext } from './contextualMemory';
import { generateAdaptiveResponse } from './learningEngine';
import { getActiveRecommendations } from './recommendationEngine';
import modularLanguageEngine, { LanguageInput } from './modularLanguageEngine';
import multilingualContextAwareness from '../services/multilingualContextAwareness';
import languageLearningFeedback from '../services/languageLearningFeedback';

export async function buildMessages(owner:string,message:string,riri:boolean){
  const man=await db.collection('memory.global').doc('manifesto').get();
  const preset=await db.collection('memory.byOwner').doc('RIRI').collection('entries').doc('seed-preset').get();
  const manifesto=(man.exists? man.data()?.content : '')||'';
  const ririPreset=(preset.exists? preset.data()?.content : '')||'';
  
  // Enhanced language processing with new modules
  const sessionId = `session_${Date.now()}`;
  
  // Analyze user message with multilingual context awareness
  const conversationContext = await multilingualContextAwareness.analyzeMessage(
    owner, 
    message, 
    sessionId
  );
  
  // Process language input through modular engine
  const languageInput: LanguageInput = {
    text: message,
    userId: owner,
    context: {
      previousMessages: conversationContext.messages.slice(-5).map(m => m.text),
      topic: conversationContext.topics[0],
      urgency: conversationContext.urgency,
      formality: conversationContext.culturalMarkers.includes('formal_context') ? 'formal' : 'informal'
    },
    metadata: {
      timestamp: Date.now(),
      source: 'chat',
      platform: 'zantara'
    }
  };
  
  const languageProcessing = await modularLanguageEngine.processLanguageInput(languageInput);
  
  // Get user personalization data (enhanced with language learning)
  const profile = await getUserProfile(owner);
  const context = await getRecentUserContext(owner, 24);
  const recommendations = await getActiveRecommendations(owner);
  const languagePrefs = await languageLearningFeedback.getUserLearningProfile(owner);
  
  // Build enhanced personalized persona
  const persona = await buildEnhancedPersonalizedPersona(
    profile, 
    context, 
    conversationContext, 
    languageProcessing,
    riri
  );
  
  // Build contextual awareness with multilingual support
  const contextualInfo = await buildEnhancedContextualInfo(
    profile, 
    context, 
    recommendations,
    conversationContext,
    languageProcessing
  );
  
  // Build language-specific system prompt
  const languageInstructions = buildLanguageSpecificInstructions(
    conversationContext.language,
    conversationContext.culturalMarkers,
    languageProcessing.adaptedResponse
  );
  
  const system=[
    'You are ZANTARA, the operational brain of Bali Zero.',
    'Honor Indonesian cultural values. Defend the Constitution. Be precise, useful, kind.',
    languageInstructions,
    manifesto?`Manifesto: ${manifesto}`:'',
    ririPreset?`Preset: ${ririPreset}`:'',
    persona,
    contextualInfo
  ].filter(Boolean).join('\n\n');
  
  return [{role:'system',content:system},{role:'user',content:message}] as any;
}

async function buildPersonalizedPersona(profile: any, context: any, riri: boolean): Promise<string> {
  if (riri) {
    return `Persona: {"tone":"delicato-assertivo-caldo","archetype":"ZAN_RIRI"}`;
  }
  
  const timeOfDay = new Date().getHours();
  const greeting = timeOfDay < 12 ? 'Buongiorno' : timeOfDay < 18 ? 'Buon pomeriggio' : 'Buonasera';
  
  return `Personalizzazione Utente: {
    "nome": "${profile.canonicalOwner}",
    "ruolo": "${profile.context.role}",
    "livello_expertise": "${profile.preferences.expertise}",
    "tono_preferito": "${profile.preferences.tone}",
    "stile_comunicazione": "${profile.preferences.communication}",
    "lunghezza_risposta": "${profile.preferences.responseLength}",
    "lingua": "${profile.preferences.language}",
    "saluto_personalizzato": "${greeting} ${profile.canonicalOwner}",
    "interazioni_totali": ${profile.learning.totalInteractions},
    "soddisfazione_media": ${profile.learning.feedbackScore.toFixed(1)},
    "livello_engagement": "${profile.learning.engagementLevel}"
  }`;
}

async function buildContextualInfo(profile: any, context: any, recommendations: any[]): Promise<string> {
  const contextParts = [];
  
  // Recent interaction context
  if (context.recentInteractions.length > 0) {
    const recentTopics = context.activeTopics.slice(0, 3);
    contextParts.push(`Argomenti recenti dell'utente: ${recentTopics.join(', ')}`);
  }
  
  // Work context
  if (context.workContext.currentProjects.length > 0) {
    contextParts.push(`Progetti attuali: ${context.workContext.currentProjects.join(', ')}`);
  }
  
  if (context.workContext.urgentTasks.length > 0) {
    contextParts.push(`Task urgenti: ${context.workContext.urgentTasks.length} in corso`);
  }
  
  // Proactive recommendations
  if (recommendations.length > 0) {
    const topRec = recommendations[0];
    contextParts.push(`Suggerimento proattivo: ${topRec.title} - ${topRec.description}`);
  }
  
  // Learning progress
  if (profile.learning.learningProgress > 50) {
    contextParts.push(`Progresso apprendimento: ${profile.learning.learningProgress}% - utente in crescita`);
  }
  
  // Memory connections - make Zantara reference past conversations naturally
  const memoryConnections = await getMemoryConnections(profile.canonicalOwner);
  if (memoryConnections.length > 0) {
    contextParts.push(`Ricordi rilevanti: ${memoryConnections.join('; ')}`);
  }
  
  // Team awareness - connect with other collaborators
  const teamContext = await getTeamContext(profile.canonicalOwner);
  if (teamContext) {
    contextParts.push(`Contesto team: ${teamContext}`);
  }
  
  // Time-based proactivity
  const timeInsight = getTimeBasedInsight();
  if (timeInsight) {
    contextParts.push(`Insight temporale: ${timeInsight}`);
  }
  
  return contextParts.length > 0 
    ? `Contesto Conversazionale: ${contextParts.join(' | ')}`
    : '';
}

async function getMemoryConnections(owner: string): Promise<string[]> {
  try {
    const snap = await db.collection('notes')
      .where('canonicalOwner', '==', owner)
      .orderBy('timestamp', 'desc')
      .limit(3)
      .get();
    
    return snap.docs.map(doc => {
      const data = doc.data();
      const daysAgo = Math.floor((Date.now() - data.timestamp) / (24 * 60 * 60 * 1000));
      return `${daysAgo}d fa: ${data.title?.substring(0, 30)}...`;
    });
  } catch {
    return [];
  }
}

async function getTeamContext(owner: string): Promise<string | null> {
  try {
    const snap = await db.collection('notes')
      .where('canonicalOwner', '!=', owner)
      .orderBy('timestamp', 'desc')
      .limit(2)
      .get();
    
    if (snap.empty) return null;
    
    const recentTeamActivity = snap.docs.map(doc => {
      const data = doc.data();
      return `${data.canonicalOwner}: ${data.title?.substring(0, 20)}`;
    });
    
    return `Team attivo: ${recentTeamActivity.join(', ')}`;
  } catch {
    return null;
  }
}

function getTimeBasedInsight(): string | null {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  
  if (hour === 9 && day >= 1 && day <= 5) {
    return "Inizio settimana lavorativa - potrebbe servire un recap weekend";
  }
  if (hour === 18 && day >= 1 && day <= 5) {
    return "Fine giornata - considera un wrap-up delle attività";
  }
  if (day === 1) {
    return "Lunedì - momento ideale per pianificare la settimana";
  }
  if (day === 5) {
    return "Venerdì - prepara il recap settimanale";
  }
  
  return null;
}

// Enhanced functions for integrated language learning system
async function buildEnhancedPersonalizedPersona(
  profile: any, 
  context: any, 
  conversationContext: any,
  languageProcessing: any,
  riri: boolean
): Promise<string> {
  if (riri) {
    return `Persona: {"tone":"delicato-assertivo-caldo","archetype":"ZAN_RIRI"}`;
  }
  
  const timeOfDay = new Date().getHours();
  const greeting = timeOfDay < 12 ? 'Buongiorno' : timeOfDay < 18 ? 'Buon pomeriggio' : 'Buonasera';
  
  // Enhanced with language learning data
  const languageSkills = conversationContext.learningProgress?.languageProficiency || {};
  const culturalContext = conversationContext.culturalMarkers.join(', ');
  const detectedFormality = conversationContext.culturalMarkers.includes('formal_context') ? 'formal' : 'informal';
  
  return `Personalizzazione Utente Avanzata: {
    "nome": "${profile.canonicalOwner}",
    "ruolo": "${profile.context.role}",
    "lingua_primaria": "${conversationContext.language}",
    "livello_linguistico": ${languageSkills[conversationContext.language] || 50},
    "fiducia_rilevamento": ${languageProcessing.confidence.toFixed(2)},
    "formalità_preferita": "${detectedFormality}",
    "contesto_culturale": "${culturalContext}",
    "sentiment_conversazione": "${conversationContext.sentiment}",
    "urgenza": "${conversationContext.urgency}",
    "argomenti_attivi": "${conversationContext.topics.slice(0, 3).join(', ')}",
    "livello_expertise": "${profile.preferences.expertise}",
    "tono_preferito": "${profile.preferences.tone}",
    "stile_comunicazione": "${profile.preferences.communication}",
    "lunghezza_risposta": "${profile.preferences.responseLength}",
    "saluto_personalizzato": "${greeting} ${profile.canonicalOwner}",
    "interazioni_totali": ${profile.learning.totalInteractions},
    "soddisfazione_media": ${profile.learning.feedbackScore.toFixed(1)},
    "livello_engagement": "${profile.learning.engagementLevel}",
    "adattamenti_suggeriti": ${JSON.stringify(languageProcessing.culturalNotes || [])}
  }`;
}

async function buildEnhancedContextualInfo(
  profile: any, 
  context: any, 
  recommendations: any[],
  conversationContext: any,
  languageProcessing: any
): Promise<string> {
  const contextParts = [];
  
  // Enhanced language context
  contextParts.push(`Contesto Linguistico: {
    "lingua_rilevata": "${conversationContext.language}",
    "confidenza": ${languageProcessing.confidence.toFixed(2)},
    "messaggi_precedenti": ${conversationContext.messages.length},
    "evoluzione_sentiment": "${conversationContext.sentiment}",
    "marcatori_culturali": "${conversationContext.culturalMarkers.join(', ')}"
  }`);
  
  // Business context enhancement
  if (conversationContext.businessContext) {
    contextParts.push(`Contesto Business: {
      "tipo_azienda": "${conversationContext.businessContext.companyType}",
      "settore": "${conversationContext.businessContext.industry}",
      "stato_compliance": "${conversationContext.businessContext.complianceStatus}",
      "documenti_attivi": "${conversationContext.businessContext.activeDocuments.join(', ')}",
      "scadenze_prossime": ${conversationContext.businessContext.deadlines.length}
    }`);
  }
  
  // Recent interaction context with language awareness
  if (context.recentInteractions.length > 0) {
    const recentTopics = context.activeTopics.slice(0, 3);
    contextParts.push(`Argomenti recenti dell'utente: ${recentTopics.join(', ')}`);
  }
  
  // Language-specific recommendations
  if (languageProcessing.suggestions && languageProcessing.suggestions.length > 0) {
    contextParts.push(`Suggerimenti linguistici: ${languageProcessing.suggestions.join('; ')}`);
  }
  
  // Cultural notes integration
  if (languageProcessing.culturalNotes && languageProcessing.culturalNotes.length > 0) {
    contextParts.push(`Note culturali: ${languageProcessing.culturalNotes.join('; ')}`);
  }
  
  // Work context
  if (context.workContext.currentProjects.length > 0) {
    contextParts.push(`Progetti attuali: ${context.workContext.currentProjects.join(', ')}`);
  }
  
  if (context.workContext.urgentTasks.length > 0) {
    contextParts.push(`Task urgenti: ${context.workContext.urgentTasks.length} in corso`);
  }
  
  // Proactive recommendations
  if (recommendations.length > 0) {
    const topRec = recommendations[0];
    contextParts.push(`Suggerimento proattivo: ${topRec.title} - ${topRec.description}`);
  }
  
  // Learning progress integration
  if (profile.learning.learningProgress > 50) {
    contextParts.push(`Progresso apprendimento: ${profile.learning.learningProgress}% - utente in crescita`);
  }
  
  // Memory connections with language context
  const memoryConnections = await getMemoryConnections(profile.canonicalOwner);
  if (memoryConnections.length > 0) {
    contextParts.push(`Ricordi rilevanti: ${memoryConnections.join('; ')}`);
  }
  
  // Team awareness
  const teamContext = await getTeamContext(profile.canonicalOwner);
  if (teamContext) {
    contextParts.push(`Contesto team: ${teamContext}`);
  }
  
  // Time-based proactivity with language adaptation
  const timeInsight = getTimeBasedInsightWithLanguage(conversationContext.language);
  if (timeInsight) {
    contextParts.push(`Insight temporale: ${timeInsight}`);
  }
  
  return contextParts.length > 0 
    ? `Contesto Conversazionale Avanzato: ${contextParts.join(' | ')}`
    : '';
}

function buildLanguageSpecificInstructions(
  language: string,
  culturalMarkers: string[],
  adaptedResponse: any
): string {
  const instructions = [];
  
  // Base language instruction
  const languageInstructions = {
    it: 'Rispondi sempre in italiano. Usa un tono rispettoso e professionale appropriato per il contesto business indonesiano.',
    id: 'Selalu jawab dalam bahasa Indonesia. Gunakan nada yang sopan dan profesional sesuai konteks bisnis.',
    en: 'Always respond in English. Use a respectful and professional tone appropriate for Indonesian business context.',
    es: 'Responde siempre en español. Usa un tono respetuoso y profesional apropiado para el contexto empresarial indonesio.',
    pt: 'Responda sempre em português. Use um tom respeitoso e profissional apropriado para o contexto empresarial indonésio.'
  };
  
  instructions.push(languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.en);
  
  // Cultural adaptation instructions
  if (culturalMarkers.includes('formal_context')) {
    const formalInstructions = {
      it: 'Mantieni un registro formale. Usa "Lei" e forme di cortesia appropriate.',
      id: 'Pertahankan register formal. Gunakan Bapak/Ibu dan bentuk kesopanan yang sesuai.',
      en: 'Maintain formal register. Use appropriate titles and courteous language.'
    };
    instructions.push(formalInstructions[language as keyof typeof formalInstructions] || formalInstructions.en);
  }
  
  if (culturalMarkers.includes('business_context')) {
    const businessInstructions = {
      it: 'Concentrati su aspetti di compliance e regolamentazione indonesiana. Fornisci informazioni pratiche e actionable.',
      id: 'Fokus pada aspek kepatuhan dan regulasi Indonesia. Berikan informasi praktis dan dapat ditindaklanjuti.',
      en: 'Focus on Indonesian compliance and regulatory aspects. Provide practical and actionable information.'
    };
    instructions.push(businessInstructions[language as keyof typeof businessInstructions] || businessInstructions.en);
  }
  
  // Learning opportunity instructions
  if (adaptedResponse?.learningOpportunity) {
    instructions.push(`Opportunità di apprendimento rilevata: ${adaptedResponse.learningOpportunity.explanation}`);
  }
  
  return `Istruzioni Linguistiche e Culturali:\n${instructions.join('\n')}`;
}

function getTimeBasedInsightWithLanguage(language: string): string | null {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  
  const insights = {
    it: {
      morning_weekday: "Inizio settimana lavorativa - potrebbe servire un recap weekend",
      evening_weekday: "Fine giornata - considera un wrap-up delle attività",
      monday: "Lunedì - momento ideale per pianificare la settimana",
      friday: "Venerdì - prepara il recap settimanale"
    },
    id: {
      morning_weekday: "Awal minggu kerja - mungkin perlu rekap akhir pekan",
      evening_weekday: "Akhir hari - pertimbangkan wrap-up aktivitas",
      monday: "Senin - waktu ideal untuk merencanakan minggu",
      friday: "Jumat - siapkan rekap mingguan"
    },
    en: {
      morning_weekday: "Start of work week - might need weekend recap",
      evening_weekday: "End of day - consider wrapping up activities",
      monday: "Monday - ideal time to plan the week",
      friday: "Friday - prepare weekly recap"
    }
  };
  
  const langInsights = insights[language as keyof typeof insights] || insights.en;
  
  if (hour === 9 && day >= 1 && day <= 5) {
    return langInsights.morning_weekday;
  }
  if (hour === 18 && day >= 1 && day <= 5) {
    return langInsights.evening_weekday;
  }
  if (day === 1) {
    return langInsights.monday;
  }
  if (day === 5) {
    return langInsights.friday;
  }
  
  return null;
}
