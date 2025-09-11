import { db } from './firestore';
import { getUserProfile, UserProfile } from './userProfiles';
import { getRecentUserContext, getTopicFrequency } from './contextualMemory';
import { analyzeInteractionPatterns, generateLearningInsights } from './learningEngine';

// ============================
// RECOMMENDATION TYPES
// ============================

export interface ProactiveRecommendation {
  id: string;
  canonicalOwner?: string;
  type: 'learning' | 'productivity' | 'workflow' | 'personal' | 'technical' | 'contextual';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  actionable?: boolean;
  suggestedAction?: string;
  estimatedValue: number; // 1-10 scale
  confidence: number; // 0-1
  context?: string[];
  createdAt: number;
  expiresAt?: number;
  isPersonalized?: boolean;
  triggers?: string[];
}

export interface WorkflowSuggestion {
  type: 'automation' | 'optimization' | 'integration' | 'learning';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  roi: number; // Return on investment score
}

export interface PersonalizedInsight {
  insight: string;
  reasoning: string;
  confidence: number;
  actionable: boolean;
  nextSteps?: string[];
}

// ============================
// RECOMMENDATION GENERATION
// ============================

export async function generateProactiveRecommendations(canonicalOwner: string): Promise<ProactiveRecommendation[]> {
  try {
    const profile = await getUserProfile(canonicalOwner);
    const context = await getRecentUserContext(canonicalOwner);
    const patterns = await analyzeInteractionPatterns(canonicalOwner);
    const topicFreq = await getTopicFrequency(canonicalOwner);
    
    const recommendations: ProactiveRecommendation[] = [];
    
    // Learning recommendations
    recommendations.push(...await generateLearningRecommendations(profile, patterns, topicFreq));
    
    // Productivity recommendations
    recommendations.push(...await generateProductivityRecommendations(profile, context, patterns));
    
    // Workflow recommendations
    recommendations.push(...await generateWorkflowRecommendations(profile, context));
    
    // Personal development recommendations
    recommendations.push(...await generatePersonalRecommendations(profile, patterns));
    
    // Technical recommendations (for technical users)
    if (isTechnicalUser(profile)) {
      recommendations.push(...await generateTechnicalRecommendations(profile, patterns));
    }
    
    // Contextual/temporal recommendations - make Zantara more "alive"
    recommendations.push(...await generateContextualRecommendations(canonicalOwner, profile, context));
    
    // Sort by priority and confidence
    return recommendations
      .sort((a, b) => {
        const priorityScore = { urgent: 4, high: 3, medium: 2, low: 1 };
        const aScore = priorityScore[a.priority] * a.confidence * a.estimatedValue;
        const bScore = priorityScore[b.priority] * b.confidence * b.estimatedValue;
        return bScore - aScore;
      })
      .slice(0, 10); // Top 10 recommendations
      
  } catch (error) {
    console.error('Error generating proactive recommendations:', error);
    return [];
  }
}

// ============================
// LEARNING RECOMMENDATIONS
// ============================

async function generateLearningRecommendations(
  profile: UserProfile,
  patterns: any[],
  topicFreq: any[]
): Promise<ProactiveRecommendation[]> {
  const recommendations: ProactiveRecommendation[] = [];
  
  // Most frequent topic deep dive
  if (topicFreq.length > 0) {
    const topTopic = topicFreq[0];
    if (topTopic.count > 5 && topTopic.avgSatisfaction > 3.5) {
      recommendations.push({
        id: `learn_${topTopic.topic}_${Date.now()}`,
        canonicalOwner: profile.canonicalOwner,
        type: 'learning',
        priority: 'medium',
        title: `Approfondisci ${topTopic.topic}`,
        description: `Hai mostrato interesse per ${topTopic.topic} in ${topTopic.count} conversazioni. Posso prepararti un percorso di apprendimento personalizzato.`,
        actionable: true,
        suggestedAction: `Chiedi: "Zantara, creami un piano di apprendimento per ${topTopic.topic}"`,
        estimatedValue: 8,
        confidence: Math.min(topTopic.count / 10, 0.9),
        context: [`${topTopic.count} interazioni`, `soddisfazione ${topTopic.avgSatisfaction}/5`],
        createdAt: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        isPersonalized: true
      });
    }
  }
  
  // Skill gap identification
  if (profile.preferences.expertise === 'beginner' && profile.learning.totalInteractions > 20) {
    recommendations.push({
      id: `skill_advancement_${Date.now()}`,
      canonicalOwner: profile.canonicalOwner,
      type: 'learning',
      priority: 'medium',
      title: 'Progressione Competenze',
      description: 'Hai mostrato buoni progressi! È il momento di passare a argomenti più avanzati nel tuo campo di interesse.',
      actionable: true,
      suggestedAction: 'Aggiorna le tue preferenze a livello "intermediate"',
      estimatedValue: 7,
      confidence: 0.8,
      context: [`${profile.learning.totalInteractions} interazioni`, 'livello beginner'],
      createdAt: Date.now(),
      isPersonalized: true
    });
  }
  
  return recommendations;
}

