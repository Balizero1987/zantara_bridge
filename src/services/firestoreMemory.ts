import { Firestore, FieldValue, Query } from '@google-cloud/firestore';
import { MemoryEntry, MemorySearchOptions, MemoryStats } from '../types/memory';
import { handleFirestoreError } from '../core/firestore';

/**
 * Simple Firestore Memory Service
 * Replaces mock memory implementation with real Firestore storage
 */

export interface SimpleMemoryEntry {
  id: string;
  userId: string;
  content: string;
  title?: string;
  tags: string[];
  category?: string;
  timestamp: number;
  lastAccessedAt: number;
  accessCount: number;
  relevanceScore: number;
  source?: string;
  metadata?: {
    tokenCount?: number;
    contextType?: 'conversation' | 'document' | 'note' | 'task';
    [key: string]: any;
  };
}

export interface SimpleSearchOptions {
  userId: string;
  query?: string;
  tags?: string[];
  category?: string;
  limit?: number;
  minRelevanceScore?: number;
  timeRange?: {
    start: number;
    end: number;
  };
}

export class FirestoreMemoryService {
  private db: Firestore;
  private collectionName = 'memory_entries';

  constructor() {
    this.db = new Firestore();
  }

  /**
   * Save a memory entry to Firestore
   */
  async saveEntry(entry: Omit<SimpleMemoryEntry, 'id' | 'timestamp' | 'lastAccessedAt' | 'accessCount'>): Promise<string> {
    try {
      const timestamp = Date.now();
      const fullEntry: SimpleMemoryEntry = {
        ...entry,
        id: '', // Will be set by Firestore
        timestamp,
        lastAccessedAt: timestamp,
        accessCount: 0,
        relevanceScore: entry.relevanceScore || 1.0,
        tags: entry.tags || [],
      };

      const docRef = await this.db
        .collection(this.collectionName)
        .add(fullEntry);

      // Update the document with its own ID
      await docRef.update({ id: docRef.id });

      return docRef.id;
    } catch (error: any) {
      handleFirestoreError(error);
      throw new Error(`Failed to save memory entry: ${error.message}`);
    }
  }

