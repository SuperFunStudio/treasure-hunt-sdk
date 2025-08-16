// capture-sdk/core/analyzeItem.js
// Enhanced vision analysis with Claude Sonnet 4
// - Streamlined for Claude API only
// - Proper error handling and fallbacks
// - Enhanced JSON parsing with multiple strategies
// - Support for 1-3 images

// Dynamic import for fetch in Node.js environments
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

/**
 * Analyze 1–3 images using Claude and return normalized item data.
 * @param {Array<Buffer|string|{buffer?:Buffer, base64?:string, url?:string}>} images
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function analyzeItem(images, options = {}) {
  const {
    apiKey,
    model = 'claude-sonnet-4-20250514',
    temperature = 0.1,
    maxTokens = 1500,
    // passthroughs for compatibility
    uid = null,
    saveToFirestore = false
  } = options;

  console.log('🔍 Starting Claude item analysis with options:', {
    model,
    imageCount: images?.length,
    hasApiKey: !!apiKey,
    maxTokens
  });

  // Determine API key
  const effectiveApiKey = apiKey || process.env.CLAUDE_API_KEY;

  if (!effectiveApiKey) {
    throw new Error('CLAUDE_API_KEY is required (set environment variable or pass options.apiKey)');
  }
  
  if (!images || !Array.isArray(images) || images.length === 0) {
    throw new Error('At least one image is required (1–3 images supported)');
  }

  // Limit to 3 images for optimal performance
  const processedImages = images.slice(0, 3);

  try {
    const result = await callClaudeAPI(processedImages, effectiveApiKey, {
      model,
      temperature,
      maxTokens
    });

    console.log('✅ Claude analysis complete:', {
      category: result.category,
      brand: result.brand,
      confidence: result.confidence,
      condition: result.condition?.rating,
      materials: result.materials?.length || 0
    });

    return result;

  } catch (error) {
    console.error('❌ Claude analysis failed:', error.message);
    
    // Return a basic structure on error instead of throwing
    // This prevents the entire UI from breaking
    return createErrorResponse(error.message, images.length);
  }
}

/**
 * Call Claude API for image analysis
 */
async function callClaudeAPI(images, apiKey, options = {}) {
  const {
    model = 'claude-sonnet-4-20250514',
    temperature = 0.1,
    maxTokens = 1500
  } = options;

  console.log('🔵 Calling Claude API with:', {
    model,
    imageCount: images.length,
    maxTokens
  });

  // Convert images to Claude format
  const imageContent = images.map((img, index) => {
    console.log(`📸 Processing image ${index + 1}:`, typeof img);
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: determineImageMediaType(img),
        data: convertToBase64(img)
      }
    };
  });

  const requestBody = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: ENHANCED_ANALYSIS_PROMPT },
        ...imageContent
      ]
    }]
  };

  console.log('🚀 Sending request to Claude API...');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('❌ Claude API Error:', errorText);
    
    // Handle specific error cases
    if (response.status === 401) {
      throw new Error('Invalid Claude API key - check your CLAUDE_API_KEY environment variable');
    }
    if (response.status === 429) {
      throw new Error('Claude API rate limit exceeded - please try again later');
    }
    if (response.status === 400) {
      throw new Error('Invalid request to Claude API - check image format and size');
    }
    
    throw new Error(`Claude API error ${response.status}: ${errorText || response.statusText}`);
  }

  const data = await response.json();
  console.log('✅ Claude API response received');
  
  // Log usage for debugging
  if (data.usage) {
    console.log('💰 Token usage:', {
      input: data.usage.input_tokens,
      output: data.usage.output_tokens,
      total: data.usage.input_tokens + data.usage.output_tokens
    });
  }

  // Extract content from response
  const rawContent = data.content?.[0]?.text || '';
  
  if (!rawContent) {
    throw new Error('No content received from Claude API');
  }

  console.log('📝 Raw response preview:', rawContent.substring(0, 200) + '...');

  // Parse JSON with multiple strategies
  const parsed = parseJsonResponse(rawContent);
  
  if (!parsed) {
    console.error('🔍 FULL RAW RESPONSE FOR DEBUGGING:', rawContent);
    throw new Error('Failed to parse JSON response from Claude');
  }

  // Normalize the response to our internal format
  const normalized = normalizeResponse(parsed);
  
  // Validate and sanitize the normalized response
  return sanitizeResponse(normalized);
}

/**
 * Determine image media type for Claude API
 */
function determineImageMediaType(img) {
  if (typeof img === 'string') {
    if (img.startsWith('data:image/png')) return 'image/png';
    if (img.startsWith('data:image/gif')) return 'image/gif';
    if (img.startsWith('data:image/webp')) return 'image/webp';
    return 'image/jpeg'; // Default
  }
  
  // For buffers or other formats, default to JPEG
  return 'image/jpeg';
}

