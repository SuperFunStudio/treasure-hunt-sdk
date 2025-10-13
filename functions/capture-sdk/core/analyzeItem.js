// capture-sdk/core/analyzeItem.js - UPDATED with vehicle detection and enhanced prompts
// Enhanced vision analysis with Claude Sonnet 4 and vehicle awareness

const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

/**
 * Analyze 1–3 images using Claude with enhanced vehicle detection
 */
async function analyzeItem(images, options = {}) {
  const {
    apiKey,
    model = 'claude-sonnet-4-20250514',
    temperature = 0.1,
    maxTokens = 1500,
    uid = null,
    saveToFirestore = false
  } = options;

  console.log('🔍 Starting enhanced Claude analysis with vehicle detection:', {
    model,
    imageCount: images?.length,
    hasApiKey: !!apiKey,
    maxTokens
  });

  const effectiveApiKey = apiKey || process.env.CLAUDE_API_KEY;

  if (!effectiveApiKey) {
    throw new Error('CLAUDE_API_KEY is required');
  }
  
  if (!images || !Array.isArray(images) || images.length === 0) {
    throw new Error('At least one image is required (1–3 images supported)');
  }

  const processedImages = images.slice(0, 3);

  try {
    const result = await callClaudeAPI(processedImages, effectiveApiKey, {
      model,
      temperature,
      maxTokens
    });

    // Post-process the result to ensure vehicle detection
    const enhancedResult = enhanceAnalysisResult(result);

    console.log('✅ Enhanced Claude analysis complete:', {
      category: enhancedResult.category,
      detectedType: enhancedResult.detectedType,
      brand: enhancedResult.brand,
      confidence: enhancedResult.confidence,
      condition: enhancedResult.condition?.rating,
      isVehicle: enhancedResult.isVehicle
    });

    return enhancedResult;

  } catch (error) {
    console.error('❌ Claude analysis failed:', error.message);
    return createErrorResponse(error.message, images.length);
  }
}

/**
 * Call Claude API with enhanced vehicle detection prompt
 */
async function callClaudeAPI(images, apiKey, options = {}) {
  const {
    model = 'claude-sonnet-4-20250514',
    temperature = 0.1,
    maxTokens = 1500
  } = options;

  console.log('🔵 Calling Claude API with vehicle-aware analysis');

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
        { type: 'text', text: VEHICLE_AWARE_ANALYSIS_PROMPT },
        ...imageContent
      ]
    }]
  };

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
    console.error('❌ Claude API Error:', response.status, errorText);
    
    if (response.status === 401) {
      throw new Error('Invalid Claude API key');
    }
    if (response.status === 429) {
      throw new Error('Claude API rate limit exceeded');
    }
    if (response.status === 400) {
      throw new Error('Invalid request to Claude API');
    }
    
    throw new Error(`Claude API error ${response.status}: ${errorText || response.statusText}`);
  }

  const data = await response.json();
  
  if (data.usage) {
    console.log('💰 Token usage:', {
      input: data.usage.input_tokens,
      output: data.usage.output_tokens,
      total: data.usage.input_tokens + data.usage.output_tokens
    });
  }

  const rawContent = data.content?.[0]?.text || '';
  
  if (!rawContent) {
    throw new Error('No content received from Claude API');
  }

  console.log('📝 Raw response preview:', rawContent.substring(0, 200) + '...');

  const parsed = parseJsonResponse(rawContent);
  
  if (!parsed) {
    console.error('🔍 FULL RAW RESPONSE FOR DEBUGGING:', rawContent);
    throw new Error('Failed to parse JSON response from Claude');
  }

  const normalized = normalizeResponse(parsed);
  return sanitizeResponse(normalized);
}

/**
 * Enhanced analysis result with vehicle detection
 */
