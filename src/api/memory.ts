import { Router, Request, Response } from "express";
import { firestoreMemory } from "../services/firestoreMemory";

const router = Router();

// POST /actions/memory/save
router.post("/save", async (req: Request, res: Response) => {
  try {
    const { userId, content, title, tags, category, source, metadata } = req.body;
    
    if (!userId || !content) {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing required fields: userId and content" 
      });
    }

    const entryId = await firestoreMemory.saveEntry({
      userId,
      content,
      title,
      tags: Array.isArray(tags) ? tags : [],
      category,
      source,
      relevanceScore: 1.0, // Default relevance
      metadata: metadata || {}
    });

    return res.json({ 
      ok: true, 
      data: { 
        id: entryId,
        message: "Memory entry saved successfully"
      } 
    });
  } catch (error: any) {
    console.error('Memory save error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Failed to save memory entry" 
    });
  }
});

// GET /actions/memory/search
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { 
      userId, 
      query, 
      tags, 
      category, 
      limit, 
      minRelevanceScore,
      timeStart,
      timeEnd 
    } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing required parameter: userId" 
      });
    }

    const searchOptions: any = {
      userId: userId as string,
      query: query as string,
      category: category as string,
      limit: limit ? parseInt(limit as string) : 50,
      minRelevanceScore: minRelevanceScore ? parseFloat(minRelevanceScore as string) : undefined
    };

    if (tags) {
      searchOptions.tags = Array.isArray(tags) ? tags : [tags];
    }

    if (timeStart && timeEnd) {
      searchOptions.timeRange = {
        start: parseInt(timeStart as string),
        end: parseInt(timeEnd as string)
      };
    }

    const entries = await firestoreMemory.searchEntries(searchOptions);

    return res.json({ 
      ok: true, 
      data: { 
        items: entries,
        count: entries.length
      } 
    });
  } catch (error: any) {
    console.error('Memory search error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Failed to search memory entries" 
    });
  }
});

// GET /actions/memory/stats
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing required parameter: userId" 
      });
    }

    const stats = await firestoreMemory.getStats(userId as string);

    return res.json({ 
      ok: true, 
      data: stats 
    });
  } catch (error: any) {
    console.error('Memory stats error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Failed to get memory stats" 
    });
  }
});

// GET /actions/memory/recent
router.get("/recent", async (req: Request, res: Response) => {
  try {
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing required parameter: userId" 
      });
    }

    const entries = await firestoreMemory.getRecentEntries(
      userId as string, 
      limit ? parseInt(limit as string) : 10
    );

    return res.json({ 
      ok: true, 
      data: { 
        items: entries,
        count: entries.length
      } 
    });
  } catch (error: any) {
    console.error('Memory recent error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Failed to get recent entries" 
    });
  }
});

// GET /actions/memory/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    const entry = await firestoreMemory.getEntry(id, userId as string);

    if (!entry) {
      return res.status(404).json({ 
        ok: false, 
        error: "Memory entry not found" 
      });
    }

    return res.json({ 
      ok: true, 
      data: entry 
    });
  } catch (error: any) {
    console.error('Memory get error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Failed to get memory entry" 
    });
  }
});

// PUT /actions/memory/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    await firestoreMemory.updateEntry(id, updates);

    return res.json({ 
      ok: true, 
      data: { 
        id,
        message: "Memory entry updated successfully"
      } 
    });
  } catch (error: any) {
    console.error('Memory update error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Failed to update memory entry" 
    });
  }
});

// DELETE /actions/memory/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    await firestoreMemory.deleteEntry(id, userId as string);

    return res.json({ 
      ok: true, 
      data: { 
        id,
        message: "Memory entry deleted successfully"
      } 
    });
  } catch (error: any) {
    console.error('Memory delete error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Failed to delete memory entry" 
    });
  }
});

// POST /actions/memory/cleanup
router.post("/cleanup", async (req: Request, res: Response) => {
  try {
    const { userId, maxEntries, minRelevanceScore, maxAgeInDays } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing required field: userId" 
      });
    }

    const deletedCount = await firestoreMemory.cleanupEntries(userId, {
      maxEntries,
      minRelevanceScore,
      maxAgeInDays
    });

    return res.json({ 
      ok: true, 
      data: { 
        deletedCount,
        message: `Cleaned up ${deletedCount} memory entries`
      } 
    });
  } catch (error: any) {
    console.error('Memory cleanup error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Failed to cleanup memory entries" 
    });
  }
});

export default router;
