// Test rapido saveMemory patch
import { saveMemory } from './dist/services/saveMemory.js';

async function testSaveMemory() {
  console.log('🧪 Testing saveMemory with forced X-BZ-USER...');
  
  try {
    const result = await saveMemory({
      title: 'Test Patch saveMemory',
      content: 'Testing the definitive saveMemory patch with forced BOSS header',
      tags: ['test', 'patch', 'saveMemory']
    });
    
    console.log('✅ SaveMemory SUCCESS:', result);
  } catch (error) {
    console.log('❌ SaveMemory FAILED:', error.message);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSaveMemory();
}