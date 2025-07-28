// capture-sdk/core/analyzeItem.js
import { normalizeResponse } from '../utils/normalize.js';

export async function analyzeItem(images, options = {}) {
  const {
    provider = 'gpt4v',
    apiKey,
    prompt = getDefaultPrompt(),
    maxRetries = 2
  } = options;

  if (!apiKey) {
    throw new Error('API key required for vision analysis');
  }

  if (!images || images.length === 0) {
    throw new Error('At least one image required');
  }

  let attempt = 0;
  let lastError;

  while (attempt <= maxRetries) {
    try {
      const result = await callVisionAPI(provider, images, apiKey, prompt);
      return normalizeResponse(result, provider);
    } catch (error) {
      lastError = error;
      attempt++;
      if (attempt <= maxRetries) {
        console.log(`Retry attempt ${attempt} after error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError;
}

function convertToBase64(image) {
  if (typeof image === 'string') {
    if (image.startsWith('data:')) {
      return image.split(',')[1];
    }
    return image;
  }
  
  if (Buffer.isBuffer(image)) {
    return image.toString('base64');
  }
  
  throw new Error('Invalid image format');
}

async function callVisionAPI(provider, images, apiKey, prompt) {
  const imageData = images.map(img => 
    img.startsWith('data:') ? img : convertToBase64(img)
  );

  switch (provider) {
    case 'gpt4v':
      return await callGPT4V(imageData, apiKey, prompt);
    case 'claude':
      return await callClaude(imageData, apiKey, prompt);
    default:
      throw new Error(`Unsupported vision provider: ${provider}`);
  }
}

async function callGPT4V(images, apiKey, prompt) {
  // Updated to use gpt-4o-mini or gpt-4o
  // Note: As of my knowledge, o1-mini doesn't support vision, but gpt-4o-mini does
  
  console.log('Calling GPT-4V with:', {
    model: 'gpt-4o-mini',
    imageCount: images.length,
    imageDataLength: images[0]?.length || 0,
    promptLength: prompt.length
  });

  const requestBody = {
    model: 'gpt-4o-mini', // Updated model name
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...images.map(img => ({
          type: 'image_url',
          image_url: { 
            url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
            detail: 'low' // Use 'low' for cost efficiency with mini model
          }
        }))
      ]
    }],
    max_tokens: 1000,
    temperature: 0.7
  };

  console.log('Request body preview:', {
    model: requestBody.model,
    messageCount: requestBody.messages.length,
    contentTypes: requestBody.messages[0].content.map(c => c.type)
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('OpenAI API Error:', errorData);
    throw new Error(`GPT-4 API error: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  
  console.log('GPT-4V Response:', {
    model: data.model,
    usage: data.usage,
    responsePreview: data.choices[0].message.content.substring(0, 200)
  });
  
  // Parse the response - gpt-4o-mini returns text, not JSON by default
  try {
    // Try to extract JSON from the response
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // If no JSON found, parse the text response
    return parseTextResponse(content);
  } catch (error) {
    console.error('Failed to parse response:', error);
    // Return a basic structure if parsing fails
    return {
      category: 'Unknown',
      brand: 'Unknown',
      model: 'Unknown',
      condition: 5,
      confidence: 3,
      salvageable_parts: [],
      estimated_value: { min: 0, max: 0 },
      reasoning: data.choices[0].message.content
    };
  }
}

function parseTextResponse(text) {
  // Basic parser for text responses
  const result = {
    category: 'Unknown',
    brand: 'Unknown', 
    model: 'Unknown',
    condition: 5,
    confidence: 5,
    salvageable_parts: [],
    estimated_value: { min: 0, max: 0 },
    reasoning: text
  };

  // Try to extract information from text
  const lines = text.split('\n');
  lines.forEach(line => {
    const lower = line.toLowerCase();
    if (lower.includes('category:')) {
      result.category = line.split(':')[1]?.trim() || 'Unknown';
    } else if (lower.includes('brand:')) {
      result.brand = line.split(':')[1]?.trim() || 'Unknown';
    } else if (lower.includes('condition:')) {
      const match = line.match(/\d+/);
      if (match) result.condition = parseInt(match[0]);
    } else if (lower.includes('confidence:')) {
      const match = line.match(/\d+/);
      if (match) result.confidence = parseInt(match[0]);
    } else if (lower.includes('value:') || lower.includes('price:')) {
      const matches = line.match(/\$?(\d+)/g);
      if (matches && matches.length > 0) {
        const values = matches.map(m => parseInt(m.replace('$', '')));
        result.estimated_value.min = Math.min(...values);
        result.estimated_value.max = Math.max(...values);
      }
    }
  });

  return result;
}

async function callClaude(images, apiKey, prompt) {
  // Claude vision implementation
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-opus-20240229',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt + '\n\nRespond with valid JSON only.' },
          ...images.map(img => ({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: img
            }
          }))
        ]
      }],
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.content[0].text);
}

function getDefaultPrompt() {
  return `You are a circular economy assistant helping users identify and evaluate items for resale or donation.

Analyze the image and provide a detailed assessment in the following JSON format:

{
  "category": "specific item category",
  "brand": "brand name or Unknown",
  "model": "model name or descriptive name",
  "condition": {
    "rating": 7,  // 1-10 scale
    "description": "detailed condition assessment",
    "usableAsIs": true,
    "issues": ["list", "of", "issues"]
  },
  "resale": {
    "recommendation": "resell",  // resell, donate, recycle, etc
    "priceRange": {
      "low": 20,
      "high": 50,
      "currency": "USD"
    },
    "justification": "why this price range"
  },
  "salvageable": [
    {
      "component": "component name",
      "value": "potential value",
      "disposal": "how to dispose/recycle"
    }
  ],
  "confidence": 8  // 1-10 confidence in assessment
}

Be specific and detailed. The image shows a furniture item - analyze its type, materials, condition, and resale potential.`;
}

export default analyzeItem;