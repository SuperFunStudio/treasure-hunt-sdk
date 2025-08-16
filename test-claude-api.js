// test-claude-api.js
// Test script to verify Claude API integration for Treasure Hunt SDK


require('dotenv').config();

// === DEBUG SECTION - ADD THIS ===
console.log('=== ENVIRONMENT DEBUG ===');
console.log('Current working directory:', process.cwd());
console.log('Looking for .env at:', './functions/.env');
console.log('CLAUDE_API_KEY found:', !!process.env.CLAUDE_API_KEY);
console.log('ANTHROPIC_API_KEY found:', !!process.env.ANTHROPIC_API_KEY);
if (process.env.CLAUDE_API_KEY) {
  console.log('CLAUDE_API_KEY first 20 chars:', process.env.CLAUDE_API_KEY.substring(0, 20) + '...');
}
if (process.env.ANTHROPIC_API_KEY) {
  console.log('ANTHROPIC_API_KEY first 20 chars:', process.env.ANTHROPIC_API_KEY.substring(0, 20) + '...');
}
console.log('========================\n');

const fs = require('fs');
const path = require('path');

// Dynamic import for fetch
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

// Load environment variables
require('dotenv').config({ path: './functions/.env' });

/**
 * Test Claude API with text-only request
 */
async function testClaudeTextOnly() {
  console.log('🧪 Testing Claude API - Text Only...');
  
  const apiKey = process.env.CLAUDE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ CLAUDE_API_KEY not found in environment variables');
    return false;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: 'Hello! Can you respond with a simple JSON object containing your model name and a greeting?'
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Claude API Error:', response.status, errorText);
      return false;
    }

    const data = await response.json();
    console.log('✅ Claude API Text Test Success!');
    console.log('📝 Response:', data.content[0].text);
    console.log('💰 Usage:', data.usage);
    
    return true;

  } catch (error) {
    console.error('❌ Claude API Test Failed:', error.message);
    return false;
  }
}

/**
 * Test Claude API with image analysis
 */
async function testClaudeImageAnalysis() {
  console.log('🖼️ Testing Claude API - Image Analysis...');
  
  const apiKey = process.env.CLAUDE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ CLAUDE_API_KEY not found in environment variables');
    return false;
  }

  // Create a simple test image (1x1 red pixel PNG)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'What do you see in this image? Respond with JSON: {"description": "what you see", "color": "primary color"}'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: testImageBase64
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Claude Image API Error:', response.status, errorText);
      return false;
    }

    const data = await response.json();
    console.log('✅ Claude Image Analysis Test Success!');
    console.log('📝 Response:', data.content[0].text);
    console.log('💰 Usage:', data.usage);
    
    return true;

  } catch (error) {
    console.error('❌ Claude Image Test Failed:', error.message);
    return false;
  }
}

/**
 * Test Claude with the actual SDK prompt format
 */
