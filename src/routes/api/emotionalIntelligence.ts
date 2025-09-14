import type { Router, Request, Response } from 'express';
import { uploadTextAsDoc } from '../../services/driveUpload';

interface EmotionalProfile {
  userId: string;
  emotionalPatterns: EmotionalPattern[];
  stressFactors: StressFactor[];
  motivationDrivers: MotivationDriver[];
  communicationNeeds: CommunicationNeed[];
  wellnessGoals: WellnessGoal[];
  energyCycles: EnergyCycle[];
  lastUpdated: string;
}

interface EmotionalPattern {
  pattern: 'stress_escalation' | 'energy_cycles' | 'mood_triggers' | 'recovery_patterns';
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'situational';
  triggers: string[];
  indicators: string[];
  helpful_responses: string[];
  effectiveness_rating: number; // 1-5
}

interface StressFactor {
  factor: string;
  intensity: number; // 1-10
  frequency: 'rare' | 'occasional' | 'frequent' | 'constant';
  category: 'workload' | 'interpersonal' | 'technical' | 'time_pressure' | 'uncertainty';
  coping_strategies: string[];
  early_warning_signs: string[];
}

interface MotivationDriver {
  driver: string;
  strength: number; // 1-10
  category: 'achievement' | 'autonomy' | 'mastery' | 'purpose' | 'recognition' | 'security';
  activation_methods: string[];
  blockers: string[];
}

interface CommunicationNeed {
  need: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  context: 'stressed' | 'excited' | 'focused' | 'confused' | 'all';
  preferred_approach: string;
  avoid: string[];
}

interface WellnessGoal {
  goal: string;
  category: 'stress_management' | 'energy_optimization' | 'emotional_balance' | 'productivity';
  target_date: string;
  progress: number; // 0-100%
  support_actions: string[];
  success_metrics: string[];
}

interface EnergyCycle {
  period: 'daily' | 'weekly' | 'monthly';
  pattern: string;
  peak_hours: number[];
  low_hours: number[];
  optimal_activities: { [energy_level: string]: string[] };
  recovery_needs: string[];
}

interface WellnessCheckIn {
  userId: string;
  timestamp: string;
  stress_level: number; // 1-10
  energy_level: number; // 1-10
  mood: string;
  physical_state: string;
  mental_clarity: number; // 1-10
  motivation_level: number; // 1-10
  current_challenges: string[];
  current_wins: string[];
  support_needed: string[];
}

// Storage
let emotionalProfiles: Map<string, EmotionalProfile> = new Map();
let wellnessCheckins: Map<string, WellnessCheckIn[]> = new Map();

