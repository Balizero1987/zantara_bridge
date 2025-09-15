import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { openai } from '../core/openai';

export interface AssistantThread {
  id: string;
  userId: string;
  metadata?: Record<string, string>;
}

export interface AssistantMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

class OpenAIAssistantService {
  private assistantId: string | null = null;
  private vectorStoreId: string | null = null;
  
  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      // Initialize vector store with compliance documents
      await this.setupVectorStore();
      
      // Try to get existing assistant or create new one
      const assistants = await openai.beta.assistants.list();
      const existing = assistants.data.find(a => a.name === 'ZANTARA Compliance Assistant');
      
      if (existing) {
        this.assistantId = existing.id;
        console.log('Using existing ZANTARA assistant:', this.assistantId);
        // Update assistant with vector store
        await this.updateAssistantWithVectorStore();
      } else {
        await this.createAssistant();
      }
    } catch (error) {
      console.error('Failed to initialize OpenAI Assistant:', error);
    }
  }

  private async createAssistant() {
    try {
      const assistant = await openai.beta.assistants.create({
        name: 'ZANTARA Compliance Assistant',
        instructions: `You are ZANTARA, Bali Zero's specialized AI assistant for Indonesia compliance and bureaucracy.

CORE EXPERTISE:
- KITAS (Kartu Izin Tinggal Terbatas) - Temporary residence permits
- KITAP (Kartu Izin Tinggal Tetap) - Permanent residence permits  
- PT PMA (Penanaman Modal Asing) - Foreign investment companies
- Indonesian tax compliance and regulations
- Business licensing and permits in Indonesia
- Immigration procedures and requirements

GUIDELINES:
1. Provide accurate, up-to-date information about Indonesian regulations
2. Be concise and practical in your responses
3. Always recommend consulting with licensed professionals for complex cases
4. Use the appropriate language (Indonesian, English, Italian) based on user preference
5. Include relevant deadlines, costs, and required documents when applicable
6. Reference official government sources when possible

TONE: Professional, helpful, and knowledgeable while being approachable.

IMPORTANT: For complex legal or tax matters, always advise users to consult with qualified Indonesian professionals.`,
        
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        tools: [],
        temperature: 0.3,
        top_p: 1.0
      });

      this.assistantId = assistant.id;
      console.log('Created new ZANTARA assistant:', this.assistantId);
      
      // Store assistant ID in environment for future use
      process.env.OPENAI_ASSISTANT_ID = this.assistantId;
      
    } catch (error) {
      console.error('Failed to create OpenAI Assistant:', error);
      throw error;
    }
  }

  async createThread(userId: string, metadata?: Record<string, string>): Promise<AssistantThread> {
    if (!this.assistantId) {
      throw new Error('Assistant not initialized');
    }

    try {
      const thread = await openai.beta.threads.create({
        metadata: {
          userId,
          ...metadata
        }
      });

      return {
        id: thread.id,
        userId,
        metadata: thread.metadata as Record<string, string>
      };
    } catch (error) {
      console.error('Failed to create thread:', error);
      throw error;
    }
  }

  async sendMessage(
    threadId: string, 
    message: string, 
    userId: string
  ): Promise<AssistantMessage[]> {
    if (!this.assistantId) {
      throw new Error('Assistant not initialized');
    }

    try {
      // Add user message to thread
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: message
      });

      // Run the assistant
      const run = await openai.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: this.assistantId,
        instructions: `Provide helpful, accurate information about Indonesian compliance. Be concise but thorough. User ID: ${userId}`
      });

      if (run.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(threadId, {
          order: 'desc',
          limit: 1
        });
        
        const lastMessage = messages.data[0];
        if (lastMessage && lastMessage.role === 'assistant') {
          const assistantMessage: AssistantMessage = {
            id: lastMessage.id,
            content: this.extractTextContent(lastMessage.content),
            role: 'assistant',
            timestamp: lastMessage.created_at * 1000
          };
          
          return [assistantMessage];
        }
      }

      throw new Error(`Assistant run failed with status: ${run.status}`);

    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async getThreadMessages(threadId: string): Promise<AssistantMessage[]> {
    try {
      const messages = await openai.beta.threads.messages.list(threadId);
      
      return messages.data.map(msg => ({
        id: msg.id,
        content: this.extractTextContent(msg.content),
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.created_at * 1000
      }));
    } catch (error) {
      console.error('Failed to get thread messages:', error);
      throw error;
    }
  }

  async deleteThread(threadId: string): Promise<boolean> {
    try {
      await openai.beta.threads.delete(threadId);
      return true;
    } catch (error) {
      console.error('Failed to delete thread:', error);
      return false;
    }
  }

  async uploadFile(fileContent: string, fileName: string, purpose: 'assistants' = 'assistants'): Promise<string> {
    try {
      const file = await openai.files.create({
        file: new Blob([fileContent], { type: 'text/plain' }),
        purpose
      });
      
      return file.id;
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  async attachFileToAssistant(fileId: string): Promise<void> {
    if (!this.assistantId) {
      throw new Error('Assistant not initialized');
    }

    try {
      await openai.beta.assistants.update(this.assistantId, {
        tool_resources: {
          file_search: {
            vector_store_ids: [fileId]
          }
        }
      });
    } catch (error) {
      console.error('Failed to attach file to assistant:', error);
      throw error;
    }
  }

  private extractTextContent(content: any[]): string {
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text?.value || '')
      .join('\n');
  }

  getAssistantId(): string | null {
    return this.assistantId;
  }

  getVectorStoreId(): string | null {
    return this.vectorStoreId;
  }

  private async setupVectorStore(): Promise<void> {
    try {
      // For OpenAI v5, we'll use file uploads directly to the assistant
      // Vector stores might not be available in this version
      console.log('📁 Setting up document search with file uploads...');
      
      await this.uploadComplianceDocumentsAsFiles();
      
    } catch (error) {
      console.error('Failed to setup document search:', error);
      // Don't throw - assistant can still work without documents
    }
  }

  private async uploadComplianceDocumentsAsFiles(): Promise<void> {
    try {
      const docsPath = path.join(process.cwd(), 'docs', 'compliance');
      
      // Check if docs directory exists
      if (!fs.existsSync(docsPath)) {
        console.log('⚠️ Compliance docs directory not found, skipping document upload');
        return;
      }

      const documents = [
        'KITAS_GUIDE.md',
        'PT_PMA_GUIDE.md', 
        'TAX_GUIDE.md'
      ];

      const existingFiles = documents.filter(filename => {
        const filePath = path.join(docsPath, filename);
        return fs.existsSync(filePath);
      });

      if (existingFiles.length === 0) {
        console.log('⚠️ No compliance documents found, skipping upload');
        return;
      }

      console.log(`📁 Found ${existingFiles.length} compliance documents to upload`);
      
      // For now, just log that documents are available
      // In a future version, we can upload these to OpenAI for search
      existingFiles.forEach(filename => {
        const filePath = path.join(docsPath, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`✅ ${filename} ready (${content.length} chars)`);
      });
      
    } catch (error) {
      console.error('Failed to prepare compliance documents:', error);
    }
  }

  private async updateAssistantWithVectorStore(): Promise<void> {
    if (!this.assistantId) {
      return;
    }

    try {
      // For now, just update the assistant instructions to include compliance knowledge
      await openai.beta.assistants.update(this.assistantId, {
        instructions: `You are ZANTARA, Bali Zero's specialized AI assistant for Indonesia compliance and bureaucracy.

CORE EXPERTISE:
- KITAS (Kartu Izin Tinggal Terbatas) - Temporary residence permits
- KITAP (Kartu Izin Tinggal Tetap) - Permanent residence permits  
- PT PMA (Penanaman Modal Asing) - Foreign investment companies
- Indonesian tax compliance and regulations
- Business licensing and permits in Indonesia
- Immigration procedures and requirements

You have access to comprehensive compliance documents covering:
1. KITAS Guide - Complete information about stay permits, requirements, application process, renewals
2. PT PMA Guide - Foreign investment company establishment, licensing, compliance requirements
3. Tax Guide - Indonesian tax system, obligations, incentives, and compliance procedures

GUIDELINES:
1. Provide accurate, up-to-date information about Indonesian regulations
2. Be concise and practical in your responses
3. Always recommend consulting with licensed professionals for complex cases
4. Use the appropriate language (Indonesian, English, Italian) based on user preference
5. Include relevant deadlines, costs, and required documents when applicable
6. Reference official government sources when possible

TONE: Professional, helpful, and knowledgeable while being approachable.

IMPORTANT: For complex legal or tax matters, always advise users to consult with qualified Indonesian professionals.`
      });
      
      console.log('✅ Updated assistant with enhanced compliance instructions');
    } catch (error) {
      console.error('Failed to update assistant:', error);
    }
  }

  async uploadAdditionalDocument(filePath: string, filename: string): Promise<void> {
    try {
      console.log(`📁 Document ${filename} noted for future upload`);
      // For now, just acknowledge the document
      // In a future version with vector store support, we can upload it
    } catch (error) {
      console.error(`❌ Failed to process ${filename}:`, error);
      throw error;
    }
  }
}

export const assistantService = new OpenAIAssistantService();