/**
 * Convert image to base64 string for Claude API
 */
function convertToBase64(img) {
  if (typeof img === 'string') {
    // If it's a data URL, extract the base64 part
    if (img.startsWith('data:image/')) {
      return img.split(',')[1];
    }
    // If it's already base64, return as-is
    return img;
  }
  
  if (Buffer.isBuffer(img)) {
    return img.toString('base64');
  }
  
  if (typeof img === 'object' && img !== null) {
    if (img.base64) return img.base64;
    if (img.buffer) return img.buffer.toString('base64');
  }
  
  throw new Error(`Unsupported image format for Claude: ${typeof img}`);
}

/**
 * Parse JSON response with multiple fallback strategies
 */
function parseJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  let text = rawText.trim();

  // Strategy 1: Direct JSON parse
  try {
    return JSON.parse(text);
  } catch (e) {
    console.log('📋 JSON Strategy 1 failed, trying fallbacks...');
  }

  // Strategy 2: Remove markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const codeBlockMatch = text.match(codeBlockRegex);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {
      console.log('📋 JSON Strategy 2 failed...');
    }
  }

  // Strategy 3: Find JSON object boundaries
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonStr = text.slice(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr);
    } catch (e) {
      console.log('📋 JSON Strategy 3 failed...');
    }
  }

  // Strategy 4: Try to clean common issues
  try {
    let cleaned = text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/^\s*json\s*/i, '')
      .replace(/^[^{]*({.*})[^}]*$/s, '$1') // Extract JSON object
      .trim();
    
    return JSON.parse(cleaned);
  } catch (e) {
    console.log('📋 JSON Strategy 4 failed...');
  }

  console.error('❌ All JSON parsing strategies failed for text:', text.substring(0, 500));
  return null;
}

/**
 * Normalize response from Claude to our internal format
 */
function normalizeResponse(parsed) {
  console.log('🔄 Normalizing Claude response with keys:', Object.keys(parsed));

  const normalized = {
    category: extractField(parsed, ['category', 'itemCategory', 'item_category'], 'Unknown'),
    brand: extractField(parsed, ['brand', 'manufacturer'], 'Unknown'),
    model: extractField(parsed, ['model', 'productName', 'product_name'], 'Unknown'),
    condition: normalizeCondition(parsed),
    resale: normalizeResale(parsed),
    salvageable: normalizeSalvageable(parsed),
    confidence: extractField(parsed, ['confidence', 'confidenceRating'], 5),
    
    // Enhanced fields for better search queries
    materials: extractField(parsed, ['materials', 'material'], []),
    style: extractField(parsed, ['style', 'styleType'], 'Unknown'),
    keyFeatures: extractField(parsed, ['keyFeatures', 'key_features', 'features'], []),
    functionalType: extractField(parsed, ['functionalType', 'functional_type', 'type'], 'Unknown'),
    identifiers: normalizeIdentifiers(parsed),
    specifications: normalizeSpecifications(parsed)
  };

  return normalized;
}

/**
 * Extract field with multiple possible keys
 */
function extractField(obj, keys, defaultValue) {
  for (const key of keys) {
    if (obj && obj.hasOwnProperty(key) && obj[key] !== null && obj[key] !== undefined) {
      return obj[key];
    }
  }
  return defaultValue;
}

/**
 * Normalize condition data
 */
function normalizeCondition(parsed) {
  const conditionData = parsed.condition || {};
  
  // Handle string condition
  if (typeof conditionData === 'string') {
    return {
      rating: normalizeConditionRating(conditionData),
      description: conditionData,
      usableAsIs: !conditionData.toLowerCase().includes('broken'),
      issues: []
    };
  }

  // Handle object condition
  return {
    rating: normalizeConditionRating(conditionData.rating || conditionData.condition || 'fair'),
    description: conditionData.description || '',
    usableAsIs: conditionData.usableAsIs !== false,
    issues: Array.isArray(conditionData.issues) ? conditionData.issues : []
  };
}

/**
 * Normalize condition rating to standard values
 */
function normalizeConditionRating(rating) {
  if (typeof rating === 'number') {
    if (rating >= 9) return 'excellent';
    if (rating >= 7) return 'good';
    if (rating >= 5) return 'fair';
    return 'poor';
  }

  const ratingStr = String(rating).toLowerCase();
  const mappings = {
    'excellent': 'excellent',
    'very good': 'good',
    'good': 'good',
    'fair': 'fair',
    'poor': 'poor',
    'new': 'excellent',
    'like new': 'excellent',
    'used': 'good',
    'damaged': 'poor',
    'broken': 'poor'
  };

  return mappings[ratingStr] || 'fair';
}

