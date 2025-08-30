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
  const ENHANCED_ANALYSIS_PROMPT = `You are an expert product identification assistant for a resale marketplace app that helps people find value in items. Analyze the uploaded image(s) with the precision of a professional appraiser.

  CRITICAL IDENTIFICATION PRIORITIES:
  1. **BRAND DETECTION** - Look exhaustively for brand identifiers:
    - Logos (even partial or worn)
    - Text on labels, tags, stickers, stamps
    - Model numbers, serial numbers, part numbers
    - Embossed or molded brand marks
    - Design signatures unique to specific brands
    - Check ALL visible surfaces, including bottoms, backs, undersides

  2. **SPECIFIC CATEGORIZATION** - Be as specific as possible:
    - Include materials: "bamboo side table" not "furniture"
    - Include function: "infant car seat" not "child safety equipment"
    - Include style: "vintage leather jacket" not "clothing"
    - Include size category when relevant: "compact microwave" vs "full-size microwave"

  3. **CONDITION ASSESSMENT** - Professional evaluation:
    - Note ALL visible wear, damage, or defects
    - Assess functionality from visual cues
    - Consider age-appropriate wear vs damage
    - Evaluate completeness (missing parts, accessories)

  4. **RESALE VALUE FACTORS** - Consider market demand:
    - Brand reputation and desirability
    - Current market trends for this item type
    - Condition impact on value
    - Completeness (original packaging, accessories, manuals)
    - Vintage/collectible potential

  SPECIAL BRAND RECOGNITION GUIDES:

  **Furniture Brands to Watch For:**
  - IKEA (look for blue/yellow tags, Swedish names, assembly codes)
  - West Elm, Pottery Barn, Crate & Barrel (often have metal tags)
  - Herman Miller, Steelcase (office furniture with distinctive design)
  - Mid-century pieces (Eames, Knoll often have manufacturer marks)

  **Electronics Brands:**
  - Apple (distinctive design, logos, model numbers like A1234)
  - Samsung, Sony, LG (model numbers on backs/bottoms)
  - Gaming consoles (distinctive controller ports, ventilation)

  **Baby/Child Items:**
  - Doona (car seat/stroller combo - premium brand)
  - Maxi-Cosi, Chicco, Graco (safety seats)
  - UPPAbaby, Bugaboo (premium strollers - high resale value)
  - Fisher-Price, Little Tikes (toys/gear)

  **Clothing Brands:**
  - Designer labels in collars, waistbands, inner tags
  - Athletic brands on labels, logos, distinctive styling
  - Vintage band tees, sports memorabilia (check copyright dates)

  ENHANCED JSON STRUCTURE - Return this exact format:

  {
    "category": "specific item with materials/style (e.g., 'infant car seat with base', 'vintage teak side table', 'Apple MacBook Pro 13-inch')",
    "brand": "EXACT brand name if visible (be specific: 'Doona', 'IKEA', 'Apple'), or 'Unknown'",
    "model": "specific model name/number if visible, or 'Unknown'",
    "materials": ["primary material", "secondary material"],
    "style": "style descriptor (vintage, modern, industrial, minimalist, etc.)",
    "keyFeatures": ["distinctive feature 1", "distinctive feature 2", "distinctive feature 3"],
    "functionalType": "primary function (car seat, coffee table, laptop, etc.)",
    "condition": {
      "rating": "excellent|good|fair|poor",
      "description": "detailed condition notes including specific wear patterns, damage, or defects",
      "usableAsIs": true,
      "issues": ["specific issue 1", "specific issue 2"]
    },
    "identifiers": {
      "visible_text": "ALL text visible on item (brand names, model numbers, labels, stickers)",
      "logos_seen": "description of any logos or brand marks visible",
      "size_info": "dimensions, capacity, or size markings if visible",
      "color": "primary color and finish (e.g., 'matte black', 'natural wood', 'navy blue fabric')",
      "distinctive_features": ["unique design element 1", "unique design element 2"]
    },
    "resale": {
      "recommendation": "resell|donate|repair and resell|recycle|local pickup",
      "priceRange": "realistic price range based on brand, condition, and market demand (e.g., '45-75' for mid-range items, '150-250' for premium brands)",
      "justification": "explain value assessment considering brand reputation, condition, completeness, and market demand"
    },
    "specifications": {
      "size": "approximate dimensions or capacity if determinable",
      "material": "primary construction material",
      "style": "design style or era",
      "era": "approximate age if vintage/antique",
      "construction": "build quality indicators (solid wood, injection molded, sewn construction, etc.)"
    },
    "salvageable": ["component 1 if item is damaged", "component 2"],
    "confidence": 8
  }

  PRICING GUIDANCE BY CATEGORY:

  **High-Value Items** (typically $100+):
  - Premium baby gear (Doona, UPPAbaby, Maxi-Cosi)
  - Apple electronics, gaming consoles
  - Designer furniture, mid-century pieces
  - Professional tools (DeWalt, Milwaukee)
  - High-end appliances

  **Medium-Value Items** ($25-100):
  - Brand-name clothing in good condition
  - IKEA furniture in excellent condition
  - Consumer electronics (non-premium brands)
  - Sporting goods from known brands
  - Complete toy sets

  **Lower-Value Items** ($5-25):
  - Generic household items
  - Worn clothing without designer labels
  - Incomplete toy sets
  - Older electronics without brand appeal

  CONFIDENCE SCORING:
  - **9-10**: Clear brand visible, model identifiable, condition obvious
  - **7-8**: Brand visible OR category very clear, condition assessable
  - **5-6**: Category clear, some uncertainty about brand/condition
  - **3-4**: Can identify general category, significant uncertainty
  - **1-2**: Minimal identification possible

  QUALITY CONTROL:
  - If multiple items visible, focus on the most prominent/valuable item
  - If uncertain about brand, state "Unknown" rather than guessing
  - Price ranges should reflect realistic resale values, not retail prices
  - Consider regional market factors (some brands more popular in certain areas)
  - Account for seasonal demand (winter coats in summer = lower immediate value)

  Return ONLY the JSON object with no additional text or markdown formatting.`;

  // Export for CommonJS
  module.exports = { analyzeItem };

  // For environments that need direct access
  if (typeof window !== 'undefined') {
    window.analyzeItem = analyzeItem;
  }