function enhanceAnalysisResult(result) {
  // Detect if this is a vehicle based on the analysis
  const category = result.category?.toLowerCase() || '';
  const description = result.condition?.description?.toLowerCase() || '';
  const brand = result.brand?.toLowerCase() || '';
  
  const vehicleIndicators = [
    'car', 'automobile', 'sedan', 'suv', 'truck', 'van', 'coupe',
    'vehicle', 'motorcycle', 'boat', 'rv', 'camper', 'trailer'
  ];
  
  const autoPartIndicators = [
    'alternator', 'starter', 'radiator', 'transmission', 'engine',
    'brake', 'tire', 'wheel', 'bumper', 'headlight', 'taillight'
  ];
  
  const allText = `${category} ${description} ${brand}`.toLowerCase();
  
  let detectedType = 'standard';
  let isVehicle = false;
  
  // Check for vehicle
  if (vehicleIndicators.some(indicator => allText.includes(indicator))) {
    detectedType = 'vehicle';
    isVehicle = true;
    
    // Try to be more specific about vehicle type
    if (allText.includes('motorcycle') || allText.includes('bike')) {
      detectedType = 'motorcycle';
    } else if (allText.includes('boat') || allText.includes('yacht')) {
      detectedType = 'boat';
    } else if (allText.includes('rv') || allText.includes('camper')) {
      detectedType = 'rv';
    } else if (allText.includes('truck')) {
      detectedType = 'truck';
    } else {
      detectedType = 'automobile';
    }
    
    console.log(`🚗 Vehicle detected: ${detectedType}`);
  }
  
  // Check for auto parts
  else if (autoPartIndicators.some(indicator => allText.includes(indicator))) {
    detectedType = 'auto_parts';
    console.log(`🔧 Auto parts detected`);
  }
  
  // Enhanced result with detection metadata
  return {
    ...result,
    detectedType,
    isVehicle,
    vehicleSpecific: isVehicle ? {
      type: detectedType,
      estimatedValue: isVehicle ? getVehicleEstimateRange(result) : null,
      specialHandling: isVehicle ? 'Local pickup typically required' : null
    } : null
  };
}

/**
 * Get vehicle estimate range based on analysis
 */
function getVehicleEstimateRange(result) {
  const brand = result.brand?.toLowerCase() || '';
  const condition = result.condition?.rating || 'fair';
  
  // Base ranges by brand tier
  const brandTiers = {
    'luxury': ['bmw', 'mercedes', 'audi', 'lexus', 'acura', 'infiniti', 'cadillac'],
    'premium': ['toyota', 'honda', 'mazda', 'subaru', 'nissan'],
    'standard': ['ford', 'chevrolet', 'dodge', 'hyundai', 'kia']
  };
  
  let baseRange = { low: 2000, high: 15000 }; // Default
  
  if (brandTiers.luxury.some(b => brand.includes(b))) {
    baseRange = { low: 5000, high: 30000 };
  } else if (brandTiers.premium.some(b => brand.includes(b))) {
    baseRange = { low: 3000, high: 20000 };
  }
  
  // Adjust for condition
  const conditionMultipliers = {
  'excellent': 1.0,
  'good': 0.75,      // Was 0.85 - too high
  'fair': 0.50,      // Was 0.65 - too high
  'poor': 0.25,      // Was 0.35 - way too high
  'parts_only': 0.15  // NEW - for non-functional items
};
  
  const multiplier = conditionMultipliers[condition] || 0.6;
  
  return {
    low: Math.round(baseRange.low * multiplier),
    high: Math.round(baseRange.high * multiplier),
    note: 'Estimate range - actual value depends on year, mileage, and detailed condition'
  };
}

/**
 * Vehicle-aware analysis prompt
 */
