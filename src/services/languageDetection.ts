interface LanguagePatterns {
  [key: string]: {
    keywords: string[];
    patterns: RegExp[];
    systemPrompt: string;
  };
}

class LanguageDetectionService {
  private readonly languages: LanguagePatterns = {
    it: {
      keywords: [
        'ciao', 'buongiorno', 'buonasera', 'grazie', 'prego', 'scusa',
        'come', 'cosa', 'quando', 'dove', 'perché', 'quanto',
        'visto', 'permesso', 'società', 'tasse', 'documenti',
        'informazioni', 'aiuto', 'bisogno', 'vorrei', 'posso'
      ],
      patterns: [
        /\b(sono|hai|abbiamo|avete|hanno)\b/i,
        /\b(della|dello|delle|degli)\b/i,
        /\b(il|la|lo|gli|le)\b/i
      ],
      systemPrompt: `Sei ZANTARA, l'assistente AI di Bali Zero per la compliance in Indonesia. 
Rispondi sempre in italiano. Aiuta con KITAS, KITAP, PT PMA, tasse e regolamenti indonesiani. 
Fornisci informazioni accurate e aggiornate sulla legge indonesiana. Sii conciso ma completo.
Quando appropriato, suggerisci di consultare professionisti legali per casi complessi.`
    },
    id: {
      keywords: [
        'halo', 'selamat', 'terima kasih', 'maaf', 'silakan',
        'apa', 'bagaimana', 'kapan', 'dimana', 'mengapa', 'berapa',
        'visa', 'izin', 'perusahaan', 'pajak', 'dokumen',
        'informasi', 'bantuan', 'butuh', 'ingin', 'bisa'
      ],
      patterns: [
        /\b(saya|anda|kami|kita|mereka)\b/i,
        /\b(ini|itu|tersebut)\b/i,
        /\b(di|ke|dari|untuk)\b/i
      ],
      systemPrompt: `Anda adalah ZANTARA, asisten AI Bali Zero untuk kepatuhan bisnis di Indonesia.
Selalu jawab dalam bahasa Indonesia. Bantu dengan KITAS, KITAP, PT PMA, pajak, dan peraturan.
Berikan informasi yang akurat dan terkini tentang hukum Indonesia. Ringkas namun lengkap.
Sarankan konsultasi dengan profesional hukum untuk kasus yang kompleks bila diperlukan.`
    },
    en: {
      keywords: [
        'hello', 'hi', 'thanks', 'please', 'sorry',
        'what', 'how', 'when', 'where', 'why', 'which',
        'visa', 'permit', 'company', 'tax', 'document',
        'information', 'help', 'need', 'want', 'can'
      ],
      patterns: [
        /\b(i|you|we|they|he|she)\b/i,
        /\b(the|a|an)\b/i,
        /\b(is|are|was|were|will|would)\b/i
      ],
      systemPrompt: `You are ZANTARA, Bali Zero's AI assistant for Indonesia business compliance.
Help with KITAS, KITAP, PT PMA, taxes, and Indonesian regulations.
Provide accurate, up-to-date information based on Indonesian law. Be concise yet thorough.
Suggest consulting legal professionals for complex cases when appropriate.`
    },
    es: {
      keywords: [
        'hola', 'buenos', 'gracias', 'por favor', 'disculpe',
        'qué', 'cómo', 'cuándo', 'dónde', 'por qué', 'cuál',
        'visa', 'permiso', 'empresa', 'impuestos', 'documentos',
        'información', 'ayuda', 'necesito', 'quiero', 'puedo'
      ],
      patterns: [
        /\b(yo|tú|usted|nosotros|ellos)\b/i,
        /\b(el|la|los|las|un|una)\b/i,
        /\b(es|son|está|están)\b/i
      ],
      systemPrompt: `Eres ZANTARA, el asistente de IA de Bali Zero para cumplimiento empresarial en Indonesia.
Responde siempre en español. Ayuda con KITAS, KITAP, PT PMA, impuestos y regulaciones indonesias.
Proporciona información precisa y actualizada sobre la ley indonesia. Sé conciso pero completo.
Sugiere consultar con profesionales legales para casos complejos cuando sea apropiado.`
    },
    pt: {
      keywords: [
        'olá', 'bom dia', 'obrigado', 'por favor', 'desculpe',
        'o que', 'como', 'quando', 'onde', 'por que', 'qual',
        'visto', 'licença', 'empresa', 'impostos', 'documentos',
        'informação', 'ajuda', 'preciso', 'quero', 'posso'
      ],
      patterns: [
        /\b(eu|você|nós|eles|ela)\b/i,
        /\b(o|a|os|as|um|uma)\b/i,
        /\b(é|são|está|estão)\b/i
      ],
      systemPrompt: `Você é ZANTARA, o assistente de IA da Bali Zero para conformidade empresarial na Indonésia.
Responda sempre em português. Ajude com KITAS, KITAP, PT PMA, impostos e regulamentos indonésios.
Forneça informações precisas e atualizadas sobre a lei indonésia. Seja conciso mas completo.
Sugira consultar profissionais jurídicos para casos complexos quando apropriado.`
    }
  };

