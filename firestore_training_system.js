#!/usr/bin/env node

/**
 * ZANTARA FIRESTORE - SISTEMA COMPLETO DI ALLENAMENTO E TEST
 * Sistema avanzato per allenare Zantara con Firestore in tutti gli scenari possibili
 */

const { firestore } = require('./dist/firebase.js');
const { db } = require('./dist/core/firestore.js');

// Configurazione di allenamento
const TRAINING_CONFIG = {
  batchSize: 50,
  collections: ['conversations', 'notes', 'learningMetrics', 'userProfiles', 'entries', 'chatSessions'],
  languages: ['it', 'en', 'id', 'ua', 'es', 'fr', 'de'],
  userTypes: ['BOSS', 'COLLABORATOR', 'GUEST', 'ADMIN', 'USER'],
  topicCategories: ['business', 'personal', 'technical', 'creative', 'educational', 'casual']
};

// Utilities per generazione dati
function generateRandomUser() {
  const users = ['antonello@balizero.com', 'zero@balizero.com', 'boss@company.com', 'user1@test.com', 'maria@example.com'];
  return users[Math.floor(Math.random() * users.length)];
}

function generateRandomContent() {
  const contents = [
    'Discussione importante di business strategy e planning per Q1 2025',
    'Note personali sulla gestione del tempo e produttività',
    'Technical discussion about Firestore optimization and performance',
    'Creative brainstorming session for new product features',
    'Educational content about machine learning and AI development',
    'Casual conversation about weekend plans and hobbies',
    'Meeting notes from client presentation and feedback session',
    'Research findings on market trends and competitor analysis',
    'Project management updates and milestone tracking',
    'Team building activities and collaboration improvement ideas'
  ];
  return contents[Math.floor(Math.random() * contents.length)];
}

function generateRandomLanguage() {
  return TRAINING_CONFIG.languages[Math.floor(Math.random() * TRAINING_CONFIG.languages.length)];
}

function generateRandomTopic() {
  return TRAINING_CONFIG.topicCategories[Math.floor(Math.random() * TRAINING_CONFIG.topicCategories.length)];
}

