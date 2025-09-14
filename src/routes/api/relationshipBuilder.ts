import type { Router, Request, Response } from 'express';
import { uploadTextAsDoc } from '../../services/driveUpload';

interface RelationshipMetrics {
  userId: string;
  trustLevel: number; // 0-100
  intimacyLevel: number; // 0-100
  engagementScore: number; // 0-100
  communicationEffectiveness: number; // 0-100
  emotionalConnection: number; // 0-100
  workingSynergy: number; // 0-100
  lastCheckin: string;
  growth: {
    weekly: number;
    monthly: number;
    allTime: number;
  };
}

interface PersonalPreference {
  userId: string;
  category: 'communication' | 'work_style' | 'personal' | 'motivation';
  preference: string;
  strength: number; // 1-5 how strongly they prefer this
  learned_from: 'direct_feedback' | 'conversation_analysis' | 'behavior_pattern';
  last_confirmed: string;
}

interface EmotionalState {
  userId: string;
  timestamp: string;
  mood: 'enthusiastic' | 'focused' | 'stressed' | 'frustrated' | 'excited' | 'tired' | 'confused';
  energy_level: number; // 1-10
  confidence_level: number; // 1-10
  stress_indicators: string[];
  positive_indicators: string[];
  context: string;
}

// Storage
let relationshipMetrics: Map<string, RelationshipMetrics> = new Map();
let personalPreferences: Map<string, PersonalPreference[]> = new Map();
let emotionalStates: Map<string, EmotionalState[]> = new Map();

