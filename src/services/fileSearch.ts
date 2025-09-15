import { openai } from '../core/openai';
import { db } from '../core/firestore';

export interface SearchableDocument {
  id: string;
  title: string;
  content: string;
  category: 'kitas' | 'pt_pma' | 'tax' | 'general';
  language: 'en' | 'id' | 'it';
  lastUpdated: number;
  metadata?: Record<string, any>;
}

export interface FileSearchResult {
  id: string;
  title: string;
  excerpt: string;
  relevanceScore: number;
  category: string;
  language: string;
  metadata?: Record<string, any>;
}

class FileSearchService {
  private documents: Map<string, SearchableDocument> = new Map();
  
  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      await this.loadBaseDocuments();
      console.log('File search service initialized');
    } catch (error) {
      console.error('Failed to initialize file search:', error);
    }
  }

  private async loadBaseDocuments() {
    const baseDocuments = [
      {
        id: 'kitas_guide',
        title: 'KITAS Complete Guide',
        content: `KITAS (Kartu Izin Tinggal Terbatas) - Complete Guide

OVERVIEW:
KITAS is a temporary residence permit for foreigners in Indonesia, valid for 1-2 years and renewable.

TYPES OF KITAS:
1. Investment KITAS (PMA/PMDN)
2. Employment KITAS (Work permit)
3. Family/Spouse KITAS
4. Retirement KITAS (55+ years old)
5. Study KITAS

REQUIREMENTS FOR INVESTMENT KITAS:
- Valid passport (min. 18 months validity)
- Company registration documents (PT PMA)
- Investment proof (min. IDR 2.5 billion)
- Health certificate
- Clean criminal record (from home country)
- Passport photos (4x6 cm, red background)

PROCESS:
1. Submit application at Indonesian consulate (home country)
2. Receive entry visa
3. Enter Indonesia within 90 days
4. Apply for KITAS card at immigration office
5. Complete within 30 days of arrival

COSTS (2024):
- Application fee: $50-100 USD (varies by country)
- KITAS card fee: IDR 1,000,000
- Multiple entry permit: IDR 1,000,000
- Processing time: 7-14 working days

RENEWAL:
- Can be renewed annually
- Must be done before expiration
- Same documents required
- Processing time: 3-7 working days

IMPORTANT NOTES:
- KITAS holders can stay max 1 year per entry
- Must obtain re-entry permit for travel
- Can apply for KITAP after 5 consecutive years`,
        category: 'kitas' as const,
        language: 'en' as const,
        lastUpdated: Date.now()
      },
      {
        id: 'pt_pma_guide',
        title: 'PT PMA Setup Guide',
        content: `PT PMA (Penanaman Modal Asing) - Foreign Investment Company Guide

OVERVIEW:
PT PMA is a limited liability company for foreign investment in Indonesia.

MINIMUM INVESTMENT:
- General business: IDR 2.5 billion
- Labor intensive: IDR 500 million
- High technology: IDR 1 billion
- Export oriented: IDR 1 billion

FOREIGN OWNERSHIP:
- Most sectors: up to 100% foreign ownership
- Restricted sectors: limited percentage
- Negative investment list (DNI) applies

SETUP PROCESS:
1. Company name reservation
2. Articles of association (AoA)
3. Ministry of Law approval
4. Tax registration (NPWP)
5. Investment license (BKPM)
6. Business license (NIB via OSS)
7. Bank account opening
8. Capital injection proof

REQUIRED DOCUMENTS:
- Shareholders' passports
- Company name options (3)
- Business plan
- Investment plan
- Share composition
- Board of directors appointment
- Articles of association

TIMELINE:
- Name reservation: 1-2 days
- AoA drafting: 3-5 days
- Ministry approval: 7-14 days
- Investment license: 7-14 days
- Business license: 3-7 days
- Total: 3-6 weeks

COSTS:
- Government fees: IDR 2-5 million
- Legal fees: $2,000-5,000 USD
- Notary fees: IDR 5-10 million
- Bank account: IDR 1-2 million

POST-SETUP OBLIGATIONS:
- Monthly tax reporting
- Quarterly investment reporting
- Annual company report
- Manpower reporting
- Annual tax return

EMPLOYEE REQUIREMENTS:
- Minimum 1 Indonesian employee per foreign employee
- Work permits (ITAS) for foreign staff
- Social security registration (BPJS)`,
        category: 'pt_pma' as const,
        language: 'en' as const,
        lastUpdated: Date.now()
      },
      {
        id: 'tax_guide',
        title: 'Indonesia Tax Guide',
        content: `Indonesia Tax System Guide

PERSONAL INCOME TAX:
- Progressive rates: 5%, 15%, 25%, 30%
- Tax resident: 183+ days in Indonesia
- Annual tax return deadline: March 31

CORPORATE INCOME TAX:
- Standard rate: 22% (2024)
- Small companies (<4.8B revenue): 12.5%
- Listed companies (40%+ public): 19%

VAT (PPN):
- Standard rate: 11%
- Luxury goods tax: 10-75%
- Export: 0% (zero-rated)

WITHHOLDING TAX:
- Dividends: 10%
- Interest: 15%
- Royalties: 15%
- Services: 2%

TAX OBLIGATIONS:
- Monthly VAT return: 20th of following month
- Monthly income tax: 20th of following month
- Annual tax return: March 31
- Corporate tax return: April 30

NPWP (Tax Number):
- Required for all taxpayers
- Individual: TIN for persons
- Corporate: TIN for companies
- Processing time: 1-2 weeks

TAX INCENTIVES:
- Investment allowance
- Accelerated depreciation
- Tax holiday (5-20 years)
- Super deduction for R&D

COMMON DEDUCTIONS:
- Business expenses
- Depreciation
- Professional development
- Health insurance
- Pension contributions

PENALTIES:
- Late filing: 2% per month
- Underpayment: 2% per month
- Non-filing: 100-200% of tax due

IMPORTANT DEADLINES:
- January 31: Annual reconciliation
- March 31: Individual tax return
- April 30: Corporate tax return
- December 31: Tax year end`,
        category: 'tax' as const,
        language: 'en' as const,
        lastUpdated: Date.now()
      }
    ];

    for (const doc of baseDocuments) {
      this.documents.set(doc.id, doc);
      
      // Store in Firestore
      await db.collection('knowledgeBase').doc(doc.id).set({
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  async uploadDocument(document: SearchableDocument): Promise<string> {
    try {
      this.documents.set(document.id, document);
      
      // Store in Firestore
      await db.collection('knowledgeBase').doc(document.id).set({
        ...document,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`Uploaded document: ${document.title} (${document.id})`);
      return document.id;

    } catch (error) {
      console.error('Failed to upload document:', error);
      throw error;
    }
  }

  async uploadDocumentFromDrive(driveFileId: string, metadata: {
    title: string;
    category: 'kitas' | 'pt_pma' | 'tax' | 'general';
    language: 'en' | 'id' | 'it';
  }): Promise<string> {
    try {
      // Simplified - in production you'd download from Drive
      const document: SearchableDocument = {
        id: `drive_${driveFileId}`,
        title: metadata.title,
        content: `Document imported from Google Drive: ${driveFileId}`,
        category: metadata.category,
        language: metadata.language,
        lastUpdated: Date.now(),
        metadata: { driveFileId }
      };

      return await this.uploadDocument(document);

    } catch (error) {
      console.error('Failed to upload document from Drive:', error);
      throw error;
    }
  }

  async searchDocuments(
    query: string, 
    category?: string,
    language?: string,
    limit: number = 5
  ): Promise<FileSearchResult[]> {
    try {
      const results: FileSearchResult[] = [];
      const lowerQuery = query.toLowerCase();

      for (const [id, doc] of this.documents.entries()) {
        // Filter by category and language if specified
        if (category && doc.category !== category) continue;
        if (language && doc.language !== language) continue;

        // Simple text matching
        const titleMatch = doc.title.toLowerCase().includes(lowerQuery);
        const contentMatch = doc.content.toLowerCase().includes(lowerQuery);

        if (titleMatch || contentMatch) {
          // Calculate relevance score
          let score = 0;
          if (titleMatch) score += 0.5;
          if (contentMatch) score += 0.3;

          // Extract excerpt
          const sentences = doc.content.split('.');
          let excerpt = '';
          for (const sentence of sentences) {
            if (sentence.toLowerCase().includes(lowerQuery)) {
              excerpt = sentence.trim();
              break;
            }
          }
          if (!excerpt && sentences.length > 0) {
            excerpt = sentences[0].trim();
          }
          if (excerpt.length > 200) {
            excerpt = excerpt.substring(0, 200) + '...';
          }

          results.push({
            id,
            title: doc.title,
            excerpt,
            relevanceScore: score,
            category: doc.category,
            language: doc.language,
            metadata: doc.metadata
          });
        }
      }

      // Sort by relevance score and limit results
      return results
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

    } catch (error) {
      console.error('Failed to search documents:', error);
      throw error;
    }
  }

  async getVectorStoreFiles(): Promise<any[]> {
    try {
      const snapshot = await db.collection('knowledgeBase').get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Failed to get files:', error);
      return [];
    }
  }

  async deleteDocument(fileId: string): Promise<boolean> {
    try {
      this.documents.delete(fileId);
      await db.collection('knowledgeBase').doc(fileId).delete();
      return true;
    } catch (error) {
      console.error('Failed to delete document:', error);
      return false;
    }
  }

  getVectorStoreId(): string | null {
    return 'firestore_knowledge_base';
  }
}

export const fileSearchService = new FileSearchService();