const VEHICLE_AWARE_ANALYSIS_PROMPT = `You are an expert product identification assistant specializing in marketplace resale analysis. Pay special attention to vehicle identification and automotive items.

CRITICAL: VEHICLE DETECTION PRIORITY
If you see ANY of these, classify as a vehicle or automotive item:
- Cars, trucks, SUVs, sedans, coupes, convertibles, wagons
- Motorcycles, scooters, mopeds, dirt bikes
- Boats, yachts, jet skis, watercraft
- RVs, motorhomes, trailers, campers
- Auto parts: engines, transmissions, wheels, bumpers, lights, etc.

VEHICLE ANALYSIS REQUIREMENTS:
1. **EXACT VEHICLE IDENTIFICATION**:
   - Make/Brand: Look for badges, emblems, grilles, distinctive styling
   - Model: Check for model badges, trim levels, specific design cues
   - Year: Look for design generation clues, license plates, inspection stickers
   - Body style: Sedan, coupe, SUV, truck, hatchback, etc.

2. **VEHICLE CONDITION ASSESSMENT**:
   - Exterior: Paint condition, rust, dents, scratches, panel alignment
   - Interior: Seat wear, dashboard condition, electronics functionality
   - Mechanical: Engine bay cleanliness, fluid leaks, tire condition
   - Mileage: If visible on odometer

3. **VEHICLE VALUE FACTORS**:
   - Age-based depreciation (newer = higher value)
   - Brand reputation (luxury brands retain value better)
   - Condition impact (excellent condition can add 20-30% value)
   - Market demand (popular models hold value better)

ENHANCED BRAND RECOGNITION:

**Automotive Brands** (be very specific):
- Luxury: BMW, Mercedes-Benz, Audi, Lexus, Acura, Infiniti, Cadillac, Lincoln
- Premium: Toyota, Honda, Mazda, Subaru, Nissan, Volvo
- Standard: Ford, Chevrolet, Dodge, Hyundai, Kia, Mitsubishi
- Trucks: Ram, GMC, Silverado, F-150, Tundra, Tacoma
- Exotic: Ferrari, Lamborghini, Porsche, Maserati, McLaren

**Auto Parts Recognition**:
- Engine components: Alternator, starter, radiator, transmission
- Brakes: Calipers, rotors, pads, brake lines
- Suspension: Shocks, struts, springs, control arms
- Body: Bumpers, hoods, doors, fenders, mirrors
- Electrical: Headlights, taillights, sensors, modules

PRICING GUIDANCE FOR VEHICLES:

**High-Value Vehicles** ($10,000+):
- Luxury sedans/SUVs less than 10 years old
- Sports cars in excellent condition
- Trucks less than 5 years old
- Classic cars (25+ years) in excellent condition

**Medium-Value Vehicles** ($3,000-$10,000):
- Standard sedans/SUVs 5-15 years old in good condition
- Older luxury vehicles in fair condition
- Motorcycles in good condition

**Lower-Value Vehicles** ($500-$3,000):
- Vehicles over 15 years old
- High-mileage vehicles (150k+ miles)
- Vehicles needing significant repairs
- Older motorcycles

**Auto Parts** ($10-$500):
- OEM parts command premium pricing
- Condition is critical for value
- Rare/discontinued parts can be valuable

JSON STRUCTURE - Return this exact format:

{
  "category": "specific vehicle type (e.g., 'mid-size sedan', 'pickup truck', 'sport motorcycle', 'alternator', 'brake caliper')",
  "brand": "EXACT brand name (e.g., 'Nissan', 'BMW', 'Harley-Davidson', 'Bosch')",
  "model": "specific model if identifiable (e.g., 'Altima', '3 Series', 'Sportster', 'Unknown')",
  "year": "model year if determinable from styling/plates/stickers, or 'Unknown'",
  "bodyStyle": "for vehicles: 'sedan', 'coupe', 'SUV', 'pickup', 'hatchback', etc.",
  "materials": ["primary material", "secondary material"],
  "condition": {
    "rating": "excellent|good|fair|poor",
    "description": "detailed condition with specific observations about wear, damage, functionality",
    "usableAsIs": true,
    "issues": ["specific issue 1", "specific issue 2"],
    "mileage": "if visible on odometer or estimated from wear"
  },
  "identifiers": {
    "visible_text": "ALL visible text, badges, license plates, VINs, part numbers",
    "vin": "if any VIN visible",
    "color": "exterior color and interior if visible",
    "distinctive_features": ["unique design elements", "aftermarket modifications"]
  },
  "resale": {
    "recommendation": "resell|local_pickup|donate|salvage",
    "priceRange": "realistic range for vehicle/part (e.g., '8000-12000' for decent car, '50-150' for auto part)",
    "justification": "value assessment considering age, condition, brand, market demand"
  },
  "vehicleSpecific": {
    "estimatedMileage": "if determinable",
    "fuelType": "gasoline|diesel|electric|hybrid if determinable",
    "transmission": "manual|automatic if visible",
    "drivetrain": "FWD|RWD|AWD if determinable",
    "specialFeatures": ["sunroof", "leather seats", "navigation", etc.]
  },
  "confidence": 8
}

VEHICLE PRICING REALITY CHECK:
- Cars typically range $500-$50,000+ depending on age/condition
- Motorcycles typically range $500-$25,000+
- Auto parts typically range $10-$2,000
- If you estimate under $500 for a functional vehicle, reconsider

CONFIDENCE SCORING FOR VEHICLES:
- 9-10: Clear brand/model visible, year determinable, condition obvious
- 7-8: Brand clear, model likely, condition assessable
- 5-6: Vehicle type clear, some brand/condition uncertainty
- 3-4: Clearly automotive but significant uncertainty
- 1-2: Minimal vehicle identification possible

Return ONLY the JSON object with no additional text or markdown formatting.`;