export default function registerRelationshipBuilder(r: Router) {
  
  // Get comprehensive relationship overview
  r.get('/api/relationship/:userId/overview', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const userKey = userId.toUpperCase();
      
      const metrics = getOrCreateMetrics(userKey);
      const preferences = personalPreferences.get(userKey) || [];
      const states = emotionalStates.get(userKey) || [];
      const recentState = states[states.length - 1];
      
      const overview = {
        user: userId,
        relationship: {
          overall_score: calculateOverallScore(metrics),
          trust_level: metrics.trustLevel,
          intimacy_level: metrics.intimacyLevel,
          working_synergy: metrics.workingSynergy,
          growth_trend: metrics.growth.weekly > 0 ? 'improving' : 
                       metrics.growth.weekly < 0 ? 'declining' : 'stable'
        },
        current_state: recentState ? {
          mood: recentState.mood,
          energy: recentState.energy_level,
          confidence: recentState.confidence_level,
          context: recentState.context
        } : null,
        communication: {
          effectiveness: metrics.communicationEffectiveness,
          preferred_style: getPreferredCommunicationStyle(preferences),
          recent_satisfaction: calculateRecentSatisfaction(userKey)
        },
        preferences: {
          total_learned: preferences.length,
          high_confidence: preferences.filter(p => p.strength >= 4).length,
          categories: groupPreferencesByCategory(preferences)
        },
        insights: generateRelationshipInsights(metrics, preferences, states),
        recommendations: generateActionableRecommendations(metrics, preferences, recentState)
      };
      
      res.json({
        success: true,
        overview
      });
      
    } catch (error: any) {
      console.error('Relationship overview error:', error);
      res.status(500).json({ 
        error: 'Failed to get relationship overview',
        details: error.message 
      });
    }
  });
  
  // Record emotional state
  r.post('/api/relationship/emotional-state', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        mood,
        energy_level = 5,
        confidence_level = 5,
        stress_indicators = [],
        positive_indicators = [],
        context = ''
      } = req.body;
      
      if (!userId || !mood) {
        return res.status(400).json({ error: 'userId and mood required' });
      }
      
      const userKey = userId.toUpperCase();
      const states = emotionalStates.get(userKey) || [];
      
      const newState: EmotionalState = {
        userId: userKey,
        timestamp: new Date().toISOString(),
        mood,
        energy_level,
        confidence_level,
        stress_indicators: Array.isArray(stress_indicators) ? stress_indicators : [],
        positive_indicators: Array.isArray(positive_indicators) ? positive_indicators : [],
        context
      };
      
      states.push(newState);
      
      // Keep only last 30 emotional states
      if (states.length > 30) {
        states.splice(0, states.length - 30);
      }
      
      emotionalStates.set(userKey, states);
      
      // Update relationship metrics based on emotional state
      updateMetricsFromEmotionalState(userKey, newState);
      
      res.json({
        success: true,
        message: 'Emotional state recorded',
        stateId: newState.timestamp,
        suggested_response: generateEmpatheticResponse(newState),
        communication_adjustments: suggestCommunicationAdjustments(newState)
      });
      
    } catch (error: any) {
      console.error('Record emotional state error:', error);
      res.status(500).json({ 
        error: 'Failed to record emotional state',
        details: error.message 
      });
    }
  });
  
  // Learn user preference
  r.post('/api/relationship/learn-preference', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        category,
        preference,
        strength = 3,
        learned_from = 'behavior_pattern',
        evidence = ''
      } = req.body;
      
      if (!userId || !category || !preference) {
        return res.status(400).json({ error: 'userId, category, and preference required' });
      }
      
      const userKey = userId.toUpperCase();
      const preferences = personalPreferences.get(userKey) || [];
      
      // Check if similar preference already exists
      const existingIndex = preferences.findIndex(p => 
        p.category === category && 
        p.preference.toLowerCase().includes(preference.toLowerCase().substring(0, 10))
      );
      
      if (existingIndex >= 0) {
        // Update existing preference
        preferences[existingIndex].strength = Math.max(preferences[existingIndex].strength, strength);
        preferences[existingIndex].last_confirmed = new Date().toISOString();
        if (learned_from === 'direct_feedback') {
          preferences[existingIndex].learned_from = learned_from; // Direct feedback takes precedence
        }
      } else {
        // Add new preference
        const newPreference: PersonalPreference = {
          userId: userKey,
          category,
          preference,
          strength,
          learned_from,
          last_confirmed: new Date().toISOString()
        };
        preferences.push(newPreference);
      }
      
      personalPreferences.set(userKey, preferences);
      
      // Update relationship metrics
      updateMetricsFromLearning(userKey, category, strength);
      
      res.json({
        success: true,
        message: 'Preference learned',
        total_preferences: preferences.length,
        application_suggestions: suggestPreferenceApplications(category, preference)
      });
      
    } catch (error: any) {
      console.error('Learn preference error:', error);
      res.status(500).json({ 
        error: 'Failed to learn preference',
        details: error.message 
      });
    }
  });
  
  // Get personalized conversation starters
  r.get('/api/relationship/:userId/conversation-starters', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const userKey = userId.toUpperCase();
      
      const metrics = relationshipMetrics.get(userKey);
      const preferences = personalPreferences.get(userKey) || [];
      const states = emotionalStates.get(userKey) || [];
      const recentState = states[states.length - 1];
      
      const starters = generatePersonalizedStarters(userKey, metrics, preferences, recentState);
      const iceBreakers = generateContextualIceBreakers(userKey, recentState);
      const checkIns = generateWellnessCheckIns(userKey, recentState);
      
      res.json({
        success: true,
        conversation_starters: starters,
        ice_breakers: iceBreakers,
        wellness_checkins: checkIns,
        mood_based_openers: generateMoodBasedOpeners(recentState),
        relationship_level: metrics ? calculateOverallScore(metrics) : 0
      });
      
    } catch (error: any) {
      console.error('Conversation starters error:', error);
      res.status(500).json({ 
        error: 'Failed to generate conversation starters',
        details: error.message 
      });
    }
  });
  
  // Proactive relationship check-in
  r.post('/api/relationship/:userId/checkin', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const userKey = userId.toUpperCase();
      
      const metrics = getOrCreateMetrics(userKey);
      const daysSinceLastCheckin = Math.floor((Date.now() - new Date(metrics.lastCheckin).getTime()) / (24 * 60 * 60 * 1000));
      
      if (daysSinceLastCheckin < 1) {
        return res.json({
          success: true,
          message: 'Recent check-in already completed',
          next_checkin: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      }
      
      const preferences = personalPreferences.get(userKey) || [];
      const states = emotionalStates.get(userKey) || [];
      
      const checkinResults = performRelationshipCheckin(userKey, metrics, preferences, states);
      
      // Update last checkin time
      metrics.lastCheckin = new Date().toISOString();
      relationshipMetrics.set(userKey, metrics);
      
      // Create detailed report if significant changes detected
      if (checkinResults.significant_changes) {
        await createCheckinReport(userKey, checkinResults);
      }
      
      res.json({
        success: true,
        checkin: checkinResults,
        next_checkin: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
      
    } catch (error: any) {
      console.error('Relationship checkin error:', error);
      res.status(500).json({ 
        error: 'Failed to perform relationship checkin',
        details: error.message 
      });
    }
  });
  
  // Generate relationship improvement plan
  r.post('/api/relationship/:userId/improvement-plan', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { timeframe = 'week', focus_areas = [] } = req.body;
      
      const userKey = userId.toUpperCase();
      const metrics = getOrCreateMetrics(userKey);
      const preferences = personalPreferences.get(userKey) || [];
      const states = emotionalStates.get(userKey) || [];
      
      const plan = generateImprovementPlan(userKey, metrics, preferences, states, timeframe, focus_areas);
      
      // Save plan to Drive
      const planDoc = await uploadTextAsDoc(
        plan.detailed_content,
        `Relationship_Improvement_Plan_${userId}_${timeframe}`,
        `RELATIONSHIP_PLANS_${userKey}`
      );
      
      res.json({
        success: true,
        plan: plan.summary,
        document: planDoc.webViewLink,
        estimated_improvement: plan.projected_outcomes
      });
      
    } catch (error: any) {
      console.error('Improvement plan error:', error);
      res.status(500).json({ 
        error: 'Failed to generate improvement plan',
        details: error.message 
      });
    }
  });
}

