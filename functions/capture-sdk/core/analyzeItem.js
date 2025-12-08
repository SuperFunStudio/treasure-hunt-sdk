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

  console.log('🔵 Calling Claude API with vehicle-aware analysis v2');

  const imageContent = images.map((img, index) => {
    const mediaType = determineImageMediaType(img);
    const imgPreview = typeof img === 'string' ? img.substring(0, 50) : 'Buffer';
    console.log(`📸 Processing image ${index + 1}: type=${typeof img}, mediaType=${mediaType}, preview=${imgPreview}...`);
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
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
    console.error('❌ Request body size:', JSON.stringify(requestBody).length, 'chars');
    console.error('❌ Prompt length:', VEHICLE_AWARE_ANALYSIS_PROMPT.length, 'chars');
    console.error('❌ Image count:', imageContent.length);

    if (response.status === 401) {
      throw new Error('Invalid Claude API key');
    }
    if (response.status === 429) {
      throw new Error('Claude API rate limit exceeded');
    }
    if (response.status === 400) {
      // Log more details about the 400 error
      console.error('❌ 400 Bad Request details:', errorText);
      throw new Error(`Invalid request to Claude API: ${errorText}`);
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

  // DEBUG: Log what Claude returned for assortment detection
  console.log('📦 Claude returned isAssortment:', parsed.isAssortment);
  console.log('📚 Claude itemizedList count:', parsed.itemizedList?.length || 0);
  if (parsed.itemizedList?.length > 0) {
    console.log('📖 First 3 items:', JSON.stringify(parsed.itemizedList.slice(0, 3)));
  }

  const normalized = normalizeResponse(parsed);

  // DEBUG: Log after normalization
  console.log('📋 Normalized isAssortment:', normalized.isAssortment);
  console.log('📋 Normalized itemizedList count:', normalized.itemizedList?.length || 0);

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

CRITICAL: FALSE POSITIVE PREVENTION
Some items contain vehicle-related words but are NOT vehicles:
- "Car seat" / "Carseat" = BABY PRODUCT (Brands: Doona, Graco, Chicco, Britax, Evenflo, Safety 1st, UPPAbaby, Nuna, Cybex)
- "Toy car" / "Remote control car" = TOY (Brands: Hot Wheels, Matchbox, RC brands)
- "Stroller" / "Baby carrier" / "Bassinet" = BABY PRODUCT
DO NOT classify these as vehicles. They are baby/child products or toys.

BRAND RECOGNITION - READ ALL VISIBLE TEXT:
- Look carefully for brand names, logos, and text on the item
- Common baby product brands: Doona, Graco, Chicco, Britax, Evenflo, Safety 1st, Baby Jogger, UPPAbaby, Nuna, Cybex, Maxi-Cosi
- If you see these brands, the item is a BABY PRODUCT, not a vehicle
- Always include visible brand text in the "visible_text" field

CRITICAL: VEHICLE DETECTION PRIORITY
If you see ANY of these (and ONLY these), classify as a vehicle or automotive item:
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

CRITICAL: QUANTITY AND SIZE DETECTION

**QUANTITY DETECTION** - Always count items carefully:
- If you see multiple SEPARATE items of the same type (e.g., 2 chairs, 3 lamps), count them
- Set "itemCount": to the exact number visible
- Set "isSet": true if items are meant to be sold together as a set
- Set "isSet": false if showing multiple of same item but selling individually
- Include quantity in description: "Set of 2 dining chairs" or "Pair of nightstands"

Quantity Examples:
- Photo shows 2 matching chairs side by side → "itemCount": 2, "isSet": true, description includes "pair" or "set of 2"
- Photo shows 1 chair with attached ottoman → "itemCount": 1, "isSet": false (ottoman is part of the chair)
- Photo shows stack of 6 plates → "itemCount": 6, "isSet": true
- Photo shows 1 chair only → "itemCount": 1, "isSet": false

**MULTI-ITEM / ASSORTMENT DETECTION** - CRITICAL for boxes, piles, or collections:
When you see a box, pile, bin, or container with MULTIPLE DIFFERENT items:
1. Set "isAssortment": true
2. Set "category": to a descriptive category like "Book Assortment", "Mixed Lot", "Toy Collection", etc.
3. CAREFULLY examine and LIST each distinct item you can identify in "itemizedList"
4. For each item, try to identify: title, author/brand, condition, and estimated individual value

ITEMIZED DETECTION - READ ALL VISIBLE TEXT:
- Look at EVERY visible book spine, cover, label, tag
- Read partial titles and try to identify the full title
- Note authors when visible
- Identify brands on toys, electronics, etc.
- For books: distinguish between children's books, textbooks, novels, art books, etc.

CRITICAL: ITEM TYPE DISCRIMINATION
Carefully distinguish between similar-looking items:

**PUZZLES vs BOOKS:**
- PUZZLE indicators: "Puzzle", "X pieces", "piece puzzle", "jigsaw", puzzle piece imagery, Galison, Buffalo Games, Ravensburger, Springbok, Ceaco brand names, box shows assembled image
- ART BOOK indicators: "Art of...", artist monograph, exhibition catalog, museum publication, ISBN visible, spine binding, page edges visible
- Example: "Yayoi Kusama 1000 Piece Puzzle" = PUZZLE (type: "Jigsaw Puzzle"), NOT an art book
- Example: "The World of Yayoi Kusama" (has spine, pages) = BOOK (type: "Art Book")

**GAMES vs BOOKS:**
- BOARD GAME indicators: "Game", player count (2-4 players), age range, game pieces visible, dice, cards as components
- CARD GAME indicators: "Card Game", deck of cards, playing cards, trading cards
- VIDEO GAME indicators: PlayStation, Xbox, Nintendo, game disc, cartridge
- BOOK indicators: ISBN, pages, chapters, author name, publisher

**TOYS vs COLLECTIBLES:**
- TOY indicators: "Ages X+", play features, action figure, for children
- COLLECTIBLE indicators: "Limited Edition", numbered, display piece, adult collector, Funko Pop, statue

For itemizedList, always set the "type" field to the SPECIFIC item type:
- "Jigsaw Puzzle" (not "Art Book" or "Book")
- "Board Game" (not "Book")
- "Card Game"
- "Video Game"
- "Art Book"
- "Children's Book"
- "Hardcover Novel"
- "Paperback Novel"
- "Textbook"
- "Action Figure"
- "Collectible Figure"
- "Stuffed Animal"
- "Building Set" (LEGO, etc.)

Assortment Examples:
- Box of books → Read EVERY spine/cover: "The World of Yayoi Kusama", "Graphic Design: The New Basics", etc.
- Box with books AND puzzles → Distinguish each: "Yayoi Kusama 500pc Puzzle" (type: "Jigsaw Puzzle"), "Design Basics" (type: "Textbook")
- Bag of toys → List each: "Hot Wheels car (red)", "Barbie doll", "LEGO set #12345"
- Bin of electronics → List each: "iPhone 6 (cracked screen)", "iPad Mini 2", "Various cables"

**SIZE/SCALE DETECTION** - Critical for accurate pricing:
Determine if the item is FULL-SIZE or MINIATURE/TOY/MODEL:
- Set "sizeCategory": "full-size" for real, usable items at normal scale
- Set "sizeCategory": "miniature" for toy/model/collectible versions
- Set "sizeCategory": "oversized" for items larger than typical
- Include estimated dimensions in "estimatedDimensions"

Size Detection Clues:
- Compare to visible reference objects (hands, furniture, flooring tiles)
- Look for "toy", "model", "replica", "1:18 scale", "miniature" text
- Check context: is it on a display shelf? In a child's hand? On a real road?
- Full-size furniture: chairs ~18" seat height, tables ~30" height, sofas ~84" wide
- Full-size electronics: laptops ~13-17" diagonal, TVs measured diagonally

Size Examples:
- Die-cast model car on shelf → "sizeCategory": "miniature", "estimatedDimensions": "6 inches long"
- Real car in driveway → "sizeCategory": "full-size", "estimatedDimensions": "sedan, approximately 15 feet"
- Dollhouse furniture → "sizeCategory": "miniature"
- IKEA bookshelf → "sizeCategory": "full-size", "estimatedDimensions": "approximately 6 feet tall"

JSON STRUCTURE - Return this exact format:

{
  "category": "specific item type (e.g., 'dining chair', 'laptop computer', 'mid-size sedan', 'alternator', 'Book Assortment')",
  "brand": "EXACT brand name (e.g., 'IKEA', 'Dell', 'Nissan', 'Bosch') or 'Various' for assortments or 'Unknown'",
  "model": "specific model if identifiable (e.g., 'Malm', 'Inspiron 15', 'Altima') or 'Unknown'",
  "year": "model year if determinable, or 'Unknown'",
  "bodyStyle": "for vehicles: 'sedan', 'coupe', 'SUV', 'pickup', 'hatchback', etc.",
  "materials": ["primary material", "secondary material"],
  "itemCount": 1,
  "isSet": false,
  "isAssortment": false,
  "sizeCategory": "full-size|miniature|oversized",
  "estimatedDimensions": "approximate size (e.g., '18 inches tall', '15-inch laptop', '6 feet long')",
  "condition": {
    "rating": "excellent|good|fair|poor",
    "description": "detailed condition with specific observations about wear, damage, functionality",
    "usableAsIs": true,
    "issues": ["specific issue 1", "specific issue 2"],
    "mileage": "if visible on odometer or estimated from wear"
  },
  "identifiers": {
    "visible_text": "ALL visible text, badges, labels, model numbers, serial numbers",
    "vin": "if any VIN visible (vehicles only)",
    "color": "primary color and secondary colors",
    "distinctive_features": ["unique design elements", "modifications", "accessories included"]
  },
  "resale": {
    "recommendation": "resell|local_pickup|donate|salvage",
    "priceRange": "realistic range (e.g., '150-250' for single chair, '300-500' for pair of chairs)",
    "justification": "value assessment noting if price is per item or for the set"
  },
  "vehicleSpecific": {
    "estimatedMileage": "if determinable",
    "fuelType": "gasoline|diesel|electric|hybrid if determinable",
    "transmission": "manual|automatic if visible",
    "drivetrain": "FWD|RWD|AWD if determinable",
    "specialFeatures": ["sunroof", "leather seats", "navigation", "other features"]
  },
  "itemizedList": [
    {
      "title": "exact title/name of item (e.g., 'Yayoi Kusama Infinity 1000 Piece Puzzle' or 'The Art of Animation')",
      "author": "author name for books, brand for puzzles/games/toys (e.g., 'Galison', 'Ravensburger', 'LEGO')",
      "type": "SPECIFIC item type - MUST be one of: 'Jigsaw Puzzle', 'Board Game', 'Card Game', 'Video Game', 'Art Book', 'Children's Book', 'Hardcover Novel', 'Paperback Novel', 'Textbook', 'Cookbook', 'Reference Book', 'Action Figure', 'Collectible Figure', 'Stuffed Animal', 'Building Set', 'Doll', 'RC Toy', 'Educational Toy'",
      "condition": "excellent|good|fair|poor",
      "conditionNotes": "specific condition details for this item",
      "estimatedValue": "$X-Y range or specific value",
      "searchable": true
    }
  ],
  "confidence": 8
}

**IMPORTANT for itemizedList:**
- Include EVERY distinct item you can identify
- For books: read spines carefully, note if upside down text
- For partially visible items: include what you can see with "(partial)" note
- Set "searchable": true if the item has enough info for an eBay lookup
- Set "searchable": false for generic items like "miscellaneous paperback"
- Leave itemizedList as empty array [] if NOT an assortment

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
  // Helper function to detect from magic bytes
  const detectFromBytes = (bytes) => {
    if (!bytes || bytes.length < 4) return null;
    // PNG magic bytes: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'image/png';
    }
    // JPEG magic bytes: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'image/jpeg';
    }
    // GIF magic bytes: 47 49 46
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return 'image/gif';
    }
    // WebP magic bytes: 52 49 46 46 ... 57 45 42 50
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return 'image/webp';
    }
    return null;
  };

  // Handle Buffer input - check magic bytes directly
  if (Buffer.isBuffer(img)) {
    const detected = detectFromBytes(img);
    if (detected) {
      console.log(`🔍 Detected image type from Buffer magic bytes: ${detected}`);
      return detected;
    }
    console.warn('Could not detect image type from Buffer bytes, defaulting to jpeg');
    return 'image/jpeg';
  }

  if (typeof img === 'string') {
    // Check data URL prefix first
    if (img.startsWith('data:image/png')) return 'image/png';
    if (img.startsWith('data:image/gif')) return 'image/gif';
    if (img.startsWith('data:image/webp')) return 'image/webp';
    if (img.startsWith('data:image/jpeg') || img.startsWith('data:image/jpg')) return 'image/jpeg';

    // If it's a data URL, extract the media type from it
    const dataUrlMatch = img.match(/^data:([^;,]+)/);
    if (dataUrlMatch) {
      return dataUrlMatch[1];
    }

    // If it's raw base64, try to detect from magic bytes
    let base64Data = img;
    if (img.includes(',')) {
      base64Data = img.split(',')[1];
    }

    // Decode first few bytes to check magic numbers
    try {
      const decoded = Buffer.from(base64Data.substring(0, 16), 'base64');
      const detected = detectFromBytes(decoded);
      if (detected) return detected;
    } catch (e) {
      console.warn('Could not detect image type from base64 bytes, defaulting to jpeg');
    }

    return 'image/jpeg';
  }

  console.warn('Unknown image input type, defaulting to jpeg');
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

    // Quantity and size fields - CRITICAL for accurate pricing
    itemCount: extractField(parsed, ['itemCount', 'item_count', 'quantity'], 1),
    isSet: extractField(parsed, ['isSet', 'is_set'], false),
    isAssortment: extractField(parsed, ['isAssortment', 'is_assortment'], false),
    sizeCategory: extractField(parsed, ['sizeCategory', 'size_category'], 'full-size'),
    estimatedDimensions: extractField(parsed, ['estimatedDimensions', 'estimated_dimensions', 'dimensions'], ''),

    // Itemized list for assortments (boxes of books, mixed lots, etc.)
    itemizedList: normalizeItemizedList(parsed),

    // Enhanced fields
    materials: extractField(parsed, ['materials', 'material'], []),
    identifiers: normalizeIdentifiers(parsed),
    vehicleSpecific: extractField(parsed, ['vehicleSpecific', 'vehicle_specific'], {}),

    // Original fields for compatibility
    keyFeatures: extractField(parsed, ['keyFeatures', 'distinctive_features'], []),
    specifications: normalizeSpecifications(parsed)
  };
}

