// capture-sdk/core/analyzeItem.js - Enhanced Universal Brand & Style Detection System
const { normalizeResponse } = require('../functions/capture-sdk/utils/normalize.js');
const admin = require('firebase-admin');

// Import Firebase (optional)
let db = null;
try {
  const { db: firebaseDb } = require('../functions/capture-sdk/config/firebase-config.js');
  db = firebaseDb;
} catch (error) {
  console.log('Firebase not configured, running in offline mode');
}

// Universal Brand Database - organized by brand with category coverage
const UNIVERSAL_BRANDS = {
  // Technology & Electronics
  'apple': {
    variations: ['apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods', 'apple watch'],
    categories: ['electronics', 'technology', 'computers', 'phones', 'tablets'],
    identifiers: ['model A####', 'designed by apple', 'lightning', 'magsafe']
  },
  'samsung': {
    variations: ['samsung', 'galaxy', 'sm-', 'samsung electronics'],
    categories: ['electronics', 'appliances', 'phones', 'tablets', 'tv'],
    identifiers: ['SM-', 'galaxy', 'samsung knox']
  },
  'sony': {
    variations: ['sony', 'playstation', 'ps5', 'ps4', 'wh-', 'wf-', 'bravia'],
    categories: ['electronics', 'gaming', 'headphones', 'tv', 'cameras'],
    identifiers: ['WH-', 'WF-', 'FE', 'alpha']
  },
  'microsoft': {
    variations: ['microsoft', 'surface', 'xbox', 'windows'],
    categories: ['electronics', 'computers', 'gaming', 'software'],
    identifiers: ['surface', 'xbox', 'windows']
  },
  'lg': {
    variations: ['lg', 'life\'s good', 'oled', 'nanocell'],
    categories: ['electronics', 'appliances', 'tv', 'phones'],
    identifiers: ['oled', 'nanocell', 'thinq']
  },
  'nintendo': {
    variations: ['nintendo', 'switch', 'mario', 'zelda'],
    categories: ['gaming', 'electronics', 'toys'],
    identifiers: ['nintendo switch', 'pro controller']
  },
  
  // Footwear & Apparel
  'nike': {
    variations: ['nike', 'jordan', 'air jordan', 'swoosh', 'just do it'],
    categories: ['footwear', 'clothing', 'sports', 'athletic wear'],
    identifiers: ['swoosh logo', 'air', 'dri-fit', 'react']
  },
  'adidas': {
    variations: ['adidas', 'three stripes', 'trefoil', 'originals'],
    categories: ['footwear', 'clothing', 'sports', 'athletic wear'],
    identifiers: ['three stripes', 'trefoil', 'boost', 'climacool']
  },
  'dr. martens': {
    variations: ['dr. martens', 'dr martens', 'doc martens', 'docs', 'airwair', 'martens'],
    categories: ['footwear', 'boots'],
    identifiers: ['airwair', 'bouncing soles', 'made in england', 'yellow stitching']
  },
  'converse': {
    variations: ['converse', 'all star', 'chuck taylor', 'one star'],
    categories: ['footwear', 'casual shoes'],
    identifiers: ['all star', 'chuck taylor', 'star logo']
  },
  'vans': {
    variations: ['vans', 'off the wall', 'checkerboard'],
    categories: ['footwear', 'skateboarding'],
    identifiers: ['off the wall', 'waffle sole', 'side stripe']
  },
  'timberland': {
    variations: ['timberland', 'timbs', 'tree logo'],
    categories: ['footwear', 'boots', 'outdoor'],
    identifiers: ['tree logo', 'wheat nubuck', '6-inch boot']
  },
  'new balance': {
    variations: ['new balance', 'nb', 'n logo'],
    categories: ['footwear', 'athletic wear', 'running'],
    identifiers: ['N logo', 'made in usa', 'fresh foam']
  },
  
  // Fashion & Luxury
  'levi\'s': {
    variations: ['levi', 'levi\'s', 'levis', '501', '511', '505', 'strauss'],
    categories: ['clothing', 'denim', 'jeans'],
    identifiers: ['red tab', '501', '511', 'original riveted']
  },
  'ralph lauren': {
    variations: ['ralph lauren', 'polo', 'polo ralph lauren', 'rl'],
    categories: ['clothing', 'fashion', 'luxury'],
    identifiers: ['polo player', 'ralph lauren', 'purple label']
  },
  'gucci': {
    variations: ['gucci', 'gg', 'double g'],
    categories: ['clothing', 'fashion', 'luxury', 'accessories'],
    identifiers: ['GG', 'made in italy', 'gucci logo']
  },
  'louis vuitton': {
    variations: ['louis vuitton', 'lv', 'vuitton', 'monogram'],
    categories: ['fashion', 'luxury', 'bags', 'accessories'],
    identifiers: ['LV', 'monogram', 'made in france']
  },
  
  // Furniture & Home
  'ikea': {
    variations: ['ikea', 'svenska', 'assembly required', 'poäng', 'billy', 'malm', 'lack', 'kallax'],
    categories: ['furniture', 'home', 'storage'],
    identifiers: ['svenska', 'assembly', 'billy', 'lack', 'scandinavian names', 'allen key', 'flat pack']
  },
  'west elm': {
    variations: ['west elm', 'westelm'],
    categories: ['furniture', 'home decor', 'modern'],
    identifiers: ['west elm', 'modern design']
  },
  'pottery barn': {
    variations: ['pottery barn', 'potterybarn', 'pb'],
    categories: ['furniture', 'home decor'],
    identifiers: ['pottery barn', 'pb']
  },
  'herman miller': {
    variations: ['herman miller', 'eames', 'aeron', 'embody', 'sayl'],
    categories: ['furniture', 'office', 'chairs'],
    identifiers: ['herman miller', 'eames', 'aeron', 'embody', 'ergonomic']
  },
  'steelcase': {
    variations: ['steelcase', 'leap', 'gesture', 'think'],
    categories: ['furniture', 'office', 'chairs'],
    identifiers: ['steelcase', 'leap', 'gesture', 'think', 'office chair']
  },
  
  // Appliances & Kitchen
  'kitchenaid': {
    variations: ['kitchenaid', 'kitchen aid', 'artisan'],
    categories: ['appliances', 'kitchen', 'mixers'],
    identifiers: ['kitchenaid', 'artisan', 'stand mixer']
  },
  'dyson': {
    variations: ['dyson', 'v7', 'v8', 'v10', 'v11', 'v12', 'v15', 'supersonic', 'airwrap'],
    categories: ['appliances', 'vacuum', 'hair care'],
    identifiers: ['cyclone', 'digital motor', 'ball technology']
  },
  'whirlpool': {
    variations: ['whirlpool', 'maytag', 'kenmore'],
    categories: ['appliances', 'laundry', 'kitchen'],
    identifiers: ['whirlpool', 'energy star']
  },
  
  // Automotive
  'toyota': {
    variations: ['toyota', 'lexus', 'prius', 'camry', 'corolla'],
    categories: ['automotive', 'vehicles', 'parts'],
    identifiers: ['toyota', 'hybrid synergy drive']
  },
  'honda': {
    variations: ['honda', 'acura', 'civic', 'accord', 'cr-v'],
    categories: ['automotive', 'vehicles', 'parts'],
    identifiers: ['honda', 'vtec', 'sensing']
  },
  'ford': {
    variations: ['ford', 'mustang', 'f-150', 'escape', 'explorer'],
    categories: ['automotive', 'vehicles', 'parts'],
    identifiers: ['ford', 'built ford tough']
  },
  
  // Baby & Kids
  'doona': {
    variations: ['doona', 'simple parenting'],
    categories: ['baby gear', 'car seats', 'strollers'],
    identifiers: ['transforms', 'car seat to stroller', 'simple parenting']
  },
  'chicco': {
    variations: ['chicco', 'keyfit'],
    categories: ['baby gear', 'car seats', 'strollers'],
    identifiers: ['chicco', 'keyfit', 'baby gear']
  },
  'graco': {
    variations: ['graco', 'snugride', 'modes'],
    categories: ['baby gear', 'car seats', 'strollers'],
    identifiers: ['graco', 'snugride', 'click connect']
  },
  
  // Tools & Hardware
  'dewalt': {
    variations: ['dewalt', 'de walt', 'guaranteed tough'],
    categories: ['tools', 'power tools', 'construction'],
    identifiers: ['dewalt', 'guaranteed tough', '20v max']
  },
  'milwaukee': {
    variations: ['milwaukee', 'fuel', 'red lithium'],
    categories: ['tools', 'power tools', 'construction'],
    identifiers: ['milwaukee', 'fuel', 'red lithium', 'm18']
  },
  'craftsman': {
    variations: ['craftsman', 'sears', 'diehard'],
    categories: ['tools', 'hardware'],
    identifiers: ['craftsman', 'lifetime warranty']
  },
  
  // Sports & Outdoor
  'patagonia': {
    variations: ['patagonia', 'better sweater', 'synchilla'],
    categories: ['clothing', 'outdoor', 'jackets'],
    identifiers: ['patagonia', '1% for the planet', 'better sweater']
  },
  'north face': {
    variations: ['the north face', 'tnf', 'north face', 'never stop exploring'],
    categories: ['clothing', 'outdoor', 'jackets'],
    identifiers: ['never stop exploring', 'tnf', 'mountain logo']
  },
  'coleman': {
    variations: ['coleman', 'lantern', 'camping'],
    categories: ['outdoor', 'camping', 'sports'],
    identifiers: ['coleman', 'lantern logo', 'outdoor']
  }
};

