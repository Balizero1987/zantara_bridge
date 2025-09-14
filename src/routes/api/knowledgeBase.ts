import type { Router, Request, Response } from 'express';
import { uploadTextAsDoc, listDriveFiles, createDriveFolder } from '../../services/driveUpload';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  fileId: string;
  webViewLink: string;
  popularity: number;
  isPublic: boolean;
}

// In-memory search index (in production, use Elasticsearch or similar)
let knowledgeIndex: KnowledgeEntry[] = [];

// Predefined knowledge categories for Bali Zero
const KNOWLEDGE_CATEGORIES = {
  'visa-immigration': {
    name: 'Visa & Immigration',
    description: 'KITAS, KITAP, and immigration procedures',
    subcategories: ['KITAS Application', 'KITAP Process', 'Visa Extensions', 'Documentation']
  },
  'business-setup': {
    name: 'Business Setup',
    description: 'PT PMA and company registration procedures',
    subcategories: ['PT PMA Setup', 'Licenses', 'Foreign Investment', 'Company Registration']
  },
  'tax-compliance': {
    name: 'Tax & Compliance',
    description: 'Tax obligations and compliance requirements',
    subcategories: ['Income Tax', 'Corporate Tax', 'VAT', 'Tax Filing', 'NPWP']
  },
  'legal-procedures': {
    name: 'Legal Procedures',
    description: 'Legal requirements and procedures in Indonesia',
    subcategories: ['Contracts', 'Legal Documents', 'Court Procedures', 'Notarization']
  },
  'client-management': {
    name: 'Client Management',
    description: 'Client service procedures and best practices',
    subcategories: ['Onboarding', 'Communication', 'Follow-up', 'Quality Control']
  }
};