// Existing utility functions (keeping the same)
function determineImageMediaType(img) {
  if (typeof img === 'string') {
    if (img.startsWith('data:image/png')) return 'image/png';
    if (img.startsWith('data:image/gif')) return 'image/gif';
    if (img.startsWith('data:image/webp')) return 'image/webp';
    return 'image/jpeg';
  }
  return 'image/jpeg';
}

function convertToBase64(img) {
  if (typeof img === 'string') {
    if (img.startsWith('data:image/')) {
      return img.split(',')[1];
    }
    return img;
  }
  
  if (Buffer.isBuffer(img)) {
    return img.toString('base64');
  }
  
  if (typeof img === 'object' && img !== null) {
    if (img.base64) return img.base64;
    if (img.buffer) return img.buffer.toString('base64');
  }
  
  throw new Error(`Unsupported image format: ${typeof img}`);
}

function parseJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  let text = rawText.trim();

  // Strategy 1: Direct JSON parse
  try {
    return JSON.parse(text);
  } catch (e) {
    console.log('JSON Strategy 1 failed, trying fallbacks...');
  }

  // Strategy 2: Remove markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const codeBlockMatch = text.match(codeBlockRegex);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {
      console.log('JSON Strategy 2 failed...');
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
      console.log('JSON Strategy 3 failed...');
    }
  }

  // Strategy 4: Clean common issues
  try {
    let cleaned = text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/^\s*json\s*/i, '')
      .replace(/^[^{]*({.*})[^}]*$/s, '$1')
      .trim();
    
    return JSON.parse(cleaned);
  } catch (e) {
    console.log('JSON Strategy 4 failed...');
  }

  console.error('❌ All JSON parsing strategies failed');
  return null;
}

function normalizeResponse(parsed) {
  console.log('🔄 Normalizing Claude response with keys:', Object.keys(parsed));

  return {
    category: extractField(parsed, ['category', 'itemCategory'], 'Unknown'),
    brand: extractField(parsed, ['brand', 'manufacturer'], 'Unknown'),
    model: extractField(parsed, ['model', 'productName'], 'Unknown'),
    year: extractField(parsed, ['year', 'modelYear'], 'Unknown'),
    bodyStyle: extractField(parsed, ['bodyStyle', 'body_style'], 'Unknown'),
    condition: normalizeCondition(parsed),
    resale: normalizeResale(parsed),
    salvageable: normalizeSalvageable(parsed),
    confidence: extractField(parsed, ['confidence', 'confidenceRating'], 5),
    
    // Enhanced fields
    materials: extractField(parsed, ['materials', 'material'], []),
    identifiers: normalizeIdentifiers(parsed),
    vehicleSpecific: extractField(parsed, ['vehicleSpecific', 'vehicle_specific'], {}),
    
    // Original fields for compatibility
    keyFeatures: extractField(parsed, ['keyFeatures', 'distinctive_features'], []),
    specifications: normalizeSpecifications(parsed)
  };
}

function extractField(obj, keys, defaultValue) {
  for (const key of keys) {
    if (obj && obj.hasOwnProperty(key) && obj[key] !== null && obj[key] !== undefined) {
      return obj[key];
    }
  }
  return defaultValue;
}

