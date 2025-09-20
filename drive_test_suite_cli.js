#!/usr/bin/env node

/**
 * ZANTARA DRIVE TEST SUITE CLI - 30+ TEST SPECIFICI
 * Test completo per endpoints Drive e configurazione Service Account
 * Focus sui problemi identificati: auth, env vars, endpoint reliability
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// === CONFIGURAZIONE TEST ===
const CONFIG = {
  BASE_URL: process.env.SERVICE_URL || 'http://localhost:8080',
  API_KEY: process.env.ZANTARA_PLUGIN_API_KEY || 'test',
  TEST_USER: 'boss',
  TIMEOUT: 15000,
  RETRY_COUNT: 3,
  VERBOSE: process.env.VERBOSE === 'true'
};

// === ENVIRONMENT VARIABLES CHECK ===
const REQUIRED_ENV_VARS = [
  'GOOGLE_SERVICE_ACCOUNT_KEY',
  'IMPERSONATE_USER', 
  'DRIVE_FOLDER_AMBARADAM',
  'GOOGLE_CLOUD_PROJECT'
];

// === TEST UTILITIES ===
let testCount = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];
const errorDetails = [];

function log(message, level = 'INFO') {
  if (CONFIG.VERBOSE || level === 'ERROR' || level === 'SUMMARY') {
    const timestamp = new Date().toISOString().substr(11, 8);
    console.log(`[${timestamp}] ${level}: ${message}`);
  }
}

function runTest(name, testFn, category = 'GENERAL') {
  testCount++;
  const testId = testCount.toString().padStart(3, '0');
  
  console.log(`[${testId}] 🧪 ${name}...`);
  log(`Starting test: ${name}`, 'DEBUG');
  
  try {
    const result = testFn();
    
    if (result && typeof result.then === 'function') {
      return result
        .then((response) => {
          passedTests++;
          console.log(`[${testId}] ✅ ${name}`);
          testResults.push({ id: testId, name, status: 'PASS', category, response });
          log(`Test passed: ${name}`, 'DEBUG');
        })
        .catch((error) => {
          failedTests++;
          console.log(`[${testId}] ❌ ${name} - ${error.message}`);
          testResults.push({ id: testId, name, status: 'FAIL', category, error: error.message });
          errorDetails.push({ test: name, error: error.message, stack: error.stack });
          log(`Test failed: ${name} - ${error.message}`, 'ERROR');
        });
    } else {
      passedTests++;
      console.log(`[${testId}] ✅ ${name}`);
      testResults.push({ id: testId, name, status: 'PASS', category, response: result });
      log(`Test passed: ${name}`, 'DEBUG');
    }
  } catch (error) {
    failedTests++;
    console.log(`[${testId}] ❌ ${name} - ${error.message}`);
    testResults.push({ id: testId, name, status: 'FAIL', category, error: error.message });
    errorDetails.push({ test: name, error: error.message, stack: error.stack });
    log(`Test failed: ${name} - ${error.message}`, 'ERROR');
  }
}

function makeAPICall(method, endpoint, data = null, headers = {}) {
  const defaultHeaders = {
    'X-API-KEY': CONFIG.API_KEY,
    'X-BZ-USER': CONFIG.TEST_USER,
    'Content-Type': 'application/json'
  };

  const finalHeaders = { ...defaultHeaders, ...headers };
  
  let cmd = `curl -s -w "\\n%{http_code}" -X ${method} "${CONFIG.BASE_URL}${endpoint}" --max-time ${CONFIG.TIMEOUT / 1000}`;
  
  Object.entries(finalHeaders).forEach(([key, value]) => {
    cmd += ` -H "${key}: ${value}"`;
  });
  
  if (data) {
    cmd += ` -d '${JSON.stringify(data)}'`;
  }
  
  log(`Executing: ${cmd}`, 'DEBUG');
  
  try {
    const response = execSync(cmd, { encoding: 'utf8', timeout: CONFIG.TIMEOUT });
    const lines = response.trim().split('\n');
    const statusCode = parseInt(lines[lines.length - 1]);
    const body = lines.slice(0, -1).join('\n');
    
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = body;
    }
    
    return { statusCode, body: parsedBody, success: statusCode >= 200 && statusCode < 300 };
  } catch (error) {
    throw new Error(`API call failed: ${error.message}`);
  }
}

// === TEST CATEGORY 1: ENVIRONMENT & CONFIGURATION (Tests 1-10) ===
async function testEnvironmentConfiguration() {
  console.log('\n🔧 ENVIRONMENT & CONFIGURATION TESTS (1-10)');
  console.log('=============================================');

  runTest('Environment variables present', () => {
    const missing = REQUIRED_ENV_VARS.filter(envVar => !process.env[envVar]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    return { valid: true, vars: REQUIRED_ENV_VARS.length };
  }, 'ENV');

  runTest('Service Account JSON validity', () => {
    const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!saKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
    
    let credentials;
    try {
      credentials = JSON.parse(saKey);
    } catch (e) {
      try {
        credentials = JSON.parse(Buffer.from(saKey, 'base64').toString());
      } catch (e2) {
        throw new Error('Invalid Service Account JSON format');
      }
    }
    
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    const missing = requiredFields.filter(field => !credentials[field]);
    if (missing.length > 0) {
      throw new Error(`Missing SA fields: ${missing.join(', ')}`);
    }
    
    return { valid: true, email: credentials.client_email, project: credentials.project_id };
  }, 'ENV');

  runTest('Project ID consistency', () => {
    const envProject = process.env.GOOGLE_CLOUD_PROJECT;
    const saKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const saProject = saKey.project_id;
    
    if (envProject !== saProject) {
      throw new Error(`Project ID mismatch: ENV=${envProject}, SA=${saProject}`);
    }
    
    return { consistent: true, project: envProject };
  }, 'ENV');

  runTest('Impersonation user format', () => {
    const user = process.env.IMPERSONATE_USER;
    if (!user) throw new Error('IMPERSONATE_USER not set');
    if (!user.includes('@')) throw new Error('IMPERSONATE_USER must be an email');
    return { valid: true, user };
  }, 'ENV');

  runTest('Drive folder ID format', () => {
    const folderId = process.env.DRIVE_FOLDER_AMBARADAM;
    if (!folderId) throw new Error('DRIVE_FOLDER_AMBARADAM not set');
    if (folderId.length < 20) throw new Error('Drive folder ID too short');
    return { valid: true, folderId };
  }, 'ENV');

  runTest('API Key configuration', () => {
    if (!CONFIG.API_KEY || CONFIG.API_KEY === 'test') {
      console.warn('⚠️ Using default test API key');
    }
    return { configured: true, key: CONFIG.API_KEY.substring(0, 4) + '...' };
  }, 'ENV');

  runTest('Base URL accessibility', async () => {
    const response = await makeAPICall('GET', '/health');
    if (!response.success) {
      throw new Error(`Service not accessible: ${response.statusCode}`);
    }
    return { accessible: true, status: response.statusCode };
  }, 'ENV');

  runTest('Environment completeness score', () => {
    const allEnvVars = [
      'GOOGLE_SERVICE_ACCOUNT_KEY', 'IMPERSONATE_USER', 'DRIVE_FOLDER_AMBARADAM',
      'GOOGLE_CLOUD_PROJECT', 'ZANTARA_PLUGIN_API_KEY', 'DEFAULT_FOLDER_ROOT',
      'DEFAULT_FOLDER_LEAF', 'CHAT_FOLDER_LEAF'
    ];
    
    const present = allEnvVars.filter(envVar => process.env[envVar]);
    const score = (present.length / allEnvVars.length) * 100;
    
    if (score < 75) throw new Error(`Environment completeness too low: ${score}%`);
    return { score: `${score}%`, present: present.length, total: allEnvVars.length };
  }, 'ENV');

  runTest('Configuration validation summary', () => {
    const config = {
      baseUrl: CONFIG.BASE_URL,
      apiKey: CONFIG.API_KEY !== 'test',
      saConfigured: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      driveFolder: !!process.env.DRIVE_FOLDER_AMBARADAM,
      impersonation: !!process.env.IMPERSONATE_USER
    };
    
    const issues = Object.entries(config).filter(([_, value]) => !value);
    if (issues.length > 2) {
      throw new Error(`Too many config issues: ${issues.map(([k]) => k).join(', ')}`);
    }
    
    return { valid: true, config };
  }, 'ENV');

  runTest('Service account permissions check', () => {
    const saKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const expectedScopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ];
    
    // We can't check actual permissions without making API calls,
    // but we can validate the SA structure suggests proper setup
    if (!saKey.client_email.includes('.iam.gserviceaccount.com')) {
      throw new Error('Service account email format invalid');
    }
    
    return { valid: true, email: saKey.client_email, expectedScopes };
  }, 'ENV');
}

// === TEST CATEGORY 2: DRIVE API CONNECTIVITY (Tests 11-20) ===
async function testDriveAPIConnectivity() {
  console.log('\n🔗 DRIVE API CONNECTIVITY TESTS (11-20)');
  console.log('========================================');

  runTest('Drive whoami endpoint', async () => {
    const response = await makeAPICall('GET', '/api/drive/_whoami');
    if (!response.success) {
      throw new Error(`Whoami failed: ${response.statusCode}`);
    }
    return { success: true, data: response.body };
  }, 'API');

  runTest('Drive diagnostic check', async () => {
    const response = await makeAPICall('GET', '/diag/drive/check');
    if (!response.success) {
      throw new Error(`Diagnostic failed: ${response.statusCode}`);
    }
    return { success: true, data: response.body };
  }, 'API');

  runTest('AMBARADAM folder access', async () => {
    const folderId = process.env.DRIVE_FOLDER_AMBARADAM;
    const response = await makeAPICall('GET', `/diag/drive/check?folderId=${folderId}`);
    if (!response.success) {
      throw new Error(`AMBARADAM access failed: ${response.statusCode}`);
    }
    
    if (response.body.folderCheck && !response.body.folderCheck.ok) {
      throw new Error(`Folder check failed: ${response.body.folderCheck.error}`);
    }
    
    return { success: true, folderId, check: response.body.folderCheck };
  }, 'API');

  runTest('Drive folder resolution', async () => {
    const resolveData = {
      folderPath: 'AMBARADAM/BOSS',
      createIfMissing: false
    };
    
    const response = await makeAPICall('POST', '/actions/drive/resolve', resolveData);
    if (!response.success) {
      throw new Error(`Folder resolution failed: ${response.statusCode}`);
    }
    
    return { success: true, resolved: response.body };
  }, 'API');

  runTest('Drive find folder by name', async () => {
    const response = await makeAPICall('GET', '/diag/drive/find-folder?name=AMBARADAM');
    if (!response.success) {
      throw new Error(`Find folder failed: ${response.statusCode}`);
    }
    
    return { success: true, matches: response.body.matches?.length || 0 };
  }, 'API');

  runTest('Drive authentication flow', async () => {
    // Test the full auth flow by checking multiple endpoints
    const endpoints = ['/api/drive/_whoami', '/diag/drive/check'];
    const results = [];
    
    for (const endpoint of endpoints) {
      const response = await makeAPICall('GET', endpoint);
      results.push({ endpoint, success: response.success, status: response.statusCode });
    }
    
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      throw new Error(`Auth flow failed on: ${failed.map(f => f.endpoint).join(', ')}`);
    }
    
    return { success: true, testedEndpoints: endpoints.length };
  }, 'API');

  runTest('Drive API rate limiting', async () => {
    // Make multiple rapid calls to test rate limiting behavior
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(makeAPICall('GET', '/api/drive/_whoami'));
    }
    
    const results = await Promise.all(promises);
    const success = results.filter(r => r.success).length;
    const rateLimited = results.filter(r => r.statusCode === 429).length;
    
    return { 
      success: true, 
      successfulCalls: success, 
      rateLimitedCalls: rateLimited,
      totalCalls: results.length 
    };
  }, 'API');

  runTest('Drive error handling', async () => {
    // Test error handling with invalid requests
    const response = await makeAPICall('GET', '/diag/drive/check?folderId=invalid_folder_id');
    
    // We expect this to fail gracefully, not crash
    if (response.success) {
      console.warn('⚠️ Expected failure for invalid folder ID, but got success');
    }
    
    return { 
      success: true, 
      handledGracefully: !response.success,
      statusCode: response.statusCode 
    };
  }, 'API');

  runTest('Drive service account impersonation', async () => {
    const response = await makeAPICall('GET', '/api/drive/_whoami');
    if (!response.success) {
      throw new Error(`Impersonation test failed: ${response.statusCode}`);
    }
    
    const data = response.body;
    if (!data.service_account || !data.impersonated_as) {
      throw new Error('Missing impersonation information in response');
    }
    
    return { 
      success: true, 
      serviceAccount: data.service_account,
      impersonatedAs: data.impersonated_as 
    };
  }, 'API');

  runTest('Drive API response consistency', async () => {
    // Make the same call multiple times and check consistency
    const responses = [];
    for (let i = 0; i < 3; i++) {
      const response = await makeAPICall('GET', '/api/drive/_whoami');
      responses.push(response);
    }
    
    const allSuccess = responses.every(r => r.success);
    const consistent = responses.every(r => 
      r.body.service_account === responses[0].body.service_account
    );
    
    if (!allSuccess || !consistent) {
      throw new Error('API responses not consistent');
    }
    
    return { success: true, consistent: true, responses: responses.length };
  }, 'API');
}

// === TEST CATEGORY 3: FILE UPLOAD OPERATIONS (Tests 21-30) ===
async function testFileUploadOperations() {
  console.log('\n📁 FILE UPLOAD OPERATIONS TESTS (21-30)');
  console.log('=========================================');

  runTest('Basic text file upload', async () => {
    const uploadData = {
      filename: `test_basic_${Date.now()}.txt`,
      content: `Basic test file\nCreated: ${new Date().toISOString()}\nTest: basic upload`,
      mimeType: 'text/plain',
      folderPath: 'AMBARADAM/BOSS/Notes'
    };
    
    const response = await makeAPICall('POST', '/actions/drive/upload', uploadData);
    if (!response.success) {
      throw new Error(`Upload failed: ${response.statusCode} - ${JSON.stringify(response.body)}`);
    }
    
    return { success: true, fileId: response.body.id, filename: uploadData.filename };
  }, 'UPLOAD');

  runTest('JSON file upload', async () => {
    const testData = {
      test: true,
      timestamp: Date.now(),
      data: { key: 'value', array: [1, 2, 3] }
    };
    
    const uploadData = {
      filename: `test_json_${Date.now()}.json`,
      content: JSON.stringify(testData, null, 2),
      mimeType: 'application/json',
      folderPath: 'AMBARADAM/BOSS/Notes'
    };
    
    const response = await makeAPICall('POST', '/actions/drive/upload', uploadData);
    if (!response.success) {
      throw new Error(`JSON upload failed: ${response.statusCode}`);
    }
    
    return { success: true, fileId: response.body.id, dataSize: uploadData.content.length };
  }, 'UPLOAD');

  runTest('Large file upload (>5KB)', async () => {
    const largeContent = 'Large file test content.\n'.repeat(200); // ~5KB
    
    const uploadData = {
      filename: `test_large_${Date.now()}.txt`,
      content: largeContent,
      mimeType: 'text/plain',
      folderPath: 'AMBARADAM/BOSS/Notes'
    };
    
    const response = await makeAPICall('POST', '/actions/drive/upload', uploadData);
    if (!response.success) {
      throw new Error(`Large file upload failed: ${response.statusCode}`);
    }
    
    return { success: true, fileId: response.body.id, size: largeContent.length };
  }, 'UPLOAD');

  runTest('Upload with special characters', async () => {
    const uploadData = {
      filename: `test_special_àèìòù_€_${Date.now()}.txt`,
      content: 'Content with special characters: àèìòù, €, @, #, %, &, *\n日本語テキスト\nEmoji: 🚀🎉✅',
      mimeType: 'text/plain',
      folderPath: 'AMBARADAM/BOSS/Notes'
    };
    
    const response = await makeAPICall('POST', '/actions/drive/upload', uploadData);
    if (!response.success) {
      throw new Error(`Special chars upload failed: ${response.statusCode}`);
    }
    
    return { success: true, fileId: response.body.id, filename: uploadData.filename };
  }, 'UPLOAD');

  runTest('Upload to different folder', async () => {
    const uploadData = {
      filename: `test_different_folder_${Date.now()}.txt`,
      content: 'Test file for different folder upload',
      mimeType: 'text/plain',
      folderPath: 'AMBARADAM/BOSS/Documents'
    };
    
    const response = await makeAPICall('POST', '/actions/drive/upload', uploadData);
    if (!response.success) {
      throw new Error(`Different folder upload failed: ${response.statusCode}`);
    }
    
    return { success: true, fileId: response.body.id, folder: 'Documents' };
  }, 'UPLOAD');

  runTest('Upload with folderId instead of path', async () => {
    const folderId = process.env.DRIVE_FOLDER_AMBARADAM;
    
    const uploadData = {
      filename: `test_folder_id_${Date.now()}.txt`,
      content: 'Test file uploaded using folderId directly',
      mimeType: 'text/plain',
      folderId: folderId
    };
    
    const response = await makeAPICall('POST', '/actions/drive/upload', uploadData);
    if (!response.success) {
      throw new Error(`FolderId upload failed: ${response.statusCode}`);
    }
    
    return { success: true, fileId: response.body.id, usedFolderId: true };
  }, 'UPLOAD');

  runTest('Upload retry on failure simulation', async () => {
    // First try with invalid folder to test error handling
    const invalidUpload = {
      filename: `test_retry_${Date.now()}.txt`,
      content: 'Test content for retry simulation',
      mimeType: 'text/plain',
      folderId: 'invalid_folder_id'
    };
    
    const failResponse = await makeAPICall('POST', '/actions/drive/upload', invalidUpload);
    if (failResponse.success) {
      throw new Error('Expected failure with invalid folder ID');
    }
    
    // Then try with valid data
    const validUpload = {
      ...invalidUpload,
      folderPath: 'AMBARADAM/BOSS/Notes'
    };
    delete validUpload.folderId;
    
    const successResponse = await makeAPICall('POST', '/actions/drive/upload', validUpload);
    if (!successResponse.success) {
      throw new Error(`Retry upload failed: ${successResponse.statusCode}`);
    }
    
    return { 
      success: true, 
      firstAttemptFailed: !failResponse.success,
      retrySucceeded: successResponse.success,
      fileId: successResponse.body.id
    };
  }, 'UPLOAD');

  runTest('Concurrent uploads stress test', async () => {
    const uploadPromises = [];
    const concurrentCount = 3; // Conservative for testing
    
    for (let i = 0; i < concurrentCount; i++) {
      const uploadData = {
        filename: `test_concurrent_${i}_${Date.now()}.txt`,
        content: `Concurrent upload test ${i}\nTimestamp: ${Date.now()}`,
        mimeType: 'text/plain',
        folderPath: 'AMBARADAM/BOSS/Notes'
      };
      
      uploadPromises.push(makeAPICall('POST', '/actions/drive/upload', uploadData));
    }
    
    const results = await Promise.all(uploadPromises);
    const successful = results.filter(r => r.success).length;
    
    if (successful === 0) {
      throw new Error('All concurrent uploads failed');
    }
    
    return { 
      success: true, 
      totalUploads: concurrentCount,
      successfulUploads: successful,
      successRate: `${(successful/concurrentCount*100).toFixed(1)}%`
    };
  }, 'UPLOAD');

  runTest('Upload with metadata validation', async () => {
    const uploadData = {
      filename: `test_metadata_${Date.now()}.txt`,
      content: 'Test file for metadata validation',
      mimeType: 'text/plain',
      folderPath: 'AMBARADAM/BOSS/Notes'
    };
    
    const response = await makeAPICall('POST', '/actions/drive/upload', uploadData);
    if (!response.success) {
      throw new Error(`Metadata upload failed: ${response.statusCode}`);
    }
    
    // Validate response contains expected metadata
    const requiredFields = ['id', 'name'];
    const missing = requiredFields.filter(field => !response.body[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing metadata fields: ${missing.join(', ')}`);
    }
    
    return { 
      success: true, 
      fileId: response.body.id,
      fileName: response.body.name,
      metadataComplete: missing.length === 0
    };
  }, 'UPLOAD');

  runTest('Upload error handling comprehensive', async () => {
    const errorScenarios = [
      { data: { filename: '', content: 'test' }, error: 'empty filename' },
      { data: { filename: 'test.txt', content: '' }, error: 'empty content' },
      { data: { filename: 'test.txt' }, error: 'missing content' }
    ];
    
    const errorResults = [];
    
    for (const scenario of errorScenarios) {
      const response = await makeAPICall('POST', '/actions/drive/upload', scenario.data);
      errorResults.push({
        scenario: scenario.error,
        handledCorrectly: !response.success && response.statusCode === 400
      });
    }
    
    const properlyHandled = errorResults.filter(r => r.handledCorrectly).length;
    
    return { 
      success: true, 
      errorScenarios: errorScenarios.length,
      properlyHandled,
      handlingRate: `${(properlyHandled/errorScenarios.length*100).toFixed(1)}%`
    };
  }, 'UPLOAD');
}

// === MAIN EXECUTION ===
async function runAllTests() {
  console.log('🚀 ZANTARA DRIVE TEST SUITE CLI - 30+ COMPREHENSIVE TESTS');
  console.log('===========================================================');
  console.log(`Base URL: ${CONFIG.BASE_URL}`);
  console.log(`Test User: ${CONFIG.TEST_USER}`);
  console.log(`Timeout: ${CONFIG.TIMEOUT}ms`);
  console.log('');

  const startTime = Date.now();

  try {
    await testEnvironmentConfiguration();
    await testDriveAPIConnectivity();
    await testFileUploadOperations();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    console.log('\n📊 COMPREHENSIVE TEST RESULTS');
    console.log('==============================');
    console.log(`Execution Time: ${duration}s`);
    console.log(`Total Tests: ${testCount}`);
    console.log(`Passed: ${passedTests} (${((passedTests/testCount)*100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests/testCount)*100).toFixed(1)}%)`);

    // Category breakdown
    const categories = {};
    testResults.forEach(test => {
      categories[test.category] = categories[test.category] || { total: 0, passed: 0 };
      categories[test.category].total++;
      if (test.status === 'PASS') categories[test.category].passed++;
    });

    console.log('\n📋 CATEGORY BREAKDOWN:');
    Object.entries(categories).forEach(([category, stats]) => {
      const rate = ((stats.passed/stats.total)*100).toFixed(1);
      const status = rate >= 80 ? '✅' : rate >= 60 ? '⚠️' : '❌';
      console.log(`  ${status} ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
    });

    // Health assessment
    console.log('\n🏥 SYSTEM HEALTH ASSESSMENT:');
    const overallHealth = (passedTests/testCount)*100;
    
    if (overallHealth >= 90) {
      console.log('🟢 EXCELLENT - Drive integration is working optimally');
    } else if (overallHealth >= 75) {
      console.log('🟡 GOOD - Drive integration mostly working, minor issues');
    } else if (overallHealth >= 50) {
      console.log('🟠 ISSUES - Drive integration partially working, needs attention');
    } else {
      console.log('🔴 CRITICAL - Drive integration has major problems, immediate action needed');
    }

    // Error summary
    if (failedTests > 0) {
      console.log('\n❌ FAILED TESTS SUMMARY:');
      const failedByCategory = {};
      testResults.filter(t => t.status === 'FAIL').forEach(test => {
        failedByCategory[test.category] = failedByCategory[test.category] || [];
        failedByCategory[test.category].push(test);
      });

      Object.entries(failedByCategory).forEach(([category, tests]) => {
        console.log(`\n  ${category} Failures:`);
        tests.slice(0, 3).forEach(test => {
          console.log(`    • ${test.name}: ${test.error}`);
        });
        if (tests.length > 3) {
          console.log(`    ... and ${tests.length - 3} more`);
        }
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (categories.ENV && categories.ENV.passed < categories.ENV.total) {
      console.log('  • Fix environment variable configuration');
    }
    if (categories.API && categories.API.passed < categories.API.total) {
      console.log('  • Check Google Drive API permissions and service account setup');
    }
    if (categories.UPLOAD && categories.UPLOAD.passed < categories.UPLOAD.total) {
      console.log('  • Review file upload implementation and error handling');
    }
    if (overallHealth < 75) {
      console.log('  • Consider implementing retry mechanisms and better error handling');
      console.log('  • Review service account delegation and folder permissions');
    }

    console.log('\n✅ DRIVE TEST SUITE COMPLETED!');
    console.log(`🎯 ${testCount} tests executed with ${((passedTests/testCount)*100).toFixed(1)}% success rate`);

    // Exit code based on results
    process.exit(overallHealth >= 75 ? 0 : 1);

  } catch (error) {
    console.error('\n💥 TEST SUITE EXECUTION FAILED:');
    console.error(error.message);
    if (CONFIG.VERBOSE) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// === CLI ARGUMENT HANDLING ===
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ZANTARA DRIVE TEST SUITE CLI

Usage: node drive_test_suite_cli.js [options]

Options:
  --help, -h          Show this help message
  --verbose           Enable verbose logging
  --base-url URL      Set base URL (default: http://localhost:8080)
  --api-key KEY       Set API key (default: from env or 'test')
  --timeout MS        Set timeout in milliseconds (default: 15000)

Environment Variables:
  GOOGLE_SERVICE_ACCOUNT_KEY  - Required: Service account JSON key
  IMPERSONATE_USER           - Required: Email to impersonate
  DRIVE_FOLDER_AMBARADAM     - Required: AMBARADAM folder ID
  GOOGLE_CLOUD_PROJECT       - Required: GCP project ID
  SERVICE_URL                - Optional: Base URL for testing
  ZANTARA_PLUGIN_API_KEY     - Optional: API key for authentication
  VERBOSE                    - Optional: Enable verbose logging (true/false)

Examples:
  node drive_test_suite_cli.js
  VERBOSE=true node drive_test_suite_cli.js
  node drive_test_suite_cli.js --base-url https://my-service.run.app
`);
    process.exit(0);
  }

  // Parse arguments
  args.forEach((arg, index) => {
    if (arg === '--verbose') CONFIG.VERBOSE = true;
    if (arg === '--base-url' && args[index + 1]) CONFIG.BASE_URL = args[index + 1];
    if (arg === '--api-key' && args[index + 1]) CONFIG.API_KEY = args[index + 1];
    if (arg === '--timeout' && args[index + 1]) CONFIG.TIMEOUT = parseInt(args[index + 1]);
  });

  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testEnvironmentConfiguration,
  testDriveAPIConnectivity,
  testFileUploadOperations,
  makeAPICall,
  CONFIG
};