// Enhanced Material Classification System
const MATERIAL_CLASSIFICATION = {
  // Wood Types
  wood: {
    patterns: ['wood', 'wooden', 'timber', 'lumber', 'grain', 'stain', 'varnish', 'lacquer'],
    subtypes: {
      'oak': ['oak', 'white oak', 'red oak'],
      'pine': ['pine', 'pinewood'],
      'birch': ['birch', 'birchwood', 'light wood'],
      'teak': ['teak', 'teakwood'],
      'walnut': ['walnut', 'dark wood'],
      'bamboo': ['bamboo'],
      'plywood': ['plywood', 'ply', 'laminated', 'veneer'],
      'mdf': ['mdf', 'particle board', 'chipboard'],
      'bentwood': ['bentwood', 'bent wood', 'laminated wood', 'curved wood']
    }
  },
  
  // Metals
  metal: {
    patterns: ['metal', 'metallic', 'steel', 'aluminum', 'iron', 'brass', 'chrome'],
    subtypes: {
      'steel': ['steel', 'stainless steel'],
      'aluminum': ['aluminum', 'aluminium', 'alloy'],
      'iron': ['iron', 'cast iron', 'wrought iron'],
      'brass': ['brass', 'bronze'],
      'chrome': ['chrome', 'chromium', 'polished metal']
    }
  },
  
  // Fabrics & Textiles
  fabric: {
    patterns: ['fabric', 'textile', 'cloth', 'upholstery', 'cushion', 'padding'],
    subtypes: {
      'cotton': ['cotton', '100% cotton'],
      'polyester': ['polyester', 'poly'],
      'leather': ['leather', 'genuine leather', 'faux leather', 'pleather'],
      'linen': ['linen', 'flax'],
      'wool': ['wool', 'woolen'],
      'velvet': ['velvet', 'velour'],
      'canvas': ['canvas', 'duck canvas'],
      'microfiber': ['microfiber', 'micro fiber']
    }
  },
  
  // Plastics & Synthetics
  plastic: {
    patterns: ['plastic', 'polymer', 'synthetic', 'acrylic', 'vinyl'],
    subtypes: {
      'abs': ['abs', 'abs plastic'],
      'polypropylene': ['polypropylene', 'pp'],
      'vinyl': ['vinyl', 'pvc'],
      'acrylic': ['acrylic', 'plexiglass'],
      'fiberglass': ['fiberglass', 'glass fiber']
    }
  }
};

// Comprehensive Style Classification System
const STYLE_CLASSIFICATION = {
  // Furniture Styles
  furniture: {
    'scandinavian': {
      patterns: ['scandinavian', 'nordic', 'swedish', 'danish', 'norwegian', 'ikea', 'minimalist', 'clean lines'],
      materials: ['birch', 'pine', 'light wood', 'natural wood', 'white', 'light fabric'],
      construction: ['bentwood', 'laminated', 'simple joints', 'cantilever', 'flat pack'],
      brands: ['ikea', 'muji'],
      indicators: ['poäng', 'billy', 'lack', 'kallax', 'simple', 'functional']
    },
    
    'mid-century modern': {
      patterns: ['mid-century', 'mid century', 'atomic', 'space age', '1950s', '1960s', 'mcm'],
      materials: ['teak', 'walnut', 'rosewood', 'vinyl', 'leather', 'fiberglass'],
      construction: ['hairpin legs', 'splayed legs', 'tapered legs', 'molded plywood', 'eames'],
      brands: ['herman miller', 'knoll', 'eames'],
      indicators: ['atomic', 'boomerang', 'kidney shaped', 'starburst']
    },
    
    'industrial': {
      patterns: ['industrial', 'factory', 'warehouse', 'loft', 'urban', 'rustic'],
      materials: ['steel', 'iron', 'reclaimed wood', 'concrete', 'exposed metal'],
      construction: ['welded', 'riveted', 'pipe frame', 'raw steel', 'unfinished'],
      brands: ['restoration hardware'],
      indicators: ['exposed', 'raw', 'weathered', 'distressed', 'pipe']
    },
    
    'traditional': {
      patterns: ['traditional', 'classic', 'colonial', 'victorian', 'antique'],
      materials: ['mahogany', 'cherry', 'oak', 'leather', 'velvet', 'brocade'],
      construction: ['dovetail', 'mortise and tenon', 'carved', 'ornate'],
      brands: ['ethan allen', 'thomasville'],
      indicators: ['carved', 'ornate', 'detailed', 'formal', 'classic']
    },
    
    'contemporary': {
      patterns: ['contemporary', 'modern', 'current', 'sleek', 'minimalist'],
      materials: ['glass', 'chrome', 'steel', 'high gloss', 'acrylic'],
      construction: ['geometric', 'angular', 'smooth', 'seamless'],
      brands: ['west elm', 'cb2', 'pottery barn'],
      indicators: ['sleek', 'smooth', 'geometric', 'minimal']
    },
    
    'rustic': {
      patterns: ['rustic', 'farmhouse', 'country', 'cabin', 'lodge', 'barn'],
      materials: ['reclaimed wood', 'pine', 'oak', 'natural', 'distressed'],
      construction: ['rough hewn', 'hand crafted', 'distressed', 'weathered'],
      brands: ['pottery barn', 'restoration hardware'],
      indicators: ['distressed', 'weathered', 'barn', 'farmhouse', 'rustic']
    }
  },
  
  // Clothing Styles
  clothing: {
    'vintage': {
      patterns: ['vintage', 'retro', 'classic', 'throwback', 'old school'],
      indicators: ['70s', '80s', '90s', 'retro', 'vintage inspired']
    },
    'streetwear': {
      patterns: ['streetwear', 'urban', 'hip hop', 'skate', 'graphic'],
      indicators: ['graphic tee', 'hoodie', 'sneaker', 'logo']
    },
    'formal': {
      patterns: ['formal', 'dress', 'business', 'professional', 'suit'],
      indicators: ['suit', 'dress shirt', 'tie', 'formal']
    }
  },
  
  // Electronics Styles
  electronics: {
    'minimalist': {
      patterns: ['minimalist', 'clean', 'simple', 'sleek', 'modern'],
      indicators: ['apple', 'white', 'clean lines', 'simple']
    },
    'gaming': {
      patterns: ['gaming', 'rgb', 'led', 'gamer', 'esports'],
      indicators: ['rgb', 'led', 'mechanical', 'gaming']
    }
  }
};