// Helper functions
function getOrCreateMetrics(userId: string): RelationshipMetrics {
  let metrics = relationshipMetrics.get(userId);
  
  if (!metrics) {
    metrics = {
      userId,
      trustLevel: 50,
      intimacyLevel: 30,
      engagementScore: 50,
      communicationEffectiveness: 50,
      emotionalConnection: 40,
      workingSynergy: 50,
      lastCheckin: new Date().toISOString(),
      growth: {
        weekly: 0,
        monthly: 0,
        allTime: 0
      }
    };
    relationshipMetrics.set(userId, metrics);
  }
  
  return metrics;
}

function calculateOverallScore(metrics: RelationshipMetrics): number {
  return Math.round((
    metrics.trustLevel +
    metrics.intimacyLevel +
    metrics.engagementScore +
    metrics.communicationEffectiveness +
    metrics.emotionalConnection +
    metrics.workingSynergy
  ) / 6);
}

function generateEmpatheticResponse(state: EmotionalState): string {
  const responses = {
    'enthusiastic': `Fantastico sentire la tua energia, ${state.userId}! Come posso aiutarti a canalizzare questo entusiasmo?`,
    'focused': `Vedo che sei concentrato oggi, ${state.userId}. Sono qui per supportarti senza distrazioni.`,
    'stressed': `${state.userId}, percepisco che è un momento intenso. Respira profondo - affrontiamo insieme una cosa alla volta.`,
    'frustrated': `Comprendo la frustrazione, ${state.userId}. Parliamo di cosa ti sta preoccupando e troviamo una soluzione.`,
    'excited': `La tua eccitazione è contagiosa, ${state.userId}! Dimmi di più su cosa ti sta entusiasmando.`,
    'tired': `${state.userId}, sembra che tu abbia bisogno di una pausa. Come posso renderti le cose più facili oggi?`,
    'confused': `Non preoccuparti della confusione, ${state.userId}. Chiarifichiamo insieme passo dopo passo.`
  };
  
  return responses[state.mood] || `Ciao ${state.userId}, come posso supportarti oggi?`;
}