export default function registerEmotionalIntelligence(r: Router) {
  
  // Get user's emotional intelligence profile
  r.get('/api/emotional-intelligence/:userId/profile', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const userKey = userId.toUpperCase();
      
      let profile = emotionalProfiles.get(userKey);
      const checkins = wellnessCheckins.get(userKey) || [];
      
      if (!profile) {
        profile = createInitialEmotionalProfile(userKey);
        emotionalProfiles.set(userKey, profile);
      }
      
      // Analyze recent checkins for insights
      const recentCheckins = checkins.slice(-10);
      const insights = analyzeEmotionalInsights(profile, recentCheckins);
      
      res.json({
        success: true,
        profile: profile,
        recent_insights: insights,
        wellness_score: calculateWellnessScore(recentCheckins),
        recommendations: generateWellnessRecommendations(profile, recentCheckins)
      });
      
    } catch (error: any) {
      console.error('Emotional profile error:', error);
      res.status(500).json({ 
        error: 'Failed to get emotional profile',
        details: error.message 
      });
    }
  });
  
  // Record wellness check-in
  r.post('/api/emotional-intelligence/checkin', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        stress_level,
        energy_level,
        mood,
        physical_state = 'okay',
        mental_clarity = 5,
        motivation_level = 5,
        current_challenges = [],
        current_wins = [],
        support_needed = []
      } = req.body;
      
      if (!userId || stress_level === undefined || energy_level === undefined || !mood) {
        return res.status(400).json({ 
          error: 'userId, stress_level, energy_level, and mood required' 
        });
      }
      
      const userKey = userId.toUpperCase();
      const checkins = wellnessCheckins.get(userKey) || [];
      
      const newCheckin: WellnessCheckIn = {
        userId: userKey,
        timestamp: new Date().toISOString(),
        stress_level,
        energy_level,
        mood,
        physical_state,
        mental_clarity,
        motivation_level,
        current_challenges: Array.isArray(current_challenges) ? current_challenges : [],
        current_wins: Array.isArray(current_wins) ? current_wins : [],
        support_needed: Array.isArray(support_needed) ? support_needed : []
      };
      
      checkins.push(newCheckin);
      
      // Keep only last 50 checkins
      if (checkins.length > 50) {
        checkins.splice(0, checkins.length - 50);
      }
      
      wellnessCheckins.set(userKey, checkins);
      
      // Update emotional patterns based on checkin
      updateEmotionalPatterns(userKey, newCheckin);
      
      // Generate immediate support response
      const immediateSupport = generateImmediateSupport(newCheckin);
      
      res.json({
        success: true,
        message: 'Wellness check-in recorded',
        checkin_id: newCheckin.timestamp,
        immediate_support: immediateSupport,
        wellness_trend: analyzeWellnessTrend(checkins),
        follow_up_suggestions: generateFollowUpSuggestions(newCheckin)
      });
      
    } catch (error: any) {
      console.error('Wellness checkin error:', error);
      res.status(500).json({ 
        error: 'Failed to record wellness checkin',
        details: error.message 
      });
    }
  });
  
  // Get personalized emotional support
  r.post('/api/emotional-intelligence/support', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        situation,
        emotion = 'neutral',
        intensity = 5,
        context = '',
        immediate_need = false
      } = req.body;
      
      if (!userId || !situation) {
        return res.status(400).json({ error: 'userId and situation required' });
      }
      
      const userKey = userId.toUpperCase();
      const profile = emotionalProfiles.get(userKey);
      const checkins = wellnessCheckins.get(userKey) || [];
      
      const support = generatePersonalizedSupport(
        userKey, 
        situation, 
        emotion, 
        intensity, 
        context, 
        immediate_need, 
        profile, 
        checkins
      );
      
      // Log support request for learning
      logSupportRequest(userKey, situation, emotion, intensity, support);
      
      res.json({
        success: true,
        support: support,
        emergency_resources: immediate_need ? getEmergencyResources() : null
      });
      
    } catch (error: any) {
      console.error('Emotional support error:', error);
      res.status(500).json({ 
        error: 'Failed to provide emotional support',
        details: error.message 
      });
    }
  });
  
  // Analyze stress patterns
  r.get('/api/emotional-intelligence/:userId/stress-analysis', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { timeframe = 'month' } = req.query;
      
      const userKey = userId.toUpperCase();
      const profile = emotionalProfiles.get(userKey);
      const checkins = wellnessCheckins.get(userKey) || [];
      
      const analysis = analyzeStressPatterns(userKey, checkins, timeframe as string, profile);
      
      // Create detailed stress report
      const report = await createStressAnalysisReport(userKey, analysis);
      
      res.json({
        success: true,
        analysis: analysis,
        report_document: report ? report.webViewLink : null
      });
      
    } catch (error: any) {
      console.error('Stress analysis error:', error);
      res.status(500).json({ 
        error: 'Failed to analyze stress patterns',
        details: error.message 
      });
    }
  });
  
  // Get energy optimization recommendations
  r.get('/api/emotional-intelligence/:userId/energy-optimization', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const userKey = userId.toUpperCase();
      
      const profile = emotionalProfiles.get(userKey);
      const checkins = wellnessCheckins.get(userKey) || [];
      
      const optimization = generateEnergyOptimization(userKey, profile, checkins);
      
      res.json({
        success: true,
        optimization: optimization,
        current_energy_score: calculateCurrentEnergyScore(checkins),
        implementation_plan: generateEnergyImplementationPlan(optimization)
      });
      
    } catch (error: any) {
      console.error('Energy optimization error:', error);
      res.status(500).json({ 
        error: 'Failed to generate energy optimization',
        details: error.message 
      });
    }
  });
  
  // Set wellness goals
  r.post('/api/emotional-intelligence/:userId/wellness-goals', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const {
        goals = [],
        target_timeframe = 'month'
      } = req.body;
      
      if (!Array.isArray(goals) || goals.length === 0) {
        return res.status(400).json({ error: 'Goals array required' });
      }
      
      const userKey = userId.toUpperCase();
      const profile = getOrCreateProfile(userKey);
      
      // Convert goals to wellness goal objects
      const wellnessGoals: WellnessGoal[] = goals.map(goal => ({
        goal: goal.goal || goal,
        category: goal.category || 'emotional_balance',
        target_date: new Date(Date.now() + getTimeframeMs(target_timeframe)).toISOString(),
        progress: 0,
        support_actions: goal.support_actions || [],
        success_metrics: goal.success_metrics || []
      }));
      
      profile.wellnessGoals = wellnessGoals;
      profile.lastUpdated = new Date().toISOString();
      emotionalProfiles.set(userKey, profile);
      
      // Create goals tracking document
      const goalsDoc = await createWellnessGoalsDocument(userKey, wellnessGoals);
      
      res.json({
        success: true,
        message: 'Wellness goals set',
        goals: wellnessGoals,
        tracking_document: goalsDoc ? goalsDoc.webViewLink : null,
        support_plan: generateGoalsSupportPlan(wellnessGoals)
      });
      
    } catch (error: any) {
      console.error('Set wellness goals error:', error);
      res.status(500).json({ 
        error: 'Failed to set wellness goals',
        details: error.message 
      });
    }
  });
  
  // Proactive wellness check
  r.post('/api/emotional-intelligence/:userId/proactive-check', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const userKey = userId.toUpperCase();
      
      const profile = emotionalProfiles.get(userKey);
      const checkins = wellnessCheckins.get(userKey) || [];
      
      const proactiveCheck = performProactiveWellnessCheck(userKey, profile, checkins);
      
      res.json({
        success: true,
        proactive_check: proactiveCheck,
        intervention_needed: proactiveCheck.alert_level === 'high',
        suggested_actions: proactiveCheck.suggested_actions
      });
      
    } catch (error: any) {
      console.error('Proactive wellness check error:', error);
      res.status(500).json({ 
        error: 'Failed to perform proactive wellness check',
        details: error.message 
      });
    }
  });
}

