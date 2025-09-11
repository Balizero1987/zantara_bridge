import { db } from './firestore';
import { getUserProfile } from './userProfiles';
import { getRecentUserContext } from './contextualMemory';
import { generateAdaptiveResponse } from './learningEngine';
import { getActiveRecommendations } from './recommendationEngine';

export async function buildMessages(owner:string,message:string,riri:boolean){
  const man=await db.collection('memory.global').doc('manifesto').get();
  const preset=await db.collection('memory.byOwner').doc('RIRI').collection('entries').doc('seed-preset').get();
  const manifesto=(man.exists? man.data()?.content : '')||'';
  const ririPreset=(preset.exists? preset.data()?.content : '')||'';
  
  // Get user personalization data
  const profile = await getUserProfile(owner);
  const context = await getRecentUserContext(owner, 24);
  const recommendations = await getActiveRecommendations(owner);
  
  // Build personalized persona
  const persona = await buildPersonalizedPersona(profile, context, riri);
  
  // Build contextual awareness
  const contextualInfo = await buildContextualInfo(profile, context, recommendations);
  
  const system=[
    'You are ZANTARA, the operational brain of Bali Zero.',
    'Honor Indonesian cultural values. Defend the Constitution. Be precise, useful, kind.',
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