// ============================
// PRODUCTIVITY RECOMMENDATIONS
// ============================

async function generateProductivityRecommendations(
  profile: UserProfile,
  context: any,
  patterns: any[]
): Promise<ProactiveRecommendation[]> {
  const recommendations: ProactiveRecommendation[] = [];
  
  // Frequent question automation
  const frequentPatterns = patterns.filter(p => p.frequency > 3);
  if (frequentPatterns.length > 0) {
    const topPattern = frequentPatterns[0];
    recommendations.push({
      id: `automate_${topPattern.pattern}_${Date.now()}`,
      canonicalOwner: profile.canonicalOwner,
      type: 'productivity',
      priority: 'medium',
      title: 'Automatizza Domande Ricorrenti',
      description: `Fai spesso domande del tipo "${topPattern.pattern}". Posso creare delle risposte rapide personalizzate per te.`,
      actionable: true,
      suggestedAction: 'Configura template di risposta per domande frequenti',
      estimatedValue: 6,
      confidence: 0.7,
      context: [`${topPattern.frequency} occorrenze`],
      createdAt: Date.now(),
      isPersonalized: true
    });
  }
  
  // Time-based recommendations
  const currentHour = new Date().getHours();
  if (currentHour >= 9 && currentHour <= 17 && context.workContext.urgentTasks.length > 0) {
    recommendations.push({
      id: `urgent_focus_${Date.now()}`,
      canonicalOwner: profile.canonicalOwner,
      type: 'productivity',
      priority: 'high',
      title: 'Focus su Task Urgenti',
      description: `Hai ${context.workContext.urgentTasks.length} task urgenti in corso. Vuoi che ti aiuti a prioritizzarli?`,
      actionable: true,
      suggestedAction: 'Chiedi aiuto per la prioritizzazione dei task',
      estimatedValue: 9,
      confidence: 0.9,
      context: context.workContext.urgentTasks,
      createdAt: Date.now(),
      expiresAt: Date.now() + (4 * 60 * 60 * 1000), // 4 hours
      isPersonalized: true
    });
  }
  
  return recommendations;
}

// ============================
// WORKFLOW RECOMMENDATIONS
// ============================

async function generateWorkflowRecommendations(
  profile: UserProfile,
  context: any
): Promise<ProactiveRecommendation[]> {
  const recommendations: ProactiveRecommendation[] = [];
  
  // Daily brief automation
  if (profile.learning.totalInteractions > 10 && !hasRecentBrief(profile.canonicalOwner)) {
    recommendations.push({
      id: `daily_brief_${Date.now()}`,
      canonicalOwner: profile.canonicalOwner,
      type: 'workflow',
      priority: 'low',
      title: 'Brief Quotidiano Automatico',
      description: 'Posso generare automaticamente un brief delle tue attività quotidiane e salvarlo in Drive.',
      actionable: true,
      suggestedAction: 'Attiva la generazione automatica del brief quotidiano',
      estimatedValue: 5,
      confidence: 0.6,
      context: ['automazione workflow'],
      createdAt: Date.now(),
      isPersonalized: true
    });
  }
  
  // Integration suggestions based on role
  if (profile.context.role === 'Manager' || profile.context.role === 'CEO') {
    recommendations.push({
      id: `integration_calendar_${Date.now()}`,
      canonicalOwner: profile.canonicalOwner,
      type: 'workflow',
      priority: 'medium',
      title: 'Integrazione Calendario',
      description: 'Come manager, potresti beneficiare dell\'integrazione con Google Calendar per suggerimenti intelligenti sui meeting.',
      actionable: true,
      suggestedAction: 'Configura l\'integrazione calendario avanzata',
      estimatedValue: 7,
      confidence: 0.7,
      context: [`ruolo: ${profile.context.role}`],
      createdAt: Date.now(),
      isPersonalized: true
    });
  }
  
  return recommendations;
}

