import express from 'express';
import immigrationKnowledgeBase from '../../services/immigrationKnowledgeBase';
import { runImmigrationKnowledgeTraining } from '../../../scripts/immigrationKnowledgeTraining';

const router = express.Router();

// Get immigration knowledge statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = immigrationKnowledgeBase.getStatistics();
    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Query immigration knowledge base
router.post('/query', async (req, res) => {
  try {
    const { query, language = 'en', category } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const result = await immigrationKnowledgeBase.queryKnowledgeBase(
      query,
      language as 'it' | 'id' | 'en',
      category
    );
    
    res.json({
      success: true,
      query,
      language,
      category,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error querying knowledge base:', error);
    res.status(500).json({ error: 'Failed to query knowledge base' });
  }
});

// Upload documents to Drive
router.post('/upload-documents', async (req, res) => {
  try {
    const result = await immigrationKnowledgeBase.uploadDocumentsToDrive();
    
    res.json({
      success: result.success,
      uploadedFiles: result.uploadedFiles,
      errors: result.errors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error uploading documents:', error);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// Index immigration documents
router.post('/index-documents', async (req, res) => {
  try {
    await immigrationKnowledgeBase.indexImmigrationDocuments();
    const stats = immigrationKnowledgeBase.getStatistics();
    
    res.json({
      success: true,
      message: 'Documents indexed successfully',
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error indexing documents:', error);
    res.status(500).json({ error: 'Failed to index documents' });
  }
});

// Generate training dataset
router.post('/generate-training-data', async (req, res) => {
  try {
    const result = await immigrationKnowledgeBase.generateTrainingDataset();
    
    res.json({
      success: true,
      trainingDataset: {
        exampleCount: result.dataset.length,
        sampleExamples: result.dataset.slice(0, 3), // Show first 3 examples
        statistics: result.statistics
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating training data:', error);
    res.status(500).json({ error: 'Failed to generate training data' });
  }
});

// Save training data to Firestore
router.post('/save-training-data', async (req, res) => {
  try {
    await immigrationKnowledgeBase.saveTrainingData();
    
    res.json({
      success: true,
      message: 'Training data saved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving training data:', error);
    res.status(500).json({ error: 'Failed to save training data' });
  }
});

// Load training data from Firestore
router.post('/load-training-data', async (req, res) => {
  try {
    await immigrationKnowledgeBase.loadTrainingData();
    const stats = immigrationKnowledgeBase.getStatistics();
    
    res.json({
      success: true,
      message: 'Training data loaded successfully',
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error loading training data:', error);
    res.status(500).json({ error: 'Failed to load training data' });
  }
});

// Run complete training pipeline
router.post('/run-training', async (req, res) => {
  try {
    // This is an async operation that might take a while
    res.json({
      success: true,
      message: 'Training pipeline started',
      status: 'running',
      timestamp: new Date().toISOString()
    });

    // Run training in background
    runImmigrationKnowledgeTraining()
      .then(() => {
        console.log('✅ Training pipeline completed successfully');
      })
      .catch((error) => {
        console.error('❌ Training pipeline failed:', error);
      });

  } catch (error) {
    console.error('Error starting training:', error);
    res.status(500).json({ error: 'Failed to start training pipeline' });
  }
});

// Get training examples by category
router.get('/training-examples/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 10 } = req.query;
    
    const result = await immigrationKnowledgeBase.generateTrainingDataset();
    
    // Filter examples by category
    const categoryExamples = result.dataset.filter(example => 
      example.context.category === category || 
      (example.context.document && example.context.document.toLowerCase().includes(category.toLowerCase()))
    );
    
    const limitedExamples = categoryExamples.slice(0, parseInt(limit as string));
    
    res.json({
      success: true,
      category,
      examples: limitedExamples,
      totalFound: categoryExamples.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting training examples:', error);
    res.status(500).json({ error: 'Failed to get training examples' });
  }
});

// Search for specific immigration topics
router.get('/search/:topic', async (req, res) => {
  try {
    const { topic } = req.params;
    const { language = 'en' } = req.query;
    
    // Create comprehensive search queries for the topic
    const searchQueries = [
      `What is ${topic}?`,
      `How to apply for ${topic}?`,
      `Requirements for ${topic}`,
      `Process for ${topic}`,
      `Documents needed for ${topic}`
    ];
    
    const results = [];
    
    for (const query of searchQueries) {
      const result = await immigrationKnowledgeBase.queryKnowledgeBase(
        query,
        language as 'it' | 'id' | 'en'
      );
      
      if (result.confidence > 0.3) {
        results.push({
          query,
          ...result
        });
      }
    }
    
    res.json({
      success: true,
      topic,
      language,
      searchResults: results,
      totalQueries: searchQueries.length,
      relevantResults: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error searching topic:', error);
    res.status(500).json({ error: 'Failed to search topic' });
  }
});

// Get all available categories
router.get('/categories', async (req, res) => {
  try {
    const result = await immigrationKnowledgeBase.generateTrainingDataset();
    
    // Extract unique categories
    const categories = Array.from(new Set(
      result.dataset
        .map(example => example.context.category)
        .filter(Boolean)
    ));
    
    // Get document categories
    const documentCategories = Array.from(new Set(
      result.dataset
        .map(example => example.context.document)
        .filter(Boolean)
    ));
    
    res.json({
      success: true,
      categories: {
        general: categories,
        documents: documentCategories
      },
      statistics: result.statistics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Health check for immigration knowledge system
router.get('/health', async (req, res) => {
  try {
    const stats = immigrationKnowledgeBase.getStatistics();
    
    const health = {
      status: 'healthy',
      services: {
        knowledgeBase: stats.documents > 0 ? 'operational' : 'no_data',
        indexing: stats.keywords > 0 ? 'operational' : 'no_index',
        firestore: 'operational' // Assume operational if we can get stats
      },
      statistics: stats,
      capabilities: {
        multilingualQuery: true,
        categoryFiltering: true,
        documentIndexing: true,
        trainingDataGeneration: true
      },
      timestamp: new Date().toISOString()
    };
    
    // Determine overall health
    const hasData = stats.documents > 0 && stats.keywords > 0;
    health.status = hasData ? 'healthy' : 'degraded';
    
    const statusCode = hasData ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Export training data for external use
router.get('/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const result = await immigrationKnowledgeBase.generateTrainingDataset();
    const stats = immigrationKnowledgeBase.getStatistics();
    
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        format,
        statistics: {
          ...result.statistics,
          ...stats
        }
      },
      data: {
        trainingExamples: result.dataset,
        statistics: result.statistics
      }
    };
    
    if (format === 'csv') {
      // Convert to CSV format for easier analysis
      const csvRows = [
        ['Input', 'Output', 'Category', 'Document', 'Language', 'Difficulty'],
        ...result.dataset.map(example => [
          `"${example.input.replace(/"/g, '""')}"`,
          `"${example.output.substring(0, 200).replace(/"/g, '""')}..."`,
          example.context.category || '',
          example.context.document || '',
          example.context.language || '',
          example.context.difficulty || ''
        ])
      ];
      
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="immigration_training_data.csv"');
      res.send(csvContent);
    } else {
      res.json(exportData);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export training data' });
  }
});

export default router;