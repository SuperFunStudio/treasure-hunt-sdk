// test-claude-integration.js
// Test file to verify Claude integration works properly
require('dotenv').config();

// Try multiple possible locations for the SDK
let CaptureSDK;
try {
  // Option 1: functions/capture-sdk subdirectory (most likely)
  CaptureSDK = require('./functions/capture-sdk/index.js');
} catch (err1) {
  try {
    // Option 2: functions directory
    CaptureSDK = require('./functions/index.js');
  } catch (err2) {
    try {
      // Option 3: capture-sdk subdirectory
      CaptureSDK = require('./capture-sdk/index.js');
    } catch (err3) {
      try {
        // Option 4: main index.js in root
        CaptureSDK = require('./index.js');
      } catch (err4) {
        console.error('❌ Could not find SDK. Checked:');
        console.error('  - ./functions/capture-sdk/index.js');
        console.error('  - ./functions/index.js');
        console.error('  - ./capture-sdk/index.js');
        console.error('  - ./index.js');
        console.error('\n📁 Please check your directory structure:');
        process.exit(1);
      }
    }
  }
}

async function testClaudeIntegration() {
  console.log('🧪 Testing Claude Integration...\n');

  // Check environment variables
  if (!process.env.CLAUDE_API_KEY) {
    console.error('❌ CLAUDE_API_KEY not found in environment variables');
    console.error('💡 Add CLAUDE_API_KEY=your-key-here to your .env file');
    return;
  }

  console.log('✅ Found Claude API key in environment');

  // Initialize SDK
  const sdk = new CaptureSDK({
    apiKeys: {
      claude: process.env.CLAUDE_API_KEY
    },
    ebay: {
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      environment: 'production'
    }
  });

  // Test 1: Health Check
  console.log('\n1️⃣ Running health check...');
  try {
    const health = await sdk.healthCheck();
    console.log('✅ Health check result:', {
      status: health.status,
      claude: health.claude.success ? '✅' : '❌',
      ebay: health.ebay.success ? '✅' : '❌'
    });
    
    if (!health.claude.success) {
      console.log('❌ Claude error:', health.claude.error);
      console.log('💡 Solution:', health.claude.solution);
      return;
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: Simple Image Analysis
  console.log('\n2️⃣ Testing simple image analysis...');
  try {
    // Create a simple test image (1x1 pixel PNG in base64)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    const result = await sdk.quickAnalyze(testImageBase64, {
      maxTokens: 800  // Increased from 200
    });
    
    console.log('✅ Analysis completed:', {
      category: result.category,
      brand: result.brand,
      confidence: result.confidence,
      hasError: !!result.error
    });

    if (result.error) {
      console.log('⚠️ Analysis error (expected for test image):', result.error);
    }
  } catch (error) {
    console.error('❌ Image analysis failed:', error.message);
    
    // Try direct analyzeItem method instead
    console.log('🔄 Trying direct analyzeItem method...');
    try {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      
      const result = await sdk.analyzeItem([testImageBase64], {
        maxTokens: 800  // Increased from 200
      });
      
      console.log('✅ Direct analysis worked:', {
        category: result.category,
        confidence: result.confidence
      });
    } catch (directError) {
      console.error('❌ Direct analysis also failed:', directError.message);
    }
  }

  // Test 3: Price Estimation
  console.log('\n3️⃣ Testing price estimation...');
  try {
    const mockItemData = {
      category: 'bamboo side table',
      brand: 'Unknown',
      model: 'vintage side table',
      materials: ['bamboo', 'wood'],
      style: 'vintage',
      condition: {
        rating: 'good',
        description: 'Shows minor wear but structurally sound',
        usableAsIs: true
      }
    };

    const price = await sdk.getQuickPrice(mockItemData);
    console.log('✅ Price estimation:', {
      suggested: price.suggested,
      confidence: price.confidence,
      source: price.source
    });
  } catch (error) {
    console.error('❌ Price estimation failed:', error.message);
  }

  // Test 4: Full Route Analysis
  console.log('\n4️⃣ Testing full route analysis...');
  try {
    const mockItemData = {
      category: 'electronics',
      brand: 'Apple',
      model: 'iPhone',
      materials: ['metal', 'glass'],
      condition: {
        rating: 'good',
        description: 'Minor scratches but fully functional',
        usableAsIs: true
      }
    };

    const routes = await sdk.getRoutes(mockItemData);
    console.log('✅ Route analysis:', {
      recommendedRoute: routes.recommendedRoute?.type,
      estimatedReturn: routes.recommendedRoute?.estimatedReturn,
      dataSource: routes.marketAnalysis?.dataSource
    });
  } catch (error) {
    console.error('❌ Route analysis failed:', error.message);
  }

  console.log('\n🎉 Claude integration test completed!');
}

// Helper function to show directory structure
function showDirectoryStructure() {
  const fs = require('fs');
  const path = require('path');
  
  console.log('\n📁 Current directory structure:');
  try {
    const files = fs.readdirSync('.').filter(f => f.endsWith('.js') || !f.includes('.'));
    files.forEach(file => {
      const stats = fs.statSync(file);
      if (stats.isDirectory()) {
        console.log(`📂 ${file}/`);
        try {
          const subFiles = fs.readdirSync(file).filter(f => f.endsWith('.js'));
          subFiles.slice(0, 3).forEach(subFile => {
            console.log(`   📄 ${subFile}`);
          });
          if (subFiles.length > 3) {
            console.log(`   ... and ${subFiles.length - 3} more files`);
          }
        } catch (e) {
          // Can't read subdirectory
        }
      } else {
        console.log(`📄 ${file}`);
      }
    });
  } catch (error) {
    console.log('Could not read directory structure');
  }
}

// Run if called directly
if (require.main === module) {
  // Show directory structure first
  showDirectoryStructure();
  
  // Then run tests
  testClaudeIntegration().catch(error => {
    console.error('\n💥 Test failed with error:', error.message);
    console.error('\n🔍 This might help debug the issue.');
  });
}

module.exports = { testClaudeIntegration };