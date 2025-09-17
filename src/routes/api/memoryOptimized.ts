import { Router, Request, Response } from 'express';
import { memoryOptimizer } from '../../services/memoryOptimizer';
import { costMonitor } from '../../services/costMonitor';
import { apiKeyGuard } from '../../middleware/authPlugin';

const router = Router();

// Apply API key authentication
router.use(apiKeyGuard);

/**
 * Save optimized memory entry
 */
router.post('/memory/save', async (req: Request, res: Response) => {
  try {
    const { content, metadata } = req.body;
    const userId = req.headers['x-bz-user'] as string || 'default';

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    const entry = await memoryOptimizer.saveMemory(userId, content, metadata);
    
    // Track API usage
    await costMonitor.trackUsage({
      service: 'openai',
      endpoint: '/memory/save',
      userId,
      tokensUsed: entry.metadata?.tokenCount || 0,
      model: 'text-embedding-3-small'
    });

    res.json({
      success: true,
      entry: {
        id: entry.id,
        relevanceScore: entry.relevanceScore,
        tokenCount: entry.metadata?.tokenCount
      }
    });
  } catch (error) {
    console.error('Error saving memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save memory'
    });
  }
});

/**
 * Search memory with semantic search
 */
router.post('/memory/search', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-bz-user'] as string || 'default';
    const { 
      query, 
      limit = 20, 
      useSemanticSearch = true,
      minRelevanceScore = 0.3,
      categories,
      timeRange 
    } = req.body;

    const entries = await memoryOptimizer.searchMemory({
      userId,
      query,
      limit,
      useSemanticSearch,
      minRelevanceScore,
      categories,
      timeRange: timeRange ? {
        start: new Date(timeRange.start),
        end: new Date(timeRange.end)
      } : undefined
    });

    // Track API usage if semantic search was used
    if (query && useSemanticSearch) {
      await costMonitor.trackUsage({
        service: 'openai',
        endpoint: '/memory/search',
        userId,
        tokensUsed: Math.ceil(query.length / 4), // Rough estimate
        model: 'text-embedding-3-small'
      });
    }

    res.json({
      success: true,
      entries: entries.map(e => ({
        id: e.id,
        content: e.content,
        relevanceScore: e.relevanceScore,
        timestamp: e.timestamp,
        metadata: e.metadata
      })),
      count: entries.length
    });
  } catch (error) {
    console.error('Error searching memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search memory'
    });
  }
});

/**
 * Prune old memories
 */
router.post('/memory/prune', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-bz-user'] as string || 'default';
    const config = req.body.config;

    const result = await memoryOptimizer.pruneMemories(userId, config);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error pruning memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to prune memory'
    });
  }
});

/**
 * Get memory statistics
 */
router.get('/memory/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-bz-user'] as string || 'default';
    
    const stats = await memoryOptimizer.getMemoryStats(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting memory stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get memory stats'
    });
  }
});

/**
 * Update relevance scores
 */
router.post('/memory/update-scores', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-bz-user'] as string || 'default';
    
    await memoryOptimizer.updateAllRelevanceScores(userId);

    res.json({
      success: true,
      message: 'Relevance scores updated'
    });
  } catch (error) {
    console.error('Error updating relevance scores:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update relevance scores'
    });
  }
});

/**
 * Get cost statistics
 */
router.get('/costs/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-bz-user'] as string || 'default';
    const period = (req.query.period as 'day' | 'week' | 'month') || 'month';
    
    const stats = await costMonitor.getUserStats(userId, period);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting cost stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cost stats'
    });
  }
});

/**
 * Set cost alert
 */
router.post('/costs/alert', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-bz-user'] as string || 'default';
    const { threshold, period = 'monthly' } = req.body;

    if (!threshold || threshold <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid threshold is required'
      });
    }

    await costMonitor.setAlert(userId, threshold, period);

    res.json({
      success: true,
      message: `Cost alert set for $${threshold} ${period}`
    });
  } catch (error) {
    console.error('Error setting cost alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set cost alert'
    });
  }
});

/**
 * Get cost projection
 */
router.get('/costs/projection', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-bz-user'] as string || 'default';
    const daysAhead = parseInt(req.query.days as string) || 30;
    
    const projection = await costMonitor.getProjection(userId, daysAhead);

    res.json({
      success: true,
      projection
    });
  } catch (error) {
    console.error('Error getting cost projection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cost projection'
    });
  }
});

/**
 * Export usage data
 */
router.get('/costs/export', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-bz-user'] as string || 'default';
    const startDate = req.query.start ? new Date(req.query.start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.end ? new Date(req.query.end as string) : new Date();
    
    const data = await costMonitor.exportUsageData(userId, startDate, endDate);

    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error exporting usage data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export usage data'
    });
  }
});

export default function registerMemoryOptimized(app: any) {
  app.use('/api/v2', router);
}