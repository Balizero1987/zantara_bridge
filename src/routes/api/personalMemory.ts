import type { Router, Request, Response } from 'express';
import { uploadTextAsDoc, createDriveFolder } from '../../services/driveUpload';

interface PersonalMemory {
  userId: string;
  memories: ConversationMemory[];
  personalNotes: PersonalNote[];
  achievements: Achievement[];
  preferences: LearningPreferences;
  relationshipScore: number;
  lastInteraction: string;
}

interface ConversationMemory {
  id: string;
  timestamp: string;
  topic: string;
  mood: 'happy' | 'frustrated' | 'excited' | 'stressed' | 'focused';
  context: string;
  outcome: 'resolved' | 'ongoing' | 'needs_followup';
  satisfaction: number; // 1-5
  keypoints: string[];
}

interface PersonalNote {
  id: string;
  category: 'preference' | 'personal_info' | 'work_style' | 'goal' | 'challenge';
  note: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  dateAdded: string;
  lastReferenced: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
  category: 'project' | 'learning' | 'milestone' | 'recognition';
  celebrationLevel: 'mention' | 'congratulate' | 'celebrate';
}

interface LearningPreferences {
  communicationStyle: 'direct' | 'encouraging' | 'analytical' | 'creative';
  preferredResponseTime: 'immediate' | 'thoughtful' | 'comprehensive';
  learningStyle: 'visual' | 'practical' | 'theoretical' | 'collaborative';
  motivationType: 'achievement' | 'growth' | 'recognition' | 'autonomy';
}

// In-memory storage (in production, use database)
let personalMemories: Map<string, PersonalMemory> = new Map();

