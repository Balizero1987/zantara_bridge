import { db } from '../core/firestore';
import { assistantService, AssistantThread } from './openaiAssistant';

export interface CollaboratorThread {
  id: string;
  threadId: string;
  userId: string;
  collaborators: string[];
  title?: string;
  category?: 'kitas' | 'pt_pma' | 'tax' | 'general';
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  userId: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  metadata?: Record<string, any>;
}

class ThreadManager {
  private readonly COLLECTION = 'assistantThreads';
  private readonly MESSAGES_COLLECTION = 'threadMessages';

  async createCollaboratorThread(
    userId: string,
    collaborators: string[] = [],
    options: {
      title?: string;
      category?: 'kitas' | 'pt_pma' | 'tax' | 'general';
      metadata?: Record<string, any>;
    } = {}
  ): Promise<CollaboratorThread> {
    try {
      // Create OpenAI thread
      const assistantThread = await assistantService.createThread(userId, {
        category: options.category || 'general',
        collaborators: collaborators.join(',')
      });

      // Create local thread record
      const threadData: CollaboratorThread = {
        id: assistantThread.id,
        threadId: assistantThread.id,
        userId,
        collaborators: [...new Set([userId, ...collaborators])], // Include creator and dedup
        title: options.title || `Thread ${new Date().toISOString().slice(0, 10)}`,
        category: options.category || 'general',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
        metadata: options.metadata || {}
      };

      await db.collection(this.COLLECTION).doc(assistantThread.id).set(threadData);

      console.log(`Created collaborator thread ${assistantThread.id} for user ${userId}`);
      return threadData;

    } catch (error) {
      console.error('Failed to create collaborator thread:', error);
      throw error;
    }
  }

  async addCollaborator(threadId: string, userId: string, newCollaborator: string): Promise<boolean> {
    try {
      const threadRef = db.collection(this.COLLECTION).doc(threadId);
      const threadDoc = await threadRef.get();

      if (!threadDoc.exists) {
        throw new Error('Thread not found');
      }

      const threadData = threadDoc.data() as CollaboratorThread;

      // Check if user has permission to add collaborators
      if (!threadData.collaborators.includes(userId)) {
        throw new Error('Permission denied: Not a collaborator');
      }

      // Add new collaborator if not already present
      if (!threadData.collaborators.includes(newCollaborator)) {
        const updatedCollaborators = [...threadData.collaborators, newCollaborator];
        
        await threadRef.update({
          collaborators: updatedCollaborators,
          updatedAt: Date.now()
        });

        console.log(`Added collaborator ${newCollaborator} to thread ${threadId}`);
        return true;
      }

      return false; // Already a collaborator
    } catch (error) {
      console.error('Failed to add collaborator:', error);
      throw error;
    }
  }