  /**
   * Get a memory entry by ID
   */
  async getEntry(entryId: string, userId?: string): Promise<SimpleMemoryEntry | null> {
    try {
      const doc = await this.db
        .collection(this.collectionName)
        .doc(entryId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data() as SimpleMemoryEntry;
      
      // Check userId if provided
      if (userId && data.userId !== userId) {
        return null;
      }

      // Update access tracking
      await this.updateAccess(entryId);

      return data;
    } catch (error: any) {
      handleFirestoreError(error);
      throw new Error(`Failed to get memory entry: ${error.message}`);
    }
  }

  /**
   * Search memory entries
   */
  async searchEntries(options: SimpleSearchOptions): Promise<SimpleMemoryEntry[]> {
    try {
      let query: Query = this.db
        .collection(this.collectionName)
        .where('userId', '==', options.userId);

      // Add filters
      if (options.category) {
        query = query.where('category', '==', options.category);
      }

      if (options.minRelevanceScore) {
        query = query.where('relevanceScore', '>=', options.minRelevanceScore);
      }

      if (options.timeRange) {
        query = query
          .where('timestamp', '>=', options.timeRange.start)
          .where('timestamp', '<=', options.timeRange.end);
      }

      // Order by relevance and timestamp
      query = query
        .orderBy('relevanceScore', 'desc')
        .orderBy('timestamp', 'desc');

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      let results = snapshot.docs.map(doc => doc.data() as SimpleMemoryEntry);

      // Text search filter (simple implementation)
      if (options.query) {
        const searchQuery = options.query.toLowerCase();
        results = results.filter(entry => 
          entry.content.toLowerCase().includes(searchQuery) ||
          entry.title?.toLowerCase().includes(searchQuery) ||
          entry.tags.some(tag => tag.toLowerCase().includes(searchQuery))
        );
      }

      // Tag filter
      if (options.tags && options.tags.length > 0) {
        results = results.filter(entry =>
          options.tags!.some(tag => entry.tags.includes(tag))
        );
      }

      return results;
    } catch (error: any) {
      handleFirestoreError(error);
      throw new Error(`Failed to search memory entries: ${error.message}`);
    }
  }

  /**
   * Update an existing memory entry
   */
  async updateEntry(entryId: string, updates: Partial<SimpleMemoryEntry>): Promise<void> {
    try {
      // Remove immutable fields
      const { id, timestamp, ...allowedUpdates } = updates;
      
      await this.db
        .collection(this.collectionName)
        .doc(entryId)
        .update({
          ...allowedUpdates,
          lastAccessedAt: Date.now()
        });
    } catch (error: any) {
      handleFirestoreError(error);
      throw new Error(`Failed to update memory entry: ${error.message}`);
    }
  }

  /**
   * Delete a memory entry
   */
  async deleteEntry(entryId: string, userId?: string): Promise<void> {
    try {
      const doc = await this.db
        .collection(this.collectionName)
        .doc(entryId)
        .get();

      if (!doc.exists) {
        throw new Error('Memory entry not found');
      }

      const data = doc.data() as SimpleMemoryEntry;
      if (userId && data.userId !== userId) {
        throw new Error('Unauthorized to delete this memory entry');
      }

      await this.db
        .collection(this.collectionName)
        .doc(entryId)
        .delete();
    } catch (error: any) {
      handleFirestoreError(error);
      throw new Error(`Failed to delete memory entry: ${error.message}`);
    }
  }

  /**
   * Get memory statistics for a user
   */
  async getStats(userId: string): Promise<MemoryStats> {
    try {
      const snapshot = await this.db
        .collection(this.collectionName)
        .where('userId', '==', userId)
        .get();

      const entries = snapshot.docs.map(doc => doc.data() as SimpleMemoryEntry);
      
      if (entries.length === 0) {
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

      const totalTokens = entries.reduce((sum, entry) => 
        sum + (entry.metadata?.tokenCount || Math.ceil(entry.content.length / 4)), 0
      );

      const averageRelevanceScore = entries.reduce((sum, entry) => 
        sum + entry.relevanceScore, 0) / entries.length;

      const timestamps = entries.map(entry => entry.timestamp);
      const oldestEntry = new Date(Math.min(...timestamps));
      const newestEntry = new Date(Math.max(...timestamps));

      return {
        totalEntries: entries.length,
        totalTokens,
        averageRelevanceScore,
        oldestEntry,
        newestEntry,
        compressionRatio: 1.0, // No compression implemented yet
        estimatedCost: totalTokens * 0.0001 // Rough estimate
      };
    } catch (error: any) {
      handleFirestoreError(error);
      throw new Error(`Failed to get memory stats: ${error.message}`);
    }
  }

  /**
   * Get recent entries for a user
   */
  async getRecentEntries(userId: string, limit: number = 10): Promise<SimpleMemoryEntry[]> {
    try {
      const snapshot = await this.db
        .collection(this.collectionName)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => doc.data() as SimpleMemoryEntry);
    } catch (error: any) {
      handleFirestoreError(error);
      throw new Error(`Failed to get recent entries: ${error.message}`);
    }
  }

  /**
   * Update access tracking for an entry
   */
  private async updateAccess(entryId: string): Promise<void> {
    try {
      await this.db
        .collection(this.collectionName)
        .doc(entryId)
        .update({
          lastAccessedAt: Date.now(),
          accessCount: FieldValue.increment(1)
        });
    } catch (error: any) {
      // Don't throw on access tracking errors
      console.warn(`Failed to update access for entry ${entryId}:`, error.message);
    }
  }

  /**
   * Cleanup old or low-relevance entries (for cost optimization)
   */
  async cleanupEntries(userId: string, options: {
    maxEntries?: number;
    minRelevanceScore?: number;
    maxAgeInDays?: number;
  } = {}): Promise<number> {
    try {
      const {
        maxEntries = 1000,
        minRelevanceScore = 0.1,
        maxAgeInDays = 365
      } = options;

      const cutoffTime = Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000);
      
      // Get entries to delete
      const snapshot = await this.db
        .collection(this.collectionName)
        .where('userId', '==', userId)
        .where('relevanceScore', '<', minRelevanceScore)
        .where('timestamp', '<', cutoffTime)
        .get();

      const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);

      // If still too many entries, delete oldest low-relevance ones
      const remainingSnapshot = await this.db
        .collection(this.collectionName)
        .where('userId', '==', userId)
        .orderBy('relevanceScore')
        .orderBy('timestamp')
        .get();

      if (remainingSnapshot.size > maxEntries) {
        const excessCount = remainingSnapshot.size - maxEntries;
        const excessDocs = remainingSnapshot.docs.slice(0, excessCount);
        const excessDeletePromises = excessDocs.map(doc => doc.ref.delete());
        await Promise.all(excessDeletePromises);
        return snapshot.size + excessCount;
      }

      return snapshot.size;
    } catch (error: any) {
      handleFirestoreError(error);
      throw new Error(`Failed to cleanup entries: ${error.message}`);
    }
  }
}

// Singleton instance
export const firestoreMemory = new FirestoreMemoryService();