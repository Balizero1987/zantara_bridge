import { MemoryEntry, MemoryPruningConfig, MemorySearchOptions, MemoryStats } from '../types/memory';
import { Firestore } from '@google-cloud/firestore';
import { openai } from '../core/openai';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { firestore as getFirestore } from '../firebase';
import NodeCache from 'node-cache';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class MemoryOptimizer {
  private firestore: Firestore;
  private cache: NodeCache;
  private readonly COLLECTION = 'optimized_memory';
  private readonly EMBEDDINGS_COLLECTION = 'memory_embeddings';
  
  private readonly DEFAULT_CONFIG: MemoryPruningConfig = {
    maxEntries: 100,
    minRelevanceScore: 0.3,
    maxAgeInDays: 90,
    compressionThresholdDays: 7,
    relevanceDecayFactor: 0.95
  };

  constructor() {
    this.firestore = getFirestore;
    this.cache = new NodeCache({ 
      stdTTL: 600, // 10 minutes
      checkperiod: 120 
    });
  }

  /**
   * Calculate relevance score based on multiple factors
   */
  private calculateRelevanceScore(entry: MemoryEntry): number {
    const now = new Date();
    const ageInDays = (now.getTime() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    
    // Time decay factor
    const timeDecay = Math.exp(-ageInDays / 30); // Exponential decay over 30 days
    
    // Access frequency factor
    const accessFactor = Math.min(1, entry.accessCount / 10); // Normalize to max 1
    
    // Recency of last access
    const lastAccessDays = (now.getTime() - new Date(entry.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24);
    const lastAccessFactor = Math.exp(-lastAccessDays / 14); // Decay over 2 weeks
    
    // Combine factors with weights
    const score = (timeDecay * 0.3) + (accessFactor * 0.4) + (lastAccessFactor * 0.3);
    
    return Math.min(1, Math.max(0, score)); // Clamp between 0 and 1
  }

  /**
   * Generate embeddings for semantic search
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Compress old memory entries
   */
  private async compressContent(content: string): Promise<Buffer> {
    return await gzip(content);
  }

  /**
   * Decompress memory entries
   */
  private async decompressContent(compressed: Buffer): Promise<string> {
    const decompressed = await gunzip(compressed);
    return decompressed.toString();
  }

  /**
   * Save memory entry with optimization
   */
  async saveMemory(
    userId: string,
    content: string,
    metadata?: Partial<MemoryEntry['metadata']>
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      content,
      timestamp: new Date(),
      relevanceScore: 1.0, // New entries start with max relevance
      accessCount: 0,
      lastAccessedAt: new Date(),
      metadata: {
        tokenCount: this.estimateTokens(content),
        ...metadata
      }
    };

    // Generate embeddings for semantic search
    if (content.length > 50) { // Only for substantial content
      entry.embeddings = await this.generateEmbedding(content);
    }

    // Save to Firestore
    await this.firestore
      .collection(this.COLLECTION)
      .doc(entry.id)
      .set(entry);

    // Save embeddings separately if they exist
    if (entry.embeddings) {
      await this.firestore
        .collection(this.EMBEDDINGS_COLLECTION)
        .doc(entry.id)
        .set({
          vector: entry.embeddings,
          dimension: entry.embeddings.length,
          model: 'text-embedding-3-small',
          createdAt: new Date()
        });
    }

    // Clear cache for this user
    this.cache.del(`memory_${userId}`);

    return entry;
  }

  /**
   * Search memory with semantic search and relevance scoring
   */
  async searchMemory(options: MemorySearchOptions): Promise<MemoryEntry[]> {
    const cacheKey = `search_${JSON.stringify(options)}`;
    const cached = this.cache.get<MemoryEntry[]>(cacheKey);
    if (cached) return cached;

    let query = this.firestore
      .collection(this.COLLECTION)
      .where('userId', '==', options.userId);

    // Apply time range filter
    if (options.timeRange) {
      query = query
        .where('timestamp', '>=', options.timeRange.start)
        .where('timestamp', '<=', options.timeRange.end);
    }

    // Apply category filter
    if (options.categories && options.categories.length > 0) {
      query = query.where('metadata.category', 'in', options.categories);
    }

    const snapshot = await query.limit(options.limit || 100).get();
    let entries: MemoryEntry[] = [];

    for (const doc of snapshot.docs) {
      const entry = doc.data() as MemoryEntry;
      
      // Update relevance score
      entry.relevanceScore = this.calculateRelevanceScore(entry);
      
      // Filter by minimum relevance score
      if (entry.relevanceScore >= (options.minRelevanceScore || 0)) {
        // Decompress if needed
        if (entry.compressed && entry.content) {
          entry.content = await this.decompressContent(Buffer.from(entry.content as any));
        }
        entries.push(entry);
      }
    }

    // Semantic search if query provided and embeddings requested
    if (options.query && options.useSemanticSearch) {
      const queryEmbedding = await this.generateEmbedding(options.query);
      
      // Calculate similarity scores
      entries = entries.map(entry => {
        if (entry.embeddings && queryEmbedding.length > 0) {
          const similarity = this.cosineSimilarity(queryEmbedding, entry.embeddings);
          // Boost relevance score with semantic similarity
          entry.relevanceScore = (entry.relevanceScore * 0.5) + (similarity * 0.5);
        }
        return entry;
      });
    }

    // Sort by relevance score
    entries.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit results
    entries = entries.slice(0, options.limit || 50);

    // Update access counts
    for (const entry of entries) {
      entry.accessCount++;
      entry.lastAccessedAt = new Date();
      
      // Update in Firestore (async, don't wait)
      this.firestore
        .collection(this.COLLECTION)
        .doc(entry.id)
        .update({
          accessCount: entry.accessCount,
          lastAccessedAt: entry.lastAccessedAt
        })
        .catch(console.error);
    }

    // Cache results
    this.cache.set(cacheKey, entries, 300); // 5 minutes

    return entries;
  }

  /**
   * Prune old and irrelevant memories
   */
  async pruneMemories(
    userId: string,
    config?: Partial<MemoryPruningConfig>
  ): Promise<{ pruned: number; compressed: number }> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const now = new Date();
    const stats = { pruned: 0, compressed: 0 };

    const snapshot = await this.firestore
      .collection(this.COLLECTION)
      .where('userId', '==', userId)
      .get();

    const entries: MemoryEntry[] = [];
    
    for (const doc of snapshot.docs) {
      entries.push(doc.data() as MemoryEntry);
    }

    // Update relevance scores
    for (const entry of entries) {
      entry.relevanceScore = this.calculateRelevanceScore(entry);
    }

    // Sort by relevance
    entries.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Process entries
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const ageInDays = (now.getTime() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60 * 24);

      // Delete if beyond max entries or below min relevance or too old
      if (
        i >= finalConfig.maxEntries ||
        entry.relevanceScore < finalConfig.minRelevanceScore ||
        ageInDays > finalConfig.maxAgeInDays
      ) {
        await this.firestore
          .collection(this.COLLECTION)
          .doc(entry.id)
          .delete();
        stats.pruned++;
      }
      // Compress if old enough but still relevant
      else if (ageInDays > finalConfig.compressionThresholdDays && !entry.compressed) {
        const compressed = await this.compressContent(entry.content);
        await this.firestore
          .collection(this.COLLECTION)
          .doc(entry.id)
          .update({
            content: compressed,
            compressed: true
          });
        stats.compressed++;
      }
    }

    // Clear cache
    this.cache.flushAll();

    return stats;
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(userId: string): Promise<MemoryStats> {
    const snapshot = await this.firestore
      .collection(this.COLLECTION)
      .where('userId', '==', userId)
      .get();

    if (snapshot.empty) {
      return {
        totalEntries: 0,
        totalTokens: 0,
        averageRelevanceScore: 0,
        oldestEntry: new Date(),
        newestEntry: new Date(),
        compressionRatio: 0,
        estimatedCost: 0
      };
    }

    let totalTokens = 0;
    let totalRelevanceScore = 0;
    let oldestEntry = new Date();
    let newestEntry = new Date(0);
    let compressedCount = 0;

    for (const doc of snapshot.docs) {
      const entry = doc.data() as MemoryEntry;
      
      totalTokens += entry.metadata?.tokenCount || 0;
      totalRelevanceScore += this.calculateRelevanceScore(entry);
      
      const timestamp = new Date(entry.timestamp);
      if (timestamp < oldestEntry) oldestEntry = timestamp;
      if (timestamp > newestEntry) newestEntry = timestamp;
      
      if (entry.compressed) compressedCount++;
    }

    const totalEntries = snapshot.size;
    const compressionRatio = totalEntries > 0 ? compressedCount / totalEntries : 0;
    
    // Estimate cost (GPT-4 pricing approximation)
    const inputCostPer1k = 0.03;
    const outputCostPer1k = 0.06;
    const estimatedCost = (totalTokens / 1000) * inputCostPer1k;

    return {
      totalEntries,
      totalTokens,
      averageRelevanceScore: totalRelevanceScore / totalEntries,
      oldestEntry,
      newestEntry,
      compressionRatio,
      estimatedCost
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Batch update relevance scores
   */
  async updateAllRelevanceScores(userId: string): Promise<void> {
    const snapshot = await this.firestore
      .collection(this.COLLECTION)
      .where('userId', '==', userId)
      .get();

    const batch = this.firestore.batch();
    
    for (const doc of snapshot.docs) {
      const entry = doc.data() as MemoryEntry;
      const newScore = this.calculateRelevanceScore(entry);
      
      batch.update(doc.ref, {
        relevanceScore: newScore
      });
    }

    await batch.commit();
    this.cache.flushAll();
  }
}

// Singleton instance
export const memoryOptimizer = new MemoryOptimizer();