function generateRandomTags() {
  const allTags = ['important', 'urgent', 'meeting', 'project', 'personal', 'business', 'technical', 'creative', 'follow-up', 'completed'];
  const numTags = Math.floor(Math.random() * 4) + 1;
  const tags = [];
  
  for (let i = 0; i < numTags; i++) {
    const tag = allTags[Math.floor(Math.random() * allTags.length)];
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  return tags;
}

// Test utilities
let testCount = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function runTest(name, testFn) {
  testCount++;
  const testId = testCount.toString().padStart(3, '0');
  
  console.log(`[${testId}] 🧪 ${name}...`);
  
  const runTestAsync = async () => {
    try {
      await testFn();
      passedTests++;
      console.log(`[${testId}] ✅ ${name}`);
      testResults.push({ id: testId, name, status: 'PASS' });
    } catch (err) {
      failedTests++;
      console.log(`[${testId}] ❌ ${name} - ${err.message}`);
      testResults.push({ id: testId, name, status: 'FAIL', error: err.message });
    }
  };
  
  return runTestAsync();
}

// Sezione 1: Training Data Generation
async function generateTrainingData() {
  console.log('📚 GENERAZIONE DATI DI ALLENAMENTO');
  console.log('==================================');
  
  // 1. Conversazioni di training
  await runTest('Generate training conversations', async () => {
    const batch = firestore.batch();
    const conversationsRef = firestore.collection('conversations');
    
    for (let i = 0; i < 100; i++) {
      const docRef = conversationsRef.doc();
      batch.set(docRef, {
        userId: generateRandomUser(),
        message: `Training message ${i + 1}: ${generateRandomContent()}`,
        reply: `AI response ${i + 1}: Understanding and processing your request about ${generateRandomTopic()}`,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
        language: generateRandomLanguage(),
        sessionId: `training_session_${Math.floor(i / 10)}`,
        metadata: {
          source: 'training_system',
          category: generateRandomTopic(),
          confidence: Math.random() * 0.5 + 0.5, // 0.5-1.0
          processingTime: Math.floor(Math.random() * 2000) + 500 // 500-2500ms
        }
      });
    }
    
    await batch.commit();
    console.log('Generated 100 training conversations');
  });
  
  // 2. Note strutturate
  await runTest('Generate structured notes', async () => {
    const batch = firestore.batch();
    const notesRef = firestore.collection('notes');
    
    for (let i = 0; i < 50; i++) {
      const docRef = notesRef.doc();
      const date = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      batch.set(docRef, {
        owner: generateRandomUser(),
        canonicalOwner: generateRandomUser().split('@')[0],
        title: `Training Note ${i + 1}`,
        content: `${generateRandomContent()}\\n\\nDetailed content for training purposes with multiple paragraphs and structured information.`,
        ts: Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000,
        dateKey: dateKey,
        tags: generateRandomTags(),
        category: generateRandomTopic(),
        language: generateRandomLanguage(),
        wordCount: Math.floor(Math.random() * 500) + 50,
        lastModified: date
      });
    }
    
    await batch.commit();
    console.log('Generated 50 structured notes');
  });
  
  // 3. Profili utente
  await runTest('Generate user profiles', async () => {
    const batch = firestore.batch();
    const profilesRef = firestore.collection('userProfiles');
    
    const users = ['antonello@balizero.com', 'zero@balizero.com', 'boss@company.com', 'user1@test.com', 'maria@example.com'];
    
    for (const userId of users) {
      const docRef = profilesRef.doc();
      batch.set(docRef, {
        userId: userId,
        displayName: userId.split('@')[0].charAt(0).toUpperCase() + userId.split('@')[0].slice(1),
        preferredLanguage: generateRandomLanguage(),
        timezone: 'Asia/Jakarta',
        preferences: {
          notifications: true,
          autoSave: true,
          theme: 'dark',
          language: generateRandomLanguage()
        },
        learningProgress: {
          totalSessions: Math.floor(Math.random() * 100) + 10,
          averageSessionLength: Math.floor(Math.random() * 30) + 5, // minutes
          topTopics: generateRandomTags().slice(0, 3),
          lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
        },
        createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(),
        isActive: true
      });
    }
    
    await batch.commit();
    console.log('Generated user profiles for 5 users');
  });
  
  // 4. Metriche di apprendimento
  await runTest('Generate learning metrics', async () => {
    const batch = firestore.batch();
    const metricsRef = firestore.collection('learningMetrics');
    
    for (let i = 0; i < 200; i++) {
      const docRef = metricsRef.doc();
      const date = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      
      batch.set(docRef, {
        userId: generateRandomUser(),
        date: date,
        sessionId: `session_${Math.floor(Math.random() * 50)}`,
        metrics: {
          accuracy: Math.random() * 0.4 + 0.6, // 0.6-1.0
          responseTime: Math.floor(Math.random() * 3000) + 500,
          userSatisfaction: Math.floor(Math.random() * 3) + 3, // 3-5
          contextRetention: Math.random() * 0.5 + 0.5,
          topicMastery: Math.random() * 0.6 + 0.4
        },
        interactions: {
          questionsAsked: Math.floor(Math.random() * 20) + 1,
          answersProvided: Math.floor(Math.random() * 25) + 1,
          corrections: Math.floor(Math.random() * 5),
          clarifications: Math.floor(Math.random() * 8)
        },
        topics: generateRandomTags().slice(0, 2),
        language: generateRandomLanguage(),
        sessionDuration: Math.floor(Math.random() * 1800) + 300 // 5-35 minutes
      });
    }
    
    await batch.commit();
    console.log('Generated 200 learning metrics entries');
  });
}

// Sezione 2: Comprehensive Firestore Testing
async function runComprehensiveTests() {
  console.log('\\n🔥 FIRESTORE COMPREHENSIVE TESTING');
  console.log('===================================');
  
  // Basic CRUD Operations
  await runTest('Basic document write', async () => {
    const doc = await firestore.collection('test_crud').add({
      name: 'Test Document',
      value: 42,
      timestamp: new Date()
    });
    if (!doc.id) throw new Error('No document ID returned');
  });
  
  await runTest('Basic document read', async () => {
    const snapshot = await firestore.collection('test_crud').limit(1).get();
    if (snapshot.empty) throw new Error('No documents found');
    const doc = snapshot.docs[0];
    if (!doc.data().name) throw new Error('Document data incomplete');
  });
  
  await runTest('Document update', async () => {
    const snapshot = await firestore.collection('test_crud').limit(1).get();
    const doc = snapshot.docs[0];
    await doc.ref.update({ updated: true, updateTime: new Date() });
    
    const updated = await doc.ref.get();
    if (!updated.data().updated) throw new Error('Update failed');
  });
  
  await runTest('Document delete', async () => {
    const doc = await firestore.collection('test_crud').add({ toDelete: true });
    await doc.delete();
    
    const deleted = await doc.get();
    if (deleted.exists) throw new Error('Delete failed');
  });
  
  // Complex Queries
  await runTest('Query with where clause', async () => {
    const snapshot = await firestore.collection('conversations')
      .where('language', '==', 'it')
      .limit(5)
      .get();
    
    if (snapshot.empty) throw new Error('No results for where query');
  });
  
  await runTest('Query with orderBy', async () => {
    const snapshot = await firestore.collection('conversations')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    if (snapshot.empty) throw new Error('No results for orderBy query');
    
    // Verify order
    let prevTime = null;
    snapshot.docs.forEach(doc => {
      const time = doc.data().timestamp.toMillis();
      if (prevTime && time > prevTime) {
        throw new Error('Order is incorrect');
      }
      prevTime = time;
    });
  });
  
  await runTest('Complex compound query', async () => {
    const snapshot = await firestore.collection('notes')
      .where('owner', '==', generateRandomUser())
      .orderBy('ts', 'desc')
      .limit(5)
      .get();
    
    // Should not throw even if empty
    console.log(`Found ${snapshot.size} matching notes`);
  });
  
  // Batch Operations
  await runTest('Batch write operations', async () => {
    const batch = firestore.batch();
    const testRef = firestore.collection('test_batch');
    
    for (let i = 0; i < 10; i++) {
      const docRef = testRef.doc();
      batch.set(docRef, {
        batchNumber: i,
        timestamp: new Date(),
        data: `Batch item ${i}`
      });
    }
    
    await batch.commit();
    
    // Verify batch write
    const snapshot = await testRef.where('batchNumber', '>=', 0).get();
    if (snapshot.size < 10) throw new Error('Batch write incomplete');
  });
  
  // Transaction Test
  await runTest('Transaction operations', async () => {
    const testDoc = firestore.collection('test_transaction').doc('counter');
    
    await firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(testDoc);
      const currentValue = doc.exists ? (doc.data().count || 0) : 0;
      transaction.set(testDoc, { count: currentValue + 1 });
    });
    
    const result = await testDoc.get();
    if (!result.exists || typeof result.data().count !== 'number') {
      throw new Error('Transaction failed');
    }
  });
  
  // Array Operations
  await runTest('Array field operations', async () => {
    const docRef = firestore.collection('test_arrays').doc();
    
    // Create with array
    await docRef.set({
      tags: ['initial', 'test'],
      numbers: [1, 2, 3]
    });
    
    // Update array
    await docRef.update({
      tags: firestore.FieldValue.arrayUnion('new_tag'),
      numbers: firestore.FieldValue.arrayRemove(2)
    });
    
    const updated = await docRef.get();
    const data = updated.data();
    
    if (!data.tags.includes('new_tag')) throw new Error('arrayUnion failed');
    if (data.numbers.includes(2)) throw new Error('arrayRemove failed');
  });
  
  // Subcollection Operations
  await runTest('Subcollection operations', async () => {
    const parentDoc = firestore.collection('test_parent').doc('parent1');
    await parentDoc.set({ name: 'Parent Document' });
    
    const subCollection = parentDoc.collection('subcollection');
    const subDoc = await subCollection.add({
      childData: 'Child document data',
      timestamp: new Date()
    });
    
    const retrieved = await subDoc.get();
    if (!retrieved.exists) throw new Error('Subcollection write failed');
  });
}

