import { Request, Response, Router } from 'express';
import { openai } from '../core/openai';
import { trackDocument } from './analytics';
import { broadcastWebhookEvent, WebhookEvent } from './webhooks';

const router = Router();

interface DocumentAnalysis {
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  category: string;
  confidence: number;
  extractedData: {
    entities: Array<{ text: string; type: string; confidence: number }>;
    keywords: string[];
    language: string;
  };
  recommendations: string[];
}

interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
}

// POST /api/ai/analyze-document - Advanced document analysis
router.post('/analyze-document', async (req: Request, res: Response) => {
  try {
    const { document, fileName, analysisType = 'comprehensive' } = req.body;
    const user = req.headers['x-bz-user'] as string;

    if (!document) {
      return res.status(400).json({ error: 'Document content required' });
    }

    // Decode base64 if provided
    let content = document;
    try {
      content = Buffer.from(document, 'base64').toString('utf-8');
    } catch {
      // If not base64, use as-is
    }

    // Track document processing
    trackDocument();

    const analysis = await analyzeDocument(content, analysisType);

    // Broadcast webhook event
    await broadcastWebhookEvent(WebhookEvent.DOCUMENT_PROCESSED, {
      fileName,
      user,
      analysis: {
        category: analysis.category,
        sentiment: analysis.sentiment,
        confidence: analysis.confidence
      }
    });

    res.json({
      success: true,
      fileName,
      analysis,
      processedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Document analysis error:', error);
    res.status(500).json({ 
      error: 'Document analysis failed',
      details: error.message 
    });
  }
});

// POST /api/ai/translate - Text translation
router.post('/translate', async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage = 'en', sourceLanguage = 'auto' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text required for translation' });
    }

    const translation = await translateText(text, targetLanguage, sourceLanguage);

    res.json({
      success: true,
      translation,
      processedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Translation error:', error);
    res.status(500).json({ 
      error: 'Translation failed',
      details: error.message 
    });
  }
});

// POST /api/ai/summarize - Text summarization
router.post('/summarize', async (req: Request, res: Response) => {
  try {
    const { text, maxLength = 150, style = 'concise' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text required for summarization' });
    }

    const summary = await summarizeText(text, maxLength, style);

    res.json({
      success: true,
      summary,
      originalLength: text.length,
      summaryLength: summary.length,
      compressionRatio: Math.round((1 - summary.length / text.length) * 100),
      processedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Summarization error:', error);
    res.status(500).json({ 
      error: 'Summarization failed',
      details: error.message 
    });
  }
});

// POST /api/ai/extract-data - Extract structured data from text
router.post('/extract-data', async (req: Request, res: Response) => {
  try {
    const { text, schema } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text required for data extraction' });
    }

    const extractedData = await extractStructuredData(text, schema);

    res.json({
      success: true,
      extractedData,
      processedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Data extraction error:', error);
    res.status(500).json({ 
      error: 'Data extraction failed',
      details: error.message 
    });
  }
});

// POST /api/ai/chat-completion - Advanced chat completion
router.post('/chat-completion', async (req: Request, res: Response) => {
  try {
    const { 
      messages, 
      model = 'gpt-3.5-turbo', 
      temperature = 0.7,
      maxTokens = 1000,
      systemPrompt 
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    const chatMessages = systemPrompt 
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const completion = await openai.chat.completions.create({
      model,
      messages: chatMessages,
      temperature,
      max_tokens: maxTokens
    });

    res.json({
      success: true,
      response: completion.choices[0]?.message?.content || '',
      usage: completion.usage,
      model: completion.model,
      processedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Chat completion error:', error);
    res.status(500).json({ 
      error: 'Chat completion failed',
      details: error.message 
    });
  }
});

// Helper function: Analyze document content
async function analyzeDocument(content: string, analysisType: string): Promise<DocumentAnalysis> {
  const prompt = `Analyze the following document and provide a comprehensive analysis:

Document:
${content}

Please provide analysis in the following JSON format:
{
  "summary": "Brief summary of the document",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "sentiment": "positive|negative|neutral",
  "category": "document category (e.g., legal, technical, business, personal)",
  "confidence": 0.95,
  "extractedData": {
    "entities": [{"text": "entity", "type": "PERSON|ORG|LOCATION|DATE", "confidence": 0.9}],
    "keywords": ["keyword1", "keyword2"],
    "language": "detected language"
  },
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  });

  try {
    return JSON.parse(completion.choices[0]?.message?.content || '{}');
  } catch {
    // Fallback if JSON parsing fails
    return {
      summary: completion.choices[0]?.message?.content || 'Analysis unavailable',
      keyPoints: [],
      sentiment: 'neutral' as const,
      category: 'unknown',
      confidence: 0.5,
      extractedData: {
        entities: [],
        keywords: [],
        language: 'unknown'
      },
      recommendations: []
    };
  }
}

// Helper function: Translate text
async function translateText(text: string, targetLang: string, sourceLang: string): Promise<TranslationResult> {
  const prompt = `Translate the following text from ${sourceLang === 'auto' ? 'detected language' : sourceLang} to ${targetLang}:

Text: ${text}

Provide response in JSON format:
{
  "originalText": "original text",
  "translatedText": "translated text",
  "sourceLanguage": "detected source language",
  "targetLanguage": "${targetLang}",
  "confidence": 0.95
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1
  });

  try {
    return JSON.parse(completion.choices[0]?.message?.content || '{}');
  } catch {
    return {
      originalText: text,
      translatedText: completion.choices[0]?.message?.content || text,
      sourceLanguage: 'unknown',
      targetLanguage: targetLang,
      confidence: 0.5
    };
  }
}

// Helper function: Summarize text
async function summarizeText(text: string, maxLength: number, style: string): Promise<string> {
  const prompt = `Summarize the following text in ${style} style, maximum ${maxLength} characters:

Text: ${text}

Provide only the summary, no additional formatting.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: Math.ceil(maxLength / 3) // Rough estimate for token limit
  });

  return completion.choices[0]?.message?.content || 'Summary unavailable';
}

// Helper function: Extract structured data
async function extractStructuredData(text: string, schema?: any): Promise<any> {
  const schemaPrompt = schema 
    ? `Extract data according to this schema: ${JSON.stringify(schema)}`
    : 'Extract key data points, dates, numbers, names, and locations';

  const prompt = `${schemaPrompt} from the following text:

Text: ${text}

Provide the extracted data in JSON format.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1
  });

  try {
    return JSON.parse(completion.choices[0]?.message?.content || '{}');
  } catch {
    return {
      rawExtraction: completion.choices[0]?.message?.content || 'No data extracted',
      error: 'Failed to parse structured data'
    };
  }
}

export { router as aiRouter };