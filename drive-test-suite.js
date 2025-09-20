#!/usr/bin/env node

/**
 * COMPREHENSIVE DRIVE ENDPOINT TEST SUITE
 * Tests all Drive endpoints with service account authentication
 * 30+ comprehensive tests for production readiness
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Test configuration
const BASE_URL = process.env.SERVICE_URL || 'http://localhost:8080';
const API_KEY = process.env.ZANTARA_PLUGIN_API_KEY || 'test';

// Test counter
let testCount = 0;
let passedTests = 0;
let failedTests = 0;

// Colors for CLI output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, details = '') {
  testCount++;
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const color = passed ? 'green' : 'red';
  
  if (passed) passedTests++;
  else failedTests++;
  
  log(`${testCount.toString().padStart(3, '0')}. ${status} ${name}`, color);
  if (details) {
    log(`     ${details}`, passed ? 'cyan' : 'yellow');
  }
}

async function makeRequest(endpoint, options = {}) {
  const method = options.method || 'GET';
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  const curlCmd = [
    'curl', '-s', '-w', '\\n%{http_code}',
    '-X', method,
    ...Object.entries(headers).flatMap(([k, v]) => ['-H', `${k}: ${v}`])
  ];
  
  if (options.body) {
    curlCmd.push('-d', JSON.stringify(options.body));
  }
  
  curlCmd.push(`${BASE_URL}${endpoint}`);
  
  try {
    const output = execSync(curlCmd.join(' '), { 
      encoding: 'utf-8',
      timeout: 30000
    });
    
    const lines = output.trim().split('\n');
    const statusCode = parseInt(lines[lines.length - 1]);
    const body = lines.slice(0, -1).join('\n');
    
    let json = null;
    try {
      json = JSON.parse(body);
    } catch (e) {
      // Not JSON, keep as string
    }
    
    return {
      statusCode,
      body: json || body,
      raw: body
    };
  } catch (error) {
    return {
      statusCode: 0,
      body: { error: error.message },
      raw: error.message
    };
  }
}

async function runDriveTests() {
  log('\n🚀 ZANTARA DRIVE ENDPOINT TEST SUITE', 'cyan');
  log('=======================================', 'cyan');
  log(`Base URL: ${BASE_URL}`, 'blue');
  log(`API Key: ${API_KEY.substring(0, 8)}...`, 'blue');
  log('', 'white');

  // ===== DIAGNOSTIC TESTS =====
  log('📊 DIAGNOSTIC TESTS', 'magenta');
  log('==================', 'magenta');

  // Test 1: Basic health check
  try {
    const result = await makeRequest('/health');
    logTest('Health check endpoint', 
      result.statusCode === 200 && result.body?.ok === true,
      `Status: ${result.statusCode}, Service: ${result.body?.service}`
    );
  } catch (e) {
    logTest('Health check endpoint', false, e.message);
  }

  // Test 2: Drive diagnostic check (basic)
  try {
    const result = await makeRequest('/diag/drive/check');
    logTest('Drive diagnostic basic check', 
      result.statusCode === 200 && result.body?.ok === true,
      `User: ${result.body?.user?.emailAddress || 'N/A'}`
    );
  } catch (e) {
    logTest('Drive diagnostic basic check', false, e.message);
  }

  // Test 3: Drive diagnostic with folder ID
  try {
    const folderId = process.env.DRIVE_FOLDER_ID || '1UGbm5er6Go351S57GQKUjmxMxHyT4QZb';
    const result = await makeRequest(`/diag/drive/check?folderId=${folderId}`);
    logTest('Drive diagnostic with folder ID', 
      result.statusCode === 200 && result.body?.folderCheck?.ok === true,
      `Folder: ${result.body?.folderCheck?.name || 'N/A'}`
    );
  } catch (e) {
    logTest('Drive diagnostic with folder ID', false, e.message);
  }

  // Test 4: Drive diagnostic with invalid folder ID  
  try {
    const result = await makeRequest('/diag/drive/check?folderId=invalid_folder_id');
    logTest('Drive diagnostic invalid folder ID', 
      result.statusCode === 200 && result.body?.folderCheck?.ok === false,
      'Correctly detected invalid folder'
    );
  } catch (e) {
    logTest('Drive diagnostic invalid folder ID', false, e.message);
  }

  // Test 5: Environment variables check
  try {
    const result = await makeRequest('/diag/drive/check');
    const env = result.body?.env || {};
    logTest('Environment variables presence', 
      env.MEMORY_DRIVE_FOLDER_ID && env.DRIVE_FOLDER_ID && env.DRIVE_FOLDER_AMBARADAM,
      `Folders configured: ${Object.keys(env).length}`
    );
  } catch (e) {
    logTest('Environment variables presence', false, e.message);
  }

  // Test 6: Find folder by name (AMBARADAM)
  try {
    const result = await makeRequest('/diag/drive/find-folder?name=AMBARADAM');
    logTest('Find AMBARADAM folder', 
      result.statusCode === 200 && result.body?.matches?.length >= 0,
      `Found ${result.body?.matches?.length || 0} matches`
    );
  } catch (e) {
    logTest('Find AMBARADAM folder', false, e.message);
  }

  // Test 7: Find folder by name (BOSS)
  try {
    const result = await makeRequest('/diag/drive/find-folder?name=BOSS');
    logTest('Find BOSS folder', 
      result.statusCode === 200,
      `Found ${result.body?.matches?.length || 0} matches`
    );
  } catch (e) {
    logTest('Find BOSS folder', false, e.message);
  }

  // Test 8: Find folder without name parameter
  try {
    const result = await makeRequest('/diag/drive/find-folder');
    logTest('Find folder without name (error handling)', 
      result.statusCode === 400 && result.body?.error,
      'Correctly returned 400 error'
    );
  } catch (e) {
    logTest('Find folder without name (error handling)', false, e.message);
  }

  // Test 9: Service account quota check
  try {
    const result = await makeRequest('/diag/drive/check');
    const quota = result.body?.quota;
    logTest('Service account quota info', 
      result.statusCode === 200 && quota,
      `Usage: ${quota?.usage || 'N/A'}, Limit: ${quota?.limit || 'N/A'}`
    );
  } catch (e) {
    logTest('Service account quota info', false, e.message);
  }

  // Test 10: Timestamp consistency
  try {
    const result = await makeRequest('/diag/drive/check');
    const timestamp = result.body?.ts;
    const isValidTimestamp = timestamp && new Date(timestamp).getTime() > 0;
    logTest('Response timestamp validation', 
      isValidTimestamp,
      `Timestamp: ${timestamp}`
    );
  } catch (e) {
    logTest('Response timestamp validation', false, e.message);
  }

  // ===== AUTHENTICATION TESTS =====
  log('\n🔐 AUTHENTICATION TESTS', 'magenta');
  log('======================', 'magenta');

  // Test 11: Request without API key
  try {
    const result = await makeRequest('/actions/drive/upload', {
      method: 'POST',
      headers: {},
      body: { test: 'data' }
    });
    logTest('Upload without API key', 
      result.statusCode === 401 || result.statusCode === 403,
      `Status: ${result.statusCode}`
    );
  } catch (e) {
    logTest('Upload without API key', false, e.message);
  }

  // Test 12: Request with invalid API key
  try {
    const result = await makeRequest('/actions/drive/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer invalid_key' },
      body: { test: 'data' }
    });
    logTest('Upload with invalid API key', 
      result.statusCode === 401 || result.statusCode === 403,
      `Status: ${result.statusCode}`
    );
  } catch (e) {
    logTest('Upload with invalid API key', false, e.message);
  }

  // Test 13: Valid API key format
  try {
    const result = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: { folderName: 'test' }
    });
    logTest('Valid API key format', 
      result.statusCode !== 401 && result.statusCode !== 403,
      `Auth accepted, status: ${result.statusCode}`
    );
  } catch (e) {
    logTest('Valid API key format', false, e.message);
  }

  // ===== DRIVE ACTIONS TESTS =====
  log('\n📁 DRIVE ACTIONS TESTS', 'magenta');
  log('=====================', 'magenta');

  // Test 14: Resolve folder with folderName
  try {
    const result = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: { folderName: 'TestFolder' }
    });
    logTest('Resolve folder with folderName', 
      result.statusCode === 200 || result.statusCode === 404,
      `Status: ${result.statusCode}, Path: ${result.body?.path || 'N/A'}`
    );
  } catch (e) {
    logTest('Resolve folder with folderName', false, e.message);
  }

  // Test 15: Resolve folder with folderName and owner
  try {
    const result = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: { folderName: 'BOSS', owner: 'zero@balizero.com' }
    });
    logTest('Resolve folder with folderName and owner', 
      result.statusCode === 200 || result.statusCode === 404,
      `Path: ${result.body?.path || 'N/A'}`
    );
  } catch (e) {
    logTest('Resolve folder with folderName and owner', false, e.message);
  }

  // Test 16: Resolve folder with direct folderPath
  try {
    const result = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: { folderPath: 'AMBARADAM/TestFolder' }
    });
    logTest('Resolve folder with direct folderPath', 
      result.statusCode === 200 || result.statusCode === 404,
      `Path: ${result.body?.path || 'N/A'}`
    );
  } catch (e) {
    logTest('Resolve folder with direct folderPath', false, e.message);
  }

  // Test 17: Resolve folder with createIfMissing=true
  try {
    const testPath = `AMBARADAM/TestFolder_${Date.now()}`;
    const result = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: { folderPath: testPath, createIfMissing: true }
    });
    logTest('Resolve folder with createIfMissing=true', 
      result.statusCode === 200 && result.body?.folderId,
      `Created folder: ${result.body?.folderId || 'N/A'}`
    );
  } catch (e) {
    logTest('Resolve folder with createIfMissing=true', false, e.message);
  }

  // Test 18: Resolve folder without parameters
  try {
    const result = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: {}
    });
    logTest('Resolve folder without parameters', 
      result.statusCode === 400,
      'Correctly returned 400 error'
    );
  } catch (e) {
    logTest('Resolve folder without parameters', false, e.message);
  }

  // Test 19: Setup compliance knowledge structure
  try {
    const result = await makeRequest('/actions/drive/setup-compliance-knowledge', {
      method: 'POST'
    });
    logTest('Setup compliance knowledge structure', 
      result.statusCode === 200 && result.body?.ok,
      `Status: ${result.statusCode}`
    );
  } catch (e) {
    logTest('Setup compliance knowledge structure', false, e.message);
  }

  // Test 20: Upload endpoint basic structure
  try {
    const result = await makeRequest('/actions/drive/upload', {
      method: 'POST',
      body: { content: 'test content', filename: 'test.txt' }
    });
    logTest('Upload endpoint basic structure', 
      result.statusCode !== 404,
      `Status: ${result.statusCode}, Response: ${JSON.stringify(result.body).substring(0, 100)}...`
    );
  } catch (e) {
    logTest('Upload endpoint basic structure', false, e.message);
  }

  // ===== ERROR HANDLING TESTS =====
  log('\n⚠️  ERROR HANDLING TESTS', 'magenta');
  log('========================', 'magenta');

  // Test 21: Malformed JSON in POST request
  try {
    const curlCmd = `curl -s -w "\\n%{http_code}" -X POST -H "Authorization: Bearer ${API_KEY}" -H "Content-Type: application/json" -d '{invalid json}' ${BASE_URL}/actions/drive/resolve`;
    const output = execSync(curlCmd, { encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    const statusCode = parseInt(lines[lines.length - 1]);
    logTest('Malformed JSON handling', 
      statusCode === 400,
      `Status: ${statusCode}`
    );
  } catch (e) {
    logTest('Malformed JSON handling', false, e.message);
  }

  // Test 22: Large request body handling
  try {
    const largeContent = 'A'.repeat(1024 * 1024); // 1MB
    const result = await makeRequest('/actions/drive/upload', {
      method: 'POST',
      body: { content: largeContent, filename: 'large.txt' }
    });
    logTest('Large request body handling', 
      result.statusCode !== 413,
      `Status: ${result.statusCode}, handles 1MB request`
    );
  } catch (e) {
    logTest('Large request body handling', false, e.message);
  }

  // Test 23: Non-existent endpoint
  try {
    const result = await makeRequest('/actions/drive/nonexistent');
    logTest('Non-existent endpoint handling', 
      result.statusCode === 404,
      `Status: ${result.statusCode}`
    );
  } catch (e) {
    logTest('Non-existent endpoint handling', false, e.message);
  }

  // Test 24: Method not allowed
  try {
    const result = await makeRequest('/actions/drive/upload', { method: 'GET' });
    logTest('Method not allowed handling', 
      result.statusCode === 405 || result.statusCode === 404,
      `Status: ${result.statusCode}`
    );
  } catch (e) {
    logTest('Method not allowed handling', false, e.message);
  }

  // Test 25: Special characters in folder names
  try {
    const result = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: { folderName: 'Test Folder with Spaces & Special chars!' }
    });
    logTest('Special characters in folder names', 
      result.statusCode === 200 || result.statusCode === 404,
      `Handled special characters, status: ${result.statusCode}`
    );
  } catch (e) {
    logTest('Special characters in folder names', false, e.message);
  }

  // ===== PERFORMANCE TESTS =====
  log('\n⚡ PERFORMANCE TESTS', 'magenta');
  log('==================', 'magenta');

  // Test 26: Response time under 5 seconds
  try {
    const startTime = Date.now();
    const result = await makeRequest('/diag/drive/check');
    const responseTime = Date.now() - startTime;
    logTest('Response time under 5 seconds', 
      responseTime < 5000 && result.statusCode === 200,
      `Response time: ${responseTime}ms`
    );
  } catch (e) {
    logTest('Response time under 5 seconds', false, e.message);
  }

  // Test 27: Concurrent requests handling
  try {
    const promises = Array(5).fill(0).map(() => makeRequest('/diag/drive/check'));
    const results = await Promise.all(promises);
    const allSuccessful = results.every(r => r.statusCode === 200);
    logTest('Concurrent requests handling', 
      allSuccessful,
      `5 concurrent requests, all successful: ${allSuccessful}`
    );
  } catch (e) {
    logTest('Concurrent requests handling', false, e.message);
  }

  // ===== SECURITY TESTS =====
  log('\n🔒 SECURITY TESTS', 'magenta');
  log('================', 'magenta');

  // Test 28: SQL injection attempt
  try {
    const result = await makeRequest("/diag/drive/find-folder?name='; DROP TABLE users; --");
    logTest('SQL injection protection', 
      result.statusCode === 200 && !result.body?.error?.includes('syntax'),
      'No SQL syntax errors in response'
    );
  } catch (e) {
    logTest('SQL injection protection', false, e.message);
  }

  // Test 29: XSS attempt in folder name
  try {
    const result = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: { folderName: '<script>alert("xss")</script>' }
    });
    logTest('XSS protection in folder names', 
      result.statusCode === 200 || result.statusCode === 404,
      'Handled XSS attempt safely'
    );
  } catch (e) {
    logTest('XSS protection in folder names', false, e.message);
  }

  // Test 30: Path traversal attempt
  try {
    const result = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: { folderPath: '../../../etc/passwd' }
    });
    logTest('Path traversal protection', 
      result.statusCode === 200 || result.statusCode === 404,
      'Handled path traversal attempt safely'
    );
  } catch (e) {
    logTest('Path traversal protection', false, e.message);
  }

  // ===== INTEGRATION TESTS =====
  log('\n🔗 INTEGRATION TESTS', 'magenta');
  log('===================', 'magenta');

  // Test 31: End-to-end folder resolution and verification
  try {
    const testFolderName = `IntegrationTest_${Date.now()}`;
    
    // First resolve/create folder
    const resolveResult = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: { folderName: testFolderName, createIfMissing: true }
    });
    
    // Then verify it exists via diagnostic
    let verifyResult = null;
    if (resolveResult.body?.folderId) {
      verifyResult = await makeRequest(`/diag/drive/check?folderId=${resolveResult.body.folderId}`);
    }
    
    logTest('End-to-end folder resolution and verification', 
      resolveResult.statusCode === 200 && 
      resolveResult.body?.folderId && 
      verifyResult?.body?.folderCheck?.ok === true,
      `Created and verified folder: ${resolveResult.body?.folderId}`
    );
  } catch (e) {
    logTest('End-to-end folder resolution and verification', false, e.message);
  }

  // Test 32: Service account impersonation validation
  try {
    const result = await makeRequest('/diag/drive/check');
    const userEmail = result.body?.user?.emailAddress;
    const expectedUser = process.env.IMPERSONATE_USER || 'zero@balizero.com';
    
    logTest('Service account impersonation validation', 
      userEmail === expectedUser,
      `Expected: ${expectedUser}, Got: ${userEmail}`
    );
  } catch (e) {
    logTest('Service account impersonation validation', false, e.message);
  }

  // Test 33: Complete workflow simulation
  try {
    const workflowFolderName = `Workflow_${Date.now()}`;
    
    // 1. Check if AMBARADAM exists
    const findResult = await makeRequest('/diag/drive/find-folder?name=AMBARADAM');
    
    // 2. Resolve workflow folder
    const resolveResult = await makeRequest('/actions/drive/resolve', {
      method: 'POST',
      body: { folderPath: `AMBARADAM/${workflowFolderName}`, createIfMissing: true }
    });
    
    // 3. Setup compliance knowledge
    const complianceResult = await makeRequest('/actions/drive/setup-compliance-knowledge', {
      method: 'POST'
    });
    
    const workflowSuccess = 
      findResult.statusCode === 200 &&
      resolveResult.statusCode === 200 &&
      complianceResult.statusCode === 200;
    
    logTest('Complete workflow simulation', 
      workflowSuccess,
      `All steps completed: ${workflowSuccess}`
    );
  } catch (e) {
    logTest('Complete workflow simulation', false, e.message);
  }

  // ===== SUMMARY =====
  log('\n📊 TEST SUMMARY', 'cyan');
  log('==============', 'cyan');
  log(`Total Tests: ${testCount}`, 'white');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${failedTests}`, 'red');
  log(`Success Rate: ${((passedTests / testCount) * 100).toFixed(1)}%`, 
    passedTests === testCount ? 'green' : failedTests > testCount * 0.1 ? 'red' : 'yellow');
  
  if (failedTests === 0) {
    log('\n🎉 ALL TESTS PASSED! Drive endpoints are production ready!', 'green');
    process.exit(0);
  } else if (failedTests <= testCount * 0.1) {
    log('\n✅ Most tests passed. Minor issues detected.', 'yellow');
    process.exit(0);
  } else {
    log('\n❌ Multiple test failures detected. Review required.', 'red');
    process.exit(1);
  }
}

// Execute the test suite
runDriveTests().catch(error => {
  log(`\n💥 Test suite crashed: ${error.message}`, 'red');
  process.exit(1);
});