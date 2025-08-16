// test-available-models.js
// Quick test to see what Claude models are available

require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

async function testModels() {
  const apiKey = process.env.CLAUDE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ CLAUDE_API_KEY not found');
    return;
  }

  const modelsToTest = [
    'claude-3-5-sonnet-latest',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-sonnet-20240229',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307'
  ];

  console.log('🔍 Testing available Claude models...\n');

  for (const model of modelsToTest) {
    try {
      console.log(`Testing: ${model}`);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 10,
          messages: [{
            role: 'user',
            content: 'Hi'
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${model} - WORKS!`);
        console.log(`   Response: ${data.content[0].text}`);
        console.log('');
        return model; // Return the first working model
      } else {
        const error = await response.text();
        console.log(`❌ ${model} - ${response.status}`);
        console.log('');
      }
    } catch (error) {
      console.log(`❌ ${model} - Error: ${error.message}`);
      console.log('');
    }
  }

  console.log('❌ No working models found');
  return null;
}

// Run the test
testModels().then(workingModel => {
  if (workingModel) {
    console.log(`🎉 Use this model in your code: ${workingModel}`);
  } else {
    console.log('❌ No models worked. Check your API key or account access.');
  }
});