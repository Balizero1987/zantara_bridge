import type { Router, Request, Response } from 'express';
import { 
  getUserProfile, 
  updateUserProfile, 
  updateUserPreferences,
  UserPreferences,
  getContextByRole 
} from '../../core/userProfiles';
import { 
  generateProactiveRecommendations,
  getActiveRecommendations,
  markRecommendationActioned 
} from '../../core/recommendationEngine';
import { 
  analyzeInteractionPatterns,
  generateLearningInsights 
} from '../../core/learningEngine';
import { getRecentUserContext } from '../../core/contextualMemory';

export default function registerUserPreferences(r: Router) {
  
  // ============================
  // GET USER PROFILE
  // ============================
  
  r.get('/api/user/profile', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const profile = await getUserProfile(owner);
      
      // Don't expose internal IDs and sensitive data
      const publicProfile = {
        canonicalOwner: profile.canonicalOwner,
        preferences: profile.preferences,
        context: profile.context,
        learning: {
          totalInteractions: profile.learning.totalInteractions,
          engagementLevel: profile.learning.engagementLevel,
          learningProgress: profile.learning.learningProgress,
          feedbackScore: profile.learning.feedbackScore
        },
        isActive: profile.isActive,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      };
      
      res.json({ ok: true, profile: publicProfile });
      
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: 'profile_fetch_failed',
        detail: error.message 
      });
    }
  });
  
  // ============================
  // UPDATE USER PREFERENCES
  // ============================
  
  r.patch('/api/user/preferences', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const updates = req.body as Partial<UserPreferences>;
      
      // Validate preferences
      const validatedUpdates = validatePreferences(updates);
      if (!validatedUpdates.valid) {
        return res.status(400).json({
          ok: false,
          error: 'invalid_preferences',
          detail: validatedUpdates.errors
        });
      }
      
      await updateUserPreferences(owner, validatedUpdates.preferences);
      const updatedProfile = await getUserProfile(owner);
      
      res.json({ 
        ok: true, 
        message: 'Preferenze aggiornate con successo',
        preferences: updatedProfile.preferences 
      });
      
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: 'preferences_update_failed',
        detail: error.message 
      });
    }
  });
  
  // ============================
  // UPDATE USER CONTEXT
  // ============================
  
  r.patch('/api/user/context', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const { role, department, interests, timezone, customInstructions } = req.body;
      
      const profile = await getUserProfile(owner);
      const contextUpdates = {
        ...profile.context,
        ...(role && { role }),
        ...(department && { department }),
        ...(interests && { interests }),
        ...(timezone && { timezone })
      };
      
      // Apply role-based defaults if role changed
      if (role && role !== profile.context.role) {
        const roleDefaults = getContextByRole(role);
        Object.assign(contextUpdates, roleDefaults.context);
        
        // Also update preferences if role provides defaults
        if (Object.keys(roleDefaults.preferences).length > 0) {
          await updateUserPreferences(owner, roleDefaults.preferences);
        }
      }
      
      const updates: any = { 
        context: contextUpdates,
        ...(customInstructions && { customInstructions })
      };
      
      await updateUserProfile(owner, updates);
      const updatedProfile = await getUserProfile(owner);
      
      res.json({ 
        ok: true, 
        message: 'Contesto aggiornato con successo',
        context: updatedProfile.context,
        customInstructions: updatedProfile.customInstructions
      });
      
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: 'context_update_failed',
        detail: error.message 
      });
    }
  });
  
  // ============================
  // GET USER ANALYTICS
  // ============================
  
  r.get('/api/user/analytics', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const profile = await getUserProfile(owner);
      const patterns = await analyzeInteractionPatterns(owner);
      const insights = await generateLearningInsights(owner);
      const context = await getRecentUserContext(owner, 7 * 24); // Last 7 days
      
      const analytics = {
        summary: {
          totalInteractions: profile.learning.totalInteractions,
          avgSatisfaction: profile.learning.feedbackScore,
          engagementLevel: profile.learning.engagementLevel,
          learningProgress: profile.learning.learningProgress
        },
        patterns: patterns.slice(0, 5), // Top 5 patterns
        insights: insights,
        recentActivity: {
          activeTopics: context.activeTopics,
          currentProjects: context.workContext.currentProjects,
          urgentTasks: context.workContext.urgentTasks.length
        },
        topTopics: Object.entries(profile.learning.topicFrequency)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([topic, count]) => ({ topic, count }))
      };
      
      res.json({ ok: true, analytics });
      
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: 'analytics_fetch_failed',
        detail: error.message 
      });
    }
  });
  
  // ============================
  // GET RECOMMENDATIONS
  // ============================
  
  r.get('/api/user/recommendations', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const { generate } = req.query;
      
      let recommendations;
      
      if (generate === 'true') {
        // Generate fresh recommendations
        recommendations = await generateProactiveRecommendations(owner);
        // Note: In production, you might want to save these to avoid regenerating frequently
      } else {
        // Get existing active recommendations
        recommendations = await getActiveRecommendations(owner);
      }
      
      res.json({ 
        ok: true, 
        recommendations,
        count: recommendations.length 
      });
      
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: 'recommendations_fetch_failed',
        detail: error.message 
      });
    }
  });
  
  // ============================
  // ACTION RECOMMENDATION
  // ============================
  
  r.post('/api/user/recommendations/:id/action', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      
      await markRecommendationActioned(id);
      
      res.json({ 
        ok: true, 
        message: 'Raccomandazione marcata come completata',
        recommendationId: id 
      });
      
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: 'recommendation_action_failed',
        detail: error.message 
      });
    }
  });
  
  // ============================
  // PROVIDE FEEDBACK
  // ============================
  
  r.post('/api/user/feedback', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const { satisfaction, category, comment } = req.body;
      
      if (!satisfaction || satisfaction < 1 || satisfaction > 5) {
        return res.status(400).json({
          ok: false,
          error: 'invalid_satisfaction',
          detail: 'Satisfaction must be between 1 and 5'
        });
      }
      
      // Store feedback
      await storeFeedback(owner, satisfaction, category, comment);
      
      // Update learning metrics
      const profile = await getUserProfile(owner);
      const newFeedbackScore = ((profile.learning.feedbackScore * profile.learning.totalInteractions) + satisfaction) / (profile.learning.totalInteractions + 1);
      
      await updateUserProfile(owner, {
        learning: {
          ...profile.learning,
          feedbackScore: newFeedbackScore
        }
      });
      
      res.json({ 
        ok: true, 
        message: 'Feedback ricevuto, grazie!',
        newAverageScore: newFeedbackScore.toFixed(1)
      });
      
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: 'feedback_submission_failed',
        detail: error.message 
      });
    }
  });
  
  // ============================
  // RESET PROFILE
  // ============================
  
  r.delete('/api/user/profile/reset', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const { confirm } = req.body;
      
      if (confirm !== 'RESET_MY_PROFILE') {
        return res.status(400).json({
          ok: false,
          error: 'confirmation_required',
          detail: 'Include { "confirm": "RESET_MY_PROFILE" } to confirm reset'
        });
      }
      
      // This will create a fresh profile with defaults
      const newProfile = await getUserProfile(owner + '_temp');
      newProfile.canonicalOwner = owner;
      
      await updateUserProfile(owner, {
        preferences: newProfile.preferences,
        context: newProfile.context,
        memory: newProfile.memory,
        learning: newProfile.learning,
        updatedAt: Date.now()
      });
      
      res.json({ 
        ok: true, 
        message: 'Profilo reimpostato ai valori predefiniti' 
      });
      
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: 'profile_reset_failed',
        detail: error.message 
      });
    }
  });
}