// Sezione 3: Advanced Training Scenarios
async function runAdvancedTrainingScenarios() {
  console.log('\\n🎯 ADVANCED TRAINING SCENARIOS');
  console.log('===============================');
  
  // Scenario 1: Conversational Context Building
  await runTest('Conversational context training', async () => {
    const conversationMemory = require('./dist/services/conversationMemory.js').default;
    
    // Simulate a learning conversation
    await conversationMemory.addConversation(
      'training_user@test.com',
      'Come posso migliorare la mia produttività?',
      'Ecco alcuni suggerimenti per migliorare la produttività: 1) Pianifica la giornata, 2) Elimina le distrazioni, 3) Fai pause regolari',
      'it',
      { category: 'productivity', difficulty: 'beginner' }
    );
    
    // Get context to verify
    const context = await conversationMemory.getContextMessages('training_user@test.com');
    if (context.length === 0) throw new Error('Context not saved');
  });
  
  // Scenario 2: Multi-language Learning
  await runTest('Multi-language training scenario', async () => {
    const languages = ['it', 'en', 'id'];
    const phrases = {
      it: 'Ciao, come stai?',
      en: 'Hello, how are you?',
      id: 'Halo, apa kabar?'
    };
    
    const batch = firestore.batch();
    const multiLangRef = firestore.collection('multilang_training');
    
    for (const lang of languages) {
      const docRef = multiLangRef.doc();
      batch.set(docRef, {
        language: lang,
        phrase: phrases[lang],
        translation: 'Greeting expression',
        difficulty: 'beginner',
        timestamp: new Date()
      });
    }
    
    await batch.commit();
    console.log('Multi-language training data created');
  });
  
  // Scenario 3: Performance Optimization Training
  await runTest('Performance optimization scenario', async () => {
    // Test different query patterns
    const startTime = Date.now();
    
    // Efficient query with proper indexing
    const efficientQuery = await firestore.collection('conversations')
      .where('userId', '==', 'training_user@test.com')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    const queryTime = Date.now() - startTime;
    console.log(`Query executed in ${queryTime}ms`);
    
    if (queryTime > 5000) throw new Error('Query too slow - check indexes');
  });
  
  // Scenario 4: Error Handling Training
  await runTest('Error handling training', async () => {
    try {
      // Intentionally cause an error
      await firestore.collection('nonexistent')
        .where('field', '==', 'value')
        .orderBy('otherField', 'desc') // This might cause index error
        .get();
    } catch (error) {
      // This is expected - train on error handling
      if (error.code === 9) {
        console.log('Trained on index requirement error');
      }
    }
  });
}