// Helper functions
function createInitialEmotionalProfile(userId: string): EmotionalProfile {
  return {
    userId,
    emotionalPatterns: [],
    stressFactors: [],
    motivationDrivers: [
      {
        driver: 'Achievement',
        strength: 5,
        category: 'achievement',
        activation_methods: ['Clear goals', 'Progress tracking'],
        blockers: ['Unclear expectations']
      }
    ],
    communicationNeeds: [
      {
        need: 'Clear communication',
        priority: 'medium',
        context: 'all',
        preferred_approach: 'Direct and supportive',
        avoid: ['Ambiguity', 'Pressure']
      }
    ],
    wellnessGoals: [],
    energyCycles: [],
    lastUpdated: new Date().toISOString()
  };
}

function getOrCreateProfile(userId: string): EmotionalProfile {
  let profile = emotionalProfiles.get(userId);
  if (!profile) {
    profile = createInitialEmotionalProfile(userId);
    emotionalProfiles.set(userId, profile);
  }
  return profile;
}

function analyzeEmotionalInsights(profile: EmotionalProfile, checkins: WellnessCheckIn[]): any {
  if (checkins.length === 0) {
    return { message: 'No recent data for insights' };
  }
  
  const avgStress = checkins.reduce((sum, c) => sum + c.stress_level, 0) / checkins.length;
  const avgEnergy = checkins.reduce((sum, c) => sum + c.energy_level, 0) / checkins.length;
  const avgMotivation = checkins.reduce((sum, c) => sum + c.motivation_level, 0) / checkins.length;
  
  const moodFrequency = checkins.reduce((acc, c) => {
    acc[c.mood] = (acc[c.mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const dominantMood = Object.keys(moodFrequency).reduce((a, b) => 
    moodFrequency[a] > moodFrequency[b] ? a : b
  );
  
  return {
    average_stress: avgStress.toFixed(1),
    average_energy: avgEnergy.toFixed(1),
    average_motivation: avgMotivation.toFixed(1),
    dominant_mood: dominantMood,
    stress_trend: calculateTrend(checkins.map(c => c.stress_level)),
    energy_trend: calculateTrend(checkins.map(c => c.energy_level)),
    patterns_detected: detectEmotionalPatterns(checkins),
    insights: generateInsightMessages(avgStress, avgEnergy, dominantMood)
  };
}

function calculateWellnessScore(checkins: WellnessCheckIn[]): number {
  if (checkins.length === 0) return 50;
  
  const recent = checkins.slice(-5);
  const stressScore = (10 - (recent.reduce((sum, c) => sum + c.stress_level, 0) / recent.length)) * 10;
  const energyScore = (recent.reduce((sum, c) => sum + c.energy_level, 0) / recent.length) * 10;
  const clarityScore = (recent.reduce((sum, c) => sum + c.mental_clarity, 0) / recent.length) * 10;
  const motivationScore = (recent.reduce((sum, c) => sum + c.motivation_level, 0) / recent.length) * 10;
  
  return Math.round((stressScore + energyScore + clarityScore + motivationScore) / 4);
}

function generateWellnessRecommendations(profile: EmotionalProfile, checkins: WellnessCheckIn[]): string[] {
  const recommendations = [];
  
  if (checkins.length > 0) {
    const avgStress = checkins.reduce((sum, c) => sum + c.stress_level, 0) / checkins.length;
    
    if (avgStress > 7) {
      recommendations.push("Consider stress management techniques like deep breathing or meditation");
      recommendations.push("Break large tasks into smaller, manageable steps");
    }
    
    const avgEnergy = checkins.reduce((sum, c) => sum + c.energy_level, 0) / checkins.length;
    
    if (avgEnergy < 4) {
      recommendations.push("Focus on energy restoration: adequate sleep, nutrition, and breaks");
      recommendations.push("Schedule demanding tasks during your peak energy hours");
    }
  }
  
  if (profile.wellnessGoals.length === 0) {
    recommendations.push("Set specific wellness goals to track your emotional growth");
  }
  
  return recommendations;
}

function updateEmotionalPatterns(userId: string, checkin: WellnessCheckIn): void {
  const profile = getOrCreateProfile(userId);
  
  // Detect stress escalation pattern
  const recentCheckins = (wellnessCheckins.get(userId) || []).slice(-5);
  if (recentCheckins.length >= 3) {
    const stressLevels = recentCheckins.map(c => c.stress_level);
    if (isEscalatingPattern(stressLevels)) {
      addOrUpdatePattern(profile, {
        pattern: 'stress_escalation',
        description: 'Gradual increase in stress levels over time',
        frequency: 'situational',
        triggers: checkin.current_challenges,
        indicators: ['Rising stress scores', 'Decreased energy'],
        helpful_responses: ['Early intervention', 'Stress management techniques'],
        effectiveness_rating: 3
      });
    }
  }
  
  // Detect mood triggers
  if (checkin.current_challenges.length > 0) {
    const existingTriggerPattern = profile.emotionalPatterns.find(p => p.pattern === 'mood_triggers');
    if (existingTriggerPattern) {
      // Update triggers list with new ones
      checkin.current_challenges.forEach(challenge => {
        if (!existingTriggerPattern.triggers.includes(challenge)) {
          existingTriggerPattern.triggers.push(challenge);
        }
      });
    } else {
      addOrUpdatePattern(profile, {
        pattern: 'mood_triggers',
        description: 'Situations that negatively impact mood',
        frequency: 'situational',
        triggers: checkin.current_challenges,
        indicators: ['Mood changes', 'Stress increase'],
        helpful_responses: ['Address root causes', 'Provide emotional support'],
        effectiveness_rating: 4
      });
    }
  }
  
  profile.lastUpdated = new Date().toISOString();
  emotionalProfiles.set(userId, profile);
}

function addOrUpdatePattern(profile: EmotionalProfile, newPattern: EmotionalPattern): void {
  const existingIndex = profile.emotionalPatterns.findIndex(p => p.pattern === newPattern.pattern);
  
  if (existingIndex >= 0) {
    profile.emotionalPatterns[existingIndex] = newPattern;
  } else {
    profile.emotionalPatterns.push(newPattern);
  }
}

function generateImmediateSupport(checkin: WellnessCheckIn): any {
  const support: any = {
    message: '',
    actions: [],
    urgency: 'normal'
  };
  
  if (checkin.stress_level >= 8) {
    support.message = `${checkin.userId}, il tuo livello di stress è molto alto. Prendiamoci un momento per respirare insieme.`;
    support.actions = [
      'Fai 5 respiri profondi',
      'Identifica una cosa che puoi controllare ora',
      'Considera di fare una pausa di 10 minuti'
    ];
    support.urgency = 'high';
  } else if (checkin.energy_level <= 2) {
    support.message = `${checkin.userId}, vedo che l'energia è molto bassa oggi. Come posso aiutarti a ricaricarti?`;
    support.actions = [
      'Prendi una bevanda idratante',
      'Fai una pausa di 15 minuti',
      'Riorganizza le priorità per oggi'
    ];
    support.urgency = 'medium';
  } else if (checkin.mood === 'frustrated' || checkin.mood === 'overwhelmed') {
    support.message = `${checkin.userId}, capisco la frustrazione. Affrontiamo questo insieme, un passo alla volta.`;
    support.actions = [
      'Identifica la fonte principale di frustrazione',
      'Spezza il problema in parti più piccole',
      'Concentrati su una sola cosa per volta'
    ];
  } else {
    support.message = `${checkin.userId}, grazie per aver condiviso il tuo stato. Sono qui per supportarti.`;
    support.actions = [
      'Continua con le tue attività pianificate',
      'Ricorda di fare pause regolari',
      'Celebra i piccoli progressi'
    ];
  }
  
  return support;
}

function analyzeWellnessTrend(checkins: WellnessCheckIn[]): any {
  if (checkins.length < 3) {
    return { trend: 'insufficient_data' };
  }
  
  const recent = checkins.slice(-5);
  const stressTrend = calculateTrend(recent.map(c => c.stress_level));
  const energyTrend = calculateTrend(recent.map(c => c.energy_level));
  
  return {
    overall_trend: determineOverallTrend(stressTrend, energyTrend),
    stress_trend: stressTrend,
    energy_trend: energyTrend,
    stability: calculateWellnessStability(recent)
  };
}

function calculateTrend(values: number[]): string {
  if (values.length < 2) return 'stable';
  
  const first = values[0];
  const last = values[values.length - 1];
  const diff = last - first;
  
  if (Math.abs(diff) < 1) return 'stable';
  return diff > 0 ? 'improving' : 'declining';
}

function determineOverallTrend(stressTrend: string, energyTrend: string): string {
  if (stressTrend === 'declining' && energyTrend === 'improving') return 'very_positive';
  if (stressTrend === 'improving' && energyTrend === 'declining') return 'very_negative';
  if (stressTrend === 'declining' || energyTrend === 'improving') return 'positive';
  if (stressTrend === 'improving' || energyTrend === 'declining') return 'negative';
  return 'stable';
}

function calculateWellnessStability(checkins: WellnessCheckIn[]): string {
  const stressVariance = calculateVariance(checkins.map(c => c.stress_level));
  const energyVariance = calculateVariance(checkins.map(c => c.energy_level));
  
  const avgVariance = (stressVariance + energyVariance) / 2;
  
  if (avgVariance < 1) return 'very_stable';
  if (avgVariance < 2) return 'stable';
  if (avgVariance < 3) return 'somewhat_volatile';
  return 'highly_volatile';
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
}

function generateFollowUpSuggestions(checkin: WellnessCheckIn): string[] {
  const suggestions = [];
  
  if (checkin.current_wins.length > 0) {
    suggestions.push('Celebra i tuoi successi di oggi - meriti riconoscimento!');
  }
  
  if (checkin.current_challenges.length > 2) {
    suggestions.push('Prioritizza le sfide: quale puoi affrontare per prima?');
  }
  
  if (checkin.support_needed.length > 0) {
    suggestions.push('Non esitare a chiedere aiuto specifico per quello di cui hai bisogno');
  }
  
  if (checkin.stress_level > 6 && checkin.energy_level < 5) {
    suggestions.push('Considera tecniche di rilassamento per equilibrare stress ed energia');
  }
  
  return suggestions;
}

function generatePersonalizedSupport(
  userId: string,
  situation: string,
  emotion: string,
  intensity: number,
  context: string,
  immediate: boolean,
  profile?: EmotionalProfile,
  checkins?: WellnessCheckIn[]
): any {
  const support: any = {
    emotional_validation: generateEmotionalValidation(emotion, intensity),
    practical_actions: [],
    coping_strategies: [],
    escalation_plan: null,
    follow_up_timing: immediate ? '1 hour' : '24 hours'
  };
  
  // Generate emotion-specific support
  switch (emotion.toLowerCase()) {
    case 'anxious':
    case 'worried':
      support.practical_actions = [
        'Identifica cosa è sotto il tuo controllo',
        'Fai una lista delle preoccupazioni specifiche',
        'Pratica la respirazione 4-7-8'
      ];
      support.coping_strategies = [
        'Grounding techniques (5-4-3-2-1)',
        'Mindfulness per 5 minuti',
        'Parla con qualcuno di fiducia'
      ];
      break;
      
    case 'frustrated':
    case 'angry':
      support.practical_actions = [
        'Prendi una pausa prima di reagire',
        'Identifica la causa specifica della frustrazione',
        'Considera soluzioni alternative'
      ];
      support.coping_strategies = [
        'Attività fisica leggera',
        'Giornaling per sfogare',
        'Tecniche di rilassamento muscolare'
      ];
      break;
      
    case 'overwhelmed':
      support.practical_actions = [
        'Fai una lista di tutto quello che hai in mente',
        'Prioritizza usando la matrice urgente/importante',
        'Delega o elimina task non essenziali'
      ];
      support.coping_strategies = [
        'Break down large tasks',
        'Time-blocking per gestire il carico',
        'Chiedi supporto specifico'
      ];
      break;
      
    case 'sad':
    case 'disappointed':
      support.practical_actions = [
        'Permetti a te stesso di sentire l\'emozione',
        'Identifica cosa puoi imparare dalla situazione',
        'Connettiti con qualcuno che ti comprende'
      ];
      support.coping_strategies = [
        'Attività che ti danno gioia',
        'Gratitude practice',
        'Gentle self-care'
      ];
      break;
  }
  
  // Add high-intensity escalation plan
  if (intensity >= 8) {
    support.escalation_plan = {
      immediate_actions: [
        'Contatta immediatamente un supporto umano',
        'Usa tecniche di emergenza per il controllo emotivo',
        'Considera di prenderti il resto della giornata'
      ],
      professional_resources: immediate ? getEmergencyResources() : null
    };
  }
  
  return support;
}

function generateEmotionalValidation(emotion: string, intensity: number): string {
  const intensityWord = intensity >= 8 ? 'molto intenso' : 
                       intensity >= 6 ? 'significativo' : 
                       intensity >= 4 ? 'moderato' : 'leggero';
  
  return `È completamente normale sentirsi ${emotion} in questo momento. ` +
         `Riconosco che quello che stai provando è ${intensityWord} e valido. ` +
         `Sono qui per supportarti attraverso questo.`;
}

function logSupportRequest(userId: string, situation: string, emotion: string, intensity: number, support: any): void {
  // In a real implementation, this would log to analytics for learning
  console.log(`Support provided to ${userId}: ${emotion} (${intensity}/10) in situation: ${situation}`);
}

function getEmergencyResources(): any {
  return {
    crisis_hotlines: [
      {
        name: 'Crisis Support',
        number: 'Emergency services contact',
        availability: '24/7'
      }
    ],
    immediate_techniques: [
      'Deep breathing: 4 counts in, 7 counts hold, 8 counts out',
      'Ground yourself: Name 5 things you can see, 4 you can touch, 3 you can hear',
      'Safe space: Go to a calm, comfortable environment'
    ]
  };
}

function detectEmotionalPatterns(checkins: WellnessCheckIn[]): string[] {
  const patterns = [];
  
  if (checkins.length < 5) return patterns;
  
  // Check for weekly patterns
  const weekdayStress = checkins.filter(c => new Date(c.timestamp).getDay() >= 1 && new Date(c.timestamp).getDay() <= 5);
  const weekendStress = checkins.filter(c => new Date(c.timestamp).getDay() === 0 || new Date(c.timestamp).getDay() === 6);
  
  if (weekdayStress.length > 0 && weekendStress.length > 0) {
    const avgWeekdayStress = weekdayStress.reduce((sum, c) => sum + c.stress_level, 0) / weekdayStress.length;
    const avgWeekendStress = weekendStress.reduce((sum, c) => sum + c.stress_level, 0) / weekendStress.length;
    
    if (avgWeekdayStress - avgWeekendStress > 2) {
      patterns.push('Higher stress during weekdays - work-related stress pattern');
    }
  }
  
  // Check for energy patterns
  const morningCheckins = checkins.filter(c => new Date(c.timestamp).getHours() < 12);
  const afternoonCheckins = checkins.filter(c => new Date(c.timestamp).getHours() >= 12);
  
  if (morningCheckins.length > 0 && afternoonCheckins.length > 0) {
    const avgMorningEnergy = morningCheckins.reduce((sum, c) => sum + c.energy_level, 0) / morningCheckins.length;
    const avgAfternoonEnergy = afternoonCheckins.reduce((sum, c) => sum + c.energy_level, 0) / afternoonCheckins.length;
    
    if (avgMorningEnergy - avgAfternoonEnergy > 2) {
      patterns.push('Energy decline throughout the day - consider energy management');
    }
  }
  
  return patterns;
}

function generateInsightMessages(avgStress: number, avgEnergy: number, dominantMood: string): string[] {
  const insights = [];
  
  if (avgStress > 6) {
    insights.push('Il tuo livello di stress è sopra la media - considera strategie di gestione dello stress');
  }
  
  if (avgEnergy < 4) {
    insights.push('La tua energia sembra essere bassa - focalizzati su riposo e recupero');
  }
  
  if (dominantMood === 'stressed' || dominantMood === 'overwhelmed') {
    insights.push('Pattern di umore difficile rilevato - potrebbe essere utile supporto aggiuntivo');
  }
  
  if (avgStress < 4 && avgEnergy > 6) {
    insights.push('Ottimo equilibrio emotivo! Continua con le strategie che stai usando');
  }
  
  return insights;
}

function isEscalatingPattern(values: number[]): boolean {
  let increases = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i-1]) increases++;
  }
  return increases >= values.length * 0.6; // 60% of comparisons show increase
}

function analyzeStressPatterns(userId: string, checkins: WellnessCheckIn[], timeframe: string, profile?: EmotionalProfile): any {
  // Implementation for comprehensive stress pattern analysis
  const analysis = {
    timeframe,
    stress_statistics: calculateStressStatistics(checkins),
    trigger_analysis: analyzeStressTriggers(checkins),
    temporal_patterns: analyzeTemporalStressPatterns(checkins),
    recommendations: generateStressRecommendations(checkins, profile)
  };
  
  return analysis;
}

function calculateStressStatistics(checkins: WellnessCheckIn[]): any {
  if (checkins.length === 0) return { message: 'No data available' };
  
  const stressLevels = checkins.map(c => c.stress_level);
  const avg = stressLevels.reduce((sum, val) => sum + val, 0) / stressLevels.length;
  const max = Math.max(...stressLevels);
  const min = Math.min(...stressLevels);
  
  return {
    average: avg.toFixed(1),
    maximum: max,
    minimum: min,
    variance: calculateVariance(stressLevels).toFixed(2),
    high_stress_days: stressLevels.filter(level => level >= 7).length,
    low_stress_days: stressLevels.filter(level => level <= 3).length
  };
}

function analyzeStressTriggers(checkins: WellnessCheckIn[]): any {
  const triggers = {};
  
  checkins.forEach(checkin => {
    if (checkin.stress_level >= 6) {
      checkin.current_challenges.forEach(challenge => {
        triggers[challenge] = (triggers[challenge] || 0) + 1;
      });
    }
  });
  
  return Object.entries(triggers)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([trigger, count]) => ({ trigger, frequency: count }));
}

