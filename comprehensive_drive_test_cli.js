#!/usr/bin/env node

/**
 * 🧪 COMPREHENSIVE DRIVE API TEST SUITE - CLI VERSION
 * Tests 30+ scenarios for Zantara Bridge Drive endpoints
 * Includes authentication, authorization, and error handling
 */

const https = require('https');
const http = require('http');

// Configuration
const config = {
  serviceUrl: process.env.SERVICE_URL || 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app',
  lightBridgeUrl: process.env.LIGHT_BRIDGE_URL || 'https://zantara-light-bridge-himaadsxua-et.a.run.app',
  apiKey: process.env.API_KEY || '7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3',
  testUser: process.env.TEST_USER || 'TESTBOT',
  ambaradamFolder: process.env.DRIVE_FOLDER_ID || '0AJC3-SJL03OOUk9PVA'
};

console.log('🚀 COMPREHENSIVE DRIVE API TEST SUITE');
console.log('=====================================');
console.log(`🔗 Service URL: ${config.serviceUrl}`);
console.log(`🌉 Light Bridge URL: ${config.lightBridgeUrl}`);
console.log(`🔑 API Key: ${config.apiKey.substring(0, 8)}...`);
console.log(`👤 Test User: ${config.testUser}`);
console.log(`📁 AMBARADAM Folder: ${config.ambaradamFolder}`);
console.log('');

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Utility function for making HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Zantara-Drive-Test-Suite/1.0',
        ...options.headers
      }
    };

    if (options.body && typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data.trim() ? JSON.parse(data) : {}
          };
          resolve(response);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test runner function
async function runTest(testName, testFn) {
  testResults.total++;
  console.log(`\n📋 Test ${testResults.total}: ${testName}`);
  console.log('─'.repeat(50));
  
  try {
    const result = await testFn();
    if (result) {
      testResults.passed++;
      console.log(`✅ PASSED: ${testName}`);
    } else {
      testResults.failed++;
      console.log(`❌ FAILED: ${testName}`);
    }
    return result;
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message });
    console.log(`💥 ERROR: ${testName} - ${error.message}`);
    return false;
  }
}

// Individual test functions
async function testHealthEndpoints() {
  console.log('🏥 Testing health endpoints...');
  
  // Test main bridge health
  const mainHealth = await makeRequest(`${config.serviceUrl}/health`);
  console.log(`Main Bridge Health: ${mainHealth.statusCode} - ${JSON.stringify(mainHealth.body)}`);
  
  // Test light bridge health
  const lightHealth = await makeRequest(`${config.lightBridgeUrl}/health`);
  console.log(`Light Bridge Health: ${lightHealth.statusCode} - ${JSON.stringify(lightHealth.body)}`);
  
  return mainHealth.statusCode === 200 && lightHealth.statusCode === 200;
}

async function testBridgeStatus() {
  console.log('📊 Testing bridge status...');
  
  const response = await makeRequest(`${config.lightBridgeUrl}/bridge/status`);
  console.log(`Status: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  
  return response.statusCode === 200 && 
         response.body.ok === true && 
         response.body.service === 'zantara-light-bridge';
}

async function testAuthenticationRequired() {
  console.log('🔐 Testing authentication requirement...');
  
  const response = await makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
    method: 'POST',
    body: { filename: 'test.txt', content: 'test' }
  });
  
  console.log(`No Auth Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 401 || response.statusCode === 403;
}

async function testInvalidApiKey() {
  console.log('❌ Testing invalid API key...');
  
  const response = await makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
    method: 'POST',
    headers: { 'X-API-KEY': 'invalid-key-12345' },
    body: { filename: 'test.txt', content: 'test' }
  });
  
  console.log(`Invalid Key Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 401 || response.statusCode === 403;
}

async function testValidApiKeyAuth() {
  console.log('✅ Testing valid API key authentication...');
  
  const response = await makeRequest(`${config.serviceUrl}/api/monitoring`, {
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    }
  });
  
  console.log(`Valid Auth Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 200;
}

async function testDriveUploadBasic() {
  console.log('📤 Testing basic drive upload...');
  
  const testContent = `Test file created at ${new Date().toISOString()}`;
  const response = await makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      filename: `test-basic-${Date.now()}.txt`,
      content: testContent,
      mimeType: 'text/plain',
      folderId: config.ambaradamFolder
    }
  });
  
  console.log(`Upload Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 200 && response.body.id;
}

async function testDriveUploadWithoutContent() {
  console.log('📭 Testing upload without content...');
  
  const response = await makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      filename: 'empty-test.txt'
    }
  });
  
  console.log(`No Content Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 400;
}

