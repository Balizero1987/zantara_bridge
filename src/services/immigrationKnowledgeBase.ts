import { db } from '../core/firestore';
import { ofetch } from 'ofetch';
import fs from 'fs';
import path from 'path';

interface ImmigrationDocument {
  id: string;
  title: string;
  category: 'visa' | 'permit' | 'tax' | 'business' | 'legal' | 'process';
  language: 'it' | 'id' | 'en';
  content: string;
  tags: string[];
  lastUpdated: number;
  version: string;
  authoritative: boolean;
  metadata: {
    source: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedReadTime: number;
    relatedDocuments: string[];
  };
}

interface KnowledgeIndex {
  keywords: Map<string, Set<string>>; // keyword -> document IDs
  entities: Map<string, Set<string>>; // entity -> document IDs
  processes: Map<string, Set<string>>; // process -> document IDs
  categories: Map<string, Set<string>>; // category -> document IDs
}

interface TrainingData {
  documents: ImmigrationDocument[];
  patterns: {
    questions: string[];
    answers: string[];
    context: string[];
  };
  entities: {
    visaTypes: string[];
    documentTypes: string[];
    processes: string[];
    institutions: string[];
    timeframes: string[];
  };
  languageAdaptations: {
    formal: Record<string, string>;
    informal: Record<string, string>;
    technical: Record<string, string>;
  };
}

class ImmigrationKnowledgeBaseService {
  private knowledgeIndex: KnowledgeIndex;
  private trainingData: TrainingData;
  private documentsCache: Map<string, ImmigrationDocument> = new Map();

  constructor() {
    this.knowledgeIndex = {
      keywords: new Map(),
      entities: new Map(),
      processes: new Map(),
      categories: new Map()
    };
    
    this.trainingData = {
      documents: [],
      patterns: {
        questions: [],
        answers: [],
        context: []
      },
      entities: {
        visaTypes: [],
        documentTypes: [],
        processes: [],
        institutions: [],
        timeframes: []
      },
      languageAdaptations: {
        formal: {},
        informal: {},
        technical: {}
      }
    };
  }