  detect(text: string): { language: string; confidence: number } {
    const scores: Record<string, number> = {};
    const normalizedText = text.toLowerCase();

    for (const [lang, config] of Object.entries(this.languages)) {
      let score = 0;

      // Check keywords
      for (const keyword of config.keywords) {
        if (normalizedText.includes(keyword)) {
          score += 2;
        }
      }

      // Check patterns
      for (const pattern of config.patterns) {
        const matches = normalizedText.match(pattern);
        if (matches) {
          score += matches.length;
        }
      }

      scores[lang] = score;
    }

    // Find the language with highest score
    let detectedLang = 'en'; // Default to English
    let maxScore = 0;

    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    // Calculate confidence (0-1)
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0;

    // If confidence is too low, default to English
    if (confidence < 0.3) {
      detectedLang = 'en';
    }

    return {
      language: detectedLang,
      confidence
    };
  }

  getSystemPrompt(language: string): string {
    return this.languages[language]?.systemPrompt || this.languages.en.systemPrompt;
  }

  getSupportedLanguages(): string[] {
    return Object.keys(this.languages);
  }

  getGreeting(language: string): string {
    const greetings: Record<string, string> = {
      it: 'Ciao! Sono ZANTARA, il tuo assistente per la compliance in Indonesia. Come posso aiutarti oggi?',
      id: 'Halo! Saya ZANTARA, asisten Anda untuk kepatuhan bisnis di Indonesia. Bagaimana saya bisa membantu Anda hari ini?',
      en: 'Hello! I\'m ZANTARA, your assistant for Indonesia business compliance. How can I help you today?',
      es: '¡Hola! Soy ZANTARA, tu asistente para el cumplimiento empresarial en Indonesia. ¿Cómo puedo ayudarte hoy?',
      pt: 'Olá! Eu sou ZANTARA, seu assistente para conformidade empresarial na Indonésia. Como posso ajudá-lo hoje?'
    };

    return greetings[language] || greetings.en;
  }

  getCommonPhrases(language: string): Record<string, string> {
    const phrases: Record<string, Record<string, string>> = {
      it: {
        yes: 'Sì',
        no: 'No',
        thanks: 'Grazie',
        welcome: 'Prego',
        sorry: 'Mi dispiace',
        understand: 'Capisco',
        'need_more_info': 'Ho bisogno di più informazioni per aiutarti meglio.',
        'consult_professional': 'Ti consiglio di consultare un professionista legale per questo caso specifico.',
        'processing': 'Sto elaborando la tua richiesta...',
        'error': 'Si è verificato un errore. Per favore riprova.'
      },
      id: {
        yes: 'Ya',
        no: 'Tidak',
        thanks: 'Terima kasih',
        welcome: 'Sama-sama',
        sorry: 'Maaf',
        understand: 'Saya mengerti',
        'need_more_info': 'Saya memerlukan informasi lebih lanjut untuk membantu Anda lebih baik.',
        'consult_professional': 'Saya sarankan Anda berkonsultasi dengan profesional hukum untuk kasus ini.',
        'processing': 'Sedang memproses permintaan Anda...',
        'error': 'Terjadi kesalahan. Silakan coba lagi.'
      },
      en: {
        yes: 'Yes',
        no: 'No',
        thanks: 'Thank you',
        welcome: "You're welcome",
        sorry: "I'm sorry",
        understand: 'I understand',
        'need_more_info': 'I need more information to better assist you.',
        'consult_professional': 'I recommend consulting a legal professional for this specific case.',
        'processing': 'Processing your request...',
        'error': 'An error occurred. Please try again.'
      },
      es: {
        yes: 'Sí',
        no: 'No',
        thanks: 'Gracias',
        welcome: 'De nada',
        sorry: 'Lo siento',
        understand: 'Entiendo',
        'need_more_info': 'Necesito más información para ayudarte mejor.',
        'consult_professional': 'Te recomiendo consultar con un profesional legal para este caso.',
        'processing': 'Procesando tu solicitud...',
        'error': 'Ocurrió un error. Por favor intenta de nuevo.'
      },
      pt: {
        yes: 'Sim',
        no: 'Não',
        thanks: 'Obrigado',
        welcome: 'De nada',
        sorry: 'Desculpe',
        understand: 'Entendo',
        'need_more_info': 'Preciso de mais informações para ajudá-lo melhor.',
        'consult_professional': 'Recomendo consultar um profissional jurídico para este caso.',
        'processing': 'Processando sua solicitação...',
        'error': 'Ocorreu um erro. Por favor, tente novamente.'
      }
    };

    return phrases[language] || phrases.en;
  }
}

export default new LanguageDetectionService();