// Construction Method Classification
const CONSTRUCTION_CLASSIFICATION = {
  furniture: {
    'bentwood': {
      patterns: ['bentwood', 'bent wood', 'laminated', 'curved', 'steam bent'],
      indicators: ['continuous curve', 'no joints in curve', 'laminated layers'],
      typical_items: ['chairs', 'rocking chairs', 'coat racks']
    },
    'cantilever': {
      patterns: ['cantilever', 'cantilevered', 'c-shaped', 'suspended'],
      indicators: ['no back legs', 'c-frame', 'floating seat'],
      typical_items: ['chairs', 'stools', 'benches']
    },
    'molded plywood': {
      patterns: ['molded plywood', 'molded', 'formed plywood', 'compound curves'],
      indicators: ['seamless curves', 'single piece', 'eames style'],
      typical_items: ['chairs', 'tables', 'shelving']
    },
    'upholstered': {
      patterns: ['upholstered', 'padded', 'cushioned', 'tufted'],
      indicators: ['fabric covering', 'padding', 'buttons', 'tufting'],
      typical_items: ['chairs', 'sofas', 'ottomans']
    }
  }
};

// Universal text pattern recognition
const UNIVERSAL_PATTERNS = {
  modelNumbers: [
    /\b[A-Z]{1,3}\d{3,6}[A-Z]?\b/g,        // ABC123, AB1234A
    /\b\d{3,4}[A-Z]{1,3}\b/g,              // 123ABC, 1234AB
    /\bSM-[A-Z0-9]+\b/g,                   // Samsung models
    /\bA\d{4}\b/g,                         // Apple models
    /\bWH-\d{4}[A-Z]*\b/g,                 // Sony headphones
    /\bMK\d{3,4}\b/g,                      // Common model pattern
    /\b[A-Z]{2,4}-\d{2,4}[A-Z]?\b/g       // XX-123A format
  ],
  serialNumbers: [
    /\bS\/N:?\s?([A-Z0-9]{6,})\b/gi,
    /\bSerial:?\s?([A-Z0-9]{6,})\b/gi,
    /\b[A-Z0-9]{10,}\b/g
  ],
  brandIndicators: [
    /\b[A-Z]{2,}(?:\s+[A-Z]{2,})*\b/g,     // All caps (likely brands)
    /®|™|©/g,                              // Trademark symbols
    /\bTM\b|\bREG\b/g                      // TM, REG indicators
  ],
  sizes: [
    /\b(?:Size|Sz):?\s?([A-Z0-9\/\-]+)\b/gi,
    /\b(XXS|XS|S|M|L|XL|XXL|XXXL|\d{0,2}[XSML])\b/g,
    /\b(\d{1,2}(?:\.\d)?)\s?(?:US|UK|EU)?\b/g
  ]
};