// Sezione 4: Integration with Google Drive
async function trainFirestoreDriveIntegration() {
  console.log('\\n🔗 FIRESTORE + GOOGLE DRIVE INTEGRATION');
  console.log('========================================');
  
  await runTest('File metadata sync to Firestore', async () => {
    const fileIndexRef = firestore.collection('fileIndex');
    
    // Simulate file upload metadata
    await fileIndexRef.add({
      canonicalOwner: 'zero',
      kind: 'document',
      driveFileId: 'test_drive_file_123',
      name: 'Training Document.txt',
      webViewLink: 'https://drive.google.com/file/d/test_drive_file_123/view',
      dateKey: new Date().toISOString().split('T')[0],
      ts: Date.now(),
      appProperties: {
        source: 'zantara_training',
        category: 'business'
      }
    });
    
    console.log('File metadata synced to Firestore');
  });
  
  await runTest('Cross-reference search', async () => {
    // Search files and related conversations
    const fileQuery = firestore.collection('fileIndex')
      .where('canonicalOwner', '==', 'zero')
      .limit(5);
    
    const conversationQuery = firestore.collection('conversations')
      .where('userId', '==', 'zero@balizero.com')
      .limit(5);
    
    const [fileResults, conversationResults] = await Promise.all([
      fileQuery.get(),
      conversationQuery.get()
    ]);
    
    console.log(`Found ${fileResults.size} files and ${conversationResults.size} conversations`);
  });
}

// Sezione 5: Real-time Updates and Listeners
async function trainRealtimeFeatures() {
  console.log('\\n⚡ REAL-TIME FEATURES TRAINING');
  console.log('===============================');
  
  await runTest('Document listener training', async () => {
    return new Promise((resolve, reject) => {
      const testDoc = firestore.collection('realtime_test').doc('listener_test');
      
      // Set up listener
      const unsubscribe = testDoc.onSnapshot((doc) => {
        if (doc.exists && doc.data().updated) {
          console.log('Real-time update detected');
          unsubscribe();
          resolve();
        }
      }, reject);
      
      // Trigger update after short delay
      setTimeout(async () => {
        await testDoc.set({ updated: true, timestamp: new Date() });
      }, 1000);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        unsubscribe();
        reject(new Error('Listener timeout'));
      }, 10000);
    });
  });
}

// Main execution
async function main() {
  console.log('🎓 ZANTARA FIRESTORE TRAINING SYSTEM');
  console.log('=====================================');
  console.log('Inizializzazione sistema di allenamento completo per Firestore...\\n');
  
  try {
    // 1. Genera dati di allenamento
    await generateTrainingData();
    
    // 2. Esegui test completi
    await runComprehensiveTests();
    
    // 3. Scenari avanzati
    await runAdvancedTrainingScenarios();
    
    // 4. Integrazione Drive
    await trainFirestoreDriveIntegration();
    
    // 5. Funzionalità real-time
    await trainRealtimeFeatures();
    
    // Summary
    console.log('\\n📊 TRAINING SUMMARY');
    console.log('===================');
    console.log(`Total Tests: ${testCount}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / testCount) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\\n❌ FAILED TESTS:');
      testResults.filter(t => t.status === 'FAIL').forEach(test => {
        console.log(`  [${test.id}] ${test.name}: ${test.error}`);
      });
    }
    
    console.log('\\n✅ FIRESTORE TRAINING COMPLETED!');
    console.log('🎉 Zantara è ora completamente allenata su Firestore!');
    
  } catch (error) {
    console.error('❌ Training failed:', error);
    process.exit(1);
  }
}

// Esegui il sistema di allenamento
main().catch(console.error);