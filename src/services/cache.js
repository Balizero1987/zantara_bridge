const { db } = require('../core/firestore');
const crypto = require('crypto');

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.DEFAULT_TTL = 3600; // 1 hour
    this.MAX_MEMORY_ENTRIES = 1000;
    
    // FAQ responses
    this.FAQ_RESPONSES = {
      'kitas_definition': {
        it: 'KITAS (Kartu Izin Tinggal Terbatas) è un permesso di soggiorno temporaneo per stranieri in Indonesia, valido 1-2 anni e rinnovabile.',
        en: 'KITAS (Kartu Izin Tinggal Terbatas) is a temporary residence permit for foreigners in Indonesia, valid for 1-2 years and renewable.',
        id: 'KITAS (Kartu Izin Tinggal Terbatas) adalah izin tinggal sementara untuk orang asing di Indonesia, berlaku 1-2 tahun dan dapat diperpanjang.'
      },
      'kitap_definition': {
        it: 'KITAP (Kartu Izin Tinggal Tetap) è un permesso di residenza permanente in Indonesia per stranieri.',
        en: 'KITAP (Kartu Izin Tinggal Tetap) is a permanent residence permit in Indonesia for foreigners.',
        id: 'KITAP (Kartu Izin Tinggal Tetap) adalah izin tinggal tetap di Indonesia untuk orang asing.'
      }
    };
    
    // Clean expired entries every 5 minutes
    setInterval(() => this.cleanExpired(), 300000);
    this.preloadFAQ();
  }

  preloadFAQ() {
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

  generateKey(input) {
    const normalized = input.toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  async get(query, language) {
    const key = this.generateKey(query);
    
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.expires > Date.now()) {
      memEntry.hits++;
      return memEntry.value;
    }
    
    const faqResponse = this.checkFAQ(query, language);
    if (faqResponse) {
      return faqResponse;
    }
    
    try {
      const doc = await db.collection('responseCache').doc(key).get();
      if (doc.exists) {
        const data = doc.data();
        if (data.expires > Date.now()) {
          this.memoryCache.set(key, data);
          await db.collection('responseCache').doc(key).update({
            hits: (data.hits || 0) + 1
          });
          return data.value;
        }
      }
    } catch (error) {
      console.error('Cache get error:', error);
    }
    
    return null;
  }

  async set(query, response, ttl = this.DEFAULT_TTL, category, language) {
    const key = this.generateKey(query);
    const expires = Date.now() + (ttl * 1000);
    
    const entry = {
      key,
      value: response,
      expires,
      hits: 0,
      category,
      language
    };
    
    if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
      const oldestKey = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].hits - b[1].hits)[0][0];
      this.memoryCache.delete(oldestKey);
    }
    this.memoryCache.set(key, entry);
    
    try {
      await db.collection('responseCache').doc(key).set(entry);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  checkFAQ(query, language) {
    const lowerQuery = query.toLowerCase();
    const lang = language || 'en';
    
    if (lowerQuery.includes('kitas') && !lowerQuery.includes('kitap')) {
      return this.FAQ_RESPONSES.kitas_definition[lang] || null;
    }
    
    if (lowerQuery.includes('kitap')) {
      return this.FAQ_RESPONSES.kitap_definition[lang] || null;
    }
    
    return null;
  }

  cleanExpired() {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expires < now) {
        this.memoryCache.delete(key);
      }
    }
  }
}

const cacheService = new CacheService();
module.exports = { cacheService };