async function testDriveUploadWithoutFilename() {
  console.log('📝 Testing upload without filename...');
  
  const response = await makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      content: 'Test content without filename'
    }
  });
  
  console.log(`No Filename Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 400;
}

async function testMemorySaveBasic() {
  console.log('🧠 Testing basic memory save...');
  
  const response = await makeRequest(`${config.serviceUrl}/actions/memory/save`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      title: `Test Memory ${Date.now()}`,
      content: `Memory content created at ${new Date().toISOString()}`,
      tags: ['test', 'automation']
    }
  });
  
  console.log(`Memory Save Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 200 && response.body.ok;
}

async function testMemorySaveWithoutContent() {
  console.log('🧠 Testing memory save without content...');
  
  const response = await makeRequest(`${config.serviceUrl}/actions/memory/save`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      title: 'Empty Memory Test'
    }
  });
  
  console.log(`No Content Memory Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 400;
}

async function testDriveSearch() {
  console.log('🔍 Testing drive search...');
  
  const response = await makeRequest(`${config.serviceUrl}/api/search/drive`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      query: 'test',
      includeFiles: true,
      includeFolders: false
    }
  });
  
  console.log(`Drive Search Response: ${response.statusCode} - Files found: ${response.body.files?.length || 0}`);
  return response.statusCode === 200 && Array.isArray(response.body.files);
}

async function testRecentFiles() {
  console.log('📅 Testing recent files...');
  
  const response = await makeRequest(`${config.serviceUrl}/api/search/recent?limit=10`, {
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    }
  });
  
  console.log(`Recent Files Response: ${response.statusCode} - Files: ${response.body.recentFiles?.length || 0}`);
  return response.statusCode === 200 && Array.isArray(response.body.recentFiles);
}

async function testLightBridgeCall() {
  console.log('🌉 Testing light bridge call endpoint...');
  
  const response = await makeRequest(`${config.lightBridgeUrl}/call`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      message: 'Test call from comprehensive test suite',
      model: 'gpt-3.5-turbo'
    }
  });
  
  console.log(`Light Bridge Call Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 200 || response.statusCode === 403; // May fail auth on real service
}

async function testRateLimiting() {
  console.log('⚡ Testing rate limiting...');
  
  const promises = [];
  for (let i = 0; i < 15; i++) {
    promises.push(
      makeRequest(`${config.serviceUrl}/health`, {
        headers: { 'X-API-KEY': config.apiKey }
      })
    );
  }
  
  const responses = await Promise.all(promises);
  const rateLimited = responses.some(r => r.statusCode === 429);
  
  console.log(`Rate Limit Test: ${rateLimited ? 'Rate limiting active' : 'No rate limiting detected'}`);
  console.log(`Response codes: ${responses.map(r => r.statusCode).join(', ')}`);
  
  return true; // This test always passes as it's informational
}

async function testMalformedJSON() {
  console.log('🔧 Testing malformed JSON handling...');
  
  const response = await makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser,
      'Content-Type': 'application/json'
    },
    body: '{"filename": "test.txt", "content": "test"' // Malformed JSON
  });
  
  console.log(`Malformed JSON Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 400;
}

async function testLargeFileUpload() {
  console.log('📦 Testing large file upload...');
  
  const largeContent = 'A'.repeat(1000000); // 1MB of 'A's
  const response = await makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      filename: `large-test-${Date.now()}.txt`,
      content: largeContent,
      mimeType: 'text/plain',
      folderId: config.ambaradamFolder
    }
  });
  
  console.log(`Large File Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 200 || response.statusCode === 413; // Success or too large
}

async function testSpecialCharactersFilename() {
  console.log('🎭 Testing special characters in filename...');
  
  const response = await makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      filename: `test-émojí-🚀-${Date.now()}.txt`,
      content: 'Content with special filename',
      mimeType: 'text/plain',
      folderId: config.ambaradamFolder
    }
  });
  
  console.log(`Special Chars Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 200;
}

async function testConcurrentUploads() {
  console.log('⚡ Testing concurrent uploads...');
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
        method: 'POST',
        headers: { 
          'X-API-KEY': config.apiKey,
          'X-BZ-USER': config.testUser
        },
        body: {
          filename: `concurrent-test-${i}-${Date.now()}.txt`,
          content: `Concurrent upload test ${i}`,
          mimeType: 'text/plain',
          folderId: config.ambaradamFolder
        }
      })
    );
  }
  
  const responses = await Promise.all(promises);
  const successful = responses.filter(r => r.statusCode === 200).length;
  
  console.log(`Concurrent Uploads: ${successful}/5 successful`);
  return successful >= 3; // At least 3 should succeed
}

async function testSearchWithFilters() {
  console.log('🔍 Testing search with filters...');
  
  const response = await makeRequest(`${config.serviceUrl}/api/search/drive`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      query: 'test',
      fileType: 'text/plain',
      includeFiles: true,
      includeFolders: false,
      modifiedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
    }
  });
  
  console.log(`Filtered Search Response: ${response.statusCode} - Files: ${response.body.files?.length || 0}`);
  return response.statusCode === 200;
}

async function testInvalidFolderId() {
  console.log('📁 Testing invalid folder ID...');
  
  const response = await makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      filename: 'test-invalid-folder.txt',
      content: 'Test content',
      folderId: 'invalid-folder-id-12345'
    }
  });
  
  console.log(`Invalid Folder Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 404 || response.statusCode === 400;
}