/**
 * Normalize itemized list for assortments
 */
function normalizeItemizedList(parsed) {
  const itemizedList = extractField(parsed, ['itemizedList', 'itemized_list', 'items'], []);

  if (!Array.isArray(itemizedList)) {
    return [];
  }

  return itemizedList.map((item, index) => {
    if (typeof item === 'string') {
      // Simple string item - convert to object
      return {
        title: item,
        author: 'Unknown',
        type: 'Unknown',
        condition: 'good',
        conditionNotes: '',
        estimatedValue: 'Unknown',
        searchable: false,
        index: index
      };
    }

    return {
      title: extractField(item, ['title', 'name', 'item'], 'Unknown Item'),
      author: extractField(item, ['author', 'brand', 'manufacturer'], ''),
      type: extractField(item, ['type', 'category', 'itemType'], ''),
      condition: normalizeConditionRating(extractField(item, ['condition', 'rating'], 'good')),
      conditionNotes: extractField(item, ['conditionNotes', 'condition_notes', 'notes'], ''),
      estimatedValue: extractField(item, ['estimatedValue', 'estimated_value', 'value', 'price'], ''),
      searchable: extractField(item, ['searchable', 'canSearch'], true),
      index: index
    };
  }).filter(item => item.title && item.title !== 'Unknown Item');
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

  // Ensure itemCount is a valid positive integer
  let itemCount = parseInt(normalized.itemCount, 10);
  if (isNaN(itemCount) || itemCount < 1) itemCount = 1;

  // Sanitize itemized list
  const sanitizedItemizedList = Array.isArray(normalized.itemizedList)
    ? normalized.itemizedList.map(item => ({
        title: trimString(item.title) || 'Unknown',
        author: trimString(item.author) || '',
        type: trimString(item.type) || '',
        condition: item.condition || 'good',
        conditionNotes: trimString(item.conditionNotes) || '',
        estimatedValue: trimString(item.estimatedValue) || '',
        searchable: item.searchable === true,
        index: item.index || 0
      }))
    : [];

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

    // Quantity and size fields - CRITICAL for accurate pricing
    itemCount: itemCount,
    isSet: normalized.isSet === true,
    isAssortment: normalized.isAssortment === true,
    sizeCategory: ['full-size', 'miniature', 'oversized'].includes(normalized.sizeCategory)
      ? normalized.sizeCategory
      : 'full-size',
    estimatedDimensions: trimString(normalized.estimatedDimensions) || '',

    // Itemized list for assortments
    itemizedList: sanitizedItemizedList,

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