async function testClaudeWithSDKPrompt() {
  console.log('🔍 Testing Claude with SDK Item Analysis Prompt...');
  
  const apiKey = process.env.CLAUDE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ CLAUDE_API_KEY not found in environment variables');
    return false;
  }

  // Simple test image
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  const sdkPrompt = `You are an expert product identification assistant for a circular economy app. Analyze the uploaded image(s) and return a detailed JSON assessment.

CRITICAL REQUIREMENTS:
1. Look for ALL brand identifiers (logos, text, labels, tags)
2. Identify specific materials and construction details
3. Note style periods and design elements
4. Be conservative - use "Unknown" if uncertain
5. Focus on the most prominent object in multi-item photos
6. Return ONLY valid JSON - no extra text

Return this exact JSON structure:

{
  "category": "specific item type with materials",
  "brand": "exact brand name if visible, or 'Unknown'",
  "model": "specific model/product name if visible, or 'Unknown'",
  "materials": ["primary material"],
  "style": "style period or aesthetic",
  "condition": {
    "rating": "excellent|good|fair|poor",
    "description": "detailed condition assessment",
    "usableAsIs": true,
    "issues": []
  },
  "resale": {
    "recommendation": "resell|donate|repair and resell|recycle",
    "priceRange": "estimated price range in USD",
    "justification": "brief explanation"
  },
  "confidence": 5
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: sdkPrompt
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: testImageBase64
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Claude SDK Prompt Error:', response.status, errorText);
      return false;
    }

    const data = await response.json();
    console.log('✅ Claude SDK Prompt Test Success!');
    console.log('📝 Response:', data.content[0].text);
    
    // Try to parse the JSON response
    try {
      const jsonResponse = JSON.parse(data.content[0].text);
      console.log('✅ JSON parsing successful!');
      console.log('📋 Parsed structure:', Object.keys(jsonResponse));
    } catch (parseError) {
      console.log('⚠️ JSON parsing failed, but response received');
      console.log('Parse error:', parseError.message);
    }
    
    console.log('💰 Usage:', data.usage);
    
    return true;

  } catch (error) {
    console.error('❌ Claude SDK Prompt Test Failed:', error.message);
    return false;
  }
}

/**
 * Compare Claude vs GPT-4V capabilities (if OpenAI key is available)
 */
async function compareProviders() {
  console.log('⚖️ Comparing Claude vs GPT-4V...');
  
  const claudeKey = process.env.CLAUDE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!claudeKey) {
    console.log('⚠️ Claude API key not available for comparison');
    return;
  }
  
  if (!openaiKey) {
    console.log('⚠️ OpenAI API key not available for comparison');
    return;
  }

  // Simple test image
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  const prompt = 'Describe this image in one sentence.';

  try {
    console.log('🔵 Testing Claude...');
    const claudeStart = Date.now();
    
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: testImageBase64
              }
            }
          ]
        }]
      })
    });
    
    const claudeTime = Date.now() - claudeStart;
    const claudeData = await claudeResponse.json();
    
    console.log('🟢 Testing GPT-4V...');
    const openaiStart = Date.now();
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${testImageBase64}`,
                detail: 'low'
              }
            }
          ]
        }],
        max_tokens: 100
      })
    });
    
    const openaiTime = Date.now() - openaiStart;
    const openaiData = await openaiResponse.json();
    
    console.log('\n📊 COMPARISON RESULTS:');
    console.log('─'.repeat(50));
    console.log(`🔵 Claude (${claudeTime}ms):`);
    console.log('   Response:', claudeData.content?.[0]?.text || 'Error');
    console.log('   Tokens:', claudeData.usage?.output_tokens || 'N/A');
    
    console.log(`🟢 GPT-4V (${openaiTime}ms):`);
    console.log('   Response:', openaiData.choices?.[0]?.message?.content || 'Error');
    console.log('   Tokens:', openaiData.usage?.completion_tokens || 'N/A');
    
  } catch (error) {
    console.error('❌ Comparison failed:', error.message);
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting Claude API Integration Tests');
  console.log('=' * 60);
  
  const results = {
    textOnly: false,
    imageAnalysis: false,
    sdkPrompt: false
  };
  
  // Test 1: Text-only API call
  results.textOnly = await testClaudeTextOnly();
  console.log('\n');
  
  // Test 2: Image analysis
  if (results.textOnly) {
    results.imageAnalysis = await testClaudeImageAnalysis();
    console.log('\n');
  }
  
  // Test 3: SDK prompt format
  if (results.imageAnalysis) {
    results.sdkPrompt = await testClaudeWithSDKPrompt();
    console.log('\n');
  }
  
  // Test 4: Provider comparison
  await compareProviders();
  
  // Summary
  console.log('\n📋 TEST SUMMARY:');
  console.log('─'.repeat(30));
  console.log(`Text API: ${results.textOnly ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Image API: ${results.imageAnalysis ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`SDK Prompt: ${results.sdkPrompt ? '✅ PASS' : '❌ FAIL'}`);
  
  if (results.textOnly && results.imageAnalysis && results.sdkPrompt) {
    console.log('\n🎉 All tests passed! Claude API is ready for integration.');
    console.log('Next steps:');
    console.log('1. Update analyzeItem.js to use Claude');
    console.log('2. Test with your actual SDK');
  } else {
    console.log('\n⚠️ Some tests failed. Check your API key and configuration.');
  }
}

/**
 * Test with a real image file if provided
 */
async function testWithRealImage(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) {
    console.log('📸 No real image provided for testing');
    return;
  }
  
  console.log(`🖼️ Testing with real image: ${imagePath}`);
  
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Data = imageBuffer.toString('base64');
    
    // Determine media type
    const ext = path.extname(imagePath).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';
    
    const apiKey = process.env.CLAUDE_API_KEY;
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this item for resale. What is it, what condition is it in, and what might it be worth?'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data
              }
            }
          ]
        }]
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Real image analysis successful!');
      console.log('📝 Claude\'s analysis:');
      console.log(data.content[0].text);
    } else {
      console.error('❌ Real image test failed:', await response.text());
    }
    
  } catch (error) {
    console.error('❌ Real image test error:', error.message);
  }
}

// Run tests if called directly
if (require.main === module) {
  const imagePath = process.argv[2]; // Optional image path argument
  
  runAllTests().then(() => {
    if (imagePath) {
      return testWithRealImage(imagePath);
    }
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testClaudeTextOnly,
  testClaudeImageAnalysis,
  testClaudeWithSDKPrompt,
  compareProviders,
  testWithRealImage
};