  async uploadDocumentsToDrive(): Promise<{ success: boolean; uploadedFiles: string[]; errors: string[] }> {
    const uploadedFiles: string[] = [];
    const errors: string[] = [];
    
    const documentsToUpload = [
      {
        filePath: '/Users/antonellosiano/zantara_bridge/docs/compliance/KITAS_GUIDE.md',
        driveFileName: 'KITAS_IMMIGRATION_GUIDE.md',
        category: 'visa'
      },
      {
        filePath: '/Users/antonellosiano/zantara_bridge/docs/compliance/PT_PMA_GUIDE.md',
        driveFileName: 'PT_PMA_BUSINESS_GUIDE.md',
        category: 'business'
      },
      {
        filePath: '/Users/antonellosiano/zantara_bridge/docs/compliance/TAX_GUIDE.md',
        driveFileName: 'INDONESIA_TAX_COMPLIANCE_GUIDE.md',
        category: 'tax'
      }
    ];

    for (const doc of documentsToUpload) {
      try {
        const content = await this.readAndSanitizeFile(doc.filePath);
        const success = await this.uploadToDrive(doc.driveFileName, content, doc.category);
        
        if (success) {
          uploadedFiles.push(doc.driveFileName);
          console.log(`✅ Uploaded: ${doc.driveFileName}`);
        } else {
          errors.push(`Failed to upload: ${doc.driveFileName}`);
        }
      } catch (error) {
        const errorMsg = `Error uploading ${doc.driveFileName}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return {
      success: errors.length === 0,
      uploadedFiles,
      errors
    };
  }

  private async readAndSanitizeFile(filePath: string): Promise<string> {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Sanitize content for JSON transmission
    return content
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')    // Normalize line endings
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/"/g, '\\"')    // Escape quotes
      .replace(/\t/g, '    '); // Replace tabs with spaces
  }

  private async uploadToDrive(filename: string, content: string, category: string): Promise<boolean> {
    try {
      const response = await ofetch('https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/actions/drive/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': 'test',
          'X-BZ-USER': 'boss'
        },
        body: {
          filename,
          content,
          mimeType: 'text/markdown',
          folderId: '1UGbm5er6Go351S57GQKUjmxMxHyT4QZb',
          description: `Indonesian immigration compliance document - Category: ${category}`
        }
      });
      
      return response && !response.error;
    } catch (error) {
      console.error(`Upload failed for ${filename}:`, error);
      return false;
    }
  }

  async indexImmigrationDocuments(): Promise<void> {
    const documentsPath = '/Users/antonellosiano/zantara_bridge/docs/compliance';
    const files = fs.readdirSync(documentsPath);
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        await this.processAndIndexDocument(path.join(documentsPath, file));
      }
    }
    
    // Also check the src/services/docs/compliance directory
    const srcDocsPath = '/Users/antonellosiano/zantara_bridge/src/services/docs/compliance';
    if (fs.existsSync(srcDocsPath)) {
      const srcFiles = fs.readdirSync(srcDocsPath);
      for (const file of srcFiles) {
        if (file.endsWith('.md')) {
          await this.processAndIndexDocument(path.join(srcDocsPath, file));
        }
      }
    }
    
    console.log(`📚 Indexed ${this.trainingData.documents.length} documents`);
    console.log(`🏷️ Extracted ${this.knowledgeIndex.keywords.size} unique keywords`);
    console.log(`🏢 Found ${this.trainingData.entities.institutions.length} institutions`);
  }

  private async processAndIndexDocument(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const filename = path.basename(filePath, '.md');
      
      const document: ImmigrationDocument = {
        id: this.generateDocumentId(filename),
        title: this.extractTitle(content),
        category: this.categorizeDocument(filename, content),
        language: 'en', // Default, could be enhanced with language detection
        content,
        tags: this.extractTags(content),
        lastUpdated: Date.now(),
        version: '1.0',
        authoritative: true,
        metadata: {
          source: filePath,
          difficulty: this.assessDifficulty(content),
          estimatedReadTime: Math.ceil(content.length / 1000), // Rough estimate
          relatedDocuments: []
        }
      };

      // Add to training data
      this.trainingData.documents.push(document);
      this.documentsCache.set(document.id, document);

      // Index keywords and entities
      await this.indexDocument(document);
      
      // Extract patterns for training
      this.extractTrainingPatterns(document);
      
      console.log(`📄 Processed: ${document.title}`);
      
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }

  private generateDocumentId(filename: string): string {
    return filename.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private extractTitle(content: string): string {
    const titleMatch = content.match(/^# (.+)$/m);
    return titleMatch ? titleMatch[1].trim() : 'Untitled Document';
  }

  private categorizeDocument(filename: string, content: string): ImmigrationDocument['category'] {
    const lower = filename.toLowerCase();
    const contentLower = content.toLowerCase();
    
    if (lower.includes('kitas') || lower.includes('visa') || contentLower.includes('immigration')) {
      return 'visa';
    }
    if (lower.includes('pt_pma') || lower.includes('business') || contentLower.includes('investment')) {
      return 'business';
    }
    if (lower.includes('tax') || contentLower.includes('pajak') || contentLower.includes('taxation')) {
      return 'tax';
    }
    if (contentLower.includes('process') || contentLower.includes('procedure')) {
      return 'process';
    }
    if (contentLower.includes('legal') || contentLower.includes('law')) {
      return 'legal';
    }
    
    return 'permit';
  }

  private extractTags(content: string): string[] {
    const tags = new Set<string>();
    
    // Extract common immigration terms
    const immigrationTerms = [
      'kitas', 'kitap', 'visa', 'permit', 'immigration', 'imigrasi',
      'pt pma', 'investment', 'business', 'company', 'tax', 'pajak',
      'renewal', 'application', 'process', 'requirements', 'documents'
    ];
    
    for (const term of immigrationTerms) {
      if (content.toLowerCase().includes(term)) {
        tags.add(term);
      }
    }
    
    // Extract specific document types mentioned
    const docTypeRegex = /\b(passport|certificate|agreement|contract|permit|license|approval)\b/gi;
    const docMatches = content.match(docTypeRegex);
    if (docMatches) {
      docMatches.forEach(match => tags.add(match.toLowerCase()));
    }
    
    return Array.from(tags);
  }

  private assessDifficulty(content: string): 'beginner' | 'intermediate' | 'advanced' {
    const complexTerms = ['compliance', 'regulatory', 'legislation', 'jurisdiction', 'amendments'];
    const technicalTerms = ['bkpm', 'djp', 'transfer pricing', 'withholding tax', 'depreciation'];
    
    let complexity = 0;
    const lowerContent = content.toLowerCase();
    
    complexTerms.forEach(term => {
      if (lowerContent.includes(term)) complexity += 1;
    });
    
    technicalTerms.forEach(term => {
      if (lowerContent.includes(term)) complexity += 2;
    });
    
    // Consider document length as complexity factor
    const lengthFactor = content.length > 5000 ? 1 : 0;
    complexity += lengthFactor;
    
    if (complexity >= 5) return 'advanced';
    if (complexity >= 2) return 'intermediate';
    return 'beginner';
  }

  private async indexDocument(document: ImmigrationDocument): Promise<void> {
    // Index keywords
    const keywords = this.extractKeywords(document.content);
    keywords.forEach(keyword => {
      if (!this.knowledgeIndex.keywords.has(keyword)) {
        this.knowledgeIndex.keywords.set(keyword, new Set());
      }
      this.knowledgeIndex.keywords.get(keyword)!.add(document.id);
    });

    // Index entities
    const entities = this.extractEntities(document.content);
    entities.forEach(entity => {
      if (!this.knowledgeIndex.entities.has(entity)) {
        this.knowledgeIndex.entities.set(entity, new Set());
      }
      this.knowledgeIndex.entities.get(entity)!.add(document.id);
    });

    // Index by category
    if (!this.knowledgeIndex.categories.has(document.category)) {
      this.knowledgeIndex.categories.set(document.category, new Set());
    }
    this.knowledgeIndex.categories.get(document.category)!.add(document.id);
  }

  private extractKeywords(content: string): string[] {
    const keywords = new Set<string>();
    
    // Common immigration keywords
    const immigrationKeywords = [
      'visa', 'kitas', 'kitap', 'permit', 'residence', 'immigration',
      'renewal', 'extension', 'application', 'requirements', 'documents',
      'passport', 'sponsor', 'employer', 'investment', 'business',
      'tax', 'compliance', 'reporting', 'deadline', 'penalty',
      'ministry', 'directorate', 'bkpm', 'djp', 'police', 'embassy'
    ];
    
    const lowerContent = content.toLowerCase();
    immigrationKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        keywords.add(keyword);
      }
    });
    
    // Extract proper nouns (likely to be important entities)
    const properNounRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const properNouns = content.match(properNounRegex) || [];
    properNouns.forEach(noun => {
      if (noun.length > 3 && !['The', 'This', 'That', 'With', 'From', 'Step'].includes(noun)) {
        keywords.add(noun.toLowerCase());
      }
    });
    
    return Array.from(keywords);
  }

  private extractEntities(content: string): string[] {
    const entities = new Set<string>();
    
    // Visa types
    const visaTypes = ['tourist visa', 'business visa', 'work visa', 'investment visa', 'retirement visa', 'family visa'];
    visaTypes.forEach(type => {
      if (content.toLowerCase().includes(type)) {
        entities.add(type);
        this.trainingData.entities.visaTypes.push(type);
      }
    });
    
    // Document types
    const documentTypes = ['passport', 'birth certificate', 'marriage certificate', 'police clearance', 'health certificate', 'employment contract'];
    documentTypes.forEach(type => {
      if (content.toLowerCase().includes(type)) {
        entities.add(type);
        this.trainingData.entities.documentTypes.push(type);
      }
    });
    
    // Indonesian institutions
    const institutions = ['bkpm', 'djp', 'immigration office', 'police station', 'embassy', 'consulate', 'ministry', 'directorate general'];
    institutions.forEach(inst => {
      if (content.toLowerCase().includes(inst)) {
        entities.add(inst);
        this.trainingData.entities.institutions.push(inst);
      }
    });
    
    // Time-related entities
    const timeframeRegex = /(\d+)\s+(days?|months?|years?|weeks?)/gi;
    const timeMatches = content.match(timeframeRegex) || [];
    timeMatches.forEach(timeframe => {
      entities.add(timeframe.toLowerCase());
      this.trainingData.entities.timeframes.push(timeframe.toLowerCase());
    });
    
    return Array.from(entities);
  }

  private extractTrainingPatterns(document: ImmigrationDocument): void {
    const content = document.content;
    
    // Extract FAQ-like patterns
    const questionPatterns = [
      /(?:What|How|When|Where|Why|Which).+\?/g,
      /(?:Apa|Bagaimana|Kapan|Dimana|Mengapa|Yang mana).+\?/g,
      /(?:Cosa|Come|Quando|Dove|Perché|Quale).+\?/g
    ];
    
    questionPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      this.trainingData.patterns.questions.push(...matches);
    });
    
    // Extract step-by-step processes
    const stepPatterns = /(?:Step \d+|Langkah \d+|Fase \d+):\s*(.+)/g;
    let stepMatch;
    while ((stepMatch = stepPatterns.exec(content)) !== null) {
      this.trainingData.patterns.answers.push(stepMatch[1]);
    }
    
    // Extract requirement lists
    const requirementPatterns = /(?:Required?|Diperlukan|Richiesto):\s*\n((?:[-*]\s*.+\n?)+)/g;
    let reqMatch;
    while ((reqMatch = requirementPatterns.exec(content)) !== null) {
      this.trainingData.patterns.answers.push(reqMatch[1]);
    }
  }

  async queryKnowledgeBase(
    query: string, 
    language: 'it' | 'id' | 'en' = 'en',
    category?: ImmigrationDocument['category']
  ): Promise<{
    documents: ImmigrationDocument[];
    confidence: number;
    suggestions: string[];
  }> {
    const queryKeywords = this.extractKeywords(query.toLowerCase());
    const relevantDocs = new Map<string, number>(); // docId -> relevance score
    
    // Score documents based on keyword matches
    queryKeywords.forEach(keyword => {
      const docIds = this.knowledgeIndex.keywords.get(keyword);
      if (docIds) {
        docIds.forEach(docId => {
          const currentScore = relevantDocs.get(docId) || 0;
          relevantDocs.set(docId, currentScore + 1);
        });
      }
    });
    
    // Filter by category if specified
    if (category) {
      const categoryDocs = this.knowledgeIndex.categories.get(category) || new Set();
      Array.from(relevantDocs.keys()).forEach(docId => {
        if (!categoryDocs.has(docId)) {
          relevantDocs.delete(docId);
        }
      });
    }
    
    // Get top documents sorted by relevance
    const sortedDocs = Array.from(relevantDocs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([docId]) => this.documentsCache.get(docId)!)
      .filter(Boolean);
    
    // Calculate confidence based on relevance scores
    const maxScore = Math.max(...Array.from(relevantDocs.values()));
    const confidence = maxScore > 0 ? Math.min(0.9, maxScore / queryKeywords.length) : 0;
    
    // Generate suggestions based on available categories and entities
    const suggestions = this.generateSuggestions(query, category);
    
    return {
      documents: sortedDocs,
      confidence,
      suggestions
    };
  }

  private generateSuggestions(query: string, category?: string): string[] {
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Category-based suggestions
    if (!category) {
      if (lowerQuery.includes('visa') || lowerQuery.includes('kitas')) {
        suggestions.push('Try searching in the "visa" category');
      }
      if (lowerQuery.includes('business') || lowerQuery.includes('company')) {
        suggestions.push('Check the "business" category for PT PMA information');
      }
      if (lowerQuery.includes('tax') || lowerQuery.includes('pajak')) {
        suggestions.push('Look in the "tax" category for compliance information');
      }
    }
    
    // Entity-based suggestions
    if (this.trainingData.entities.visaTypes.some(type => lowerQuery.includes(type))) {
      suggestions.push('Consider searching for specific visa requirements');
    }
    
    if (this.trainingData.entities.processes.some(proc => lowerQuery.includes(proc))) {
      suggestions.push('Look for step-by-step process guides');
    }
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  async generateTrainingDataset(): Promise<{
    dataset: any[];
    statistics: {
      totalDocuments: number;
      totalPatterns: number;
      entitiesExtracted: number;
      languageCoverage: string[];
    };
  }> {
    const dataset = [];
    
    // Create training examples from documents
    for (const doc of this.trainingData.documents) {
      // Create document-based training examples
      const sections = doc.content.split(/#{2,}/); // Split by headers
      
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].trim().length > 100) { // Only use substantial sections
          dataset.push({
            input: this.generateQuestionFromSection(sections[i]),
            output: sections[i].trim(),
            context: {
              document: doc.title,
              category: doc.category,
              language: doc.language,
              difficulty: doc.metadata.difficulty
            }
          });
        }
      }
    }
    
    // Add pattern-based examples
    for (let i = 0; i < Math.min(this.trainingData.patterns.questions.length, this.trainingData.patterns.answers.length); i++) {
      dataset.push({
        input: this.trainingData.patterns.questions[i],
        output: this.trainingData.patterns.answers[i],
        context: {
          type: 'pattern',
          category: 'general'
        }
      });
    }
    
    const statistics = {
      totalDocuments: this.trainingData.documents.length,
      totalPatterns: this.trainingData.patterns.questions.length + this.trainingData.patterns.answers.length,
      entitiesExtracted: Object.values(this.trainingData.entities).reduce((sum, arr) => sum + arr.length, 0),
      languageCoverage: Array.from(new Set(this.trainingData.documents.map(d => d.language)))
    };
    
    return { dataset, statistics };
  }

  private generateQuestionFromSection(section: string): string {
    const titleMatch = section.match(/^(.+?)\n/);
    const title = titleMatch ? titleMatch[1].trim() : 'Information';
    
    // Generate different types of questions based on content
    if (section.toLowerCase().includes('requirement')) {
      return `What are the requirements for ${title.toLowerCase()}?`;
    }
    if (section.toLowerCase().includes('process') || section.toLowerCase().includes('step')) {
      return `How do I complete the ${title.toLowerCase()} process?`;
    }
    if (section.toLowerCase().includes('document')) {
      return `What documents are needed for ${title.toLowerCase()}?`;
    }
    if (section.toLowerCase().includes('timeline') || section.toLowerCase().includes('duration')) {
      return `How long does ${title.toLowerCase()} take?`;
    }
    
    return `Tell me about ${title.toLowerCase()}`;
  }

  async saveTrainingData(): Promise<void> {
    try {
      // Convert Maps to plain objects for Firestore compatibility
      const firestoreCompatibleData = {
        documents: this.trainingData.documents.map(doc => ({
          ...doc,
          // Ensure no undefined values
          metadata: {
            ...doc.metadata,
            relatedDocuments: doc.metadata.relatedDocuments || []
          }
        })),
        patterns: this.trainingData.patterns,
        entities: this.trainingData.entities,
        languageAdaptations: this.trainingData.languageAdaptations,
        indexStatistics: {
          keywords: this.knowledgeIndex.keywords.size,
          entities: this.knowledgeIndex.entities.size,
          processes: this.knowledgeIndex.processes.size,
          categories: this.knowledgeIndex.categories.size
        },
        lastUpdated: Date.now(),
        version: '1.0'
      };

      // Save main training data
      await db.collection('knowledgeBase').doc('immigration').set(firestoreCompatibleData);
      
      // Save keyword index separately (smaller chunks)
      const keywordEntries = Array.from(this.knowledgeIndex.keywords.entries());
      const keywordBatches = this.chunkArray(keywordEntries, 100);
      
      for (let i = 0; i < keywordBatches.length; i++) {
        const batch = keywordBatches[i];
        const batchData = Object.fromEntries(batch.map(([k, v]) => [k, Array.from(v)]));
        await db.collection('knowledgeBase').doc(`immigration_keywords_${i}`).set({
          data: batchData,
          batchIndex: i,
          totalBatches: keywordBatches.length
        });
      }
      
      // Save entity index separately
      const entityEntries = Array.from(this.knowledgeIndex.entities.entries());
      const entityData = Object.fromEntries(entityEntries.map(([k, v]) => [k, Array.from(v)]));
      await db.collection('knowledgeBase').doc('immigration_entities').set({
        data: entityData
      });
      
      console.log('✅ Training data saved to Firestore');
    } catch (error) {
      console.error('Error saving training data:', error);
      // Continue without throwing to allow the rest of the process to complete
      console.log('⚠️ Continuing without saving to Firestore...');
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async loadTrainingData(): Promise<void> {
    try {
      const doc = await db.collection('knowledgeBase').doc('immigration').get();
      if (doc.exists) {
        const data = doc.data();
        this.trainingData = data.trainingData;
        
        // Reconstruct Maps from arrays
        const index = data.knowledgeIndex;
        this.knowledgeIndex.keywords = new Map(index.keywords.map(([k, v]: [string, string[]]) => [k, new Set(v)]));
        this.knowledgeIndex.entities = new Map(index.entities.map(([k, v]: [string, string[]]) => [k, new Set(v)]));
        this.knowledgeIndex.processes = new Map(index.processes.map(([k, v]: [string, string[]]) => [k, new Set(v)]));
        this.knowledgeIndex.categories = new Map(index.categories.map(([k, v]: [string, string[]]) => [k, new Set(v)]));
        
        console.log('✅ Training data loaded from Firestore');
      }
    } catch (error) {
      console.error('Error loading training data:', error);
    }
  }

  getStatistics(): {
    documents: number;
    keywords: number;
    entities: number;
    categories: number;
    lastUpdated?: Date;
  } {
    return {
      documents: this.trainingData.documents.length,
      keywords: this.knowledgeIndex.keywords.size,
      entities: this.knowledgeIndex.entities.size,
      categories: this.knowledgeIndex.categories.size,
      lastUpdated: new Date()
    };
  }
}

export default new ImmigrationKnowledgeBaseService();
export { ImmigrationDocument, TrainingData, KnowledgeIndex };