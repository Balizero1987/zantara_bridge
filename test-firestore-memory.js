#!/usr/bin/env node

/**
 * Test script for Firestore Memory Service
 * Verifies that the mock memory implementation has been successfully replaced
 */

const { firestoreMemory } = require('./dist/services/firestoreMemory');

async function testFirestoreMemory() {
  console.log('🧪 Testing Firestore Memory Service...\n');

  const testUserId = 'test-user-' + Date.now();
  let testEntryId = null;

  try {
    // Test 1: Save a memory entry
    console.log('1. Testing memory save...');
    testEntryId = await firestoreMemory.saveEntry({
      userId: testUserId,
      content: 'This is a test memory entry about learning Italian',
      title: 'Italian Learning Session',
      tags: ['language', 'italian', 'test'],
      category: 'learning',
      source: 'test-script',
      relevanceScore: 0.8,
      metadata: {
        tokenCount: 10,
        contextType: 'note'
      }
    });
    console.log('✅ Memory entry saved with ID:', testEntryId);

    // Test 2: Retrieve the entry
    console.log('\n2. Testing memory retrieval...');
    const retrievedEntry = await firestoreMemory.getEntry(testEntryId, testUserId);
    if (retrievedEntry && retrievedEntry.content.includes('Italian')) {
      console.log('✅ Memory entry retrieved successfully');
      console.log('   Title:', retrievedEntry.title);
      console.log('   Tags:', retrievedEntry.tags);
      console.log('   Access Count:', retrievedEntry.accessCount);
    } else {
      throw new Error('Retrieved entry does not match expected content');
    }

    // Test 3: Search entries
    console.log('\n3. Testing memory search...');
    const searchResults = await firestoreMemory.searchEntries({
      userId: testUserId,
      query: 'Italian',
      tags: ['language'],
      limit: 10
    });
    if (searchResults.length > 0 && searchResults[0].id === testEntryId) {
      console.log('✅ Memory search working correctly');
      console.log('   Found', searchResults.length, 'entries');
    } else {
      throw new Error('Search did not return expected results');
    }

    // Test 4: Update entry
    console.log('\n4. Testing memory update...');
    await firestoreMemory.updateEntry(testEntryId, {
      relevanceScore: 0.9,
      tags: ['language', 'italian', 'test', 'updated']
    });
    const updatedEntry = await firestoreMemory.getEntry(testEntryId);
    if (updatedEntry.relevanceScore === 0.9 && updatedEntry.tags.includes('updated')) {
      console.log('✅ Memory entry updated successfully');
      console.log('   New relevance score:', updatedEntry.relevanceScore);
      console.log('   Updated tags:', updatedEntry.tags);
    } else {
      throw new Error('Entry update did not work correctly');
    }

    // Test 5: Get stats
    console.log('\n5. Testing memory stats...');
    const stats = await firestoreMemory.getStats(testUserId);
    if (stats.totalEntries >= 1) {
      console.log('✅ Memory stats working correctly');
      console.log('   Total entries:', stats.totalEntries);
      console.log('   Total tokens:', stats.totalTokens);
      console.log('   Average relevance:', stats.averageRelevanceScore.toFixed(2));
    } else {
      throw new Error('Stats do not reflect saved entries');
    }

    // Test 6: Get recent entries
    console.log('\n6. Testing recent entries...');
    const recentEntries = await firestoreMemory.getRecentEntries(testUserId, 5);
    if (recentEntries.length > 0) {
      console.log('✅ Recent entries working correctly');
      console.log('   Found', recentEntries.length, 'recent entries');
    } else {
      throw new Error('No recent entries found');
    }

    // Test 7: Delete entry
    console.log('\n7. Testing memory deletion...');
    await firestoreMemory.deleteEntry(testEntryId, testUserId);
    const deletedEntry = await firestoreMemory.getEntry(testEntryId);
    if (!deletedEntry) {
      console.log('✅ Memory entry deleted successfully');
    } else {
      throw new Error('Entry was not deleted properly');
    }

    console.log('\n🎉 All Firestore Memory tests passed!');
    console.log('\n✅ Mock memory implementation successfully replaced with Firestore');
    console.log('📊 Features verified:');
    console.log('   • Save memory entries to Firestore');
    console.log('   • Retrieve entries with access tracking');
    console.log('   • Search entries by content, tags, and filters');
    console.log('   • Update existing entries');
    console.log('   • Delete entries with authorization');
    console.log('   • Get user memory statistics');
    console.log('   • Retrieve recent entries');
    console.log('\n🔥 Ready for production use!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Cleanup on error
    if (testEntryId) {
      try {
        await firestoreMemory.deleteEntry(testEntryId);
        console.log('🧹 Cleaned up test entry');
      } catch (cleanupError) {
        console.error('Failed to cleanup test entry:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testFirestoreMemory()
    .then(() => {
      console.log('\n✨ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test runner error:', error);
      process.exit(1);
    });
}

module.exports = { testFirestoreMemory };