/**
 * Normalize resale data
 */
function normalizeResale(parsed) {
  const resaleData = parsed.resale || {};
  
  return {
    recommendation: extractField(resaleData, ['recommendation'], 'evaluate'),
    priceRange: {
      low: extractPriceValue(resaleData, ['low', 'min', 'minPrice']) || 0,
      high: extractPriceValue(resaleData, ['high', 'max', 'maxPrice']) || 0,
      currency: 'USD'
    },
    justification: extractField(resaleData, ['justification', 'reasoning'], '')
  };
}

/**
 * Extract price value from various formats
 */
function extractPriceValue(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== null && obj[key] !== undefined) {
      const value = obj[key];
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        // Extract number from string like "$15–35" or "15-35"
        const match = value.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
      }
    }
  }
  
  // Try to extract from price range string
  const priceRangeStr = extractField(obj, ['priceRange', 'price_range'], '');
  if (priceRangeStr) {
    const match = priceRangeStr.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }
  
  return 0;
}

/**
 * Normalize salvageable components
 */
function normalizeSalvageable(parsed) {
  const salvageData = parsed.salvageable || [];
  
  if (!Array.isArray(salvageData)) {
    return [];
  }

  return salvageData.map(item => {
    if (typeof item === 'string') {
      return {
        component: item,
        value: 'Unknown',
        disposal: 'Check local recycling'
      };
    }
    
    return {
      component: item.component || item.part || 'Unknown part',
      value: item.value || 'Unknown',
      disposal: item.disposal || 'Check local recycling'
    };
  });
}

/**
 * Normalize identifiers
 */
function normalizeIdentifiers(parsed) {
  const identifiers = parsed.identifiers || {};
  
  return {
    visible_text: extractField(identifiers, ['visible_text', 'visibleText', 'text'], ''),
    logos_seen: extractField(identifiers, ['logos_seen', 'logosSeen', 'logos'], ''),
    size_info: extractField(identifiers, ['size_info', 'sizeInfo', 'size'], ''),
    color: extractField(identifiers, ['color', 'primaryColor'], ''),
    distinctive_features: extractField(identifiers, ['distinctive_features', 'distinctiveFeatures'], [])
  };
}

/**
 * Normalize specifications
 */
function normalizeSpecifications(parsed) {
  const specs = parsed.specifications || {};
  
  return {
    size: extractField(specs, ['size', 'dimensions'], ''),
    material: extractField(specs, ['material', 'primaryMaterial'], ''),
    style: extractField(specs, ['style', 'styleType'], ''),
    era: extractField(specs, ['era', 'period'], ''),
    construction: extractField(specs, ['construction', 'constructionType'], '')
  };
}

/**
 * Sanitize and validate the final response
 */
function sanitizeResponse(normalized) {
  // Trim string values
  const trimString = (val) => typeof val === 'string' ? val.trim() : val;
  
  return {
    category: trimString(normalized.category) || 'Unknown',
    brand: trimString(normalized.brand) || 'Unknown',
    model: trimString(normalized.model) || 'Unknown',
    condition: {
      rating: normalized.condition?.rating || 'fair',
      description: trimString(normalized.condition?.description) || '',
      usableAsIs: normalized.condition?.usableAsIs !== false,
      issues: Array.isArray(normalized.condition?.issues) ? normalized.condition.issues : []
    },
    resale: {
      recommendation: normalized.resale?.recommendation || 'evaluate',
      priceRange: {
        low: Math.max(0, normalized.resale?.priceRange?.low || 0),
        high: Math.max(0, normalized.resale?.priceRange?.high || 0),
        currency: 'USD'
      },
      justification: trimString(normalized.resale?.justification) || ''
    },
    salvageable: Array.isArray(normalized.salvageable) ? normalized.salvageable : [],
    confidence: Math.min(10, Math.max(1, normalized.confidence || 5)),
    
    // Enhanced fields for better eBay search queries
    materials: Array.isArray(normalized.materials) ? normalized.materials : [],
    style: trimString(normalized.style) || 'Unknown',
    keyFeatures: Array.isArray(normalized.keyFeatures) ? normalized.keyFeatures : [],
    functionalType: trimString(normalized.functionalType) || 'Unknown',
    identifiers: normalized.identifiers || {},
    specifications: normalized.specifications || {}
  };
}

/**
 * Create error response structure
 */
