class LanguageDetectionService {
  constructor() {
    this.languagePatterns = {
      it: {
        common: ['il', 'la', 'di', 'che', 'è', 'e', 'un', 'per', 'con', 'non', 'come', 'sono'],
        indicators: ['ciao', 'grazie', 'prego', 'scusa', 'buongiorno', 'arrivederci'],
        patterns: /\b(sono|hai|puoi|voglio|devo|posso|quando|dove|perché|cosa)\b/gi
      },
      en: {
        common: ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with'],
        indicators: ['hello', 'hi', 'thanks', 'please', 'sorry', 'goodbye', 'yes', 'no'],
        patterns: /\b(am|is|are|have|has|can|could|would|should|what|where|when|why|how)\b/gi
      },
      id: {
        common: ['dan', 'di', 'yang', 'untuk', 'dari', 'ini', 'itu', 'dengan', 'pada', 'ke'],
        indicators: ['halo', 'terima kasih', 'maaf', 'selamat', 'sampai jumpa', 'ya', 'tidak'],
        patterns: /\b(saya|anda|bisa|mau|harus|kapan|dimana|mengapa|bagaimana|apa)\b/gi
      }
    };

    this.systemPrompts = {
      it: `Sei ZANTARA, assistente AI di Bali Zero per la compliance in Indonesia. 
           Rispondi in italiano. Per info importanti su visti/tasse, inizia con: ⚠️ Informazione generale - verificare con le autorità competenti.`,
      en: `You are ZANTARA, Bali Zero's AI assistant for Indonesia compliance. 
           Reply in English. For important visa/tax info, start with: ⚠️ General information - verify with competent authorities.`,
      id: `Anda adalah ZANTARA, asisten AI Bali Zero untuk kepatuhan di Indonesia. 
           Jawab dalam Bahasa Indonesia. Untuk info penting visa/pajak, mulai dengan: ⚠️ Informasi umum - verifikasi dengan pihak berwenang.`
    };
  }

  detect(text) {
    const scores = [];
    const cleanText = text.toLowerCase();
    const words = cleanText.split(/\s+/);
    
    for (const [lang, config] of Object.entries(this.languagePatterns)) {
      let score = 0;
      let matches = 0;
      
      for (const word of words) {
        if (config.common.includes(word)) {
          score += 2;
          matches++;
        }
        if (config.indicators.includes(word)) {
          score += 5;
          matches++;
        }
      }
      
      const patternMatches = cleanText.match(config.patterns);
      if (patternMatches) {
        score += patternMatches.length * 3;
        matches += patternMatches.length;
      }
      
      const confidence = words.length > 0 ? (matches / words.length) * 100 : 0;
      
      scores.push({
        language: lang,
        score,
        confidence: Math.min(confidence, 100)
      });
    }
    
    scores.sort((a, b) => b.score - a.score);
    
    if (scores[0].score === 0) {
      return { language: 'en', score: 0, confidence: 0 };
    }
    
    return scores[0];
  }

  getSystemPrompt(language) {
    return this.systemPrompts[language] || this.systemPrompts.en;
  }
}

const languageDetection = new LanguageDetectionService();
module.exports = languageDetection;