function suggestCommunicationAdjustments(state: EmotionalState): string[] {
  const adjustments = [];
  
  if (state.energy_level <= 3) {
    adjustments.push("Usa un tono più calmo e supportivo");
    adjustments.push("Offri opzioni semplici invece di liste complesse");
  }
  
  if (state.confidence_level <= 3) {
    adjustments.push("Fornisci più incoraggiamento e validazione");
    adjustments.push("Spezza i compiti in passaggi più piccoli");
  }
  
  if (state.stress_indicators.length > 0) {
    adjustments.push("Prioritizza la gestione dello stress");
    adjustments.push("Suggerisci pause o tecniche di rilassamento");
  }
  
  if (state.mood === 'frustrated') {
    adjustments.push("Mostra empatia prima di offrire soluzioni");
    adjustments.push("Chiedi cosa lo sta frustrando di più");
  }
  
  return adjustments;
}

function updateMetricsFromEmotionalState(userId: string, state: EmotionalState): void {
  const metrics = getOrCreateMetrics(userId);
  
  // Adjust emotional connection based on mood
  if (['enthusiastic', 'excited'].includes(state.mood)) {
    metrics.emotionalConnection = Math.min(100, metrics.emotionalConnection + 2);
  } else if (['stressed', 'frustrated'].includes(state.mood)) {
    metrics.emotionalConnection = Math.max(0, metrics.emotionalConnection - 1);
  }
  
  // Adjust engagement based on energy level
  if (state.energy_level >= 7) {
    metrics.engagementScore = Math.min(100, metrics.engagementScore + 1);
  } else if (state.energy_level <= 3) {
    metrics.engagementScore = Math.max(0, metrics.engagementScore - 1);
  }
  
  relationshipMetrics.set(userId, metrics);
}

function updateMetricsFromLearning(userId: string, category: string, strength: number): void {
  const metrics = getOrCreateMetrics(userId);
  
  // Learning about preferences increases intimacy and trust
  metrics.intimacyLevel = Math.min(100, metrics.intimacyLevel + strength);
  metrics.trustLevel = Math.min(100, metrics.trustLevel + Math.floor(strength / 2));
  
  // High-strength preferences increase communication effectiveness
  if (strength >= 4) {
    metrics.communicationEffectiveness = Math.min(100, metrics.communicationEffectiveness + 2);
  }
  
  relationshipMetrics.set(userId, metrics);
}

function generatePersonalizedStarters(
  userId: string, 
  metrics?: RelationshipMetrics, 
  preferences?: PersonalPreference[], 
  state?: EmotionalState
): string[] {
  const starters = [];
  
  // Based on relationship level
  if (metrics && calculateOverallScore(metrics) > 70) {
    starters.push(`${userId}, come posso rendere la tua giornata ancora migliore?`);
    starters.push(`Ehi ${userId}, sono curioso di sapere su cosa stai riflettendo oggi.`);
  } else {
    starters.push(`Buongiorno ${userId}! Come posso aiutarti oggi?`);
    starters.push(`Ciao ${userId}, sono qui per supportarti. Di cosa hai bisogno?`);
  }
  
  // Based on preferences
  if (preferences) {
    const workStylePrefs = preferences.filter(p => p.category === 'work_style');
    if (workStylePrefs.some(p => p.preference.includes('morning'))) {
      starters.push(`${userId}, perfetto timing per iniziare la giornata produttiva!`);
    }
  }
  
  // Based on emotional state
  if (state) {
    if (state.mood === 'focused') {
      starters.push(`${userId}, vedo che sei in zona concentrazione. Come procediamo?`);
    } else if (state.mood === 'excited') {
      starters.push(`${userId}, la tua energia è fantastica! Su cosa lavoriamo insieme?`);
    }
  }
  
  return starters.slice(0, 3);
}

