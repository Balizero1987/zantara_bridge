export type ConversationStatus = 'open' | 'closed' | 'archived';

export type MoodType = 'curious' | 'stressed' | 'relaxed' | 'excited' | 'frustrated' | 'relieved' | 'confused' | 'confident' | 'urgent' | 'casual';

export type MessageSender = 'collab' | 'zantara' | 'system';

export type ArtifactType = 'note' | 'driveFile' | 'calendarEvent' | 'quest' | 'reminder';

export interface ConversationSummary {
  short: string;
  bullets: string[];
  narrative: string;
}

export interface ConversationMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: string; // ISO string
  mood?: MoodType;
  trigger?: string;
  metadata?: {
    responseTime?: number;
    actionTaken?: string;
    confidenceScore?: number;
  };
}

export interface ConversationArtifact {
  id: string;
  type: ArtifactType;
  fileId?: string;
  link?: string;
  title?: string;
  description?: string;
  createdAt: string; // ISO string
  metadata?: {
    questId?: string;
    eventId?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  };
}

export interface Conversation {
  id: string;
  collab: string;
  startedAt: string; // ISO string
  lastMessageAt: string; // ISO string
  status: ConversationStatus;
  tags: string[];
  summary?: ConversationSummary;
  questLinked?: string;
  moodTrend: MoodType[];
  messageCount?: number;
  artifactCount?: number;
  collaboratorBadge?: string;
  collaboratorTone?: string;
  metadata?: {
    avgResponseTime?: number;
    satisfactionScore?: number;
    complexityLevel?: 'simple' | 'medium' | 'complex' | 'epic';
    language?: 'en' | 'id' | 'mixed';
  };
}

export interface SharedConversation extends Conversation {
  participants: string[];
  mainTopic: string;
  collaborationType: 'discussion' | 'planning' | 'crisis' | 'celebration';
}

export interface ConversationMetrics {
  totalConversations: number;
  activeConversations: number;
  avgResponseTime: number;
  topTriggers: Array<{ trigger: string; count: number }>;
  moodDistribution: Record<MoodType, number>;
  artifactGeneration: {
    notes: number;
    quests: number;
    events: number;
    total: number;
  };
  collabStats: Array<{
    collab: string;
    conversations: number;
    lastActive: string;
    avgMood: MoodType;
    questsGenerated: number;
  }>;
}

export interface ConversationQuery {
  collab?: string;
  tags?: string[];
  status?: ConversationStatus;
  startDate?: string;
  endDate?: string;
  mood?: MoodType[];
  hasArtifacts?: boolean;
  limit?: number;
  offset?: number;
}

export interface ConversationAnalysis {
  extractedKeywords: string[];
  suggestedTags: string[];
  knowledgeSnippets: Array<{
    content: string;
    category: string;
    reusability: 'high' | 'medium' | 'low';
  }>;
  questSuggestions: Array<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    estimatedDuration: string;
  }>;
  moodAnalysis: {
    primaryMood: MoodType;
    moodShifts: Array<{
      from: MoodType;
      to: MoodType;
      messageId: string;
    }>;
    overallSentiment: 'positive' | 'negative' | 'neutral';
  };
}