function analyzeTemporalStressPatterns(checkins: WellnessCheckIn[]): any {
  const hourlyStress = {};
  const dailyStress = {};
  
  checkins.forEach(checkin => {
    const date = new Date(checkin.timestamp);
    const hour = date.getHours();
    const day = date.getDay();
    
    hourlyStress[hour] = hourlyStress[hour] || [];
    hourlyStress[hour].push(checkin.stress_level);
    
    dailyStress[day] = dailyStress[day] || [];
    dailyStress[day].push(checkin.stress_level);
  });
  
  // Calculate averages
  const hourlyAvg = Object.entries(hourlyStress).map(([hour, levels]) => ({
    hour: parseInt(hour),
    avgStress: (levels as number[]).reduce((sum, val) => sum + val, 0) / (levels as number[]).length
  }));
  
  const dailyAvg = Object.entries(dailyStress).map(([day, levels]) => ({
    day: parseInt(day),
    avgStress: (levels as number[]).reduce((sum, val) => sum + val, 0) / (levels as number[]).length
  }));
  
  return {
    peak_stress_hours: hourlyAvg.sort((a, b) => b.avgStress - a.avgStress).slice(0, 3),
    peak_stress_days: dailyAvg.sort((a, b) => b.avgStress - a.avgStress).slice(0, 3),
    patterns: identifyStressPatterns(hourlyAvg, dailyAvg)
  };
}

