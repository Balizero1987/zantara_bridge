import { Request, Response, NextFunction } from 'express';
import { memoryOptimizer } from '../services/memoryOptimizer';
import { costMonitor } from '../services/costMonitor';

/**
 * Middleware to inject optimized memory into chat context
 */
export async function injectMemoryContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.headers['x-bz-user'] as string || 'default';
    const { message, useOptimizedMemory = true } = req.body;

    if (!useOptimizedMemory || !message) {
      return next();
    }

    // Search for relevant memory entries
    const memories = await memoryOptimizer.searchMemory({
      userId,
      query: message,
      limit: 10,
      useSemanticSearch: true,
      minRelevanceScore: 0.4
    });

    // Inject memory context into request
    (req as any).memoryContext = memories.map(m => ({
      content: m.content,
      relevance: m.relevanceScore,
      timestamp: m.timestamp
    }));

    // Track the token usage for memory retrieval
    if (memories.length > 0) {
      const totalTokens = memories.reduce((sum, m) => 
        sum + (m.metadata?.tokenCount || 0), 0
      );
      
      await costMonitor.trackUsage({
        service: 'openai',
        endpoint: 'memory-retrieval',
        userId,
        tokensUsed: totalTokens,
        model: 'text-embedding-3-small',
        metadata: {
          memoriesRetrieved: memories.length
        }
      });
    }

    next();
  } catch (error) {
    console.error('Memory middleware error:', error);
    // Don't break the request flow
    next();
  }
}

/**
 * Middleware to save conversation to optimized memory
 */
export async function saveToOptimizedMemory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Hook into response to save after completion
  const originalSend = res.send;
  
  res.send = function(data: any) {
    // Restore original send
    res.send = originalSend;
    
    // Process async after sending response
    setImmediate(async () => {
      try {
        const userId = req.headers['x-bz-user'] as string || 'default';
        const { message, saveToMemory = true } = req.body;
        
        if (!saveToMemory || !message) return;
        
        // Parse response to get AI reply
        let aiResponse = '';
        try {
          const parsed = JSON.parse(data);
          aiResponse = parsed.text || parsed.response || '';
        } catch {
          aiResponse = String(data);
        }
        
        if (!aiResponse) return;
        
        // Save conversation pair to memory
        const conversationContent = `User: ${message}\nAssistant: ${aiResponse}`;
        
        await memoryOptimizer.saveMemory(
          userId,
          conversationContent,
          {
            contextType: 'conversation',
            source: req.path
          }
        );
        
        // Periodically prune old memories (1% chance)
        if (Math.random() < 0.01) {
          await memoryOptimizer.pruneMemories(userId);
        }
      } catch (error) {
        console.error('Error saving to optimized memory:', error);
      }
    });
    
    return originalSend.call(this, data);
  };
  
  next();
}