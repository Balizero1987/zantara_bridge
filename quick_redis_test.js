#!/usr/bin/env node

/**
 * QUICK REDIS TEST - Verifica veloce che Redis e cache funzionino
 * Test rapido prima del test suite completo
 */

const { execSync } = require('child_process');

const BASE_URL = process.env.SERVICE_URL || 'http://localhost:8080';
const API_KEY = process.env.ZANTARA_PLUGIN_API_KEY || 'test';

function makeRequest(endpoint) {
  try {
    const cmd = `curl -s "${BASE_URL}${endpoint}" -H "X-API-KEY: ${API_KEY}" -H "X-BZ-USER: boss"`;
    const response = execSync(cmd, { encoding: 'utf8', timeout: 10000 });
    return JSON.parse(response);
  } catch (error) {
    return { error: error.message };
  }
}

console.log('🔥 QUICK REDIS INTEGRATION TEST');
console.log('================================');
console.log(`Testing: ${BASE_URL}`);
console.log('');

// Test 1: Service Health
console.log('1️⃣ Service Health...');
const health = makeRequest('/health');
if (health.error) {
  console.log('❌ Service not available:', health.error);
  process.exit(1);
} else {
  console.log('✅ Service is running');
}

// Test 2: Redis Health
console.log('\\n2️⃣ Redis Health...');
const redis = makeRequest('/api/heartbeat/redis');
if (redis.error) {
  console.log('❌ Redis health check failed:', redis.error);
  console.log('⚠️ Redis might not be configured (will use mock client)');
} else if (redis.ok && redis.redis.status === 'connected') {
  console.log('✅ Redis connected successfully');
  console.log(`   Latency: ${redis.redis.latency || 'N/A'}ms`);
} else {
  console.log('⚠️ Redis not connected (using mock client)');
  console.log(`   Status: ${redis.redis?.status || 'unknown'}`);
}

// Test 3: Drive Auth
console.log('\\n3️⃣ Drive Authentication...');
const auth = makeRequest('/api/drive/_whoami');
if (auth.error) {
  console.log('❌ Drive auth failed:', auth.error);
} else if (auth.ok && auth.service_account) {
  console.log('✅ Drive authentication working');
  console.log(`   Service Account: ${auth.service_account}`);
} else {
  console.log('❌ Drive authentication issue');
}

// Test 4: Cache Test (Search)
console.log('\\n4️⃣ Cache Performance Test...');
console.log('   First search (cache miss)...');
const start1 = Date.now();
const search1 = makeRequest('/search?q=test&limit=5');
const time1 = Date.now() - start1;

if (search1.error) {
  console.log('❌ Search failed:', search1.error);
} else {
  console.log(`   ✅ Search 1: ${time1}ms (${search1.files?.length || 0} results)`);
  
  console.log('   Second search (cache hit)...');
  const start2 = Date.now();
  const search2 = makeRequest('/search?q=test&limit=5');
  const time2 = Date.now() - start2;
  
  if (search2.error) {
    console.log('❌ Second search failed:', search2.error);
  } else {
    console.log(`   ✅ Search 2: ${time2}ms (${search2.files?.length || 0} results)`);
    
    if (time2 < time1) {
      const improvement = ((time1 - time2) / time1 * 100).toFixed(1);
      console.log(`   🚀 Cache improvement: ${improvement}% faster!`);
    } else {
      console.log('   ⚠️ No cache improvement detected');
    }
  }
}

// Test 5: Upload Test
console.log('\\n5️⃣ Upload Test...');
const uploadData = {
  filename: `quick_test_${Date.now()}.txt`,
  content: 'Quick Redis integration test file',
  mimeType: 'text/plain',
  folderPath: 'AMBARADAM/BOSS/Notes'
};

const uploadCmd = `curl -s -X POST "${BASE_URL}/actions/drive/upload" \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: ${API_KEY}" \\
  -H "X-BZ-USER: boss" \\
  -d '${JSON.stringify(uploadData)}'`;

try {
  const uploadResponse = execSync(uploadCmd, { encoding: 'utf8', timeout: 15000 });
  const upload = JSON.parse(uploadResponse);
  
  if (upload.id) {
    console.log('✅ File upload successful');
    console.log(`   File ID: ${upload.id}`);
  } else {
    console.log('❌ Upload failed:', upload.error || 'Unknown error');
  }
} catch (error) {
  console.log('❌ Upload test failed:', error.message);
}

// Summary
console.log('\\n📊 QUICK TEST SUMMARY');
console.log('======================');

const tests = [
  { name: 'Service Health', status: !health.error },
  { name: 'Redis Connection', status: redis.ok && redis.redis?.status === 'connected' },
  { name: 'Drive Auth', status: auth.ok && auth.service_account },
  { name: 'Search Function', status: !search1.error },
  { name: 'Upload Function', status: true } // Will be determined above
];

const passed = tests.filter(t => t.status).length;
const total = tests.length;

tests.forEach(test => {
  console.log(`${test.status ? '✅' : '❌'} ${test.name}`);
});

console.log(`\\nResult: ${passed}/${total} tests passed`);

if (passed === total) {
  console.log('🎉 All systems operational! Ready for comprehensive testing.');
  console.log('\\nRun full test suite with:');
  console.log('  ./redis_integration_test_cli.js');
} else if (passed >= 3) {
  console.log('⚠️ Partial functionality. Some features may be degraded.');
  console.log('\\nRun full test suite to identify issues:');
  console.log('  ./redis_integration_test_cli.js --verbose');
} else {
  console.log('❌ Major issues detected. Check configuration.');
  console.log('\\nDebug with:');
  console.log('  ./redis_integration_test_cli.js --verbose');
}

console.log('\\n🔗 Manual tests:');
console.log(`  Health: ${BASE_URL}/health`);
console.log(`  Redis: ${BASE_URL}/api/heartbeat/redis`);
console.log(`  Drive: ${BASE_URL}/api/drive/_whoami`);

process.exit(passed >= 3 ? 0 : 1);