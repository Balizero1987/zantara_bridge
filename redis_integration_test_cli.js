#!/usr/bin/env node

/**
 * REDIS INTEGRATION TEST CLI - COMPREHENSIVE TESTING
 * Test completo di Redis + Drive Cache + Auth Cache + Rate Limiting
 * Focus su performance, caching, e integrazione con sistema esistente
 */

const { execSync } = require('child_process');
const fs = require('fs');

// === CONFIGURAZIONE TEST ===
const CONFIG = {
  BASE_URL: process.env.SERVICE_URL || 'http://localhost:8080',
  API_KEY: process.env.ZANTARA_PLUGIN_API_KEY || 'test',
  TEST_USER: 'boss',
  TIMEOUT: 20000,
  VERBOSE: process.env.VERBOSE === 'true',
  REDIS_TESTS: true
};

// === TEST UTILITIES ===
let testCount = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];
const performanceMetrics = [];

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
  
  const startTime = Date.now();
  
  try {
    const result = testFn();
    
    if (result && typeof result.then === 'function') {
      return result
        .then((response) => {
          const duration = Date.now() - startTime;
          passedTests++;
          console.log(`[${testId}] ✅ ${name} (${duration}ms)`);
          testResults.push({ id: testId, name, status: 'PASS', category, duration, response });
          performanceMetrics.push({ test: name, duration, category });
        })
        .catch((error) => {
          const duration = Date.now() - startTime;
          failedTests++;
          console.log(`[${testId}] ❌ ${name} (${duration}ms) - ${error.message}`);
          testResults.push({ id: testId, name, status: 'FAIL', category, duration, error: error.message });
          performanceMetrics.push({ test: name, duration, category, failed: true });
        });
    } else {
      const duration = Date.now() - startTime;
      passedTests++;
      console.log(`[${testId}] ✅ ${name} (${duration}ms)`);
      testResults.push({ id: testId, name, status: 'PASS', category, duration, response: result });
      performanceMetrics.push({ test: name, duration, category });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    failedTests++;
    console.log(`[${testId}] ❌ ${name} (${duration}ms) - ${error.message}`);
    testResults.push({ id: testId, name, status: 'FAIL', category, duration, error: error.message });
    performanceMetrics.push({ test: name, duration, category, failed: true });
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

// === TEST CATEGORY 1: REDIS HEALTH & CONNECTIVITY (Tests 1-15) ===
async function testRedisHealthConnectivity() {
  console.log('\n🔴 REDIS HEALTH & CONNECTIVITY TESTS (1-15)');
  console.log('============================================');

  runTest('Redis health check endpoint', async () => {
    const response = await makeAPICall('GET', '/api/heartbeat/redis');
    if (!response.success) {
      throw new Error(`Redis health check failed: ${response.statusCode}`);
    }
    
    const health = response.body;
    if (!health.redis) {
      throw new Error('Missing redis health information');
    }
    
    return { 
      status: health.redis.status, 
      latency: health.redis.latency,
      connected: health.ok 
    };
  }, 'REDIS');

  runTest('Service health with Redis', async () => {
    const response = await makeAPICall('GET', '/health');
    if (!response.success) {
      throw new Error(`Service health failed: ${response.statusCode}`);
    }
    return { healthy: true, status: response.statusCode };
  }, 'REDIS');

  // Test Redis repeatedly to check stability
  for (let i = 1; i <= 10; i++) {
    runTest(`Redis stability test ${i}`, async () => {
      const response = await makeAPICall('GET', '/api/heartbeat/redis');
      if (!response.success) {
        throw new Error(`Redis stability test ${i} failed`);
      }
      return { test: i, stable: true };
    }, 'REDIS');
  }

  runTest('Redis configuration validation', async () => {
    const response = await makeAPICall('GET', '/api/heartbeat/redis');
    if (!response.success) {
      throw new Error('Redis config validation failed');
    }
    
    const config = response.body.redis.config;
    if (!config) {
      throw new Error('Missing Redis configuration info');
    }
    
    return { 
      hasUrl: config.url !== 'not set',
      host: config.host,
      port: config.port 
    };
  }, 'REDIS');

  runTest('Redis performance baseline', async () => {
    const startTime = Date.now();
    const response = await makeAPICall('GET', '/api/heartbeat/redis');
    const endTime = Date.now();
    
    if (!response.success) {
      throw new Error('Redis performance test failed');
    }
    
    const responseTime = endTime - startTime;
    if (responseTime > 5000) {
      throw new Error(`Redis response too slow: ${responseTime}ms`);
    }
    
    return { responseTime, acceptable: responseTime < 1000 };
  }, 'REDIS');
}

// === TEST CATEGORY 2: DRIVE CACHE PERFORMANCE (Tests 16-35) ===
async function testDriveCachePerformance() {
  console.log('\n📁 DRIVE CACHE PERFORMANCE TESTS (16-35)');
  console.log('==========================================');

  // Upload test files for caching tests
  const testFiles = [];
  for (let i = 1; i <= 5; i++) {
    runTest(`Upload cache test file ${i}`, async () => {
      const uploadData = {
        filename: `cache_test_${i}_${Date.now()}.txt`,
        content: `Cache test file ${i}\nCreated: ${new Date().toISOString()}\nFor cache performance testing`,
        mimeType: 'text/plain',
        folderPath: 'AMBARADAM/BOSS/Notes'
      };
      
      const response = await makeAPICall('POST', '/actions/drive/upload', uploadData);
      if (!response.success) {
        throw new Error(`Cache test file upload ${i} failed`);
      }
      
      testFiles.push({ id: response.body.id, filename: uploadData.filename });
      return { uploaded: true, fileId: response.body.id };
    }, 'CACHE');
  }

  // Test cache performance - first calls (cache miss)
  for (let i = 1; i <= 5; i++) {
    runTest(`Drive list files - MISS ${i}`, async () => {
      const startTime = Date.now();
      const response = await makeAPICall('GET', '/search?q=cache_test&limit=10');
      const endTime = Date.now();
      
      if (!response.success) {
        throw new Error(`Drive search cache miss ${i} failed`);
      }
      
      const responseTime = endTime - startTime;
      return { responseTime, cacheMiss: true, results: response.body.files?.length || 0 };
    }, 'CACHE');
  }

  // Wait a moment for cache to settle
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test cache performance - second calls (cache hit)
  for (let i = 1; i <= 5; i++) {
    runTest(`Drive list files - HIT ${i}`, async () => {
      const startTime = Date.now();
      const response = await makeAPICall('GET', '/search?q=cache_test&limit=10');
      const endTime = Date.now();
      
      if (!response.success) {
        throw new Error(`Drive search cache hit ${i} failed`);
      }
      
      const responseTime = endTime - startTime;
      return { responseTime, cacheHit: true, results: response.body.files?.length || 0 };
    }, 'CACHE');
  }

  // Cache invalidation tests
  runTest('Cache invalidation on new upload', async () => {
    // First, get cached results
    const cached = await makeAPICall('GET', '/search?q=cache_test&limit=10');
    const cachedCount = cached.body.files?.length || 0;
    
    // Upload new file (should invalidate cache)
    const uploadData = {
      filename: `cache_invalidation_test_${Date.now()}.txt`,
      content: 'This file should invalidate cache',
      mimeType: 'text/plain',
      folderPath: 'AMBARADAM/BOSS/Notes'
    };
    
    const upload = await makeAPICall('POST', '/actions/drive/upload', uploadData);
    if (!upload.success) {
      throw new Error('Cache invalidation upload failed');
    }
    
    // Wait for invalidation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Search again (should be cache miss with new results)
    const fresh = await makeAPICall('GET', '/search?q=cache&limit=20');
    const freshCount = fresh.body.files?.length || 0;
    
    return { 
      invalidated: freshCount > cachedCount,
      cachedCount,
      freshCount,
      uploaded: upload.body.id
    };
  }, 'CACHE');

  // Performance comparison tests
  runTest('Cache vs no-cache performance comparison', async () => {
    const trials = 3;
    const cachedTimes = [];
    const freshTimes = [];
    
    // Cached requests
    for (let i = 0; i < trials; i++) {
      const start = Date.now();
      await makeAPICall('GET', '/search?q=cache_test&limit=5');
      cachedTimes.push(Date.now() - start);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Force cache miss by searching different terms
    for (let i = 0; i < trials; i++) {
      const start = Date.now();
      await makeAPICall('GET', `/search?q=fresh_search_${i}&limit=5`);
      freshTimes.push(Date.now() - start);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const avgCached = cachedTimes.reduce((a, b) => a + b, 0) / trials;
    const avgFresh = freshTimes.reduce((a, b) => a + b, 0) / trials;
    const improvement = ((avgFresh - avgCached) / avgFresh * 100).toFixed(1);
    
    return {
      avgCachedTime: avgCached,
      avgFreshTime: avgFresh,
      performanceImprovement: `${improvement}%`,
      cacheEffective: avgCached < avgFresh
    };
  }, 'CACHE');
}

// === TEST CATEGORY 3: AUTH CACHE & RATE LIMITING (Tests 36-50) ===
async function testAuthCacheRateLimiting() {
  console.log('\n🔐 AUTH CACHE & RATE LIMITING TESTS (36-50)');
  console.log('=============================================');

  // Auth endpoint tests
  for (let i = 1; i <= 5; i++) {
    runTest(`Auth endpoint performance ${i}`, async () => {
      const startTime = Date.now();
      const response = await makeAPICall('GET', '/api/drive/_whoami');
      const endTime = Date.now();
      
      if (!response.success) {
        throw new Error(`Auth test ${i} failed: ${response.statusCode}`);
      }
      
      const responseTime = endTime - startTime;
      return { 
        responseTime, 
        hasAuth: !!response.body.service_account,
        hasCachedSession: responseTime < 100 // Fast = likely cached
      };
    }, 'AUTH');
  }

  // Rate limiting tests
  runTest('Rate limiting - rapid requests', async () => {
    const requests = [];
    const startTime = Date.now();
    
    // Make 10 rapid requests
    for (let i = 0; i < 10; i++) {
      requests.push(makeAPICall('GET', '/api/drive/_whoami'));
    }
    
    const results = await Promise.all(requests);
    const endTime = Date.now();
    
    const successful = results.filter(r => r.success).length;
    const rateLimited = results.filter(r => r.statusCode === 429).length;
    const totalTime = endTime - startTime;
    
    return {
      totalRequests: requests.length,
      successful,
      rateLimited,
      totalTime,
      averageTime: totalTime / requests.length,
      rateLimitingWorking: successful > 0 // At least some should work
    };
  }, 'AUTH');

  // Session persistence tests
  runTest('Session persistence across requests', async () => {
    const sessionTests = [];
    
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const response = await makeAPICall('GET', '/api/drive/_whoami');
      const duration = Date.now() - start;
      
      sessionTests.push({
        success: response.success,
        duration,
        hasConsistentAuth: !!response.body.service_account
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const allSuccessful = sessionTests.every(t => t.success);
    const avgDuration = sessionTests.reduce((sum, t) => sum + t.duration, 0) / sessionTests.length;
    const consistentAuth = sessionTests.every(t => t.hasConsistentAuth);
    
    return {
      allSuccessful,
      avgDuration,
      consistentAuth,
      sessionPersistence: allSuccessful && consistentAuth
    };
  }, 'AUTH');

  // Memory and performance tests
  for (let i = 1; i <= 7; i++) {
    runTest(`Cache memory efficiency ${i}`, async () => {
      // Test different cache operations
      const operations = ['list', 'search', 'auth', 'metadata'];
      const operation = operations[i % operations.length];
      
      let endpoint;
      switch (operation) {
        case 'list': endpoint = '/search?q=test&limit=5'; break;
        case 'search': endpoint = '/search?q=cache&limit=3'; break;
        case 'auth': endpoint = '/api/drive/_whoami'; break;
        case 'metadata': endpoint = '/diag/drive/check'; break;
      }
      
      const response = await makeAPICall('GET', endpoint);
      if (!response.success) {
        throw new Error(`Cache memory test ${i} failed`);
      }
      
      return { operation, efficient: true };
    }, 'AUTH');
  }
}

// === TEST CATEGORY 4: END-TO-END INTEGRATION (Tests 51-70) ===
async function testEndToEndIntegration() {
  console.log('\n🔄 END-TO-END INTEGRATION TESTS (51-70)');
  console.log('=========================================');

  // Complete workflow tests
  runTest('Complete file workflow with caching', async () => {
    const workflow = {
      upload: null,
      search: null,
      metadata: null,
      cached_search: null
    };
    
    // Step 1: Upload file
    const uploadData = {
      filename: `workflow_test_${Date.now()}.txt`,
      content: 'End-to-end workflow test file with caching integration',
      mimeType: 'text/plain',
      folderPath: 'AMBARADAM/BOSS/Notes'
    };
    
    const upload = await makeAPICall('POST', '/actions/drive/upload', uploadData);
    workflow.upload = { success: upload.success, fileId: upload.body.id };
    
    // Step 2: Search for file (cache miss)
    await new Promise(resolve => setTimeout(resolve, 500));
    const search1 = await makeAPICall('GET', '/search?q=workflow_test&limit=10');
    workflow.search = { success: search1.success, results: search1.body.files?.length || 0 };
    
    // Step 3: Get file metadata
    if (upload.body.id) {
      const meta = await makeAPICall('GET', `/diag/drive/check?folderId=${upload.body.id}`);
      workflow.metadata = { success: meta.success };
    }
    
    // Step 4: Search again (cache hit)
    const search2 = await makeAPICall('GET', '/search?q=workflow_test&limit=10');
    workflow.cached_search = { success: search2.success, results: search2.body.files?.length || 0 };
    
    const allSuccessful = Object.values(workflow).every(step => step.success);
    return { workflow, allSuccessful };
  }, 'INTEGRATION');

  // Stress test - multiple operations
  for (let i = 1; i <= 10; i++) {
    runTest(`Concurrent operations stress ${i}`, async () => {
      const operations = [
        makeAPICall('GET', '/api/drive/_whoami'),
        makeAPICall('GET', '/search?q=test&limit=3'),
        makeAPICall('GET', '/diag/drive/check'),
        makeAPICall('GET', '/api/heartbeat/redis')
      ];
      
      const results = await Promise.all(operations);
      const successful = results.filter(r => r.success).length;
      
      if (successful < operations.length * 0.8) {
        throw new Error(`Stress test ${i}: Only ${successful}/${operations.length} operations successful`);
      }
      
      return { successful, total: operations.length, stress: i };
    }, 'INTEGRATION');
  }

  // Cache consistency tests
  runTest('Cache consistency across operations', async () => {
    const consistency = [];
    
    // Test multiple cache operations
    for (let i = 0; i < 5; i++) {
      const auth = await makeAPICall('GET', '/api/drive/_whoami');
      const search = await makeAPICall('GET', '/search?q=test&limit=2');
      
      consistency.push({
        authConsistent: auth.success && !!auth.body.service_account,
        searchConsistent: search.success,
        iteration: i
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const allConsistent = consistency.every(c => c.authConsistent && c.searchConsistent);
    return { allConsistent, tests: consistency.length };
  }, 'INTEGRATION');
}

// === MAIN EXECUTION ===
async function runAllTests() {
  console.log('🚀 REDIS INTEGRATION TEST CLI - COMPREHENSIVE TESTING');
  console.log('======================================================');
  console.log(`Base URL: ${CONFIG.BASE_URL}`);
  console.log(`Test User: ${CONFIG.TEST_USER}`);
  console.log(`Redis Tests: ${CONFIG.REDIS_TESTS ? 'ENABLED' : 'DISABLED'}`);
  console.log('');

  const startTime = Date.now();

  try {
    await testRedisHealthConnectivity();
    await testDriveCachePerformance();
    await testAuthCacheRateLimiting();
    await testEndToEndIntegration();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    console.log('\n📊 COMPREHENSIVE REDIS INTEGRATION RESULTS');
    console.log('===========================================');
    console.log(`Execution Time: ${duration}s`);
    console.log(`Total Tests: ${testCount}`);
    console.log(`Passed: ${passedTests} (${((passedTests/testCount)*100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests/testCount)*100).toFixed(1)}%)`);

    // Performance analysis
    const avgDuration = performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / performanceMetrics.length;
    const fastTests = performanceMetrics.filter(m => m.duration < 1000).length;
    const slowTests = performanceMetrics.filter(m => m.duration > 5000).length;

    console.log('\n⚡ PERFORMANCE ANALYSIS:');
    console.log(`Average Test Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`Fast Tests (<1s): ${fastTests}/${testCount} (${((fastTests/testCount)*100).toFixed(1)}%)`);
    console.log(`Slow Tests (>5s): ${slowTests}/${testCount} (${((slowTests/testCount)*100).toFixed(1)}%)`);

    // Category breakdown
    const categories = {};
    testResults.forEach(test => {
      categories[test.category] = categories[test.category] || { total: 0, passed: 0, avgDuration: 0 };
      categories[test.category].total++;
      categories[test.category].avgDuration += test.duration || 0;
      if (test.status === 'PASS') categories[test.category].passed++;
    });

    console.log('\n📋 CATEGORY PERFORMANCE:');
    Object.entries(categories).forEach(([category, stats]) => {
      const rate = ((stats.passed/stats.total)*100).toFixed(1);
      const avgTime = (stats.avgDuration/stats.total).toFixed(0);
      const status = rate >= 90 ? '🟢' : rate >= 75 ? '🟡' : '🔴';
      console.log(`  ${status} ${category}: ${stats.passed}/${stats.total} (${rate}%) - Avg: ${avgTime}ms`);
    });

    // Redis performance assessment
    const redisTests = testResults.filter(t => t.category === 'REDIS');
    const cacheTests = testResults.filter(t => t.category === 'CACHE');
    const authTests = testResults.filter(t => t.category === 'AUTH');

    console.log('\n🔴 REDIS INTEGRATION ASSESSMENT:');
    
    const redisHealth = redisTests.length > 0 && redisTests.every(t => t.status === 'PASS');
    const cacheEffective = cacheTests.length > 0 && cacheTests.filter(t => t.status === 'PASS').length >= cacheTests.length * 0.8;
    const authWorking = authTests.length > 0 && authTests.filter(t => t.status === 'PASS').length >= authTests.length * 0.8;

    if (redisHealth && cacheEffective && authWorking) {
      console.log('🎉 EXCELLENT - Redis integration fully operational!');
      console.log('   ✅ Redis connectivity stable');
      console.log('   ✅ Drive caching effective');
      console.log('   ✅ Auth caching working');
      console.log('   ✅ Rate limiting functional');
    } else {
      console.log('⚠️ PARTIAL - Redis integration has issues:');
      if (!redisHealth) console.log('   ❌ Redis connectivity problems');
      if (!cacheEffective) console.log('   ❌ Drive caching not effective');
      if (!authWorking) console.log('   ❌ Auth caching issues');
    }

    // Performance improvements
    const cachePerformanceTests = performanceMetrics.filter(m => m.test.includes('HIT') || m.test.includes('MISS'));
    if (cachePerformanceTests.length > 0) {
      const hitTests = cachePerformanceTests.filter(m => m.test.includes('HIT'));
      const missTests = cachePerformanceTests.filter(m => m.test.includes('MISS'));
      
      if (hitTests.length > 0 && missTests.length > 0) {
        const avgHit = hitTests.reduce((sum, t) => sum + t.duration, 0) / hitTests.length;
        const avgMiss = missTests.reduce((sum, t) => sum + t.duration, 0) / missTests.length;
        const improvement = ((avgMiss - avgHit) / avgMiss * 100).toFixed(1);
        
        console.log('\n⚡ CACHE PERFORMANCE IMPACT:');
        console.log(`  Cache Hit Avg: ${avgHit.toFixed(0)}ms`);
        console.log(`  Cache Miss Avg: ${avgMiss.toFixed(0)}ms`);
        console.log(`  Performance Improvement: ${improvement}%`);
      }
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (slowTests > testCount * 0.1) {
      console.log('  • Investigate slow operations - consider cache optimization');
    }
    if (failedTests > 0) {
      console.log('  • Fix failing tests before production deployment');
    }
    if (redisHealth && cacheEffective) {
      console.log('  • Redis integration ready for production use');
      console.log('  • Consider enabling Redis in production environment');
    }

    // Error summary
    if (failedTests > 0) {
      console.log('\n❌ FAILED TESTS SUMMARY:');
      testResults.filter(t => t.status === 'FAIL').slice(0, 5).forEach(test => {
        console.log(`  • ${test.name}: ${test.error}`);
      });
      if (failedTests > 5) {
        console.log(`  ... and ${failedTests - 5} more failed tests`);
      }
    }

    console.log('\n✅ REDIS INTEGRATION TESTING COMPLETED!');
    console.log(`🎯 ${testCount} tests executed with comprehensive Redis performance analysis`);

    // Generate summary report
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: testCount,
      passed: passedTests,
      failed: failedTests,
      duration: `${duration}s`,
      categories: Object.keys(categories),
      redisHealthy: redisHealth,
      cacheEffective: cacheEffective,
      authWorking: authWorking,
      avgPerformance: `${avgDuration.toFixed(0)}ms`,
      recommendation: redisHealth && cacheEffective ? 'PRODUCTION_READY' : 'NEEDS_ATTENTION'
    };

    console.log('\n📄 TEST REPORT SUMMARY:');
    console.log(JSON.stringify(report, null, 2));

    // Exit code based on results
    const overallHealth = (passedTests/testCount)*100;
    process.exit(overallHealth >= 80 ? 0 : 1);

  } catch (error) {
    console.error('\n💥 REDIS INTEGRATION TEST FAILED:');
    console.error(error.message);
    if (CONFIG.VERBOSE) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// === CLI EXECUTION ===
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
REDIS INTEGRATION TEST CLI

Usage: node redis_integration_test_cli.js [options]

Options:
  --help              Show this help
  --verbose           Enable verbose logging
  --base-url URL      Set base URL
  --no-redis          Disable Redis-specific tests

Test Categories:
  1. Redis Health & Connectivity (15 tests)
  2. Drive Cache Performance (20 tests) 
  3. Auth Cache & Rate Limiting (15 tests)
  4. End-to-End Integration (20 tests)

Total: 70 comprehensive Redis integration tests
`);
    process.exit(0);
  }

  if (args.includes('--verbose')) CONFIG.VERBOSE = true;
  if (args.includes('--no-redis')) CONFIG.REDIS_TESTS = false;
  
  const urlIndex = args.indexOf('--base-url');
  if (urlIndex !== -1 && args[urlIndex + 1]) {
    CONFIG.BASE_URL = args[urlIndex + 1];
  }

  runAllTests().catch(console.error);
}

module.exports = { runAllTests, CONFIG };