function identifyStressPatterns(hourlyAvg: any[], dailyAvg: any[]): string[] {
  const patterns = [];
  
  // Check for work hours stress
  const workHoursStress = hourlyAvg.filter(h => h.hour >= 9 && h.hour <= 17);
  const afterHoursStress = hourlyAvg.filter(h => h.hour < 9 || h.hour > 17);
  
  if (workHoursStress.length > 0 && afterHoursStress.length > 0) {
    const workAvg = workHoursStress.reduce((sum, h) => sum + h.avgStress, 0) / workHoursStress.length;
    const afterAvg = afterHoursStress.reduce((sum, h) => sum + h.avgStress, 0) / afterHoursStress.length;
    
    if (workAvg - afterAvg > 1.5) {
      patterns.push('Significantly higher stress during work hours');
    }
  }
  
  return patterns;
}

function generateStressRecommendations(checkins: WellnessCheckIn[], profile?: EmotionalProfile): string[] {
  const recommendations = [];
  
  const avgStress = checkins.reduce((sum, c) => sum + c.stress_level, 0) / checkins.length;
  
  if (avgStress > 6) {
    recommendations.push('Implement daily stress management techniques');
    recommendations.push('Consider professional stress management coaching');
  }
  
  if (avgStress > 4) {
    recommendations.push('Practice regular mindfulness or meditation');
    recommendations.push('Ensure adequate sleep and nutrition');
  }
  
  return recommendations;
}