// ============================
// PERSONAL RECOMMENDATIONS
// ============================

async function generatePersonalRecommendations(
  profile: UserProfile,
  patterns: any[]
): Promise<ProactiveRecommendation[]> {
  const recommendations: ProactiveRecommendation[] = [];
  
  // Communication style optimization
  if (profile.learning.feedbackScore < 3.5 && profile.learning.totalInteractions > 15) {
    recommendations.push({
      id: `communication_style_${Date.now()}`,
      canonicalOwner: profile.canonicalOwner,
      type: 'personal',
      priority: 'medium',
      title: 'Ottimizza Stile Comunicazione',
      description: 'I tuoi feedback suggeriscono che potremmo migliorare il nostro stile di comunicazione. Vuoi personalizzare le mie risposte?',
      actionable: true,
      suggestedAction: 'Rivedi e aggiorna le preferenze di comunicazione',
      estimatedValue: 8,
      confidence: 0.8,
      context: [`feedback medio: ${profile.learning.feedbackScore.toFixed(1)}`],
      createdAt: Date.now(),
      isPersonalized: true
    });
  }
  
  // Expertise evolution
  const complexPatterns = patterns.filter(p => p.pattern.includes('complex') || p.pattern.includes('advanced'));
  if (complexPatterns.length > 3 && profile.preferences.expertise !== 'expert') {
    recommendations.push({
      id: `expertise_upgrade_${Date.now()}`,
      canonicalOwner: profile.canonicalOwner,
      type: 'personal',
      priority: 'low',
      title: 'Evoluzione Competenze',
      description: 'Le tue domande sono diventate più sofisticate. Considera di aggiornare il tuo livello di expertise per ricevere risposte più avanzate.',
      actionable: true,
      suggestedAction: 'Aggiorna il livello di expertise nelle preferenze',
      estimatedValue: 6,
      confidence: 0.7,
      context: [`${complexPatterns.length} query complesse`],
      createdAt: Date.now(),
      isPersonalized: true
    });
  }
  
  return recommendations;
}

// ============================
// TECHNICAL RECOMMENDATIONS
// ============================

async function generateTechnicalRecommendations(
  profile: UserProfile,
  patterns: any[]
): Promise<ProactiveRecommendation[]> {
  const recommendations: ProactiveRecommendation[] = [];
  
  // API usage optimization
  const technicalPatterns = patterns.filter(p => 
    p.pattern.includes('api') || 
    p.pattern.includes('technical') || 
    p.pattern.includes('development')
  );
  
  if (technicalPatterns.length > 2) {
    recommendations.push({
      id: `api_optimization_${Date.now()}`,
      canonicalOwner: profile.canonicalOwner,
      type: 'technical',
      priority: 'medium',
      title: 'Ottimizzazione API Usage',
      description: 'Noto che fai molte domande tecniche. Posso mostrarti come utilizzare le API di Zantara Bridge per automatizzare alcune operazioni.',
      actionable: true,
      suggestedAction: 'Esplora la documentazione API avanzata',
      estimatedValue: 8,
      confidence: 0.8,
      context: [`${technicalPatterns.length} query tecniche`],
      createdAt: Date.now(),
      isPersonalized: true
    });
  }
  
  return recommendations;
}

// ============================
// HELPER FUNCTIONS
// ============================

function isTechnicalUser(profile: UserProfile): boolean {
  const technicalRoles = ['Developer', 'CTO', 'DevOps', 'Architect'];
  const technicalDepartments = ['Engineering', 'IT', 'Technology'];
  
  return technicalRoles.includes(profile.context.role) || 
         technicalDepartments.includes(profile.context.department) ||
         profile.context.interests.some(interest => 
           ['coding', 'api', 'development', 'architecture'].includes(interest.toLowerCase())
         );
}

async function hasRecentBrief(canonicalOwner: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const briefDoc = await db.collection('fileIndex')
      .where('canonicalOwner', '==', canonicalOwner)
      .where('kind', '==', 'brief')
      .where('dateKey', '==', today)
      .limit(1)
      .get();
    
    return !briefDoc.empty;
  } catch {
    return false;
  }
}