function normalizeCondition(parsed) {
  const conditionData = parsed.condition || {};
  
  if (typeof conditionData === 'string') {
    return {
      rating: normalizeConditionRating(conditionData),
      description: conditionData,
      usableAsIs: !conditionData.toLowerCase().includes('broken'),
      issues: []
    };
  }

  return {
    rating: normalizeConditionRating(conditionData.rating || 'fair'),
    description: conditionData.description || '',
    usableAsIs: conditionData.usableAsIs !== false,
    issues: Array.isArray(conditionData.issues) ? conditionData.issues : [],
    mileage: conditionData.mileage || null
  };
}

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

function normalizeResale(parsed) {
  const resaleData = parsed.resale || {};
  
  return {
    recommendation: extractField(resaleData, ['recommendation'], 'evaluate'),
    priceRange: {
      low: extractPriceValue(resaleData, ['low', 'min']) || 0,
      high: extractPriceValue(resaleData, ['high', 'max']) || 0,
      currency: 'USD'
    },
    justification: extractField(resaleData, ['justification', 'reasoning'], '')
  };
}

function extractPriceValue(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== null && obj[key] !== undefined) {
      const value = obj[key];
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const match = value.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
      }
    }
  }
  
  const priceRangeStr = extractField(obj, ['priceRange', 'price_range'], '');
  if (priceRangeStr) {
    const match = priceRangeStr.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }
  
  return 0;
}

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

function normalizeIdentifiers(parsed) {
  const identifiers = parsed.identifiers || {};
  
  return {
    visible_text: extractField(identifiers, ['visible_text', 'visibleText', 'text'], ''),
    vin: extractField(identifiers, ['vin', 'VIN'], ''),
    logos_seen: extractField(identifiers, ['logos_seen', 'logosSeen', 'logos'], ''),
    size_info: extractField(identifiers, ['size_info', 'sizeInfo', 'size'], ''),
    color: extractField(identifiers, ['color', 'primaryColor'], ''),
    distinctive_features: extractField(identifiers, ['distinctive_features', 'distinctiveFeatures'], [])
  };
}

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

function sanitizeResponse(normalized) {
  const trimString = (val) => typeof val === 'string' ? val.trim() : val;
  
  return {
    category: trimString(normalized.category) || 'Unknown',
    brand: trimString(normalized.brand) || 'Unknown',
    model: trimString(normalized.model) || 'Unknown',
    year: trimString(normalized.year) || 'Unknown',
    bodyStyle: trimString(normalized.bodyStyle) || 'Unknown',
    condition: {
      rating: normalized.condition?.rating || 'fair',
      description: trimString(normalized.condition?.description) || '',
      usableAsIs: normalized.condition?.usableAsIs !== false,
      issues: Array.isArray(normalized.condition?.issues) ? normalized.condition.issues : [],
      mileage: normalized.condition?.mileage || null
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
    
    // Enhanced fields
    materials: Array.isArray(normalized.materials) ? normalized.materials : [],
    identifiers: normalized.identifiers || {},
    vehicleSpecific: normalized.vehicleSpecific || {},
    
    // Compatibility fields
    keyFeatures: Array.isArray(normalized.keyFeatures) ? normalized.keyFeatures : [],
    specifications: normalized.specifications || {},
    style: 'Unknown',
    functionalType: normalized.category || 'Unknown'
  };
}

function createErrorResponse(errorMessage, imageCount = 0) {
  return {
    category: 'Unknown',
    brand: 'Unknown',
    model: 'Unknown',
    year: 'Unknown',
    bodyStyle: 'Unknown',
    condition: {
      rating: 'fair',
      description: 'Analysis failed - please review manually',
      usableAsIs: true,
      issues: ['Analysis error: ' + errorMessage],
      mileage: null
    },
    resale: {
      recommendation: 'evaluate',
      priceRange: { low: 0, high: 0, currency: 'USD' },
      justification: 'Could not analyze - manual evaluation needed'
    },
    salvageable: [],
    confidence: 1,
    materials: [],
    identifiers: {},
    vehicleSpecific: {},
    keyFeatures: [],
    specifications: {},
    style: 'Unknown',
    functionalType: 'Unknown',
    error: errorMessage,
    errorCode: 'ANALYSIS_FAILED',
    imageCount,
    provider: 'claude'
  };
}

// Export for CommonJS
module.exports = { analyzeItem };

// For environments that need direct access
if (typeof window !== 'undefined') {
  window.analyzeItem = analyzeItem;
}