async function createStressAnalysisReport(userId: string, analysis: any): Promise<any> {
  try {
    const content = `# Stress Analysis Report - ${userId}

**Analysis Date**: ${new Date().toISOString().split('T')[0]}
**Timeframe**: ${analysis.timeframe}

## Stress Statistics
- **Average Stress Level**: ${analysis.stress_statistics.average}/10
- **Maximum**: ${analysis.stress_statistics.maximum}/10
- **Minimum**: ${analysis.stress_statistics.minimum}/10
- **High Stress Days**: ${analysis.stress_statistics.high_stress_days}
- **Low Stress Days**: ${analysis.stress_statistics.low_stress_days}

## Top Stress Triggers
${analysis.trigger_analysis.map((trigger: any) => 
  `- **${trigger.trigger}**: ${trigger.frequency} occurrences`
).join('\n')}

## Temporal Patterns
### Peak Stress Hours
${analysis.temporal_patterns.peak_stress_hours.map((hour: any) => 
  `- ${hour.hour}:00 - Average stress: ${hour.avgStress.toFixed(1)}/10`
).join('\n')}

### Peak Stress Days
${analysis.temporal_patterns.peak_stress_days.map((day: any) => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `- ${dayNames[day.day]} - Average stress: ${day.avgStress.toFixed(1)}/10`;
}).join('\n')}

## Recommendations
${analysis.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

---
*Generated by Zantara Emotional Intelligence System*
    `;
    
    return await uploadTextAsDoc(
      content,
      `Stress_Analysis_${userId}_${analysis.timeframe}`,
      `WELLNESS_REPORTS_${userId}`
    );
  } catch (error) {
    console.error('Failed to create stress analysis report:', error);
    return null;
  }
}

