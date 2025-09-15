/**
 * Test script per verificare l'estrazione automatica dell'utente
 */

const { extractUserFromRequest } = require('./dist/services/appsScriptDrive');

// Test cases
const testCases = [
  {
    name: "Request con canonicalOwner",
    req: { canonicalOwner: "AMANDA" },
    expected: "AMANDA"
  },
  {
    name: "Request con header X-BZ-USER",
    req: { 
      header: (name) => name === 'X-BZ-USER' ? 'Antonello' : null,
      canonicalOwner: null 
    },
    expected: "Antonello"
  },
  {
    name: "Request con headers array",
    req: { 
      headers: { 'x-bz-user': 'Boss' },
      canonicalOwner: null,
      header: () => null
    },
    expected: "Boss"
  },
  {
    name: "Request con user nel body",
    req: { 
      body: { user: 'TestUser' },
      canonicalOwner: null,
      header: () => null,
      headers: {}
    },
    expected: "TestUser"
  },
  {
    name: "Request senza user info",
    req: { 
      canonicalOwner: null,
      header: () => null,
      headers: {},
      body: {}
    },
    expected: "unknown"
  }
];

console.log('🧪 Testing user extraction from requests...\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`);
  
  try {
    const result = extractUserFromRequest(test.req);
    
    if (result === test.expected) {
      console.log(`✅ PASS: Got "${result}"`);
      passed++;
    } else {
      console.log(`❌ FAIL: Expected "${test.expected}", got "${result}"`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    failed++;
  }
  
  console.log('');
});

console.log(`📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed! User extraction is working correctly.');
  process.exit(0);
} else {
  console.log('⚠️ Some tests failed. Check the implementation.');
  process.exit(1);
}