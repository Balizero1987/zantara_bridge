#!/usr/bin/env node

/**
 * Test script for ZANTARA OpenAI Assistant with compliance documents
 * Tests the assistant setup and document integration
 */

const fs = require('fs');
const path = require('path');

async function testAssistant() {
  console.log('🚀 Testing ZANTARA Assistant Setup...\n');

  try {
    // Load environment variables
    require('dotenv').config();
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('❌ OPENAI_API_KEY not found in environment variables');
    }
    
    console.log('✅ OpenAI API key found');

    // Check compliance documents
    const docsPath = path.join(process.cwd(), 'docs', 'compliance');
    const expectedDocs = ['KITAS_GUIDE.md', 'PT_PMA_GUIDE.md', 'TAX_GUIDE.md'];
    
    console.log('\n📋 Checking compliance documents...');
    
    if (!fs.existsSync(docsPath)) {
      throw new Error(`❌ Compliance docs directory not found: ${docsPath}`);
    }
    
    const missingDocs = expectedDocs.filter(doc => {
      const docPath = path.join(docsPath, doc);
      return !fs.existsSync(docPath);
    });
    
    if (missingDocs.length > 0) {
      throw new Error(`❌ Missing documents: ${missingDocs.join(', ')}`);
    }
    
    console.log('✅ All compliance documents found');
    
    // Test document content
    expectedDocs.forEach(doc => {
      const docPath = path.join(docsPath, doc);
      const content = fs.readFileSync(docPath, 'utf8');
      
      if (content.length < 100) {
        console.log(`⚠️  ${doc} seems too short (${content.length} characters)`);
      } else {
        console.log(`✅ ${doc} (${content.length} characters)`);
      }
    });

    console.log('\n🤖 Testing Assistant Service...');
    
    // Try to import and test the assistant service
    const { assistantService } = require('../dist/services/openaiAssistant.js');
    
    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const assistantId = assistantService.getAssistantId();
    const vectorStoreId = assistantService.getVectorStoreId();
    
    console.log(`Assistant ID: ${assistantId || 'Not initialized'}`);
    console.log(`Vector Store ID: ${vectorStoreId || 'Not initialized'}`);
    
    if (assistantId && vectorStoreId) {
      console.log('✅ Assistant service initialized successfully');
      
      // Test a simple query
      console.log('\n💬 Testing compliance query...');
      
      try {
        const thread = await assistantService.createThread('test-user-123', {
          purpose: 'test'
        });
        
        console.log(`Thread created: ${thread.id}`);
        
        const testQuestion = "What are the basic requirements for KITAS application?";
        const messages = await assistantService.sendMessage(thread.id, testQuestion, 'test-user-123');
        
        if (messages && messages.length > 0) {
          console.log('✅ Assistant responded successfully');
          console.log('Response preview:', messages[0].content.substring(0, 200) + '...');
        } else {
          console.log('⚠️  Assistant created but no response received');
        }
        
        // Clean up test thread
        await assistantService.deleteThread(thread.id);
        console.log('✅ Test thread cleaned up');
        
      } catch (queryError) {
        console.log('⚠️  Query test failed:', queryError.message);
      }
      
    } else {
      console.log('⚠️  Assistant service not fully initialized');
    }

    console.log('\n🔗 Testing API endpoints...');
    
    // Test if the main server file includes the assistant routes
    const indexPath = path.join(process.cwd(), 'src', 'index.ts');
    if (fs.existsSync(indexPath)) {
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      if (indexContent.includes('assistant') || indexContent.includes('Assistant')) {
        console.log('✅ Assistant routes likely registered');
      } else {
        console.log('⚠️  Assistant routes may not be registered in main app');
      }
    }

    console.log('\n🎉 Assistant setup test completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Test the API endpoint: POST /api/assistant/compliance/ask');
    console.log('3. Example request body:');
    console.log('   {');
    console.log('     "question": "How do I apply for KITAS?",');
    console.log('     "userId": "user123"');
    console.log('   }');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check OPENAI_API_KEY in .env file');
    console.log('2. Run: npm run build');
    console.log('3. Ensure all dependencies are installed: npm install');
    process.exit(1);
  }
}

// Run the test
testAssistant();