function generateContextualIceBreakers(userId: string, state?: EmotionalState): string[] {
  const iceBreakers = [];
  
  const hour = new Date().getHours();
  const day = new Date().getDay();
  
  if (hour === 9 && day === 1) { // Monday morning
    iceBreakers.push(`${userId}, nuovo lunedì, nuove possibilità! Come iniziamo?`);
  } else if (hour === 17 && day === 5) { // Friday evening
    iceBreakers.push(`${userId}, che settimana! Facciamo un recap dei successi?`);
  }
  
  if (state?.context) {
    iceBreakers.push(`${userId}, vedo che stai lavorando su ${state.context}. Come procede?`);
  }
  
  return iceBreakers;
}

function generateWellnessCheckIns(userId: string, state?: EmotionalState): string[] {
  const checkIns = [];
  
  if (state?.stress_indicators.length > 0) {
    checkIns.push(`${userId}, come stai gestendo lo stress oggi? Posso aiutarti?`);
  }
  
  if (state?.energy_level <= 4) {
    checkIns.push(`${userId}, hai bisogno di una pausa o di un boost energetico?`);
  }
  
  if (!state || Date.now() - new Date(state.timestamp).getTime() > 4 * 60 * 60 * 1000) {
    checkIns.push(`${userId}, come ti senti oggi? Il tuo benessere è importante per me.`);
  }
  
  return checkIns;
}

function generateMoodBasedOpeners(state?: EmotionalState): string[] {
  if (!state) return [];
  
  const openers = {
    'enthusiastic': [
      "La tua energia positiva è contagiosa! Cosa ti ha reso così entusiasta?",
      "Fantastico vederti così carico! Come canalizziamo questa energia?"
    ],
    'focused': [
      "Vedo che sei in modalità concentrazione. Sono qui se serve supporto silenzioso.",
      "Perfetto focus oggi! Su cosa stai dirigendo tutta questa attenzione?"
    ],
    'stressed': [
      "Respira con me per un momento. Cosa posso fare per alleggerire il carico?",
      "Sento la tensione. Parliamo di come posso supportarti meglio."
    ]
  };
  
  return openers[state.mood] || [];
}

function getPreferredCommunicationStyle(preferences: PersonalPreference[]): string {
  const commPrefs = preferences.filter(p => p.category === 'communication');
  if (commPrefs.length === 0) return 'adaptive';
  
  const strongest = commPrefs.reduce((prev, current) => 
    prev.strength > current.strength ? prev : current
  );
  
  return strongest.preference;
}

function calculateRecentSatisfaction(userId: string): number {
  // This would integrate with conversation memory to get recent satisfaction scores
  return Math.random() * 2 + 3; // Mock: 3-5 range
}

