export interface MemoryEntry {
  id: string;
  userId: string;
  content: string;
  timestamp: Date;
  relevanceScore: number;
  accessCount: number;
  lastAccessedAt: Date;
  tags?: string[];
  category?: string;
  embeddings?: number[];
  compressed?: boolean;
  metadata?: {
    tokenCount?: number;
    source?: string;
    contextType?: 'conversation' | 'document' | 'note' | 'task';
  };
}

export interface MemorySearchOptions {
  userId: string;
  query?: string;
  limit?: number;
  minRelevanceScore?: number;
  includeEmbeddings?: boolean;
  timeRange?: {
    start: Date;
    end: Date;
  };
  categories?: string[];
  useSemanticSearch?: boolean;
}

export interface MemoryPruningConfig {
  maxEntries: number;
  minRelevanceScore: number;
  maxAgeInDays: number;
  compressionThresholdDays: number;
  relevanceDecayFactor: number;
}

export interface MemoryStats {
  totalEntries: number;
  totalTokens: number;
  averageRelevanceScore: number;
  oldestEntry: Date;
  newestEntry: Date;
  compressionRatio: number;
  estimatedCost: number;
}

export interface EmbeddingVector {
  id: string;
  vector: number[];
  dimension: number;
  model: string;
  createdAt: Date;
}