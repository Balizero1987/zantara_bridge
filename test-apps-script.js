/**
 * Test script for Apps Script Drive integration
 */

// Test configuration
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
const AMBARADAM_FOLDER_ID = '1UGbm5er6Go351S57GQKUjmxMxHyT4QZb';

async function testAppsScript() {
  console.log('🧪 Testing Apps Script Drive integration...');
  
  if (!process.env.APPS_SCRIPT_URL) {
    console.error('❌ APPS_SCRIPT_URL environment variable not set');
    console.log('📋 Please set it to your deployed Apps Script URL');
    process.exit(1);
  }

  try {
    // Test 1: Upload a test file
    console.log('\n📤 Testing file upload...');
    const uploadResult = await testUpload();
    console.log('✅ Upload successful:', uploadResult);

    // Test 2: List files in AMBARADAM
    console.log('\n📂 Testing file listing...');
    const listResult = await testList();
    console.log('✅ List successful:', listResult.files?.length || 0, 'files found');

    // Test 3: Search for files
    console.log('\n🔍 Testing file search...');
    const searchResult = await testSearch('test');
    console.log('✅ Search successful:', searchResult.files?.length || 0, 'files found');

    // Test 4: Delete the test file
    if (uploadResult.fileId) {
      console.log('\n🗑️  Testing file deletion...');
      const deleteResult = await testDelete(uploadResult.fileId);
      console.log('✅ Delete successful:', deleteResult);
    }

    console.log('\n🎉 All Apps Script tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function makeRequest(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function testUpload() {
  const testContent = `ZANTARA TEST FILE
==================
Created: ${new Date().toISOString()}
Purpose: Testing Apps Script Drive integration

This is a test file created by the ZANTARA Bridge test suite.
It will be uploaded to the AMBARADAM folder and then cleaned up.

Test data:
- User: test-user
- Timestamp: ${Date.now()}
- Random: ${Math.random()}
`;

  return makeRequest({
    action: 'upload',
    fileName: `zantara-test-${Date.now()}.txt`,
    content: testContent,
    folderId: AMBARADAM_FOLDER_ID,
  });
}

async function testList() {
  return makeRequest({
    action: 'list',
    folderId: AMBARADAM_FOLDER_ID,
  });
}

async function testSearch(query) {
  return makeRequest({
    action: 'search',
    query,
    folderId: AMBARADAM_FOLDER_ID,
  });
}

async function testDelete(fileId) {
  return makeRequest({
    action: 'delete',
    fileId,
  });
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAppsScript().catch(console.error);
}

module.exports = {
  testAppsScript,
  testUpload,
  testList,
  testSearch,
  testDelete,
};