// ============================
// HELPER FUNCTIONS
// ============================

function validatePreferences(updates: Partial<UserPreferences>): { valid: boolean; preferences: Partial<UserPreferences>; errors?: string[] } {
  const errors: string[] = [];
  const cleanUpdates: Partial<UserPreferences> = {};
  
  if (updates.tone && !['formal', 'casual', 'warm', 'assertive'].includes(updates.tone)) {
    errors.push('Invalid tone. Must be: formal, casual, warm, assertive');
  } else if (updates.tone) {
    cleanUpdates.tone = updates.tone;
  }
  
  if (updates.language && !['it', 'en', 'id'].includes(updates.language)) {
    errors.push('Invalid language. Must be: it, en, id');
  } else if (updates.language) {
    cleanUpdates.language = updates.language;
  }
  
  if (updates.expertise && !['beginner', 'intermediate', 'expert', 'executive'].includes(updates.expertise)) {
    errors.push('Invalid expertise. Must be: beginner, intermediate, expert, executive');
  } else if (updates.expertise) {
    cleanUpdates.expertise = updates.expertise;
  }
  
  if (updates.responseLength && !['brief', 'detailed', 'comprehensive'].includes(updates.responseLength)) {
    errors.push('Invalid responseLength. Must be: brief, detailed, comprehensive');
  } else if (updates.responseLength) {
    cleanUpdates.responseLength = updates.responseLength;
  }
  
  if (updates.communication && !['direct', 'diplomatic', 'encouraging'].includes(updates.communication)) {
    errors.push('Invalid communication. Must be: direct, diplomatic, encouraging');
  } else if (updates.communication) {
    cleanUpdates.communication = updates.communication;
  }
  
  return {
    valid: errors.length === 0,
    preferences: cleanUpdates,
    errors: errors.length > 0 ? errors : undefined
  };
}

async function storeFeedback(owner: string, satisfaction: number, category?: string, comment?: string): Promise<void> {
  try {
    const feedback = {
      canonicalOwner: owner,
      satisfaction,
      category: category || 'general',
      comment: comment || '',
      timestamp: Date.now()
    };
    
    await require('../../core/firestore').db.collection('userFeedback').add(feedback);
  } catch (error) {
    console.error('Error storing feedback:', error);
    // Don't throw - feedback storage shouldn't break the main flow
  }
}