// ============================
// RECOMMENDATION DELIVERY
// ============================

export async function getActiveRecommendations(canonicalOwner: string): Promise<ProactiveRecommendation[]> {
  try {
    const now = Date.now();
    const recommendations = await db.collection('userRecommendations')
      .where('canonicalOwner', '==', canonicalOwner)
      .where('expiresAt', '>', now)
      .orderBy('expiresAt')
      .orderBy('priority')
      .limit(5)
      .get();
    
    return recommendations.docs.map(doc => doc.data() as ProactiveRecommendation);
  } catch (error) {
    console.error('Error getting active recommendations:', error);
    return [];
  }
}

export async function saveRecommendations(recommendations: ProactiveRecommendation[]): Promise<void> {
  try {
    const batch = db.batch();
    
    recommendations.forEach(rec => {
      const docRef = db.collection('userRecommendations').doc(rec.id);
      batch.set(docRef, rec);
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error saving recommendations:', error);
  }
}

export async function markRecommendationActioned(recommendationId: string): Promise<void> {
  try {
    await db.collection('userRecommendations').doc(recommendationId).update({
      actionedAt: Date.now()
    });
  } catch (error) {
    console.error('Error marking recommendation as actioned:', error);
  }
}

async function generateContextualRecommendations(
  canonicalOwner: string, 
  profile: any, 
  context: any
): Promise<ProactiveRecommendation[]> {
  const recommendations: ProactiveRecommendation[] = [];
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  
  try {
    // Check for recent team activity
    const teamSnap = await db.collection('notes')
      .where('canonicalOwner', '!=', canonicalOwner)
      .where('timestamp', '>=', Date.now() - 24 * 60 * 60 * 1000)
      .get();
    
    if (!teamSnap.empty) {
      recommendations.push({
        id: `contextual-team-${canonicalOwner}-${Date.now()}`,
        type: 'contextual',
        title: 'Aggiornamento team disponibile',
        description: `Il team ha aggiornato ${teamSnap.size} note nelle ultime 24h. Vuoi un recap?`,
        priority: 'medium',
        confidence: 0.7,
        estimatedValue: 15,
        createdAt: Date.now(),
        triggers: ['team_activity']
      });
    }
    
    // Monday morning weekly planning
    if (dayOfWeek === 1 && hour >= 8 && hour <= 11) {
      recommendations.push({
        id: `contextual-weekly-${canonicalOwner}-${Date.now()}`,
        type: 'productivity',
        title: 'Pianificazione settimanale',
        description: 'È lunedì mattina - momento ideale per pianificare la settimana. Vuoi che generi un template?',
        priority: 'high',
        confidence: 0.8,
        estimatedValue: 25,
        createdAt: Date.now(),
        triggers: ['monday_morning']
      });
    }
    
    // Friday afternoon wrap-up
    if (dayOfWeek === 5 && hour >= 16 && hour <= 18) {
      recommendations.push({
        id: `contextual-weekly-wrap-${canonicalOwner}-${Date.now()}`,
        type: 'productivity',
        title: 'Recap settimanale',
        description: 'Fine settimana lavorativa - vuoi che generi un recap delle attività completate?',
        priority: 'medium',
        confidence: 0.7,
        estimatedValue: 20,
        createdAt: Date.now(),
        triggers: ['friday_afternoon']
      });
    }
    
    // Check for old unresolved items
    const oldNotesSnap = await db.collection('notes')
      .where('canonicalOwner', '==', canonicalOwner)
      .where('timestamp', '<=', Date.now() - 7 * 24 * 60 * 60 * 1000)
      .where('tags', 'array-contains-any', ['todo', 'action-item', 'follow-up'])
      .limit(3)
      .get();
    
    if (!oldNotesSnap.empty) {
      recommendations.push({
        id: `contextual-followup-${canonicalOwner}-${Date.now()}`,
        type: 'workflow',
        title: 'Follow-up necessari',
        description: `Hai ${oldNotesSnap.size} item di una settimana fa che potrebbero richiedere follow-up`,
        priority: 'medium',
        confidence: 0.6,
        estimatedValue: 18,
        createdAt: Date.now(),
        triggers: ['old_todos']
      });
    }
    
  } catch (error) {
    console.error('Error generating contextual recommendations:', error);
  }
  
  return recommendations;
}