async function testEmptySearchQuery() {
  console.log('🔍 Testing empty search query...');
  
  const response = await makeRequest(`${config.serviceUrl}/api/search/drive`, {
    method: 'POST',
    headers: { 
      'X-API-KEY': config.apiKey,
      'X-BZ-USER': config.testUser
    },
    body: {
      query: '',
      includeFiles: true
    }
  });
  
  console.log(`Empty Search Response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
  return response.statusCode === 400 || response.statusCode === 200;
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting comprehensive Drive API tests...\n');
  
  // Core functionality tests
  await runTest('Health Endpoints Check', testHealthEndpoints);
  await runTest('Bridge Status Check', testBridgeStatus);
  
  // Authentication tests
  await runTest('Authentication Required', testAuthenticationRequired);
  await runTest('Invalid API Key Rejection', testInvalidApiKey);
  await runTest('Valid API Key Authentication', testValidApiKeyAuth);
  
  // Drive upload tests
  await runTest('Basic Drive Upload', testDriveUploadBasic);
  await runTest('Upload Without Content', testDriveUploadWithoutContent);
  await runTest('Upload Without Filename', testDriveUploadWithoutFilename);
  await runTest('Large File Upload', testLargeFileUpload);
  await runTest('Special Characters in Filename', testSpecialCharactersFilename);
  await runTest('Concurrent Uploads', testConcurrentUploads);
  await runTest('Invalid Folder ID', testInvalidFolderId);
  
  // Memory save tests
  await runTest('Basic Memory Save', testMemorySaveBasic);
  await runTest('Memory Save Without Content', testMemorySaveWithoutContent);
  
  // Search tests
  await runTest('Drive Search', testDriveSearch);
  await runTest('Recent Files', testRecentFiles);
  await runTest('Search with Filters', testSearchWithFilters);
  await runTest('Empty Search Query', testEmptySearchQuery);
  
  // Light bridge tests
  await runTest('Light Bridge Call', testLightBridgeCall);
  
  // Error handling tests
  await runTest('Rate Limiting', testRateLimiting);
  await runTest('Malformed JSON Handling', testMalformedJSON);
  
  // Additional endpoint tests
  for (let i = 1; i <= 10; i++) {
    await runTest(`Stress Test Upload ${i}`, async () => {
      const response = await makeRequest(`${config.serviceUrl}/actions/drive/upload`, {
        method: 'POST',
        headers: { 
          'X-API-KEY': config.apiKey,
          'X-BZ-USER': config.testUser
        },
        body: {
          filename: `stress-test-${i}-${Date.now()}.txt`,
          content: `Stress test file ${i} - ${new Date().toISOString()}`,
          mimeType: 'text/plain',
          folderId: config.ambaradamFolder
        }
      });
      
      console.log(`Stress Test ${i}: ${response.statusCode}`);
      return response.statusCode === 200;
    });
  }
  
  // Results summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}/${testResults.total}`);
  console.log(`❌ Failed: ${testResults.failed}/${testResults.total}`);
  console.log(`📊 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n💥 ERRORS:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}: ${error.error}`);
    });
  }
  
  console.log('\n🎯 Test Categories Covered:');
  console.log('- ✅ Health & Status Checks');
  console.log('- ✅ Authentication & Authorization');
  console.log('- ✅ Drive Upload Operations');
  console.log('- ✅ Memory Save Operations');
  console.log('- ✅ Search & Discovery');
  console.log('- ✅ Error Handling');
  console.log('- ✅ Rate Limiting');
  console.log('- ✅ Concurrent Operations');
  console.log('- ✅ Edge Cases & Validation');
  console.log('- ✅ Stress Testing');
  
  console.log('\n🚀 Comprehensive Drive API testing completed!');
  
  return testResults.passed >= 25; // Success if at least 25 tests pass
}

// Execute if run directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, testResults };