export default function registerPersonalMemory(r: Router) {
  
  // Get user's personal memory profile
  r.get('/api/memory/personal/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      
      let memory = personalMemories.get(userId.toUpperCase());
      
      if (!memory) {
        // Initialize new personal memory
        memory = {
          userId: userId.toUpperCase(),
          memories: [],
          personalNotes: [],
          achievements: [],
          preferences: {
            communicationStyle: 'direct',
            preferredResponseTime: 'thoughtful',
            learningStyle: 'practical',
            motivationType: 'growth'
          },
          relationshipScore: 0,
          lastInteraction: new Date().toISOString()
        };
        personalMemories.set(userId.toUpperCase(), memory);
      }
      
      res.json({
        success: true,
        memory: memory,
        insights: generatePersonalInsights(memory)
      });
      
    } catch (error: any) {
      console.error('Personal memory error:', error);
      res.status(500).json({ 
        error: 'Failed to get personal memory',
        details: error.message 
      });
    }
  });
  
  // Add conversation memory
  r.post('/api/memory/conversation', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        topic,
        mood = 'focused',
        context,
        outcome = 'resolved',
        satisfaction = 3,
        keypoints = []
      } = req.body;
      
      if (!userId || !topic) {
        return res.status(400).json({ error: 'userId and topic required' });
      }
      
      const memory = getOrCreateMemory(userId.toUpperCase());
      
      const conversationMemory: ConversationMemory = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        topic,
        mood,
        context,
        outcome,
        satisfaction,
        keypoints: Array.isArray(keypoints) ? keypoints : []
      };
      
      memory.memories.push(conversationMemory);
      memory.lastInteraction = new Date().toISOString();
      memory.relationshipScore += calculateRelationshipDelta(satisfaction, mood);
      
      // Keep only last 50 conversation memories
      if (memory.memories.length > 50) {
        memory.memories = memory.memories.slice(-50);
      }
      
      personalMemories.set(userId.toUpperCase(), memory);
      
      res.json({
        success: true,
        message: 'Conversation memory added',
        memoryId: conversationMemory.id,
        relationshipScore: memory.relationshipScore
      });
      
    } catch (error: any) {
      console.error('Add conversation memory error:', error);
      res.status(500).json({ 
        error: 'Failed to add conversation memory',
        details: error.message 
      });
    }
  });
  
  // Add personal note
  r.post('/api/memory/note', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        category = 'preference',
        note,
        importance = 'medium'
      } = req.body;
      
      if (!userId || !note) {
        return res.status(400).json({ error: 'userId and note required' });
      }
      
      const memory = getOrCreateMemory(userId.toUpperCase());
      
      const personalNote: PersonalNote = {
        id: generateId(),
        category,
        note,
        importance,
        dateAdded: new Date().toISOString(),
        lastReferenced: new Date().toISOString()
      };
      
      memory.personalNotes.push(personalNote);
      personalMemories.set(userId.toUpperCase(), memory);
      
      res.json({
        success: true,
        message: 'Personal note added',
        noteId: personalNote.id
      });
      
    } catch (error: any) {
      console.error('Add personal note error:', error);
      res.status(500).json({ 
        error: 'Failed to add personal note',
        details: error.message 
      });
    }
  });
  
  // Record achievement
  r.post('/api/memory/achievement', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        title,
        description,
        category = 'milestone',
        celebrationLevel = 'congratulate'
      } = req.body;
      
      if (!userId || !title) {
        return res.status(400).json({ error: 'userId and title required' });
      }
      
      const memory = getOrCreateMemory(userId.toUpperCase());
      
      const achievement: Achievement = {
        id: generateId(),
        title,
        description: description || title,
        date: new Date().toISOString(),
        category,
        celebrationLevel
      };
      
      memory.achievements.push(achievement);
      memory.relationshipScore += 5; // Achievements boost relationship
      personalMemories.set(userId.toUpperCase(), memory);
      
      // Create celebration document
      if (celebrationLevel === 'celebrate') {
        await createCelebrationDocument(userId, achievement);
      }
      
      res.json({
        success: true,
        message: 'Achievement recorded',
        achievement: achievement,
        celebrationMessage: generateCelebrationMessage(userId, achievement)
      });
      
    } catch (error: any) {
      console.error('Record achievement error:', error);
      res.status(500).json({ 
        error: 'Failed to record achievement',
        details: error.message 
      });
    }
  });
  
  // Get conversation context for AI
  r.get('/api/memory/context/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { limit = 5 } = req.query;
      
      const memory = personalMemories.get(userId.toUpperCase());
      
      if (!memory) {
        return res.json({
          success: true,
          context: {
            recentMemories: [],
            personalNotes: [],
            achievements: [],
            relationshipScore: 0,
            conversationStarters: getDefaultConversationStarters(userId)
          }
        });
      }
      
      const recentMemories = memory.memories
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, parseInt(limit as string));
      
      const relevantNotes = memory.personalNotes
        .filter(note => note.importance === 'high' || note.importance === 'critical')
        .sort((a, b) => new Date(b.lastReferenced).getTime() - new Date(a.lastReferenced).getTime())
        .slice(0, 3);
      
      const recentAchievements = memory.achievements
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 2);
      
      res.json({
        success: true,
        context: {
          recentMemories,
          personalNotes: relevantNotes,
          achievements: recentAchievements,
          relationshipScore: memory.relationshipScore,
          conversationStarters: generatePersonalizedStarters(memory),
          communicationTips: generateCommunicationTips(memory)
        }
      });
      
    } catch (error: any) {
      console.error('Get context error:', error);
      res.status(500).json({ 
        error: 'Failed to get conversation context',
        details: error.message 
      });
    }
  });
  
  // Generate relationship report
  r.post('/api/memory/report/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const memory = personalMemories.get(userId.toUpperCase());
      
      if (!memory) {
        return res.status(404).json({ error: 'No memory found for user' });
      }
      
      const report = generateRelationshipReport(memory);
      
      // Save report to Drive
      const reportDoc = await uploadTextAsDoc(
        report.content,
        `Relationship_Report_${userId}_${new Date().toISOString().split('T')[0]}`,
        'SHARED_RELATIONSHIPS'
      );
      
      res.json({
        success: true,
        report: report,
        document: reportDoc.webViewLink
      });
      
    } catch (error: any) {
      console.error('Generate report error:', error);
      res.status(500).json({ 
        error: 'Failed to generate relationship report',
        details: error.message 
      });
    }
  });
}