function createErrorResponse(errorMessage, imageCount = 0) {
  return {
    category: 'Unknown',
    brand: 'Unknown',
    model: 'Unknown',
    condition: {
      rating: 'fair',
      description: 'Analysis failed - please review manually',
      usableAsIs: true,
      issues: ['Analysis error: ' + errorMessage]
    },
    resale: {
      recommendation: 'evaluate',
      priceRange: { low: 0, high: 0, currency: 'USD' },
      justification: 'Could not analyze - manual evaluation needed'
    },
    salvageable: [],
    confidence: 1,
    materials: [],
    style: 'Unknown',
    keyFeatures: [],
    functionalType: 'Unknown',
    identifiers: {},
    specifications: {},
    error: errorMessage,
    errorCode: 'ANALYSIS_FAILED',
    imageCount,
    provider: 'claude'
  };
}

/**
 * Enhanced analysis prompt optimized for Claude Sonnet 4
 */
const ENHANCED_ANALYSIS_PROMPT = `You are an expert product identification assistant for a circular economy marketplace app. Analyze the uploaded image(s) and return a detailed JSON assessment for resale value determination.

CRITICAL REQUIREMENTS:
1. Look for ALL brand identifiers (logos, text, labels, tags, stamps, embossed marks)
2. Identify specific materials and construction details
3. Note style periods and distinctive design elements
4. Be conservative with confidence - use "Unknown" when uncertain
5. Focus on the most prominent/valuable object in multi-item photos
6. Return ONLY valid JSON - no extra text, explanations, or markdown

For FURNITURE items, pay special attention to:
- Material (bamboo, wood, metal, plastic, glass)
- Style period (mid-century, vintage, modern, industrial)
- Construction type (solid wood, veneer, jointed, welded)
- Specific furniture type (side table vs coffee table vs desk)

For ELECTRONICS, identify:
- Brand and model numbers clearly visible
- Condition of screen, buttons, ports
- Included accessories or cables

For CLOTHING, note:
- Brand labels and size tags
- Material composition labels
- Style category (vintage, designer, athletic)

Return this exact JSON structure:

{
  "category": "specific item type with materials (e.g., 'bamboo side table', 'leather jacket', 'iPhone 12')",
  "brand": "exact brand name if visible, or 'Unknown'",
  "model": "specific model/product name if visible, or 'Unknown'",
  "materials": ["primary material", "secondary material"],
  "style": "style period or aesthetic (vintage, modern, mid-century, industrial, etc.)",
  "keyFeatures": ["distinctive feature 1", "distinctive feature 2", "distinctive feature 3"],
  "functionalType": "specific function (side table, coffee table, work shirt, running shoes, etc.)",
  "condition": {
    "rating": "excellent|good|fair|poor",
    "description": "detailed condition assessment noting wear, damage, functionality",
    "usableAsIs": true,
    "issues": ["specific issue 1", "specific issue 2"]
  },
  "identifiers": {
    "visible_text": "any text visible on the item (brand names, model numbers, labels)",
    "logos_seen": "description of visible logos or brand marks",
    "size_info": "size if visible (clothing size, dimensions, etc.)",
    "color": "primary color(s)",
    "distinctive_features": ["unique visual element 1", "unique visual element 2"]
  },
  "resale": {
    "recommendation": "resell|donate|repair and resell|recycle|local pickup",
    "priceRange": "estimated price range in USD (e.g., '15-35')",
    "justification": "brief explanation of value assessment based on brand, condition, demand"
  },
  "specifications": {
    "size": "dimensions or clothing size if determinable",
    "material": "primary construction material",
    "style": "style category",
    "era": "approximate age or era if vintage",
    "construction": "how it's made (sewn, welded, jointed, etc.)"
  },
  "salvageable": ["salvageable part 1", "salvageable part 2"],
  "confidence": 7
}

EXAMPLES OF SPECIFIC CATEGORIES:
- "bamboo side table with drawer" (not just "furniture")
- "military flight suit olive drab" (not just "clothing")
- "iPhone 12 Pro 128GB" (not just "electronics")
- "vintage leather work boots size 10" (not just "footwear")
- "mid-century teak coffee table" (not just "table")

CONFIDENCE SCALE:
- 9-10: Very confident (clear brand, model, condition visible)
- 7-8: Confident (category and condition clear, some brand info)
- 5-6: Moderate (category clear, condition assessable)
- 3-4: Low (category identifiable, condition uncertain)
- 1-2: Very low (item barely identifiable)

Focus on accuracy and specificity. If uncertain about brand or model, use "Unknown" rather than guessing. Provide specific, actionable information for resale decisions.`;

// Export for CommonJS
module.exports = { analyzeItem };

// For environments that need direct access
if (typeof window !== 'undefined') {
  window.analyzeItem = analyzeItem;
}