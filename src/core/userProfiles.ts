import { db } from './firestore';

// ============================
// TYPES & INTERFACES
// ============================

export interface UserPreferences {
  tone: 'formal' | 'casual' | 'warm' | 'assertive';
  language: 'it' | 'en' | 'id';
  expertise: 'beginner' | 'intermediate' | 'expert' | 'executive';
  responseLength: 'brief' | 'detailed' | 'comprehensive';
  communication: 'direct' | 'diplomatic' | 'encouraging';
}

export interface UserContext {
  role: string; // CEO, Developer, Manager, etc
  department: string; // Engineering, Sales, Operations
  interests: string[];
  timezone: string;
  workingHours: { start: number; end: number }; // 9-17 format
  preferredMeetingTimes: string[];
}

export interface ConversationMemory {
  lastInteraction: number;
  conversationStyle: string;
  recentTopics: string[];
  commonQuestions: string[];
  satisfactionHistory: number[]; // 1-5 ratings
  preferredResponsePatterns: string[];
}

export interface LearningMetrics {
  totalInteractions: number;
  avgResponseTime: number;
  topicFrequency: Record<string, number>;
  feedbackScore: number;
  engagementLevel: 'low' | 'medium' | 'high';
  learningProgress: number; // 0-100
}

export interface UserProfile {
  canonicalOwner: string;
  createdAt: number;
  updatedAt: number;
  preferences: UserPreferences;
  context: UserContext;
  memory: ConversationMemory;
  learning: LearningMetrics;
  customInstructions?: string;
  isActive: boolean;
}

// ============================
// DEFAULT PROFILES
// ============================

export const DEFAULT_PREFERENCES: UserPreferences = {
  tone: 'warm',
  language: 'it',
  expertise: 'intermediate',
  responseLength: 'detailed',
  communication: 'diplomatic'
};

export const DEFAULT_CONTEXT: UserContext = {
  role: 'User',
  department: 'General',
  interests: [],
  timezone: 'Asia/Jakarta',
  workingHours: { start: 9, end: 17 },
  preferredMeetingTimes: []
};

export const DEFAULT_MEMORY: ConversationMemory = {
  lastInteraction: 0,
  conversationStyle: 'exploratory',
  recentTopics: [],
  commonQuestions: [],
  satisfactionHistory: [],
  preferredResponsePatterns: []
};

export const DEFAULT_LEARNING: LearningMetrics = {
  totalInteractions: 0,
  avgResponseTime: 0,
  topicFrequency: {},
  feedbackScore: 0,
  engagementLevel: 'medium',
  learningProgress: 0
};

// ============================
// PROFILE MANAGEMENT
// ============================

export async function getUserProfile(canonicalOwner: string): Promise<UserProfile> {
  try {
    const doc = await db.collection('userProfiles').doc(canonicalOwner).get();
    
    if (doc.exists) {
      return doc.data() as UserProfile;
    }
    
    // Create new profile with defaults
    const newProfile: UserProfile = {
      canonicalOwner,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      preferences: { ...DEFAULT_PREFERENCES },
      context: { ...DEFAULT_CONTEXT },
      memory: { ...DEFAULT_MEMORY },
      learning: { ...DEFAULT_LEARNING },
      isActive: true
    };
    
    await db.collection('userProfiles').doc(canonicalOwner).set(newProfile);
    return newProfile;
    
  } catch (error) {
    console.error('Error getting user profile:', error);
    // Return default profile without saving if DB fails
    return {
      canonicalOwner,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      preferences: { ...DEFAULT_PREFERENCES },
      context: { ...DEFAULT_CONTEXT },
      memory: { ...DEFAULT_MEMORY },
      learning: { ...DEFAULT_LEARNING },
      isActive: true
    };
  }
}

export async function updateUserProfile(
  canonicalOwner: string, 
  updates: Partial<UserProfile>
): Promise<void> {
  try {
    const updateData = {
      ...updates,
      updatedAt: Date.now()
    };
    
    await db.collection('userProfiles').doc(canonicalOwner).update(updateData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function updateUserPreferences(
  canonicalOwner: string,
  preferences: Partial<UserPreferences>
): Promise<void> {
  try {
    await db.collection('userProfiles').doc(canonicalOwner).update({
      preferences,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    throw error;
  }
}

// ============================
// ROLE-BASED DEFAULTS
// ============================

export function getContextByRole(role: string): { context: Partial<UserContext>; preferences: Partial<UserPreferences> } {
  const roleDefaults: Record<string, { context: Partial<UserContext>; preferences: Partial<UserPreferences> }> = {
    'CEO': {
      context: {
        interests: ['strategy', 'growth', 'leadership']
      },
      preferences: {
        expertise: 'executive',
        communication: 'direct',
        responseLength: 'brief'
      }
    },
    'CTO': {
      context: {
        interests: ['technology', 'architecture', 'innovation']
      },
      preferences: {
        expertise: 'expert',
        communication: 'direct'
      }
    },
    'Developer': {
      context: {
        interests: ['coding', 'architecture', 'best-practices']
      },
      preferences: {
        expertise: 'expert',
        communication: 'direct',
        responseLength: 'detailed'
      }
    },
    'Manager': {
      context: {
        interests: ['team-management', 'processes', 'productivity']
      },
      preferences: {
        expertise: 'intermediate',
        communication: 'diplomatic'
      }
    },
    'Sales': {
      context: {
        interests: ['growth', 'customers', 'revenue']
      },
      preferences: {
        communication: 'encouraging'
      }
    }
  };
  
  return roleDefaults[role] || { context: {}, preferences: {} };
}