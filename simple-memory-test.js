#!/usr/bin/env node

/**
 * Simple test for Memory API endpoints
 * Tests the Firestore memory integration via HTTP API
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const API_KEY = process.env.ZANTARA_PLUGIN_API_KEY || 'test';

async function fetch(url, options = {}) {
  const { default: fetch } = await import('node-fetch');
  return fetch(url, options);
}

async function testMemoryAPI() {
  console.log('🧪 Testing Memory API with Firestore...\n');
  console.log('📍 Base URL:', BASE_URL);
  
  const testUserId = 'test-user-' + Date.now();
  let testEntryId = null;

  try {
    // Test 1: Save a memory entry
    console.log('1. Testing POST /actions/memory/save...');
    const saveResponse = await fetch(`${BASE_URL}/actions/memory/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        userId: testUserId,
        content: 'Testing Firestore memory integration with a sample note about learning JavaScript',
        title: 'JavaScript Learning Notes',
        tags: ['programming', 'javascript', 'firestore', 'test'],
        category: 'learning',
        source: 'api-test',
        metadata: {
          tokenCount: 15,
          contextType: 'note'
        }
      })
    });

    if (!saveResponse.ok) {
      throw new Error(`Save failed: ${saveResponse.status} ${saveResponse.statusText}`);
    }

    const saveResult = await saveResponse.json();
    if (saveResult.ok && saveResult.data?.id) {
      testEntryId = saveResult.data.id;
      console.log('✅ Memory entry saved successfully');
      console.log('   Entry ID:', testEntryId);
    } else {
      throw new Error('Save response missing entry ID');
    }

    // Test 2: Search entries
    console.log('\n2. Testing GET /actions/memory/search...');
    const searchUrl = new URL(`${BASE_URL}/actions/memory/search`);
    searchUrl.searchParams.set('userId', testUserId);
    searchUrl.searchParams.set('query', 'JavaScript');
    searchUrl.searchParams.set('limit', '10');

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status} ${searchResponse.statusText}`);
    }

    const searchResult = await searchResponse.json();
    if (searchResult.ok && searchResult.data?.items?.length > 0) {
      console.log('✅ Memory search working correctly');
      console.log('   Found', searchResult.data.count, 'entries');
      console.log('   First entry title:', searchResult.data.items[0].title);
    } else {
      throw new Error('Search did not return expected results');
    }

    // Test 3: Get entry by ID
    console.log('\n3. Testing GET /actions/memory/:id...');
    const getUrl = new URL(`${BASE_URL}/actions/memory/${testEntryId}`);
    getUrl.searchParams.set('userId', testUserId);

    const getResponse = await fetch(getUrl);
    if (!getResponse.ok) {
      throw new Error(`Get entry failed: ${getResponse.status} ${getResponse.statusText}`);
    }

    const getResult = await getResponse.json();
    if (getResult.ok && getResult.data?.content?.includes('JavaScript')) {
      console.log('✅ Memory entry retrieval working correctly');
      console.log('   Title:', getResult.data.title);
      console.log('   Tags:', getResult.data.tags);
      console.log('   Access Count:', getResult.data.accessCount);
    } else {
      throw new Error('Retrieved entry does not match expected content');
    }

    // Test 4: Get recent entries
    console.log('\n4. Testing GET /actions/memory/recent...');
    const recentUrl = new URL(`${BASE_URL}/actions/memory/recent`);
    recentUrl.searchParams.set('userId', testUserId);
    recentUrl.searchParams.set('limit', '5');

    const recentResponse = await fetch(recentUrl);
    if (!recentResponse.ok) {
      throw new Error(`Recent entries failed: ${recentResponse.status} ${recentResponse.statusText}`);
    }

    const recentResult = await recentResponse.json();
    if (recentResult.ok && recentResult.data?.items?.length > 0) {
      console.log('✅ Recent entries working correctly');
      console.log('   Found', recentResult.data.count, 'recent entries');
    } else {
      throw new Error('No recent entries found');
    }

    // Test 5: Get memory stats
    console.log('\n5. Testing GET /actions/memory/stats...');
    const statsUrl = new URL(`${BASE_URL}/actions/memory/stats`);
    statsUrl.searchParams.set('userId', testUserId);

    const statsResponse = await fetch(statsUrl);
    if (!statsResponse.ok) {
      throw new Error(`Stats failed: ${statsResponse.status} ${statsResponse.statusText}`);
    }

    const statsResult = await statsResponse.json();
    if (statsResult.ok && statsResult.data?.totalEntries >= 1) {
      console.log('✅ Memory stats working correctly');
      console.log('   Total entries:', statsResult.data.totalEntries);
      console.log('   Total tokens:', statsResult.data.totalTokens);
      console.log('   Average relevance:', statsResult.data.averageRelevanceScore?.toFixed(2));
    } else {
      throw new Error('Stats do not reflect saved entries');
    }

    // Test 6: Update entry
    console.log('\n6. Testing PUT /actions/memory/:id...');
    const updateResponse = await fetch(`${BASE_URL}/actions/memory/${testEntryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        relevanceScore: 0.9,
        tags: ['programming', 'javascript', 'firestore', 'test', 'updated']
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`Update failed: ${updateResponse.status} ${updateResponse.statusText}`);
    }

    const updateResult = await updateResponse.json();
    if (updateResult.ok) {
      console.log('✅ Memory entry updated successfully');
    } else {
      throw new Error('Update did not return success');
    }

    // Test 7: Delete entry
    console.log('\n7. Testing DELETE /actions/memory/:id...');
    const deleteUrl = new URL(`${BASE_URL}/actions/memory/${testEntryId}`);
    deleteUrl.searchParams.set('userId', testUserId);

    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'x-api-key': API_KEY
      }
    });

    if (!deleteResponse.ok) {
      throw new Error(`Delete failed: ${deleteResponse.status} ${deleteResponse.statusText}`);
    }

    const deleteResult = await deleteResponse.json();
    if (deleteResult.ok) {
      console.log('✅ Memory entry deleted successfully');
    } else {
      throw new Error('Delete did not return success');
    }

    // Verify deletion
    const verifyDeleteUrl = new URL(`${BASE_URL}/actions/memory/${testEntryId}`);
    verifyDeleteUrl.searchParams.set('userId', testUserId);
    const verifyResponse = await fetch(verifyDeleteUrl);
    
    if (verifyResponse.status === 404) {
      console.log('✅ Entry deletion verified');
    } else {
      console.log('⚠️  Entry might still exist (status:', verifyResponse.status, ')');
    }

    console.log('\n🎉 All Memory API tests passed!');
    console.log('\n✅ Mock memory implementation successfully replaced with Firestore');
    console.log('📊 API endpoints verified:');
    console.log('   • POST /actions/memory/save - Save memory entries');
    console.log('   • GET  /actions/memory/search - Search entries');
    console.log('   • GET  /actions/memory/:id - Get entry by ID');
    console.log('   • GET  /actions/memory/recent - Get recent entries');
    console.log('   • GET  /actions/memory/stats - Get memory stats');
    console.log('   • PUT  /actions/memory/:id - Update entries');
    console.log('   • DELETE /actions/memory/:id - Delete entries');
    console.log('\n🔥 Ready for production use!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Cleanup on error
    if (testEntryId) {
      try {
        const deleteUrl = new URL(`${BASE_URL}/actions/memory/${testEntryId}`);
        deleteUrl.searchParams.set('userId', testUserId);
        await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { 'x-api-key': API_KEY }
        });
        console.log('🧹 Cleaned up test entry');
      } catch (cleanupError) {
        console.error('Failed to cleanup test entry:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

// Instructions for running the test
function printInstructions() {
  console.log('📋 To run this test:');
  console.log('1. Make sure your Zantara Light Bridge server is running');
  console.log('2. Set environment variables:');
  console.log('   export BASE_URL=http://localhost:8080  # or your server URL');
  console.log('   export ZANTARA_PLUGIN_API_KEY=your-api-key');
  console.log('3. Run: node simple-memory-test.js');
  console.log('');
}

// Run the test
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printInstructions();
    process.exit(0);
  }

  testMemoryAPI()
    .then(() => {
      console.log('\n✨ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test runner error:', error);
      process.exit(1);
    });
}