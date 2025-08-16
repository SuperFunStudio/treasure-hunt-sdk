// test-api-key.js
// Run this to test if your OpenAI API key is working
require('dotenv').config();

async function testOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  console.log('🔍 Testing OpenAI API Key...');
  console.log('API Key present:', apiKey ? 'YES ✅' : 'NO ❌');
  console.log('API Key format:', apiKey?.startsWith('sk-') ? 'Valid format ✅' : 'Invalid format ❌');
  console.log('API Key length:', apiKey?.length || 'N/A');
  
  if (!apiKey) {
    console.log('❌ No API key found in environment');
    return;
  }

  try {
    // Test with a simple API call
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 API Response Status:', response.status);

    if (response.ok) {
      console.log('✅ API Key is VALID and working!');
      const data = await response.json();
      console.log('🎯 Available models:', data.data?.length || 0);
      
      // Check if GPT-4V is available
      const hasgpt-4o = data.data?.some(model => 
        model.id.includes('gpt-4') && model.id.includes('vision')
      );
      console.log('🖼️  GPT-4 Vision available:', hasgpt-4o ? 'YES ✅' : 'NO ❌');
      
    } else {
      console.log('❌ API Key is INVALID');
      const errorText = await response.text();
      console.log('Error details:', errorText);
      
      if (response.status === 401) {
        console.log('🔑 Suggestion: Generate a new API key at https://platform.openai.com/api-keys');
      } else if (response.status === 429) {
        console.log('💳 Suggestion: Check your OpenAI billing/usage limits');
      }
    }
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

testOpenAIKey();