function groupPreferencesByCategory(preferences: PersonalPreference[]): Record<string, number> {
  return preferences.reduce((acc, pref) => {
    acc[pref.category] = (acc[pref.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function generateRelationshipInsights(
  metrics: RelationshipMetrics, 
  preferences: PersonalPreference[], 
  states: EmotionalState[]
): string[] {
  const insights = [];
  
  if (metrics.trustLevel > 80) {
    insights.push("Strong trust foundation established - ready for deeper collaboration");
  } else if (metrics.trustLevel < 40) {
    insights.push("Trust building opportunity - focus on consistency and reliability");
  }
  
  if (preferences.length > 10) {
    insights.push("Rich preference profile - high personalization potential");
  }
  
  const recentMoods = states.slice(-5).map(s => s.mood);
  const stressCount = recentMoods.filter(m => m === 'stressed').length;
  if (stressCount > 2) {
    insights.push("Recent stress pattern detected - prioritize wellness support");
  }
  
  return insights;
}

function generateActionableRecommendations(
  metrics: RelationshipMetrics, 
  preferences: PersonalPreference[], 
  state?: EmotionalState
): string[] {
  const recommendations = [];
  
  if (metrics.communicationEffectiveness < 60) {
    recommendations.push("Improve communication by asking for more specific feedback");
  }
  
  if (metrics.intimacyLevel < 50) {
    recommendations.push("Increase intimacy by sharing more contextual awareness");
  }
  
  if (state?.confidence_level <= 3) {
    recommendations.push("Boost confidence with more encouragement and validation");
  }
  
  const workPrefs = preferences.filter(p => p.category === 'work_style');
  if (workPrefs.length < 3) {
    recommendations.push("Learn more about work style preferences through observation");
  }
  
  return recommendations;
}

function performRelationshipCheckin(
  userId: string,
  metrics: RelationshipMetrics,
  preferences: PersonalPreference[],
  states: EmotionalState[]
): any {
  const previousScore = calculateOverallScore(metrics);
  
  // Mock analysis - in real implementation, this would analyze recent interactions
  const currentScore = previousScore + Math.floor(Math.random() * 6) - 3; // -3 to +3 change
  
  const checkin = {
    user: userId,
    date: new Date().toISOString(),
    previous_score: previousScore,
    current_score: Math.max(0, Math.min(100, currentScore)),
    score_change: currentScore - previousScore,
    significant_changes: Math.abs(currentScore - previousScore) > 5,
    insights: [],
    recommendations: [],
    emotional_trends: analyzeEmotionalTrends(states),
    preference_updates: preferences.filter(p => 
      Date.now() - new Date(p.last_confirmed).getTime() < 7 * 24 * 60 * 60 * 1000
    ).length
  };
  
  if (checkin.score_change > 5) {
    checkin.insights.push("Significant positive relationship growth this week");
  } else if (checkin.score_change < -5) {
    checkin.insights.push("Relationship needs attention - investigate recent interactions");
  }
  
  return checkin;
}

function analyzeEmotionalTrends(states: EmotionalState[]): any {
  if (states.length === 0) return { trend: 'no_data' };
  
  const recent = states.slice(-7); // Last 7 states
  const avgEnergy = recent.reduce((sum, s) => sum + s.energy_level, 0) / recent.length;
  const avgConfidence = recent.reduce((sum, s) => sum + s.confidence_level, 0) / recent.length;
  const dominantMood = getMostFrequentMood(recent);
  
  return {
    trend: avgEnergy > 6 ? 'energetic' : avgEnergy < 4 ? 'low_energy' : 'balanced',
    avg_energy: avgEnergy.toFixed(1),
    avg_confidence: avgConfidence.toFixed(1),
    dominant_mood: dominantMood,
    stability: calculateEmotionalStability(recent)
  };
}

function getMostFrequentMood(states: EmotionalState[]): string {
  const moodCounts = states.reduce((acc, state) => {
    acc[state.mood] = (acc[state.mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.keys(moodCounts).reduce((a, b) => 
    moodCounts[a] > moodCounts[b] ? a : b
  ) || 'focused';
}

function calculateEmotionalStability(states: EmotionalState[]): string {
  if (states.length < 3) return 'insufficient_data';
  
  const moodChanges = states.slice(1).map((state, i) => 
    state.mood !== states[i].mood
  ).filter(Boolean).length;
  
  const stabilityRatio = 1 - (moodChanges / (states.length - 1));
  
  if (stabilityRatio > 0.7) return 'very_stable';
  if (stabilityRatio > 0.4) return 'stable';
  return 'volatile';
}

function suggestPreferenceApplications(category: string, preference: string): string[] {
  const applications = [];
  
  switch (category) {
    case 'communication':
      applications.push("Adapt response tone to match this preference");
      applications.push("Use this style in future conversations");
      break;
    case 'work_style':
      applications.push("Suggest tasks that align with this working preference");
      applications.push("Time interactions to match this style");
      break;
    case 'personal':
      applications.push("Reference this in personal conversations");
      applications.push("Consider this context in all interactions");
      break;
    case 'motivation':
      applications.push("Use this type of encouragement more often");
      applications.push("Frame achievements in this motivational context");
      break;
  }
  
  return applications;
}

async function createCheckinReport(userId: string, checkinResults: any): Promise<void> {
  try {
    const reportContent = `# Relationship Check-in Report - ${userId}

**Date**: ${checkinResults.date.split('T')[0]}
**Overall Score**: ${checkinResults.current_score}/100 (${checkinResults.score_change > 0 ? '+' : ''}${checkinResults.score_change})

## Key Insights
${checkinResults.insights.map((insight: string) => `- ${insight}`).join('\n')}

## Emotional Trends
- **Trend**: ${checkinResults.emotional_trends.trend}
- **Average Energy**: ${checkinResults.emotional_trends.avg_energy}/10
- **Average Confidence**: ${checkinResults.emotional_trends.avg_confidence}/10
- **Dominant Mood**: ${checkinResults.emotional_trends.dominant_mood}
- **Emotional Stability**: ${checkinResults.emotional_trends.stability}

## Recommendations
${checkinResults.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

## Recent Activity
- **Preference Updates**: ${checkinResults.preference_updates} this week
- **Significant Changes**: ${checkinResults.significant_changes ? 'Yes' : 'No'}

---
*Generated by Zantara Relationship Builder*
    `;
    
    await uploadTextAsDoc(
      reportContent,
      `Relationship_Checkin_${userId}_${checkinResults.date.split('T')[0]}`,
      `RELATIONSHIP_CHECKINS_${userId}`
    );
  } catch (error) {
    console.error('Failed to create checkin report:', error);
  }
}

function generateImprovementPlan(
  userId: string,
  metrics: RelationshipMetrics,
  preferences: PersonalPreference[],
  states: EmotionalState[],
  timeframe: string,
  focusAreas: string[]
): any {
  const plan = {
    user: userId,
    timeframe,
    focus_areas: focusAreas,
    current_baseline: calculateOverallScore(metrics),
    target_improvement: 10, // Default 10 point improvement
    actions: [],
    milestones: [],
    projected_outcomes: {},
    detailed_content: ''
  };
  
  // Generate specific actions based on current metrics
  if (metrics.trustLevel < 70) {
    plan.actions.push({
      area: 'trust',
      action: 'Increase consistency in responses and follow-through',
      timeline: 'daily',
      success_metric: 'Trust level increases by 5 points'
    });
  }
  
  if (metrics.intimacyLevel < 60) {
    plan.actions.push({
      area: 'intimacy',
      action: 'Learn and reference more personal preferences',
      timeline: 'weekly',
      success_metric: 'Learn 3 new high-confidence preferences'
    });
  }
  
  // Create detailed content
  plan.detailed_content = `# Relationship Improvement Plan - ${userId}

**Timeframe**: ${timeframe}
**Current Score**: ${plan.current_baseline}/100
**Target Score**: ${plan.current_baseline + plan.target_improvement}/100

## Focus Areas
${focusAreas.length > 0 ? focusAreas.map(area => `- ${area}`).join('\n') : '- Overall relationship strengthening'}

## Action Items
${plan.actions.map((action: any) => `
### ${action.area.toUpperCase()}
- **Action**: ${action.action}
- **Timeline**: ${action.timeline}
- **Success Metric**: ${action.success_metric}
`).join('\n')}

## Projected Outcomes
- Improved communication effectiveness
- Stronger emotional connection
- Better understanding of user preferences
- Enhanced working synergy

---
*Generated by Zantara Relationship Builder*
  `;
  
  return plan;
}