import express from 'express';
import languageLearningFeedback from '../../services/languageLearningFeedback';
import multilingualContextAwareness from '../../services/multilingualContextAwareness';
import modularLanguageEngine from '../../core/modularLanguageEngine';
import enhancedLanguageTraining from '../../services/enhancedLanguageTraining';

const router = express.Router();

// Record user feedback for language learning
router.post('/feedback', async (req, res) => {
  try {
    const { userId, sessionId, ...feedbackData } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    await languageLearningFeedback.recordUserFeedback(userId, sessionId || 'default', feedbackData);
    
    res.json({ 
      success: true, 
      message: 'Feedback recorded successfully' 
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

// Get user learning analytics
router.get('/analytics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'weekly' } = req.query;
    
    const analytics = await languageLearningFeedback.generateLearningAnalytics(
      userId, 
      period as 'daily' | 'weekly' | 'monthly'
    );
    
    res.json(analytics);
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// Get personalized learning insights
router.get('/insights/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const insights = await languageLearningFeedback.provideLearningInsights(userId);
    
    res.json(insights);
  } catch (error) {
    console.error('Error providing insights:', error);
    res.status(500).json({ error: 'Failed to provide insights' });
  }
});

// Get conversation context summary
router.get('/context/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId = 'default' } = req.query;
    
    const contextSummary = await multilingualContextAwareness.getContextSummary(
      userId, 
      sessionId as string
    );
    
    if (!contextSummary) {
      return res.status(404).json({ error: 'Context not found' });
    }
    
    res.json(contextSummary);
  } catch (error) {
    console.error('Error getting context:', error);
    res.status(500).json({ error: 'Failed to get context' });
  }
});

// Process message with enhanced language capabilities
router.post('/process', async (req, res) => {
  try {
    const { userId, message, sessionId = 'default' } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ error: 'User ID and message are required' });
    }
    
    // Analyze conversation context
    const conversationContext = await multilingualContextAwareness.analyzeMessage(
      userId, 
      message, 
      sessionId
    );
    
    // Process through language engine
    const languageInput = {
      text: message,
      userId,
      context: {
        previousMessages: conversationContext.messages.slice(-5).map(m => m.text),
        topic: conversationContext.topics[0],
        urgency: conversationContext.urgency,
        formality: conversationContext.culturalMarkers.includes('formal_context') ? 'formal' : 'informal'
      },
      metadata: {
        timestamp: Date.now(),
        source: 'api',
        platform: 'zantara'
      }
    };
    
    const languageProcessing = await modularLanguageEngine.processLanguageInput(languageInput);
    
    // Generate contextual response
    const contextualResponse = await multilingualContextAwareness.generateContextualResponse(
      conversationContext,
      languageProcessing.processedText
    );
    
    res.json({
      conversationContext: {
        language: conversationContext.language,
        topics: conversationContext.topics,
        sentiment: conversationContext.sentiment,
        urgency: conversationContext.urgency,
        culturalMarkers: conversationContext.culturalMarkers
      },
      languageProcessing: {
        detectedLanguage: languageProcessing.detectedLanguage,
        confidence: languageProcessing.confidence,
        suggestions: languageProcessing.suggestions,
        culturalNotes: languageProcessing.culturalNotes,
        nextActions: languageProcessing.nextActions
      },
      contextualResponse,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Generate adaptive response for given text
router.post('/adaptive-response', async (req, res) => {
  try {
    const { userId, originalResponse, userMessage, context = {} } = req.body;
    
    if (!userId || !originalResponse || !userMessage) {
      return res.status(400).json({ 
        error: 'User ID, original response, and user message are required' 
      });
    }
    
    const adaptiveResponse = await languageLearningFeedback.generateAdaptiveResponse(
      userId,
      originalResponse,
      userMessage,
      context
    );
    
    res.json(adaptiveResponse);
  } catch (error) {
    console.error('Error generating adaptive response:', error);
    res.status(500).json({ error: 'Failed to generate adaptive response' });
  }
});

// Get user language preferences
router.get('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const preferences = await enhancedLanguageTraining.getUserLanguagePreferences(userId);
    
    res.json(preferences);
  } catch (error) {
    console.error('Error getting preferences:', error);
    res.status(500).json({ error: 'Failed to get language preferences' });
  }
});

// Record language correction
router.post('/correction', async (req, res) => {
  try {
    const { userId, original, corrected, reason, language } = req.body;
    
    if (!userId || !original || !corrected || !reason || !language) {
      return res.status(400).json({ 
        error: 'All fields (userId, original, corrected, reason, language) are required' 
      });
    }
    
    await enhancedLanguageTraining.recordLanguageCorrection(
      userId,
      original,
      corrected,
      reason,
      language
    );
    
    res.json({ 
      success: true, 
      message: 'Language correction recorded successfully' 
    });
  } catch (error) {
    console.error('Error recording correction:', error);
    res.status(500).json({ error: 'Failed to record language correction' });
  }
});

// Get language engine stats
router.get('/engine/stats', async (req, res) => {
  try {
    const stats = modularLanguageEngine.getProcessingStats();
    
    res.json({
      engineStats: stats,
      activeContexts: multilingualContextAwareness.getActiveContexts(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting engine stats:', error);
    res.status(500).json({ error: 'Failed to get engine stats' });
  }
});

// Test specific language module
router.post('/engine/test-module', async (req, res) => {
  try {
    const { moduleName, input } = req.body;
    
    if (!moduleName || !input) {
      return res.status(400).json({ 
        error: 'Module name and input are required' 
      });
    }
    
    const result = await modularLanguageEngine.testModule(moduleName, input);
    
    if (!result) {
      return res.status(404).json({ error: 'Module not found' });
    }
    
    res.json({
      moduleName,
      input,
      result,
      testedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing module:', error);
    res.status(500).json({ error: 'Failed to test module' });
  }
});

// Get available language modules
router.get('/engine/modules', async (req, res) => {
  try {
    const modules = modularLanguageEngine.getAvailableModules();
    
    const moduleDetails = modules.map(moduleName => {
      const status = modularLanguageEngine.getModuleStatus(moduleName);
      return {
        name: moduleName,
        status
      };
    });
    
    res.json({
      modules: moduleDetails,
      totalModules: modules.length
    });
  } catch (error) {
    console.error('Error getting modules:', error);
    res.status(500).json({ error: 'Failed to get modules' });
  }
});

// Enable/disable language module
router.patch('/engine/modules/:moduleName', async (req, res) => {
  try {
    const { moduleName } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ 
        error: 'Enabled field must be a boolean' 
      });
    }
    
    if (enabled) {
      modularLanguageEngine.enableModule(moduleName);
    } else {
      modularLanguageEngine.disableModule(moduleName);
    }
    
    const status = modularLanguageEngine.getModuleStatus(moduleName);
    
    res.json({
      moduleName,
      status,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({ error: 'Failed to update module' });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        languageLearningFeedback: 'operational',
        multilingualContextAwareness: 'operational',
        modularLanguageEngine: 'operational',
        enhancedLanguageTraining: 'operational'
      },
      stats: {
        activeContexts: multilingualContextAwareness.getActiveContexts(),
        engineStats: modularLanguageEngine.getProcessingStats()
      }
    };
    
    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;