async function analyzeItem(images, options = {}) {
  const {
    provider = 'gpt-4o',
    apiKey,
    prompt = getEnhancedUniversalPrompt(),
    maxRetries = 2,
    uid = null,
    saveToFirestore = true
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
      console.log(`🔍 Analysis attempt ${attempt + 1}/${maxRetries + 1}`);
      
      // Single optimized API call with enhanced material/style detection
      const result = await callVisionAPI(provider, images, apiKey, prompt);
      const normalizedResult = normalizeResponse(result, provider);
      
      // Enhanced universal detection with material/style classification
      const enhancedResult = enhanceWithAdvancedDetection(normalizedResult);
      
      // Save to Firestore if configured
      let scanDocument = null;
      if (db && uid && saveToFirestore) {
        scanDocument = await saveToScannedItems(enhancedResult, uid, provider, images.length);
        console.log('✅ Scan saved to Firestore:', scanDocument.scanId);
        
        await updateUserStats(uid, {
          totalScans: admin.firestore.FieldValue.increment(1),
          lastScanDate: admin.firestore.FieldValue.serverTimestamp(),
          lastConfidenceScore: enhancedResult.confidence_rating || enhancedResult.confidence || 0
        });
      }
      
      return {
        ...enhancedResult,
        scanId: scanDocument?.scanId || `local_${Date.now()}`,
        firestoreId: scanDocument?.firestoreId || null,
        savedToFirestore: !!scanDocument
      };
      
    } catch (error) {
      lastError = error;
      attempt++;
      if (attempt <= maxRetries) {
        console.log(`⚠️ Retry attempt ${attempt} after error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Enhanced detection with advanced material, style, and construction analysis
 */
function enhanceWithAdvancedDetection(result) {
  console.log('🎯 Starting advanced detection enhancement...');
  
  // Collect all available text evidence
  const textEvidence = collectTextEvidence(result);
  console.log('📝 Text evidence collected:', textEvidence.summary);
  
  // Extract patterns and identifiers
  const patterns = extractUniversalPatterns(textEvidence.fullText);
  console.log('🔍 Patterns extracted:', Object.keys(patterns));
  
  // Enhanced material detection
  const materialAnalysis = analyzeMaterials(textEvidence, result);
  console.log('🧱 Material analysis:', materialAnalysis);
  
  // Enhanced style classification
  const styleAnalysis = classifyStyle(textEvidence, result, materialAnalysis);
  console.log('🎨 Style analysis:', styleAnalysis);
  
  // Construction method detection
  const constructionAnalysis = analyzeConstruction(textEvidence, result, materialAnalysis);
  console.log('🔧 Construction analysis:', constructionAnalysis);
  
  // Perform brand detection
  const brandAnalysis = performUniversalBrandDetection(textEvidence, patterns, result.category);
  console.log('🏷️ Brand analysis result:', brandAnalysis);
  
  // Apply all enhancements
  const enhanced = applyAdvancedEnhancements(result, {
    brandAnalysis,
    materialAnalysis,
    styleAnalysis,
    constructionAnalysis,
    patterns
  });
  
  // Generate enhanced eBay search queries
  enhanced.ebaySearchQueries = generateEnhancedSearchQueries(enhanced);
  
  console.log('✨ Advanced enhancement complete:', {
    originalBrand: result.brand,
    enhancedBrand: enhanced.brand,
    materials: enhanced.materials,
    style: enhanced.style,
    searchQueries: enhanced.ebaySearchQueries?.slice(0, 3) // Show first 3
  });
  
  return enhanced;
}

/**
 * Advanced material analysis
 */
function analyzeMaterials(textEvidence, result) {
  const analysis = {
    detected: [],
    primary: null,
    secondary: null,
    confidence: 0
  };
  
  const searchText = textEvidence.fullText.toLowerCase();
  
  // Check each material category
  for (const [category, data] of Object.entries(MATERIAL_CLASSIFICATION)) {
    // Check main patterns
    for (const pattern of data.patterns) {
      if (searchText.includes(pattern)) {
        analysis.detected.push({
          category: category,
          type: pattern,
          confidence: 6
        });
      }
    }
    
    // Check specific subtypes
    for (const [subtype, variations] of Object.entries(data.subtypes)) {
      for (const variation of variations) {
        if (searchText.includes(variation)) {
          analysis.detected.push({
            category: category,
            type: subtype,
            specific: variation,
            confidence: 8
          });
        }
      }
    }
  }
  
  // Sort by confidence and remove duplicates
  analysis.detected.sort((a, b) => b.confidence - a.confidence);
  analysis.detected = analysis.detected.filter((item, index, self) => 
    index === self.findIndex(t => t.type === item.type)
  );
  
  // Set primary and secondary materials
  if (analysis.detected.length > 0) {
    analysis.primary = analysis.detected[0].type;
    analysis.confidence = analysis.detected[0].confidence;
  }
  
  if (analysis.detected.length > 1) {
    analysis.secondary = analysis.detected[1].type;
  }
  
  return analysis;
}

/**
 * Advanced style classification
 */
function classifyStyle(textEvidence, result, materialAnalysis) {
  const analysis = {
    detected: null,
    confidence: 0,
    indicators: [],
    category: null
  };
  
  const searchText = textEvidence.fullText.toLowerCase();
  const category = result.category?.toLowerCase() || '';
  
  // Determine style category based on item category
  let styleCategory = 'furniture'; // Default
  if (category.includes('chair') || category.includes('table') || category.includes('furniture')) {
    styleCategory = 'furniture';
  } else if (category.includes('clothing') || category.includes('shirt') || category.includes('jacket')) {
    styleCategory = 'clothing';
  } else if (category.includes('electronic') || category.includes('phone') || category.includes('computer')) {
    styleCategory = 'electronics';
  }
  
  analysis.category = styleCategory;
  
  // Get style classifications for this category
  const styleData = STYLE_CLASSIFICATION[styleCategory] || {};
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [styleName, styleInfo] of Object.entries(styleData)) {
    let score = 0;
    const indicators = [];
    
    // Check patterns
    if (styleInfo.patterns) {
      for (const pattern of styleInfo.patterns) {
        if (searchText.includes(pattern)) {
          score += 3;
          indicators.push(`pattern: ${pattern}`);
        }
      }
    }
    
    // Check materials
    if (styleInfo.materials && materialAnalysis.primary) {
      for (const material of styleInfo.materials) {
        if (materialAnalysis.primary.includes(material)) {
          score += 2;
          indicators.push(`material: ${material}`);
        }
      }
    }
    
    // Check construction
    if (styleInfo.construction) {
      for (const construction of styleInfo.construction) {
        if (searchText.includes(construction)) {
          score += 2;
          indicators.push(`construction: ${construction}`);
        }
      }
    }
    
    // Check brands
    if (styleInfo.brands) {
      for (const brand of styleInfo.brands) {
        if (searchText.includes(brand)) {
          score += 2;
          indicators.push(`brand: ${brand}`);
        }
      }
    }
    
    // Check specific indicators
    if (styleInfo.indicators) {
      for (const indicator of styleInfo.indicators) {
        if (searchText.includes(indicator)) {
          score += 1;
          indicators.push(`indicator: ${indicator}`);
        }
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        style: styleName,
        score: score,
        indicators: indicators
      };
    }
  }
  
  if (bestMatch && bestMatch.score >= 3) {
    analysis.detected = bestMatch.style;
    analysis.confidence = Math.min(10, bestMatch.score);
    analysis.indicators = bestMatch.indicators;
  }
  
  return analysis;
}

/**
 * Construction method analysis
 */
function analyzeConstruction(textEvidence, result, materialAnalysis) {
  const analysis = {
    methods: [],
    primary: null,
    confidence: 0
  };
  
  const searchText = textEvidence.fullText.toLowerCase();
  const category = result.category?.toLowerCase() || '';
  
  // Focus on furniture construction for now
  if (category.includes('chair') || category.includes('table') || category.includes('furniture')) {
    const constructionData = CONSTRUCTION_CLASSIFICATION.furniture || {};
    
    for (const [method, data] of Object.entries(constructionData)) {
      let score = 0;
      const evidence = [];
      
      // Check patterns
      for (const pattern of data.patterns) {
        if (searchText.includes(pattern)) {
          score += 3;
          evidence.push(pattern);
        }
      }
      
      // Check indicators
      for (const indicator of data.indicators) {
        if (searchText.includes(indicator)) {
          score += 2;
          evidence.push(indicator);
        }
      }
      
      // Check if item type matches typical items for this construction
      for (const typicalItem of data.typical_items) {
        if (category.includes(typicalItem)) {
          score += 1;
        }
      }
      
      if (score > 0) {
        analysis.methods.push({
          method: method,
          score: score,
          evidence: evidence,
          confidence: Math.min(10, score * 2)
        });
      }
    }
    
    // Sort by score and set primary method
    analysis.methods.sort((a, b) => b.score - a.score);
    
    if (analysis.methods.length > 0) {
      analysis.primary = analysis.methods[0].method;
      analysis.confidence = analysis.methods[0].confidence;
    }
  }
  
  return analysis;
}

/**
 * Collect all text evidence from the analysis result
 */
function collectTextEvidence(result) {
  const evidence = {
    visibleText: (result.identifiers?.visible_text || '').toLowerCase(),
    logos: (result.identifiers?.logos_seen || '').toLowerCase(),
    notes: (result.notes || '').toLowerCase(),
    description: (result.condition?.description || '').toLowerCase(),
    category: (result.category || '').toLowerCase(),
    specifications: Object.values(result.specifications || {}).join(' ').toLowerCase()
  };
  
  const fullText = Object.values(evidence).join(' ').trim();
  
  return {
    ...evidence,
    fullText,
    summary: `${fullText.length} chars of evidence`
  };
}

/**
 * Extract universal patterns from text
 */
function extractUniversalPatterns(text) {
  const patterns = {
    models: [],
    serials: [],
    brands: [],
    sizes: [],
    trademarks: []
  };
  
  // Model numbers
  UNIVERSAL_PATTERNS.modelNumbers.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    patterns.models.push(...matches.map(m => m[0]));
  });
  
  // Serial numbers
  UNIVERSAL_PATTERNS.serialNumbers.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    patterns.serials.push(...matches.map(m => m[1] || m[0]));
  });
  
  // Brand indicators (all caps words, trademark symbols)
  const capsWords = [...text.matchAll(/\b[A-Z]{2,}(?:\s+[A-Z]{2,})*\b/g)];
  patterns.brands.push(...capsWords.map(m => m[0]));
  
  // Trademark indicators
  if (/®|™|©|\bTM\b|\bREG\b/i.test(text)) {
    patterns.trademarks.push('trademark_symbols_present');
  }
  
  // Clean and deduplicate
  Object.keys(patterns).forEach(key => {
    patterns[key] = [...new Set(patterns[key])].filter(Boolean);
  });
  
  return patterns;
}

/**
 * Perform universal brand detection across all categories
 */
function performUniversalBrandDetection(textEvidence, patterns, category) {
  const analysis = {
    detectedBrand: null,
    confidence: 0,
    evidence: [],
    method: null
  };
  
  const searchText = textEvidence.fullText;
  
  // Method 1: Direct brand name matching
  for (const [brandName, brandData] of Object.entries(UNIVERSAL_BRANDS)) {
    for (const variation of brandData.variations) {
      if (searchText.includes(variation.toLowerCase())) {
        const confidence = calculateBrandConfidence(variation, searchText, brandData, category);
        
        if (confidence > analysis.confidence) {
          analysis.detectedBrand = properCaseBrand(brandName);
          analysis.confidence = confidence;
          analysis.evidence.push(`Found "${variation}" in text`);
          analysis.method = 'direct_match';
        }
      }
    }
  }
  
  // Method 2: Pattern-based detection with brand association
  if (analysis.confidence < 7 && patterns.models.length > 0) {
    for (const model of patterns.models) {
      const brandFromModel = inferBrandFromModel(model);
      if (brandFromModel) {
        analysis.detectedBrand = brandFromModel.brand;
        analysis.confidence = Math.max(analysis.confidence, brandFromModel.confidence);
        analysis.evidence.push(`Model "${model}" suggests ${brandFromModel.brand}`);
        analysis.method = 'model_inference';
      }
    }
  }
  
  // Method 3: Fuzzy matching for partial/damaged text
  if (analysis.confidence < 6) {
    const fuzzyMatch = performFuzzyBrandMatching(searchText);
    if (fuzzyMatch && fuzzyMatch.confidence > analysis.confidence) {
      analysis.detectedBrand = fuzzyMatch.brand;
      analysis.confidence = fuzzyMatch.confidence;
      analysis.evidence.push(`Fuzzy match: "${fuzzyMatch.match}" → ${fuzzyMatch.brand}`);
      analysis.method = 'fuzzy_match';
    }
  }
  
  return analysis;
}

/**
 * Apply all advanced enhancements to the result
 */
function applyAdvancedEnhancements(result, analyses) {
  const enhanced = { ...result };
  const { brandAnalysis, materialAnalysis, styleAnalysis, constructionAnalysis, patterns } = analyses;
  
  // Update brand if we found a better match
  if (brandAnalysis.detectedBrand && brandAnalysis.confidence >= 6) {
    const currentConfidence = result.confidence_rating || result.confidence || 0;
    
    if (result.brand === 'Unknown' || brandAnalysis.confidence > currentConfidence) {
      enhanced.brand = brandAnalysis.detectedBrand;
      enhanced.confidence_rating = Math.min(10, Math.max(currentConfidence, brandAnalysis.confidence));
      
      // Add detection method to notes
      if (!enhanced.notes) enhanced.notes = '';
      enhanced.notes += ` Brand detected via ${brandAnalysis.method}: ${brandAnalysis.evidence.join(', ')}.`;
    }
  }
  
  // Enhance materials with deduplication
  enhanced.materials = enhanced.materials || [];
  if (materialAnalysis.primary && !enhanced.materials.includes(materialAnalysis.primary)) {
    enhanced.materials.unshift(materialAnalysis.primary);
  }
  if (materialAnalysis.secondary && !enhanced.materials.includes(materialAnalysis.secondary)) {
    enhanced.materials.push(materialAnalysis.secondary);
  }
  
  // Enhance style
  if (styleAnalysis.detected && styleAnalysis.confidence >= 5) {
    enhanced.style = styleAnalysis.detected;
    
    // Add style indicators to key features with deduplication
    enhanced.keyFeatures = enhanced.keyFeatures || [];
    styleAnalysis.indicators.forEach(indicator => {
      const indicatorValue = indicator.split(': ')[1];
      if (indicatorValue && !enhanced.keyFeatures.some(f => f.toLowerCase().includes(indicatorValue.toLowerCase()))) {
        enhanced.keyFeatures.push(indicatorValue);
      }
    });
  }
  
  // Enhance construction details with deduplication
  if (constructionAnalysis.primary) {
    enhanced.keyFeatures = enhanced.keyFeatures || [];
    const constructionFeature = `${constructionAnalysis.primary} construction`;
    if (!enhanced.keyFeatures.some(f => f.toLowerCase().includes(constructionAnalysis.primary.toLowerCase()))) {
      enhanced.keyFeatures.unshift(constructionFeature);
    }
    
    // Add to specifications
    enhanced.specifications = enhanced.specifications || {};
    enhanced.specifications.construction = constructionAnalysis.primary;
  }
  
  // Enhanced category with smart deduplication
  enhanced.category = buildEnhancedCategory(result.category, enhanced.materials, enhanced.style, constructionAnalysis.primary);
  
  // Enhance model with detected patterns
  if ((result.model === 'Unknown' || !result.model) && patterns.models.length > 0) {
    enhanced.model = patterns.models[0];
    enhanced.confidence_rating = Math.min(10, (enhanced.confidence_rating || 6) + 1);
  }
  
  // Enhance specifications with extracted patterns
  enhanced.specifications = enhanced.specifications || {};
  if (patterns.sizes.length > 0) {
    enhanced.specifications.size = patterns.sizes[0];
  }
  if (patterns.serials.length > 0) {
    enhanced.specifications.serial = patterns.serials[0];
  }
  
  // Final confidence adjustment
  if (enhanced.brand !== 'Unknown' && brandAnalysis.confidence >= 7) {
    enhanced.confidence_rating = Math.min(10, (enhanced.confidence_rating || 6) + 2);
  }
  
  return enhanced;
}

/**
 * Build enhanced category with smart deduplication
 */
function buildEnhancedCategory(originalCategory, materials, style, construction) {
  if (!originalCategory) return 'item';
  
  const originalLower = originalCategory.toLowerCase();
  const usedTerms = new Set(originalLower.split(/\s+/));
  const categoryParts = [];
  
  // Add style if not already in original category
  if (style && style !== 'Unknown') {
    const styleLower = style.toLowerCase();
    if (!usedTerms.has(styleLower) && !originalLower.includes(styleLower)) {
      categoryParts.push(style);
      usedTerms.add(styleLower);
    }
  }
  
  // Add primary material if not already in original category
  if (materials && materials.length > 0 && materials[0] !== 'Unknown') {
    const materialLower = materials[0].toLowerCase();
    if (!usedTerms.has(materialLower) && !originalLower.includes(materialLower)) {
      categoryParts.push(materials[0]);
      usedTerms.add(materialLower);
    }
  }
  
  // Add construction if not already in original category
  if (construction) {
    const constructionLower = construction.toLowerCase();
    if (!usedTerms.has(constructionLower) && !originalLower.includes(constructionLower)) {
      categoryParts.push(construction);
      usedTerms.add(constructionLower);
    }
  }
  
  // Always include the original category
  categoryParts.push(originalCategory);
  
  return categoryParts.join(' ').trim();
}

/**
 * Generate enhanced eBay search queries based on detected attributes
 */
function generateEnhancedSearchQueries(itemData) {
  const queries = [];
  
  const brand = itemData.brand && itemData.brand !== 'Unknown' ? itemData.brand : null;
  const style = itemData.style && itemData.style !== 'Unknown' ? itemData.style : null;
  const materials = itemData.materials && itemData.materials.length > 0 ? itemData.materials : [];
  const construction = itemData.specifications?.construction;
  const category = itemData.category || 'item';
  
  // Helper function to clean and deduplicate query terms
  function buildCleanQuery(...terms) {
    const cleanTerms = terms
      .filter(Boolean)
      .map(term => term.toString().toLowerCase().trim())
      .filter(term => term.length > 0);
    
    // Remove duplicates while preserving order
    const uniqueTerms = [];
    const seen = new Set();
    
    for (const term of cleanTerms) {
      const words = term.split(/\s+/);
      for (const word of words) {
        if (word.length > 2 && !seen.has(word)) {
          uniqueTerms.push(word);
          seen.add(word);
        }
      }
    }
    
    return uniqueTerms.join(' ').trim();
  }
  
  // Strategy 1: Most specific - Brand + Style + Construction + Material
  if (brand && style && construction && materials[0]) {
    const query = buildCleanQuery(brand, style, construction, materials[0], getBaseCategoryTerm(category));
    if (query) {
      queries.push({
        query,
        priority: 1,
        description: 'Brand + style + construction + material',
        confidence: 'high'
      });
    }
  }
  
  // Strategy 2: Brand + Model (if available)
  if (brand && itemData.model && itemData.model !== 'Unknown') {
    const query = buildCleanQuery(brand, itemData.model);
    if (query) {
      queries.push({
        query,
        priority: 2,
        description: 'Brand + model number',
        confidence: 'high'
      });
    }
  }
  
  // Strategy 3: Brand + Style + Material
  if (brand && style && materials[0]) {
    const query = buildCleanQuery(brand, style, materials[0], getBaseCategoryTerm(category));
    if (query) {
      queries.push({
        query,
        priority: 3,
        description: 'Brand + style + material',
        confidence: 'high'
      });
    }
  }
  
  // Strategy 4: Style + Construction + Material (no brand)
  if (style && construction && materials[0]) {
    const query = buildCleanQuery(style, construction, materials[0], getBaseCategoryTerm(category));
    if (query) {
      queries.push({
        query,
        priority: 4,
        description: 'Style + construction + material',
        confidence: 'medium'
      });
    }
  }
  
  // Strategy 5: Brand + Basic Category
  if (brand) {
    const query = buildCleanQuery(brand, getBaseCategoryTerm(category));
    if (query) {
      queries.push({
        query,
        priority: 5,
        description: 'Brand + category',
        confidence: 'medium'
      });
    }
  }
  
  // Strategy 6: Style + Material
  if (style && materials[0]) {
    const query = buildCleanQuery(style, materials[0], getBaseCategoryTerm(category));
    if (query) {
      queries.push({
        query,
        priority: 6,
        description: 'Style + material',
        confidence: 'medium'
      });
    }
  }
  
  // Strategy 7: Construction + Material
  if (construction && materials[0]) {
    const query = buildCleanQuery(construction, materials[0], getBaseCategoryTerm(category));
    if (query) {
      queries.push({
        query,
        priority: 7,
        description: 'Construction + material',
        confidence: 'medium'
      });
    }
  }
  
  // Strategy 8: Enhanced category only
  const categoryQuery = buildCleanQuery(getBaseCategoryTerm(category));
  if (categoryQuery) {
    queries.push({
      query: categoryQuery,
      priority: 8,
      description: 'Category fallback',
      confidence: 'low'
    });
  }
  
  // Remove duplicate queries and ensure minimum length
  const uniqueQueries = queries
    .filter(q => q.query && q.query.length >= 3)
    .filter((q, index, self) => index === self.findIndex(sq => sq.query === q.query))
    .sort((a, b) => a.priority - b.priority);
  
  return uniqueQueries;
}

/**
 * Get base category term for eBay search
 */
function getBaseCategoryTerm(category) {
  if (!category) return 'item';
  
  // Extract the core item type from enhanced category
  const categoryLower = category.toLowerCase();
  
  if (categoryLower.includes('chair')) return 'chair';
  if (categoryLower.includes('table')) return 'table';
  if (categoryLower.includes('desk')) return 'desk';
  if (categoryLower.includes('sofa') || categoryLower.includes('couch')) return 'sofa';
  if (categoryLower.includes('shoe') || categoryLower.includes('sneaker')) return 'shoes';
  if (categoryLower.includes('shirt')) return 'shirt';
  if (categoryLower.includes('jacket')) return 'jacket';
  if (categoryLower.includes('phone')) return 'phone';
  if (categoryLower.includes('laptop')) return 'laptop';
  
  // Return the last word as fallback
  return category.split(' ').pop() || 'item';
}

/**
 * Calculate confidence score for brand detection
 */
function calculateBrandConfidence(foundText, fullText, brandData, category) {
  let confidence = 5; // Base confidence
  
  // Exact match bonus
  if (foundText === brandData.variations[0]) {
    confidence += 2;
  }
  
  // Category match bonus
  if (brandData.categories.includes(category?.toLowerCase())) {
    confidence += 2;
  }
  
  // Multiple evidence bonus
  const evidenceCount = brandData.variations.filter(v => fullText.includes(v.toLowerCase())).length;
  confidence += Math.min(evidenceCount - 1, 2);
  
  // Identifier bonus
  const identifierCount = brandData.identifiers.filter(id => fullText.includes(id.toLowerCase())).length;
  confidence += identifierCount;
  
  // Text quality bonus
  if (foundText.length >= 4 && /^[a-z\s]+$/.test(foundText)) {
    confidence += 1;
  }
  
  return Math.min(confidence, 10);
}

/**
 * Infer brand from model number patterns
 */
function inferBrandFromModel(model) {
  const modelPatterns = {
    'Apple': [/^A\d{4}$/i, /^MGNT\d$/i, /^ML\w{2}\d$/i],
    'Samsung': [/^SM-[A-Z]\d{3}[A-Z]?$/i, /^GT-[A-Z]\d{4}$/i],
    'Sony': [/^WH-\d{4}[A-Z]*$/i, /^WF-\d{4}[A-Z]*$/i],
    'Microsoft': [/^Surface\s/i, /^Xbox\s/i],
    'Nintendo': [/^HAC-/i, /^Switch/i]
  };
  
  for (const [brand, patterns] of Object.entries(modelPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(model)) {
        return {
          brand: brand,
          confidence: 7,
          pattern: pattern.toString()
        };
      }
    }
  }
  
  return null;
}

/**
 * Perform fuzzy string matching for damaged/partial text
 */
function performFuzzyBrandMatching(text) {
  const commonBrands = ['nike', 'adidas', 'apple', 'samsung', 'sony', 'microsoft', 'nintendo', 'ikea'];
  const threshold = 0.7;
  
  for (const brand of commonBrands) {
    const words = text.split(/\s+/);
    for (const word of words) {
      if (word.length >= 3) {
        const similarity = calculateStringSimilarity(word, brand);
        if (similarity >= threshold) {
          return {
            brand: properCaseBrand(brand),
            confidence: Math.floor(similarity * 8),
            match: word,
            similarity: similarity
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Calculate string similarity using simple ratio
 */
function calculateStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Enhanced universal prompt with material and style focus
 */
function getEnhancedUniversalPrompt() {
  return `You are a circular economy assistant that helps users identify and evaluate secondhand items found on the street. Based on 1–3 uploaded images, you analyze the object and provide a structured JSON-like response with:

1. Item Category
2. Brand / Manufacturer
3. Model / Product Name
4. Condition Assessment
5. Resale Potential: 
   - Recommended action (resell, donate, repair, recycle, scrap)
   - Estimated resale price range (USD)
   - Brief justification
6. Component Salvage (if unsellable): parts that can be reused, resold, or recycled
7. Confidence Rating (1–10)

Focus on the most prominent object in the photos. Use accurate terminology but keep explanations clear and brief.`;
}


/**
 * Proper case brand name formatting
 */
function properCaseBrand(name) {
  const specialCases = {
    'dr. martens': 'Dr. Martens',
    'mcdonalds': 'McDonald\'s',
    'coca-cola': 'Coca-Cola',
    'levi\'s': 'Levi\'s',
    'o\'neill': 'O\'Neill',
    'l\'oreal': 'L\'Oréal',
    'ikea': 'IKEA'
  };
  
  const normalized = name.toLowerCase().replace(/['"]/g, '\'');
  
  if (specialCases[normalized]) {
    return specialCases[normalized];
  }
  
  return name.split(/[\s\-_]/)
    .map(word => word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(' ');
}

/**
 * Convert image to data URL with smart quality detection
 */
function toDataUrl(img, fallbackMime = 'image/jpeg') {
  if (typeof img === 'string') {
    if (img.startsWith('data:')) return img;
    if (/^[A-Za-z0-9+/=\s]+$/.test(img) && img.length > 100) {
      return `data:${fallbackMime};base64,${img.replace(/\s+/g, '')}`;
    }
    return img;
  }
  if (Buffer.isBuffer(img) || img instanceof Uint8Array) {
    const b64 = Buffer.from(img).toString('base64');
    return `data:${fallbackMime};base64,${b64}`;
  }
  throw new Error('Unsupported image input type');
}

/**
 * Call vision API with optimized settings
 */async function callVisionAPI(provider, images, apiKey, prompt = '', options = {}) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('No images provided to callVisionAPI');
  }

  const imageData = images.map((img) => toDataUrl(img));

  switch (provider) {
    case 'gpt-4o':
    case 'gpt-4o':
      // Merge defaults with any overrides passed in
      return await callgpt-4o(
        imageData,
        apiKey,
        prompt,
        { model: 'gpt-4o', ...options }
      );
    case 'claude':
      return await callClaude(imageData, apiKey, prompt, options);
    default:
      throw new Error(`Unsupported vision provider: ${provider}`);
  }
}

// Call GPT-4o with enhanced optimization
 
async function callgpt-4o(images, apiKey, prompt = '', options = {}) {
  const chosenModel = options.model || 'gpt-4o'; // default to GPT-4o
  const useHighDetail = true; // Always use high detail for OCR/branding

  console.log('🤖 Calling GPT-4V with enhanced detection:', {
    model: chosenModel,
    imageCount: images.length,
    detail: useHighDetail ? 'high' : 'low',
    promptLength: prompt.length
  });

  const requestBody = {
    model: chosenModel,
    messages: [
      {
        role: 'system',
        content:
 `You prioritize text/logos/labels if present, but you may also infer brand/model from distinctive design features.
Return a best guess when the design is well-known (mark it as "likely" and set confidence accordingly).
Do not hallucinate rare models; briefly justify any inference.`      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map((img) => ({
            type: 'image_url',
            image_url: {
              url:
                typeof img === 'string' &&
                (img.startsWith('data:') || img.startsWith('http'))
                  ? img
                  : `data:image/jpeg;base64,${img}`,
              detail: useHighDetail ? 'high' : 'low'
            }
          }))
        ]
      }
    ],
    max_tokens: 1500,
    temperature: 0.3
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorText;
    try {
      errorText = await response.text();
    } catch {
      errorText = `HTTP ${response.status}`;
    }
    console.error('❌ OpenAI API Error:', errorText);
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  try {
    console.log('📊 GPT-4V Usage:', data.usage);
    const preview = data.choices?.[0]?.message?.content || '';
    console.log('📝 Response Preview:', preview.slice(0, 300) + '...');
  } catch (e) {
    console.warn('Could not log usage info:', e.message);
  }

  // Parse response
  try {
    const content = data.choices[0].message.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ Successfully parsed enhanced JSON response');
      return parsed;
    }

    console.warn('⚠️ No JSON found, attempting text parsing');
    return parseTextResponse(content);
  } catch (err) {
    console.error('❌ Failed to parse GPT-4V response:', err.message);
    return {
      category: 'Unknown',
      brand: 'Unknown',
      model: 'Unknown',
      materials: [],
      style: 'Unknown',
      keyFeatures: [],
      condition: {
        rating: 'fair',
        numeric_rating: 5,
        description: 'Unable to assess condition from image',
        usableAsIs: true,
        issues: [],
        cleanable: true
      },
      identifiers: {
        visible_text: '',
        logos_seen: '',
        size_info: 'Unknown',
        color: 'Unknown',
        distinctive_features: [],
        construction_evidence: '',
        material_evidence: ''
      },
      specifications: {
        material: 'Unknown',
        construction: 'Unknown'
      },
      confidence_rating: 3,
      image_quality: 'fair',
      notes: `Parsing error: ${err.message}. Raw response: ${
        data.choices?.[0]?.message?.content?.slice(0, 200) || 'No content'
      }`
    };
  }
}

/**
 * Parse text response as fallback
 */
function parseTextResponse(content) {
  const fallback = {
    category: 'Unknown',
    brand: 'Unknown',
    model: 'Unknown',
    materials: [],
    style: 'Unknown',
    keyFeatures: [],
    condition: {
      rating: 'fair',
      numeric_rating: 5,
      description: 'Unable to parse detailed condition',
      usableAsIs: true,
      issues: [],
      cleanable: true
    },
    identifiers: {
      visible_text: content.slice(0, 200),
      logos_seen: '',
      size_info: 'Unknown',
      color: 'Unknown',
      distinctive_features: [],
      construction_evidence: '',
      material_evidence: ''
    },
    specifications: {
      material: 'Unknown',
      construction: 'Unknown'
    },
    confidence_rating: 4,
    image_quality: 'fair',
    notes: 'Parsed from text response due to JSON parsing failure'
  };

  const categoryMatch = content.match(/category[:\s]+([^\n,\.]+)/i);
  if (categoryMatch) fallback.category = categoryMatch[1].trim();

  const brandMatch = content.match(/brand[:\s]+([^\n,\.]+)/i);
  if (brandMatch) fallback.brand = brandMatch[1].trim();

  return fallback;
}

/**
 * Call Claude API
 */
async function callClaude(images, apiKey, prompt) {
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
              data: img.replace(/^data:image\/[^;]+;base64,/, '')
            }
          }))
        ]
      }],
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.content[0].text);
}

/**
 * Save scan results to Firestore with enhanced error handling
 */async function saveToScannedItems(scanResult, uid, provider, imageCount) {
  if (!db) {
    throw new Error('Firebase not configured');
  }

  const scanId = generateReadableDocumentId(scanResult, uid);
    
  const scanDocument = {
    scanId,
    uid,
    scanData: {
      category: scanResult.category || 'Unknown',
      brand: scanResult.brand || 'Unknown',
      model: scanResult.model || 'Unknown',
      materials: Array.isArray(scanResult.materials) ? scanResult.materials : [],
      style: scanResult.style || '',
      keyFeatures: Array.isArray(scanResult.keyFeatures) ? scanResult.keyFeatures : [],
      functionalType: scanResult.functionalType || '',
      
      condition: {
        rating: scanResult.condition?.rating || 'unknown',
        numeric_rating: parseInt(scanResult.condition?.numeric_rating) || 0,
        description: scanResult.condition?.description || '',
        usableAsIs: Boolean(scanResult.condition?.usableAsIs),
        issues: Array.isArray(scanResult.condition?.issues) ? scanResult.condition.issues : [],
        cleanable: Boolean(scanResult.condition?.cleanable)
      },
      
      identifiers: scanResult.identifiers || {},
      specifications: scanResult.specifications || {},
      
      confidence: parseInt(scanResult.confidence_rating || scanResult.confidence) || 0,
      imageQuality: scanResult.image_quality || 'unknown',
      notes: scanResult.notes || ''
    },
    
    resale: {
      recommendedAction: scanResult.resale?.recommended_action || 'evaluate',
      estimatedValue: parseEstimatedValue(scanResult.resale?.estimated_value),
      confidence: scanResult.resale?.confidence || 'low',
      sellingPoints: Array.isArray(scanResult.resale?.selling_points) ? scanResult.resale.selling_points : [],
      concerns: Array.isArray(scanResult.resale?.concerns) ? scanResult.resale.concerns : []
    },
    
    disposition: {
      chosen: null,
      route: null,
      estimatedReturn: null,
      chosenAt: null
    },
    
    // Enhanced search data for eBay integration with null safety
    searchData: {
      ebayQueries: Array.isArray(scanResult.ebaySearchQueries) ? scanResult.ebaySearchQueries : [],
      detectedMaterials: Array.isArray(scanResult.materials) ? scanResult.materials : [],
      detectedStyle: scanResult.style || '',
      construction: scanResult.specifications?.construction || '',
      enhancedCategory: scanResult.category || ''
    },
    
    metadata: {
      scannedAt: new Date(),
      appVersion: '1.0.0',
      visionProvider: provider || 'unknown',
      imageCount: parseInt(imageCount) || 0,
      processingTime: null,
      deviceType: 'unknown'
    }
  };

  try {
    const docRef = db.collection('scanned_items').doc(scanId);
    await docRef.set(scanDocument);
    
    console.log('📄 Enhanced scan document created:', {
      scanId: scanId,
      firestoreId: docRef.id,
      category: scanResult.category,
      brand: scanResult.brand,
      materials: scanResult.materials,
      style: scanResult.style,
      confidence: scanResult.confidence_rating
    });
    
    return {
      scanId: scanId,
      firestoreId: docRef.id,
      ...scanDocument
    };
    
  } catch (error) {
    console.error('❌ Failed to save scan to Firestore:', error);
    throw new Error(`Failed to save scan: ${error.message}`);
  }
}

/**
 * Parse estimated value from various formats with null safety
 */
function parseEstimatedValue(estimatedValue) {
  // Default safe return value
  const defaultValue = { min: 0, max: 0, currency: 'USD' };
  
  if (!estimatedValue) {
    return defaultValue;
  }
  
  try {
    if (typeof estimatedValue === 'string') {
      const rangeMatch = estimatedValue.match(/\$?(\d+)(?:-\$?(\d+))?/);
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1]) || 0;
        const max = parseInt(rangeMatch[2]) || min || 0;
        return { min, max, currency: 'USD' };
      }
    }
    
    if (typeof estimatedValue === 'object') {
      return {
        min: parseInt(estimatedValue.min) || 0,
        max: parseInt(estimatedValue.max) || 0,
        currency: estimatedValue.currency || 'USD'
      };
    }
    
    if (typeof estimatedValue === 'number' && !isNaN(estimatedValue)) {
      const value = Math.max(0, estimatedValue);
      return { min: value, max: value, currency: 'USD' };
    }
  } catch (error) {
    console.warn('Error parsing estimated value:', error.message, estimatedValue);
  }
  
  return defaultValue;
}

/**
 * Generate readable document ID with better deduplication
 */
function generateReadableDocumentId(scanResult, uid) {
  const usedTerms = new Set();
  const titleParts = [];
  
  // Add brand if available and not generic
  if (scanResult.brand && scanResult.brand !== 'Unknown') {
    const brandClean = scanResult.brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (brandClean.length > 0) {
      titleParts.push(brandClean);
      usedTerms.add(brandClean);
    }
  }
  
  // Add model if available and not generic
  if (scanResult.model && scanResult.model !== 'Unknown') {
    const modelClean = scanResult.model.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (modelClean.length > 0 && !usedTerms.has(modelClean)) {
      titleParts.push(modelClean);
      usedTerms.add(modelClean);
    }
  }
  
  // Add category terms, avoiding duplicates
  if (scanResult.category) {
    const categoryWords = scanResult.category.toLowerCase().split(/\s+/);
    for (const word of categoryWords) {
      const wordClean = word.replace(/[^a-z0-9]/g, '');
      if (wordClean.length > 2 && !usedTerms.has(wordClean)) {
        titleParts.push(wordClean);
        usedTerms.add(wordClean);
        if (titleParts.length >= 3) break; // Limit to reasonable length
      }
    }
  }
  
  // Fallback if no good terms found
  if (titleParts.length === 0) {
    titleParts.push('item');
  }
  
  // Build final title
  let title = titleParts.join('_').substring(0, 25);
  
  // Add timestamp and user info
  const now = new Date();
  const dateStamp = now.toISOString().split('T')[0].replace(/-/g, '');
  const userPart = (uid.split('_')[0] || uid.substring(0, 6)).replace(/[^a-z0-9]/gi, '');
  const uniqueSuffix = Math.random().toString(36).substr(2, 4);
  
  return `${title}_${dateStamp}_${userPart}_${uniqueSuffix}`;
}

/**
 * Update scan disposition choice with null safety
 */
async function updateScanDisposition(scanId, dispositionChoice) {
  if (!db) {
    throw new Error('Firebase not configured');
  }
  
  if (!scanId || !dispositionChoice) {
    throw new Error('Missing required parameters for disposition update');
  }
  
  const updateData = {
    'disposition.chosen': dispositionChoice.type || 'unknown',
    'disposition.route': dispositionChoice.route || 'unknown',
    'disposition.estimatedReturn': parseFloat(dispositionChoice.estimatedReturn) || 0,
    'disposition.chosenAt': new Date(),
    'metadata.updatedAt': new Date()
  };
  
  try {
    const snapshot = await db.collection('scanned_items')
      .where('scanId', '==', scanId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      throw new Error(`Scan not found: ${scanId}`);
    }
    
    const docRef = snapshot.docs[0].ref;
    await docRef.update(updateData);
    
    console.log('✅ Scan disposition updated:', scanId, dispositionChoice.type);
    return true;
    
  } catch (error) {
    console.error('❌ Failed to update scan disposition:', error);
    throw error;
  }
}

/**
 * Update user statistics with null safety
 */
async function updateUserStats(uid, updates) {
  if (!db) {
    console.log('Firebase not configured, skipping user stats update');
    return false;
  }
  
  if (!uid || !updates) {
    console.warn('Missing parameters for user stats update');
    return false;
  }
  
  try {
    const userRef = db.collection('users').doc(uid);
    
    const updateData = {
      'metadata.updatedAt': new Date(),
      'metadata.lastActiveAt': new Date()
    };
    
    // Safely add stats updates
    Object.entries(updates).forEach(([key, value]) => {
      if (key && value !== undefined && value !== null) {
        updateData[`stats.${key}`] = value;
      }
    });
    
    await userRef.update(updateData);
    
    console.log('✅ User stats updated:', uid, Object.keys(updates));
    return true;
    
  } catch (error) {
    console.error('❌ Failed to update user stats:', error);
    return false;
  }
}

/**
 * Get user's scan history with error handling
 */
async function getUserScans(uid, limit = 50) {
  if (!db) {
    throw new Error('Firebase not configured');
  }
  
  if (!uid) {
    throw new Error('User ID required');
  }
  
  try {
    const snapshot = await db.collection('scanned_items')
      .where('uid', '==', uid)
      .orderBy('metadata.scannedAt', 'desc')
      .limit(parseInt(limit) || 50)
      .get();
    
    const scans = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📋 Retrieved ${scans.length} scans for user ${uid}`);
    return scans;
    
  } catch (error) {
    console.error('❌ Failed to get user scans:', error);
    throw error;
  }
}

// Export all functions
module.exports = { 
  analyzeItem, 
  updateScanDisposition, 
  getUserScans,
  updateUserStats,
  enhanceWithAdvancedDetection,
  UNIVERSAL_BRANDS,
  MATERIAL_CLASSIFICATION,
  STYLE_CLASSIFICATION,
  generateEnhancedSearchQueries
};