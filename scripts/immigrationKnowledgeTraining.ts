#!/usr/bin/env npx ts-node

import immigrationKnowledgeBase from '../src/services/immigrationKnowledgeBase';
import enhancedLanguageTraining from '../src/services/enhancedLanguageTraining';
import modularLanguageEngine from '../src/core/modularLanguageEngine';

async function runImmigrationKnowledgeTraining() {
  console.log('🚀 Starting Immigration Knowledge Base Training...\n');
  
  try {
    // Step 1: Upload documents to Drive
    console.log('📤 Step 1: Uploading documents to AMBARADAM Drive folder...');
    const uploadResult = await immigrationKnowledgeBase.uploadDocumentsToDrive();
    
    if (uploadResult.success) {
      console.log(`✅ Successfully uploaded ${uploadResult.uploadedFiles.length} files:`);
      uploadResult.uploadedFiles.forEach(file => console.log(`   - ${file}`));
    } else {
      console.log('❌ Some uploads failed:');
      uploadResult.errors.forEach(error => console.log(`   - ${error}`));
    }
    console.log('');
    
    // Step 2: Index all immigration documents
    console.log('📚 Step 2: Indexing immigration documents...');
    await immigrationKnowledgeBase.indexImmigrationDocuments();
    
    const stats = immigrationKnowledgeBase.getStatistics();
    console.log(`✅ Indexing complete:`);
    console.log(`   - Documents processed: ${stats.documents}`);
    console.log(`   - Keywords extracted: ${stats.keywords}`);
    console.log(`   - Entities found: ${stats.entities}`);
    console.log(`   - Categories: ${stats.categories}`);
    console.log('');
    
    // Step 3: Generate training dataset
    console.log('🏗️  Step 3: Generating training dataset...');
    const trainingResult = await immigrationKnowledgeBase.generateTrainingDataset();
    
    console.log(`✅ Training dataset generated:`);
    console.log(`   - Training examples: ${trainingResult.dataset.length}`);
    console.log(`   - Total patterns: ${trainingResult.statistics.totalPatterns}`);
    console.log(`   - Entities extracted: ${trainingResult.statistics.entitiesExtracted}`);
    console.log(`   - Language coverage: ${trainingResult.statistics.languageCoverage.join(', ')}`);
    console.log('');
    
    // Step 4: Save training data
    console.log('💾 Step 4: Saving training data to Firestore...');
    await immigrationKnowledgeBase.saveTrainingData();
    console.log('✅ Training data saved successfully\n');
    
    // Step 5: Test knowledge base queries
    console.log('🧪 Step 5: Testing knowledge base queries...');
    
    const testQueries = [
      { query: 'How to renew KITAS visa?', language: 'en' as const },
      { query: 'Quali documenti servono per PT PMA?', language: 'it' as const },
      { query: 'Berapa biaya pajak untuk perusahaan asing?', language: 'id' as const },
      { query: 'What are the requirements for investment visa?', language: 'en' as const },
      { query: 'Come aprire una società in Indonesia?', language: 'it' as const }
    ];
    
    for (const test of testQueries) {
      console.log(`\n🔍 Testing query: "${test.query}" (${test.language})`);
      const result = await immigrationKnowledgeBase.queryKnowledgeBase(test.query, test.language);
      
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Documents found: ${result.documents.length}`);
      
      if (result.documents.length > 0) {
        console.log(`   Top result: ${result.documents[0].title} (${result.documents[0].category})`);
      }
      
      if (result.suggestions.length > 0) {
        console.log(`   Suggestions: ${result.suggestions.join('; ')}`);
      }
    }
    
    console.log('\n');
    
    // Step 6: Integration with language modules
    console.log('🔧 Step 6: Integrating with language learning modules...');
    
    // Create immigration-specific language module
    await createImmigrationLanguageModule();
    
    console.log('✅ Immigration language module created and integrated');
    console.log('');
    
    // Step 7: Final validation
    console.log('✅ Step 7: Final validation...');
    
    const engineStats = modularLanguageEngine.getProcessingStats();
    console.log(`   Language engine modules: ${engineStats.totalModules}`);
    console.log(`   Enabled modules: ${engineStats.enabledModules}`);
    console.log(`   Average confidence: ${(engineStats.averageConfidence * 100).toFixed(1)}%`);
    
    console.log('\n🎉 Immigration Knowledge Base Training Complete!');
    console.log('📋 Summary:');
    console.log(`   - Documents uploaded to Drive: ${uploadResult.uploadedFiles.length}`);
    console.log(`   - Documents indexed: ${stats.documents}`);
    console.log(`   - Training examples generated: ${trainingResult.dataset.length}`);
    console.log(`   - Keywords extracted: ${stats.keywords}`);
    console.log(`   - Entities identified: ${stats.entities}`);
    console.log(`   - Language modules: ${engineStats.totalModules} (${engineStats.enabledModules} enabled)`);
    
    console.log('\n📚 Knowledge Base is now ready for production use!');
    
  } catch (error) {
    console.error('❌ Training failed:', error);
    throw error;
  }
}

async function createImmigrationLanguageModule(): Promise<void> {
  // Create a specialized immigration module for the language engine
  const immigrationModule = {
    name: 'immigration_specialist',
    priority: 85,
    supports: ['it', 'id', 'en', 'es', 'pt'],
    process: async (input: any) => {
      // Query the immigration knowledge base
      const kbResult = await immigrationKnowledgeBase.queryKnowledgeBase(
        input.text,
        input.context?.language || 'en'
      );
      
      // Analyze if this is an immigration-related query
      const immigrationKeywords = [
        'visa', 'kitas', 'kitap', 'permit', 'immigration', 'imigrasi',
        'pt pma', 'investment', 'business', 'company', 'tax', 'pajak',
        'renewal', 'extension', 'application', 'embassy', 'consulate'
      ];
      
      const isImmigrationQuery = immigrationKeywords.some(keyword => 
        input.text.toLowerCase().includes(keyword)
      );
      
      if (!isImmigrationQuery || kbResult.confidence < 0.3) {
        return {
          processedText: input.text,
          detectedLanguage: input.context?.language || 'en',
          confidence: 0.1,
          suggestions: ['This query may not be immigration-related']
        };
      }
      
      // Generate immigration-specific response enhancements
      const immigrationSuggestions = [];
      const immigrationNotes = [];
      
      if (kbResult.documents.length > 0) {
        const topDoc = kbResult.documents[0];
        immigrationSuggestions.push(`Based on ${topDoc.title}, consider these steps`);
        
        if (topDoc.metadata.difficulty === 'advanced') {
          immigrationNotes.push('This is a complex immigration topic - consider professional consultation');
        }
        
        if (topDoc.category === 'visa') {
          immigrationSuggestions.push('Check your current visa status and expiration dates');
        }
        
        if (topDoc.category === 'business') {
          immigrationSuggestions.push('Ensure compliance with Indonesian investment regulations');
        }
        
        if (topDoc.category === 'tax') {
          immigrationSuggestions.push('Review your tax obligations and filing deadlines');
        }
      }
      
      // Add context-specific recommendations
      if (input.text.toLowerCase().includes('renewal')) {
        immigrationSuggestions.push('Start renewal process at least 30 days before expiration');
        immigrationNotes.push('Late renewals may incur penalties');
      }
      
      if (input.text.toLowerCase().includes('application')) {
        immigrationSuggestions.push('Ensure all documents are properly apostilled if required');
        immigrationNotes.push('Processing times vary - plan accordingly');
      }
      
      return {
        processedText: input.text,
        detectedLanguage: input.context?.language || 'en',
        confidence: kbResult.confidence,
        suggestions: [
          ...kbResult.suggestions,
          ...immigrationSuggestions
        ].slice(0, 5),
        culturalNotes: immigrationNotes,
        nextActions: [
          'Verify current immigration status',
          'Check document expiration dates',
          'Review applicable regulations',
          'Consider professional consultation if needed'
        ].slice(0, 3),
        knowledgeBaseResults: {
          documentsFound: kbResult.documents.length,
          topCategories: Array.from(new Set(kbResult.documents.map(d => d.category))),
          confidence: kbResult.confidence
        }
      };
    }
  };
  
  // Register the module with the language engine
  modularLanguageEngine.registerModule(immigrationModule);
  modularLanguageEngine.setModuleConfig('immigration_specialist', {
    enabled: true,
    weight: 0.9
  });
  
  // Update processing chain to include immigration module
  const currentModules = modularLanguageEngine.getAvailableModules();
  const newChain = [
    'detection',
    'enhanced_training',
    'immigration_specialist',
    'context_awareness',
    'business_compliance'
  ].filter(module => currentModules.includes(module));
  
  modularLanguageEngine.updateProcessingChain(newChain);
}

// Run if called directly
if (require.main === module) {
  runImmigrationKnowledgeTraining()
    .then(() => {
      console.log('\n✅ All processes completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Process failed:', error);
      process.exit(1);
    });
}

export { runImmigrationKnowledgeTraining };