import Redis from 'ioredis';
import { db } from '../core/firestore';
import * as crypto from 'crypto';

export interface CacheEntry {
  key: string;
  value: string;
  expires: number;
  hits: number;
  category?: string;
  language?: string;
  metadata?: Record<string, any>;
}

export interface CacheStats {
  memoryHits: number;
  redisHits: number;
  firestoreHits: number;
  misses: number;
  totalEntries: number;
  memoryUsage: number;
}

class EnhancedCacheService {
  private redis: Redis | null = null;
  private memoryCache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    memoryHits: 0,
    redisHits: 0,
    firestoreHits: 0,
    misses: 0,
    totalEntries: 0,
    memoryUsage: 0
  };

  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly MAX_MEMORY_ENTRIES = 1000;
  private readonly REDIS_TTL = 86400; // 24 hours for Redis
  private readonly FIRESTORE_TTL = 7 * 24 * 3600; // 7 days for Firestore

  private readonly FAQ_RESPONSES = {
    'kitas_definition': {
      it: 'KITAS (Kartu Izin Tinggal Terbatas) è un permesso di soggiorno temporaneo per stranieri in Indonesia, valido 1-2 anni e rinnovabile.',
      en: 'KITAS (Kartu Izin Tinggal Terbatas) is a temporary residence permit for foreigners in Indonesia, valid for 1-2 years and renewable.',
      id: 'KITAS (Kartu Izin Tinggal Terbatas) adalah izin tinggal sementara untuk orang asing di Indonesia, berlaku 1-2 tahun dan dapat diperpanjang.'
    },
    'kitap_definition': {
      it: 'KITAP (Kartu Izin Tinggal Tetap) è un permesso di residenza permanente in Indonesia per stranieri.',
      en: 'KITAP (Kartu Izin Tinggal Tetap) is a permanent residence permit in Indonesia for foreigners.',
      id: 'KITAP (Kartu Izin Tinggal Tetap) adalah izin tinggal tetap di Indonesia untuk orang asing.'
    },
    'pt_pma_definition': {
      it: 'PT PMA (Penanaman Modal Asing) è una società a responsabilità limitata per investimenti stranieri in Indonesia.',
      en: 'PT PMA (Penanaman Modal Asing) is a limited liability company for foreign investment in Indonesia.',
      id: 'PT PMA (Penanaman Modal Asing) adalah perseroan terbatas untuk penanaman modal asing di Indonesia.'
    },
    'tax_filing': {
      it: 'La dichiarazione dei redditi in Indonesia deve essere presentata entro il 31 marzo per le persone fisiche.',
      en: 'Tax returns in Indonesia must be filed by March 31st for individuals.',
      id: 'SPT Tahunan di Indonesia harus disampaikan paling lambat 31 Maret untuk orang pribadi.'
    }
  };

  constructor() {
    this.initializeRedis();
    this.preloadFAQ();
    
    // Clean expired entries every 5 minutes
    setInterval(() => this.cleanExpired(), 300000);
    
    // Update stats every minute
    setInterval(() => this.updateStats(), 60000);
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;
      
      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          connectTimeout: 5000,
          commandTimeout: 5000
        });

        this.redis.on('connect', () => {
          console.log('✅ Redis connected');
        });

        this.redis.on('error', (error) => {
          console.error('❌ Redis error:', error.message);
          this.redis = null; // Fallback to memory + Firestore
        });

        // Test connection
        await this.redis.ping();
        
      } else {
        console.log('⚠️ No Redis URL provided, using memory + Firestore cache');
      }
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      this.redis = null;
    }
  }

  private preloadFAQ(): void {
    for (const [key, translations] of Object.entries(this.FAQ_RESPONSES)) {
      for (const [lang, response] of Object.entries(translations)) {
        const cacheKey = this.generateKey(`${key}_${lang}`);
        this.memoryCache.set(cacheKey, {
          key: cacheKey,
          value: response,
          expires: Date.now() + (86400 * 1000), // 24 hours
          hits: 0,
          category: 'faq',
          language: lang
        });
      }
    }
  }

  generateKey(input: string): string {
    const normalized = input.toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  async get(query: string, language?: string): Promise<string | null> {
    const key = this.generateKey(query);
    
    // 1. Check memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.expires > Date.now()) {
      memEntry.hits++;
      this.stats.memoryHits++;
      return memEntry.value;
    }

    // 2. Check FAQ responses
    const faqResponse = this.checkFAQ(query, language);
    if (faqResponse) {
      // Cache the FAQ response
      await this.set(query, faqResponse, this.DEFAULT_TTL, 'faq', language);
      return faqResponse;
    }

    // 3. Check Redis cache
    if (this.redis) {
      try {
        const redisValue = await this.redis.get(key);
        if (redisValue) {
          const entry: CacheEntry = JSON.parse(redisValue);
          if (entry.expires > Date.now()) {
            // Store in memory cache for faster access
            this.memoryCache.set(key, entry);
            entry.hits++;
            this.stats.redisHits++;
            
            // Update hit count in Redis
            await this.redis.set(key, JSON.stringify(entry), 'EX', this.REDIS_TTL);
            
            return entry.value;
          }
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }

    // 4. Check Firestore cache
    try {
      const doc = await db.collection('responseCache').doc(key).get();
      if (doc.exists) {
        const data = doc.data() as CacheEntry;
        if (data.expires > Date.now()) {
          // Store in memory and Redis for faster access
          this.memoryCache.set(key, data);
          
          if (this.redis) {
            await this.redis.set(key, JSON.stringify(data), 'EX', this.REDIS_TTL);
          }

          // Update hit count in Firestore
          await db.collection('responseCache').doc(key).update({
            hits: (data.hits || 0) + 1
          });

          this.stats.firestoreHits++;
          return data.value;
        }
      }
    } catch (error) {
      console.error('Firestore cache get error:', error);
    }

    this.stats.misses++;
    return null;
  }

  async set(
    query: string, 
    response: string, 
    ttl: number = this.DEFAULT_TTL, 
    category?: string, 
    language?: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    const key = this.generateKey(query);
    const expires = Date.now() + (ttl * 1000);
    
    const entry: CacheEntry = {
      key,
      value: response,
      expires,
      hits: 0,
      category,
      language,
      metadata
    };

    try {
      // 1. Store in memory cache
      if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
        const oldestKey = Array.from(this.memoryCache.entries())
          .sort((a, b) => a[1].hits - b[1].hits)[0][0];
        this.memoryCache.delete(oldestKey);
      }
      this.memoryCache.set(key, entry);

      // 2. Store in Redis cache
      if (this.redis) {
        try {
          await this.redis.set(key, JSON.stringify(entry), 'EX', this.REDIS_TTL);
        } catch (error) {
          console.error('Redis set error:', error);
        }
      }

      // 3. Store in Firestore cache (for persistence)
      await db.collection('responseCache').doc(key).set({
        ...entry,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  private checkFAQ(query: string, language: string = 'en'): string | null {
    const lowerQuery = query.toLowerCase();
    const lang = language || 'en';
    
    // KITAS related
    if (lowerQuery.includes('kitas') && !lowerQuery.includes('kitap')) {
      return this.FAQ_RESPONSES.kitas_definition[lang as keyof typeof this.FAQ_RESPONSES.kitas_definition] || null;
    }
    
    // KITAP related
    if (lowerQuery.includes('kitap')) {
      return this.FAQ_RESPONSES.kitap_definition[lang as keyof typeof this.FAQ_RESPONSES.kitap_definition] || null;
    }

    // PT PMA related
    if (lowerQuery.includes('pt pma') || lowerQuery.includes('foreign investment')) {
      return this.FAQ_RESPONSES.pt_pma_definition[lang as keyof typeof this.FAQ_RESPONSES.pt_pma_definition] || null;
    }

    // Tax related
    if (lowerQuery.includes('tax filing') || lowerQuery.includes('spt')) {
      return this.FAQ_RESPONSES.tax_filing[lang as keyof typeof this.FAQ_RESPONSES.tax_filing] || null;
    }
    
    return null;
  }

  async delete(query: string): Promise<boolean> {
    const key = this.generateKey(query);
    
    try {
      // Delete from memory
      this.memoryCache.delete(key);

      // Delete from Redis
      if (this.redis) {
        await this.redis.del(key);
      }

      // Delete from Firestore
      await db.collection('responseCache').doc(key).delete();

      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async clear(category?: string): Promise<number> {
    let deletedCount = 0;

    try {
      if (category) {
        // Clear specific category
        for (const [key, entry] of this.memoryCache.entries()) {
          if (entry.category === category) {
            this.memoryCache.delete(key);
            deletedCount++;
          }
        }

        // Clear from Firestore
        const snapshot = await db.collection('responseCache')
          .where('category', '==', category)
          .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCount++;
        });
        await batch.commit();

        // Clear from Redis (scan and delete matching keys)
        if (this.redis) {
          // Note: This is simplified. In production, you'd want to use SCAN
          const keys = await this.redis.keys('*');
          for (const key of keys) {
            try {
              const value = await this.redis.get(key);
              if (value) {
                const entry = JSON.parse(value);
                if (entry.category === category) {
                  await this.redis.del(key);
                }
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      } else {
        // Clear all
        this.memoryCache.clear();
        
        if (this.redis) {
          await this.redis.flushdb();
        }

        const snapshot = await db.collection('responseCache').get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCount++;
        });
        await batch.commit();
      }

      return deletedCount;
    } catch (error) {
      console.error('Cache clear error:', error);
      return 0;
    }
  }

  private cleanExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expires < now) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned ${cleanedCount} expired entries from memory cache`);
    }
  }

  private updateStats(): void {
    this.stats.totalEntries = this.memoryCache.size;
    this.stats.memoryUsage = JSON.stringify(Array.from(this.memoryCache.entries())).length;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  async getHealthStatus(): Promise<{
    memory: boolean;
    redis: boolean;
    firestore: boolean;
    totalEntries: number;
  }> {
    const status = {
      memory: this.memoryCache.size >= 0,
      redis: false,
      firestore: false,
      totalEntries: this.memoryCache.size
    };

    // Test Redis
    if (this.redis) {
      try {
        await this.redis.ping();
        status.redis = true;
      } catch (error) {
        console.error('Redis health check failed:', error);
      }
    }

    // Test Firestore
    try {
      await db.collection('responseCache').limit(1).get();
      status.firestore = true;
    } catch (error) {
      console.error('Firestore health check failed:', error);
    }

    return status;
  }

  async warmupCache(): Promise<void> {
    try {
      console.log('Warming up cache...');
      
      // Load most recent cache entries from Firestore
      const snapshot = await db.collection('responseCache')
        .orderBy('hits', 'desc')
        .limit(100)
        .get();

      let loadedCount = 0;
      for (const doc of snapshot.docs) {
        const data = doc.data() as CacheEntry;
        if (data.expires > Date.now()) {
          this.memoryCache.set(data.key, data);
          loadedCount++;
        }
      }

      console.log(`Warmed up cache with ${loadedCount} entries`);
    } catch (error) {
      console.error('Cache warmup failed:', error);
    }
  }

  // Method to get cache performance metrics
  getPerformanceMetrics(): {
    hitRatio: number;
    memoryHitRatio: number;
    redisHitRatio: number;
    firestoreHitRatio: number;
    totalRequests: number;
  } {
    const totalRequests = this.stats.memoryHits + this.stats.redisHits + 
                         this.stats.firestoreHits + this.stats.misses;
    
    return {
      hitRatio: totalRequests > 0 ? 
        (this.stats.memoryHits + this.stats.redisHits + this.stats.firestoreHits) / totalRequests : 0,
      memoryHitRatio: totalRequests > 0 ? this.stats.memoryHits / totalRequests : 0,
      redisHitRatio: totalRequests > 0 ? this.stats.redisHits / totalRequests : 0,
      firestoreHitRatio: totalRequests > 0 ? this.stats.firestoreHits / totalRequests : 0,
      totalRequests
    };
  }
}

export const cacheService = new EnhancedCacheService();

// Initialize cache warmup on startup
setTimeout(() => {
  cacheService.warmupCache();
}, 5000); // Wait 5 seconds after startup