function generateEnergyOptimization(userId: string, profile?: EmotionalProfile, checkins?: WellnessCheckIn[]): any {
  const optimization = {
    current_patterns: analyzeEnergyPatterns(checkins || []),
    optimization_strategies: [],
    personalized_schedule: generateOptimalSchedule(checkins || []),
    energy_boosters: getPersonalizedEnergyBoosters(profile),
    recovery_plan: generateRecoveryPlan(checkins || [])
  };
  
  return optimization;
}

function analyzeEnergyPatterns(checkins: WellnessCheckIn[]): any {
  if (checkins.length === 0) return { message: 'No data available' };
  
  const hourlyEnergy = {};
  
  checkins.forEach(checkin => {
    const hour = new Date(checkin.timestamp).getHours();
    hourlyEnergy[hour] = hourlyEnergy[hour] || [];
    hourlyEnergy[hour].push(checkin.energy_level);
  });
  
  const hourlyAvg = Object.entries(hourlyEnergy).map(([hour, levels]) => ({
    hour: parseInt(hour),
    avgEnergy: (levels as number[]).reduce((sum, val) => sum + val, 0) / (levels as number[]).length
  }));
  
  const peakHours = hourlyAvg.sort((a, b) => b.avgEnergy - a.avgEnergy).slice(0, 3);
  const lowHours = hourlyAvg.sort((a, b) => a.avgEnergy - b.avgEnergy).slice(0, 3);
  
  return {
    peak_energy_hours: peakHours,
    low_energy_hours: lowHours,
    average_daily_energy: checkins.reduce((sum, c) => sum + c.energy_level, 0) / checkins.length
  };
}

function generateOptimalSchedule(checkins: WellnessCheckIn[]): any {
  const patterns = analyzeEnergyPatterns(checkins);
  
  return {
    high_energy_tasks: {
      recommended_hours: patterns.peak_energy_hours?.map((h: any) => `${h.hour}:00`) || ['9:00', '10:00'],
      task_types: ['Creative work', 'Problem solving', 'Important meetings']
    },
    low_energy_tasks: {
      recommended_hours: patterns.low_energy_hours?.map((h: any) => `${h.hour}:00`) || ['14:00', '15:00'],
      task_types: ['Administrative tasks', 'Email processing', 'Documentation']
    },
    recovery_periods: {
      recommended_times: ['12:00-13:00', '15:30-15:45'],
      activities: ['Short walk', 'Meditation', 'Healthy snack']
    }
  };
}

function getPersonalizedEnergyBoosters(profile?: EmotionalProfile): string[] {
  return [
    'Take a 5-10 minute walk outside',
    'Practice deep breathing exercises',
    'Listen to energizing music',
    'Have a healthy snack with protein',
    'Do light stretching or movement',
    'Connect with a colleague or friend',
    'Review recent accomplishments',
    'Change your physical environment'
  ];
}

function generateRecoveryPlan(checkins: WellnessCheckIn[]): any {
  const avgEnergy = checkins.length > 0 ? 
    checkins.reduce((sum, c) => sum + c.energy_level, 0) / checkins.length : 5;
  
  if (avgEnergy < 4) {
    return {
      priority: 'high',
      focus: 'Energy restoration',
      daily_actions: [
        'Ensure 7-8 hours of quality sleep',
        'Take 2-3 short breaks every hour',
        'Practice energy-restoring activities',
        'Limit energy-draining tasks'
      ],
      weekly_actions: [
        'Schedule one full rest day',
        'Plan energizing activities you enjoy',
        'Review and adjust workload if possible'
      ]
    };
  }
  
  return {
    priority: 'maintenance',
    focus: 'Energy optimization',
    daily_actions: [
      'Maintain consistent sleep schedule',
      'Balance high and low energy tasks',
      'Take proactive energy breaks'
    ],
    weekly_actions: [
      'Plan one energy-boosting activity',
      'Review energy patterns and adjust'
    ]
  };
}