  async sendMessage(
    threadId: string, 
    userId: string, 
    message: string
  ): Promise<ThreadMessage[]> {
    try {
      // Verify user has access to thread
      const threadRef = db.collection(this.COLLECTION).doc(threadId);
      const threadDoc = await threadRef.get();

      if (!threadDoc.exists) {
        throw new Error('Thread not found');
      }

      const threadData = threadDoc.data() as CollaboratorThread;
      
      if (!threadData.collaborators.includes(userId)) {
        throw new Error('Permission denied: Not a collaborator');
      }

      // Send message via OpenAI Assistant
      const assistantMessages = await assistantService.sendMessage(threadId, message, userId);

      // Store all messages in Firestore
      const batch = db.batch();
      const storedMessages: ThreadMessage[] = [];

      for (const msg of assistantMessages) {
        const messageData: ThreadMessage = {
          id: msg.id,
          threadId,
          userId: msg.role === 'user' ? userId : 'assistant',
          content: msg.content,
          role: msg.role,
          timestamp: msg.timestamp,
          metadata: {}
        };

        const messageRef = db.collection(this.MESSAGES_COLLECTION).doc(msg.id);
        batch.set(messageRef, messageData);
        storedMessages.push(messageData);
      }

      // Update thread timestamp
      batch.update(threadRef, { updatedAt: Date.now() });

      await batch.commit();

      return storedMessages;

    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async getThreadMessages(threadId: string, userId: string): Promise<ThreadMessage[]> {
    try {
      // Verify access
      const threadDoc = await db.collection(this.COLLECTION).doc(threadId).get();
      if (!threadDoc.exists) {
        throw new Error('Thread not found');
      }

      const threadData = threadDoc.data() as CollaboratorThread;
      if (!threadData.collaborators.includes(userId)) {
        throw new Error('Permission denied: Not a collaborator');
      }

      // Get messages from Firestore
      const messagesSnapshot = await db.collection(this.MESSAGES_COLLECTION)
        .where('threadId', '==', threadId)
        .orderBy('timestamp', 'asc')
        .get();

      return messagesSnapshot.docs.map(doc => doc.data() as ThreadMessage);

    } catch (error) {
      console.error('Failed to get thread messages:', error);
      throw error;
    }
  }

  async getUserThreads(userId: string): Promise<CollaboratorThread[]> {
    try {
      const threadsSnapshot = await db.collection(this.COLLECTION)
        .where('collaborators', 'array-contains', userId)
        .where('isActive', '==', true)
        .orderBy('updatedAt', 'desc')
        .get();

      return threadsSnapshot.docs.map(doc => doc.data() as CollaboratorThread);

    } catch (error) {
      console.error('Failed to get user threads:', error);
      throw error;
    }
  }

  async getThreadsByCategory(
    userId: string, 
    category: 'kitas' | 'pt_pma' | 'tax' | 'general'
  ): Promise<CollaboratorThread[]> {
    try {
      const threadsSnapshot = await db.collection(this.COLLECTION)
        .where('collaborators', 'array-contains', userId)
        .where('category', '==', category)
        .where('isActive', '==', true)
        .orderBy('updatedAt', 'desc')
        .get();

      return threadsSnapshot.docs.map(doc => doc.data() as CollaboratorThread);

    } catch (error) {
      console.error('Failed to get threads by category:', error);
      throw error;
    }
  }

  async archiveThread(threadId: string, userId: string): Promise<boolean> {
    try {
      const threadRef = db.collection(this.COLLECTION).doc(threadId);
      const threadDoc = await threadRef.get();

      if (!threadDoc.exists) {
        throw new Error('Thread not found');
      }

      const threadData = threadDoc.data() as CollaboratorThread;

      // Only thread creator can archive
      if (threadData.userId !== userId) {
        throw new Error('Permission denied: Only thread creator can archive');
      }

      await threadRef.update({
        isActive: false,
        updatedAt: Date.now()
      });

      return true;

    } catch (error) {
      console.error('Failed to archive thread:', error);
      throw error;
    }
  }

  async deleteThread(threadId: string, userId: string): Promise<boolean> {
    try {
      const threadRef = db.collection(this.COLLECTION).doc(threadId);
      const threadDoc = await threadRef.get();

      if (!threadDoc.exists) {
        throw new Error('Thread not found');
      }

      const threadData = threadDoc.data() as CollaboratorThread;

      // Only thread creator can delete
      if (threadData.userId !== userId) {
        throw new Error('Permission denied: Only thread creator can delete');
      }

      // Delete OpenAI thread
      await assistantService.deleteThread(threadId);

      // Delete local thread and messages
      const batch = db.batch();
      
      // Delete thread
      batch.delete(threadRef);

      // Delete all messages
      const messagesSnapshot = await db.collection(this.MESSAGES_COLLECTION)
        .where('threadId', '==', threadId)
        .get();

      messagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      return true;

    } catch (error) {
      console.error('Failed to delete thread:', error);
      throw error;
    }
  }
}

export const threadManager = new ThreadManager();