// Helper functions
function getOrCreateMemory(userId: string): PersonalMemory {
  let memory = personalMemories.get(userId);
  
  if (!memory) {
    memory = {
      userId,
      memories: [],
      personalNotes: [],
      achievements: [],
      preferences: {
        communicationStyle: 'direct',
        preferredResponseTime: 'thoughtful',
        learningStyle: 'practical',
        motivationType: 'growth'
      },
      relationshipScore: 0,
      lastInteraction: new Date().toISOString()
    };
    personalMemories.set(userId, memory);
  }
  
  return memory;
}

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateRelationshipDelta(satisfaction: number, mood: string): number {
  let delta = satisfaction - 3; // Base on satisfaction score
  
  // Mood modifiers
  if (mood === 'happy' || mood === 'excited') delta += 1;
  if (mood === 'frustrated' || mood === 'stressed') delta -= 1;
  
  return Math.max(-2, Math.min(2, delta)); // Cap between -2 and +2
}

function generatePersonalInsights(memory: PersonalMemory): any {
  const totalInteractions = memory.memories.length;
  const avgSatisfaction = totalInteractions > 0 ? 
    memory.memories.reduce((sum, m) => sum + m.satisfaction, 0) / totalInteractions : 0;
  
  const moodDistribution = memory.memories.reduce((acc, m) => {
    acc[m.mood] = (acc[m.mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topTopics = memory.memories.reduce((acc, m) => {
    acc[m.topic] = (acc[m.topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalInteractions,
    avgSatisfaction: avgSatisfaction.toFixed(1),
    relationshipLevel: getRelationshipLevel(memory.relationshipScore),
    dominantMood: Object.keys(moodDistribution).sort((a, b) => moodDistribution[b] - moodDistribution[a])[0] || 'focused',
    topTopics: Object.keys(topTopics).sort((a, b) => topTopics[b] - topTopics[a]).slice(0, 3),
    achievements: memory.achievements.length,
    personalNotes: memory.personalNotes.length
  };
}

function getRelationshipLevel(score: number): string {
  if (score >= 50) return 'Excellent Partnership';
  if (score >= 25) return 'Strong Connection';
  if (score >= 10) return 'Good Rapport';
  if (score >= 0) return 'Building Trust';
  return 'Needs Attention';
}

function generatePersonalizedStarters(memory: PersonalMemory): string[] {
  const starters = [];
  
  // Based on recent mood
  const recentMoods = memory.memories.slice(-3).map(m => m.mood);
  if (recentMoods.includes('stressed')) {
    starters.push("Come stai gestendo il carico di lavoro oggi?");
  }
  if (recentMoods.includes('excited')) {
    starters.push("Vedo che sei energico oggi! Su cosa stai lavorando?");
  }
  
  // Based on achievements
  if (memory.achievements.length > 0) {
    const recent = memory.achievements[memory.achievements.length - 1];
    starters.push(`Come procede dopo il tuo successo con ${recent.title}?`);
  }
  
  // Based on relationship score
  if (memory.relationshipScore > 20) {
    starters.push("Cosa posso fare oggi per supportarti al meglio?");
  }
  
  return starters.slice(0, 3);
}

function generateCommunicationTips(memory: PersonalMemory): string[] {
  const tips = [];
  
  // Based on satisfaction patterns
  const lowSatisfactionTopics = memory.memories
    .filter(m => m.satisfaction < 3)
    .map(m => m.topic);
  
  if (lowSatisfactionTopics.length > 0) {
    tips.push(`Attenzione extra per: ${lowSatisfactionTopics.slice(0, 2).join(', ')}`);
  }
  
  // Based on communication style
  switch (memory.preferences.communicationStyle) {
    case 'direct':
      tips.push("Preferisce risposte dirette e concise");
      break;
    case 'encouraging':
      tips.push("Apprezza incoraggiamento e supporto emotivo");
      break;
    case 'analytical':
      tips.push("Preferisce spiegazioni dettagliate e dati");
      break;
  }
  
  return tips;
}

function generateCelebrationMessage(userId: string, achievement: Achievement): string {
  const messages = {
    'project': `🎉 Fantastico lavoro su ${achievement.title}, ${userId}! Il tuo impegno fa la differenza.`,
    'learning': `📚 Complimenti per aver padroneggiato ${achievement.title}! La crescita continua è la tua forza.`,
    'milestone': `🏆 Milestone raggiunto: ${achievement.title}! Ogni passo avanti conta.`,
    'recognition': `⭐ Ben meritato riconoscimento per ${achievement.title}! Il tuo valore è evidente.`
  };
  
  return messages[achievement.category] || `🎊 Congratulazioni per ${achievement.title}!`;
}

function getDefaultConversationStarters(userId: string): string[] {
  return [
    `Ciao ${userId}! Come posso aiutarti oggi?`,
    `Buongiorno ${userId}! Su cosa stiamo lavorando?`,
    `Eccomi qui per te, ${userId}! Cosa ti serve?`
  ];
}

function generateRelationshipReport(memory: PersonalMemory): any {
  const insights = generatePersonalInsights(memory);
  
  const content = `# Relationship Report - ${memory.userId}

**Generated**: ${new Date().toISOString()}
**Relationship Level**: ${insights.relationshipLevel}
**Relationship Score**: ${memory.relationshipScore}

## Interaction Summary
- **Total Interactions**: ${insights.totalInteractions}
- **Average Satisfaction**: ${insights.avgSatisfaction}/5
- **Dominant Mood**: ${insights.dominantMood}
- **Top Topics**: ${insights.topTopics.join(', ')}

## Personal Notes (${memory.personalNotes.length})
${memory.personalNotes.map(note => 
  `- **${note.category}** (${note.importance}): ${note.note}`
).join('\n')}

## Achievements (${memory.achievements.length})
${memory.achievements.map(achievement => 
  `- **${achievement.date.split('T')[0]}**: ${achievement.title} (${achievement.category})`
).join('\n')}

## Communication Preferences
- **Style**: ${memory.preferences.communicationStyle}
- **Response Time**: ${memory.preferences.preferredResponseTime}
- **Learning Style**: ${memory.preferences.learningStyle}
- **Motivation**: ${memory.preferences.motivationType}

## Recent Conversation Patterns
${memory.memories.slice(-5).map(conv => 
  `- **${conv.timestamp.split('T')[0]}**: ${conv.topic} (${conv.mood}, satisfaction: ${conv.satisfaction}/5)`
).join('\n')}

## Recommendations
${generateRecommendations(memory).join('\n')}

---
*Generated by Zantara Personal Memory System*
`;

  return {
    content,
    insights,
    recommendations: generateRecommendations(memory)
  };
}

function generateRecommendations(memory: PersonalMemory): string[] {
  const recommendations = [];
  
  if (memory.relationshipScore < 10) {
    recommendations.push("- Focus on building trust through consistent, helpful interactions");
  }
  
  const avgSatisfaction = memory.memories.length > 0 ? 
    memory.memories.reduce((sum, m) => sum + m.satisfaction, 0) / memory.memories.length : 0;
  
  if (avgSatisfaction < 3.5) {
    recommendations.push("- Improve response quality and relevance to user needs");
  }
  
  if (memory.achievements.length === 0) {
    recommendations.push("- Look for opportunities to recognize and celebrate user accomplishments");
  }
  
  const stressedInteractions = memory.memories.filter(m => m.mood === 'stressed').length;
  if (stressedInteractions > memory.memories.length * 0.3) {
    recommendations.push("- Provide extra emotional support and stress-relief suggestions");
  }
  
  return recommendations;
}

async function createCelebrationDocument(userId: string, achievement: Achievement): Promise<void> {
  try {
    const celebrationContent = `# 🎉 Celebration: ${achievement.title}

**Congratulations ${userId}!**

**Achievement**: ${achievement.title}
**Date**: ${achievement.date.split('T')[0]}
**Category**: ${achievement.category}
**Description**: ${achievement.description}

## Why This Matters
This achievement represents your dedication and growth. Every milestone like this builds toward your larger goals and strengthens our working relationship.

## What's Next
${generateNextSteps(achievement)}

---
*Celebrated with pride by your AI partner, Zantara* 🎊
    `;
    
    await uploadTextAsDoc(
      celebrationContent,
      `Celebration_${userId}_${achievement.title.replace(/\s+/g, '_')}`,
      `CELEBRATIONS_${userId.toUpperCase()}`
    );
  } catch (error) {
    console.error('Failed to create celebration document:', error);
  }
}

function generateNextSteps(achievement: Achievement): string {
  switch (achievement.category) {
    case 'project':
      return "Consider documenting lessons learned and applying them to future projects.";
    case 'learning':
      return "Think about how to apply this new knowledge in your current work.";
    case 'milestone':
      return "Reflect on the journey and set the next milestone to pursue.";
    case 'recognition':
      return "Use this recognition as motivation to continue your excellent work.";
    default:
      return "Take a moment to appreciate your progress and plan your next steps.";
  }
}