function calculateCurrentEnergyScore(checkins: WellnessCheckIn[]): number {
  if (checkins.length === 0) return 50;
  
  const recent = checkins.slice(-3);
  const avgEnergy = recent.reduce((sum, c) => sum + c.energy_level, 0) / recent.length;
  
  return Math.round(avgEnergy * 10);
}

function generateEnergyImplementationPlan(optimization: any): any {
  return {
    week_1: {
      focus: 'Establish optimal timing',
      actions: [
        'Track energy levels at different times',
        'Schedule demanding tasks during peak hours',
        'Implement recovery breaks during low energy periods'
      ]
    },
    week_2: {
      focus: 'Optimize energy boosters',
      actions: [
        'Try different energy-boosting activities',
        'Identify what works best for you',
        'Create personalized energy toolkit'
      ]
    },
    week_3: {
      focus: 'Establish sustainable routine',
      actions: [
        'Create consistent daily energy management routine',
        'Adjust schedule based on patterns observed',
        'Plan for energy recovery'
      ]
    },
    ongoing: {
      focus: 'Continuous optimization',
      actions: [
        'Regular energy pattern reviews',
        'Adjust strategies based on life changes',
        'Maintain energy management practices'
      ]
    }
  };
}

function getTimeframeMs(timeframe: string): number {
  switch (timeframe) {
    case 'week': return 7 * 24 * 60 * 60 * 1000;
    case 'month': return 30 * 24 * 60 * 60 * 1000;
    case 'quarter': return 90 * 24 * 60 * 60 * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}

async function createWellnessGoalsDocument(userId: string, goals: WellnessGoal[]): Promise<any> {
  try {
    const content = `# Wellness Goals - ${userId}

**Created**: ${new Date().toISOString().split('T')[0]}

## Goals Overview
${goals.map((goal, index) => `
### Goal ${index + 1}: ${goal.goal}
- **Category**: ${goal.category}
- **Target Date**: ${goal.target_date.split('T')[0]}
- **Progress**: ${goal.progress}%

**Support Actions**:
${goal.support_actions.map(action => `- ${action}`).join('\n')}

**Success Metrics**:
${goal.success_metrics.map(metric => `- ${metric}`).join('\n')}
`).join('\n')}

---
*Track your progress and celebrate your wellness journey!*
    `;
    
    return await uploadTextAsDoc(
      content,
      `Wellness_Goals_${userId}_${new Date().toISOString().split('T')[0]}`,
      `WELLNESS_GOALS_${userId}`
    );
  } catch (error) {
    console.error('Failed to create wellness goals document:', error);
    return null;
  }
}

function generateGoalsSupportPlan(goals: WellnessGoal[]): any {
  return {
    daily_actions: extractDailyActions(goals),
    weekly_reviews: 'Check progress on all goals and adjust as needed',
    monthly_assessments: 'Comprehensive review and goal adjustments',
    success_celebrations: 'Acknowledge and celebrate progress milestones'
  };
}

function extractDailyActions(goals: WellnessGoal[]): string[] {
  const dailyActions = [];
  
  goals.forEach(goal => {
    goal.support_actions.forEach(action => {
      if (action.toLowerCase().includes('daily') || action.toLowerCase().includes('every day')) {
        dailyActions.push(action);
      }
    });
  });
  
  return dailyActions.length > 0 ? dailyActions : [
    'Check in with your emotional state',
    'Practice one stress management technique',
    'Take energy breaks as needed'
  ];
}

function performProactiveWellnessCheck(userId: string, profile?: EmotionalProfile, checkins?: WellnessCheckIn[]): any {
  const check = {
    user: userId,
    timestamp: new Date().toISOString(),
    alert_level: 'normal',
    concerns: [],
    suggested_actions: [],
    intervention_needed: false,
    next_check: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
  
  if (!checkins || checkins.length === 0) {
    check.concerns.push('No recent wellness data available');
    check.suggested_actions.push('Complete a wellness check-in to establish baseline');
    return check;
  }
  
  const recent = checkins.slice(-5);
  const avgStress = recent.reduce((sum, c) => sum + c.stress_level, 0) / recent.length;
  const avgEnergy = recent.reduce((sum, c) => sum + c.energy_level, 0) / recent.length;
  
  // Check for concerning patterns
  if (avgStress > 7) {
    check.alert_level = 'high';
    check.concerns.push('Sustained high stress levels detected');
    check.suggested_actions.push('Implement immediate stress management techniques');
    check.intervention_needed = true;
  }
  
  if (avgEnergy < 3) {
    check.alert_level = check.alert_level === 'high' ? 'high' : 'medium';
    check.concerns.push('Low energy levels may indicate burnout risk');
    check.suggested_actions.push('Focus on energy restoration and recovery');
  }
  
  // Check for declining trends
  const stressTrend = calculateTrend(recent.map(c => c.stress_level));
  const energyTrend = calculateTrend(recent.map(c => c.energy_level));
  
  if (stressTrend === 'improving' && energyTrend === 'declining') {
    check.alert_level = 'medium';
    check.concerns.push('Declining energy despite improving stress - review workload balance');
    check.suggested_actions.push('Adjust activity levels and ensure adequate recovery');
  }
  
  if (check.concerns.length === 0) {
    check.suggested_actions.push('Continue current wellness practices');
    check.suggested_actions.push('Consider setting new wellness goals for continued growth');
  }
  
  return check;
}