export default function registerKnowledgeBase(r: Router) {
  
  // Get knowledge base overview
  r.get('/api/knowledge', async (req: Request, res: Response) => {
    try {
      const { 
        category,
        search,
        tags,
        author,
        limit = 20,
        sortBy = 'updatedAt'
      } = req.query;
      
      let filtered = [...knowledgeIndex];
      
      // Apply filters
      if (category) {
        filtered = filtered.filter(entry => entry.category === category);
      }
      
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        filtered = filtered.filter(entry => 
          entry.title.toLowerCase().includes(searchTerm) ||
          entry.content.toLowerCase().includes(searchTerm) ||
          entry.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }
      
      if (tags) {
        const tagList = (tags as string).split(',').map(t => t.trim().toLowerCase());
        filtered = filtered.filter(entry => 
          entry.tags.some(tag => tagList.includes(tag.toLowerCase()))
        );
      }
      
      if (author) {
        filtered = filtered.filter(entry => 
          entry.author.toLowerCase() === (author as string).toLowerCase()
        );
      }
      
      // Sort results
      if (sortBy === 'popularity') {
        filtered.sort((a, b) => b.popularity - a.popularity);
      } else if (sortBy === 'createdAt') {
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else {
        filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }
      
      const results = filtered.slice(0, parseInt(limit as string));
      
      res.json({
        success: true,
        entries: results,
        total: filtered.length,
        categories: KNOWLEDGE_CATEGORIES,
        filters: { category, search, tags, author, limit, sortBy }
      });
      
    } catch (error: any) {
      console.error('Knowledge base error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve knowledge base',
        details: error.message 
      });
    }
  });
  
  // Create knowledge entry
  r.post('/api/knowledge/create', async (req: Request, res: Response) => {
    try {
      const {
        title,
        content,
        category = 'general',
        tags = [],
        author = 'anonymous',
        isPublic = true
      } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content required' });
      }
      
      // Create knowledge document
      const docContent = `# ${title}

**Category**: ${category}
**Author**: ${author}
**Tags**: ${tags.join(', ')}
**Created**: ${new Date().toISOString()}
**Public**: ${isPublic ? 'Yes' : 'No'}

---

${content}

---

*This document is part of the Bali Zero Knowledge Base*
*Category: ${KNOWLEDGE_CATEGORIES[category]?.name || category}*
      `;
      
      const document = await uploadTextAsDoc(
        docContent,
        `KB_${title.replace(/\s+/g, '_')}`,
        'SHARED_KNOWLEDGE'
      );
      
      // Create knowledge entry
      const entry: KnowledgeEntry = {
        id: generateKnowledgeId(),
        title,
        content,
        category,
        tags: Array.isArray(tags) ? tags : [],
        author,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileId: document.fileId,
        webViewLink: document.webViewLink,
        popularity: 0,
        isPublic
      };
      
      // Add to index
      knowledgeIndex.push(entry);
      
      res.json({
        success: true,
        message: 'Knowledge entry created',
        entry: entry
      });
      
    } catch (error: any) {
      console.error('Knowledge creation error:', error);
      res.status(500).json({ 
        error: 'Failed to create knowledge entry',
        details: error.message 
      });
    }
  });
  
  // Get specific knowledge entry
  r.get('/api/knowledge/:entryId', async (req: Request, res: Response) => {
    try {
      const { entryId } = req.params;
      
      const entry = knowledgeIndex.find(e => e.id === entryId);
      if (!entry) {
        return res.status(404).json({ error: 'Knowledge entry not found' });
      }
      
      // Increment popularity
      entry.popularity += 1;
      
      // Get related entries
      const related = knowledgeIndex
        .filter(e => 
          e.id !== entryId && 
          (e.category === entry.category || 
           e.tags.some(tag => entry.tags.includes(tag)))
        )
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 5);
      
      res.json({
        success: true,
        entry: entry,
        related: related.map(e => ({
          id: e.id,
          title: e.title,
          category: e.category,
          webViewLink: e.webViewLink,
          popularity: e.popularity
        }))
      });
      
    } catch (error: any) {
      console.error('Knowledge entry error:', error);
      res.status(500).json({ 
        error: 'Failed to get knowledge entry',
        details: error.message 
      });
    }
  });
  
  // Search knowledge base
  r.post('/api/knowledge/search', async (req: Request, res: Response) => {
    try {
      const {
        query,
        categories = [],
        tags = [],
        includeContent = false,
        limit = 10
      } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query required' });
      }
      
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
      
      const results = knowledgeIndex
        .filter(entry => {
          // Category filter
          if (categories.length > 0 && !categories.includes(entry.category)) {
            return false;
          }
          
          // Tags filter
          if (tags.length > 0 && !entry.tags.some(tag => tags.includes(tag))) {
            return false;
          }
          
          // Search in title, content, and tags
          const searchText = `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase();
          return searchTerms.some(term => searchText.includes(term));
        })
        .map(entry => {
          // Calculate relevance score
          const titleMatches = searchTerms.filter(term => entry.title.toLowerCase().includes(term)).length;
          const contentMatches = searchTerms.filter(term => entry.content.toLowerCase().includes(term)).length;
          const tagMatches = searchTerms.filter(term => 
            entry.tags.some(tag => tag.toLowerCase().includes(term))
          ).length;
          
          const relevanceScore = (titleMatches * 3) + contentMatches + (tagMatches * 2) + (entry.popularity * 0.1);
          
          return {
            ...entry,
            relevanceScore,
            content: includeContent ? entry.content : entry.content.substring(0, 200) + '...'
          };
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
      
      res.json({
        success: true,
        query,
        results,
        total: results.length,
        suggestions: generateSearchSuggestions(query)
      });
      
    } catch (error: any) {
      console.error('Knowledge search error:', error);
      res.status(500).json({ 
        error: 'Failed to search knowledge base',
        details: error.message 
      });
    }
  });
  
  // Get popular knowledge entries
  r.get('/api/knowledge/popular', async (req: Request, res: Response) => {
    try {
      const { category, limit = 10 } = req.query;
      
      let entries = [...knowledgeIndex];
      
      if (category) {
        entries = entries.filter(e => e.category === category);
      }
      
      const popular = entries
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, parseInt(limit as string))
        .map(entry => ({
          id: entry.id,
          title: entry.title,
          category: entry.category,
          author: entry.author,
          popularity: entry.popularity,
          webViewLink: entry.webViewLink,
          tags: entry.tags,
          updatedAt: entry.updatedAt
        }));
      
      res.json({
        success: true,
        popular,
        category: category || 'all'
      });
      
    } catch (error: any) {
      console.error('Popular knowledge error:', error);
      res.status(500).json({ 
        error: 'Failed to get popular entries',
        details: error.message 
      });
    }
  });
  
  // Initialize knowledge base with sample entries
  r.post('/api/knowledge/initialize', async (req: Request, res: Response) => {
    try {
      const sampleEntries = [
        {
          title: 'KITAS Application Process Step-by-Step',
          content: `Complete guide for KITAS application in Indonesia:

1. **Document Preparation**
   - Valid passport (min 18 months validity)
   - Sponsor letter from Indonesian company
   - Health certificate from home country
   - Criminal background check (apostilled)
   - Educational certificates (apostilled)
   - CV/Resume
   - Passport photos (4x6 cm, white background)

2. **Visa Application at Consulate**
   - Submit documents at Indonesian consulate
   - Pay visa fee ($50-100)
   - Wait for approval (5-10 working days)

3. **Arrival in Indonesia**
   - Enter Indonesia within 90 days of visa issue
   - Proceed to KITAS application immediately

4. **KITAS Application**
   - Submit documents to Immigration Office
   - Medical check-up in Indonesia
   - Biometric data collection
   - Pay KITAS fee (varies by type)
   - Wait for approval (2-4 weeks)

**Important Notes:**
- Process must be completed within 30 days of arrival
- All foreign documents require apostille/legalization
- Some documents need translation to Indonesian
- Sponsor company must have proper licenses`,
          category: 'visa-immigration',
          tags: ['KITAS', 'visa', 'immigration', 'process', 'documents'],
          author: 'BOSS'
        },
        {
          title: 'PT PMA Minimum Capital Requirements 2024',
          content: `Updated capital requirements for PT PMA (Foreign Investment Company):

**Minimum Investment:**
- General business: IDR 2.5 billion (~$165,000)
- Manufacturing: IDR 10 billion (~$660,000)
- High-tech/strategic sectors: Higher requirements

**Capital Structure:**
- Paid-up capital: Minimum 25% of authorized capital
- Authorized capital: Can be higher than minimum investment
- Foreign ownership: Up to 100% in most sectors

**Exceptions:**
- Negative Investment List (DNI) restrictions apply
- Some sectors require local partners
- Strategic sectors may have higher requirements

**Recent Changes:**
- 2024 regulations simplified some procedures
- Online submission through OSS system
- Faster approval for certain sectors

**Documentation:**
- Investment plan (detailed business plan)
- Proof of fund availability
- Technical cooperation agreement (if applicable)
- Environmental impact assessment (if required)`,
          category: 'business-setup',
          tags: ['PT PMA', 'investment', 'capital', 'foreign ownership', '2024'],
          author: 'RIRI'
        },
        {
          title: 'Indonesian Tax Obligations for Foreigners',
          content: `Tax compliance requirements for foreign residents:

**Tax Residency:**
- Physical presence: 183+ days in tax year
- Permanent establishment in Indonesia
- Tax resident = worldwide income taxable

**Income Tax Rates:**
- Employment income: Progressive (5%-35%)
- Business income: 25% corporate rate
- Investment income: Various withholding rates

**Required Registrations:**
- NPWP (Tax ID): Mandatory for tax residents
- Digital certificate for online filing
- Bank account for tax payments

**Filing Requirements:**
- Monthly: Employee tax withholding (PPh 21)
- Annual: Personal tax return (SPT)
- Quarterly: Corporate tax (if applicable)

**Common Deductions:**
- Professional development
- Health insurance premiums
- Pension contributions (limited)
- Tax treaty benefits (if applicable)

**Deadlines:**
- Annual return: March 31
- Monthly filings: 20th of following month
- Penalties for late filing: 2% per month

**Important Notes:**
- Keep all receipts and documentation
- Use authorized tax consultants for complex cases
- Consider tax treaty benefits from home country`,
          category: 'tax-compliance',
          tags: ['tax', 'NPWP', 'income tax', 'filing', 'foreigners'],
          author: 'BOSS'
        }
      ];
      
      const created = [];
      
      for (const sample of sampleEntries) {
        try {
          const docContent = `# ${sample.title}

**Category**: ${sample.category}
**Author**: ${sample.author}
**Tags**: ${sample.tags.join(', ')}
**Created**: ${new Date().toISOString()}

---

${sample.content}

---

*This document is part of the Bali Zero Knowledge Base*
          `;
          
          const document = await uploadTextAsDoc(
            docContent,
            `KB_${sample.title.replace(/\s+/g, '_')}`,
            'SHARED_KNOWLEDGE'
          );
          
          const entry: KnowledgeEntry = {
            id: generateKnowledgeId(),
            title: sample.title,
            content: sample.content,
            category: sample.category,
            tags: sample.tags,
            author: sample.author,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            fileId: document.fileId,
            webViewLink: document.webViewLink,
            popularity: Math.floor(Math.random() * 50), // Random initial popularity
            isPublic: true
          };
          
          knowledgeIndex.push(entry);
          created.push(entry.title);
        } catch (error) {
          console.error(`Failed to create sample entry: ${sample.title}`, error);
        }
      }
      
      res.json({
        success: true,
        message: 'Knowledge base initialized',
        created: created,
        total: knowledgeIndex.length
      });
      
    } catch (error: any) {
      console.error('Knowledge initialization error:', error);
      res.status(500).json({ 
        error: 'Failed to initialize knowledge base',
        details: error.message 
      });
    }
  });
}

// Helper functions
function generateKnowledgeId(): string {
  return `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSearchSuggestions(query: string): string[] {
  const commonTerms = [
    'KITAS application', 'KITAP process', 'PT PMA setup', 'tax filing',
    'visa extension', 'work permit', 'business license', 'NPWP registration',
    'immigration requirements', 'investment procedures'
  ];
  
  return commonTerms
    .filter(term => term.toLowerCase().includes(query.toLowerCase()) && term.toLowerCase() !== query.toLowerCase())
    .slice(0, 5);
}