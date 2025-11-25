// functions/capture-sdk/utils/searchQueryBuilder.js
// Enhanced search query building for better eBay comparables

/**
 * Build intelligent search queries based on item characteristics
 * Returns array of queries ordered by priority (most specific first)
 */
function buildSmartSearchQueries(itemData) {
  const queries = [];
  const category = itemData.category?.toLowerCase() || '';
  const brand = itemData.brand;
  const model = itemData.model;

  console.log('Building smart queries for:', { category, brand, model });

  // Extract key characteristics from the item
  const characteristics = extractItemCharacteristics(itemData);

  // Strategy 1: Exact Brand + Model (highest priority for known items)
  if (brand && brand !== 'Unknown' && model && model !== 'Unknown') {
    // Special handling for common brands with specific models
    if (isWellKnownBrandModel(brand, model)) {
      const cleanedModel = cleanQueryForSingleItem(model);
      queries.push({
        query: cleanQueryForSingleItem(`${brand} ${cleanedModel}`),
        priority: 1,
        description: 'Exact brand and model',
        expectedResults: 'high_relevance',
        confidence: 0.95
      });
    }
  }

  // Strategy 2: Brand + simplified category (for mass market brands)
  if (brand && brand !== 'Unknown' && isMassMarketBrand(brand)) {
    const simplifiedCategory = getSimplifiedCategoryForBrand(brand, category);
    if (simplifiedCategory) {
      // Check if this is a set of items
      const itemCount = itemData.itemCount || 1;
      const isSet = itemData.isSet || false;

      let searchTerm = `${brand} ${simplifiedCategory}`;

      // If it's a set, don't clean the query - we want to find sets
      if (!isSet && itemCount === 1) {
        searchTerm = cleanQueryForSingleItem(searchTerm);
      }

      queries.push({
        query: searchTerm,
        priority: 2,
        description: isSet ? 'Brand with category (set)' : 'Brand with simplified category',
        expectedResults: 'high_relevance',
        confidence: 0.85,
        isSet: isSet,
        itemCount: itemCount
      });
    }
  }
  
  // Strategy 3: Descriptive search based on specific characteristics
  const descriptiveQuery = buildDescriptiveQuery(itemData, characteristics);
  if (descriptiveQuery) {
    queries.push({
      query: descriptiveQuery,
      priority: 3,
      description: 'Descriptive item search',
      expectedResults: 'medium_relevance',
      confidence: 0.75
    });
  }
  
  // Strategy 4: Category + key material/feature
  const featureQuery = buildFeatureQuery(itemData, characteristics);
  if (featureQuery) {
    queries.push({
      query: featureQuery,
      priority: 4,
      description: 'Category with key features',
      expectedResults: 'medium_relevance',
      confidence: 0.65
    });
  }
  
  // Strategy 5: Brand + general category (if brand known but not mass market)
  if (brand && brand !== 'Unknown' && !isMassMarketBrand(brand)) {
    const generalCategory = getGeneralCategory(category);
    queries.push({
      query: `${brand} ${generalCategory}`,
      priority: 5,
      description: 'Brand with general category',
      expectedResults: 'medium_relevance',
      confidence: 0.55
    });
  }
  
  // Strategy 6: Specific category only
  const specificCategory = getSpecificCategoryTerm(category);
  if (specificCategory && specificCategory !== category) {
    queries.push({
      query: specificCategory,
      priority: 6,
      description: 'Specific category search',
      expectedResults: 'low_relevance',
      confidence: 0.45
    });
  }
  
  // Strategy 7: Generic category fallback (last resort)
  const fallbackCategory = getFallbackCategory(category);
  queries.push({
    query: fallbackCategory,
    priority: 7,
    description: 'Generic category fallback',
    expectedResults: 'low_relevance',
    confidence: 0.25
  });
  
  // Remove duplicates and sort by priority
  const uniqueQueries = removeDuplicateQueries(queries);
  return uniqueQueries.sort((a, b) => a.priority - b.priority);
}

/**
 * Check if brand+model combination is well-known
 */
function isWellKnownBrandModel(brand, model) {
  const wellKnownCombos = {
    'IKEA': ['POÄNG', 'LACK', 'MALM', 'BILLY', 'HEMNES', 'KALLAX'],
    'Apple': ['iPhone', 'iPad', 'MacBook', 'iMac', 'AirPods'],
    'Samsung': ['Galaxy', 'Note', 'Tab'],
    'Nintendo': ['Switch', 'DS', '3DS', 'Wii'],
    'Sony': ['PlayStation', 'PS4', 'PS5', 'WH-1000XM'],
    'Microsoft': ['Xbox', 'Surface']
  };
  
  const models = wellKnownCombos[brand];
  return models && models.some(knownModel => 
    model.toLowerCase().includes(knownModel.toLowerCase())
  );
}

/**
 * Check if brand is mass market (needs conservative pricing)
 */
function isMassMarketBrand(brand) {
  const massMarketBrands = [
    'IKEA', 'Target', 'Walmart', 'Costco', 'HomeGoods', 'Big Lots',
    'Mainstays', 'Better Homes', 'Room Essentials', 'Threshold',
    'Hampton Bay', 'Style Selections'
  ];
  
  return massMarketBrands.some(massMarket => 
    brand.toLowerCase().includes(massMarket.toLowerCase())
  );
}

/**
 * Get simplified category for brand searches
 */
function getSimplifiedCategoryForBrand(brand, category) {
  const brandCategoryMap = {
    'IKEA': {
      'furniture': 'chair',
      'cantilever armchair': 'armchair',
      'cantilever armchair with headrest': 'armchair',
      'armchair': 'armchair',
      'side table': 'side table',
      'coffee table': 'coffee table',
      'bookshelf': 'bookshelf',
      'default': 'furniture'
    },
    'Apple': {
      'electronics': 'device',
      'phone': 'iPhone',
      'tablet': 'iPad',
      'laptop': 'MacBook',
      'default': 'device'
    }
  };

  const categoryMap = brandCategoryMap[brand];
  if (!categoryMap) return null;

  // Try exact category match first
  for (const [key, value] of Object.entries(categoryMap)) {
    if (category.includes(key)) {
      return value;
    }
  }

  return categoryMap.default;
}

/**
 * Clean search query to remove multi-item indicators
 * Ensures we search for single items only
 */
function cleanQueryForSingleItem(query) {
  // Remove common multi-item phrases
  let cleaned = query
    .replace(/\bwith ottoman\b/gi, '')
    .replace(/\bwith cushion\b/gi, '')
    .replace(/\bwith footstool\b/gi, '')
    .replace(/\band ottoman\b/gi, '')
    .replace(/\band cushion\b/gi, '')
    .replace(/\bset\b/gi, '')
    .replace(/\blot\b/gi, '')
    .replace(/\s+/g, ' ')  // Collapse multiple spaces
    .trim();

  return cleaned;
}

/**
 * Extract key characteristics from item data and image analysis
 */
function extractItemCharacteristics(itemData) {
  const characteristics = {
    material: null,
    style: null,
    size: null,
    era: null,
    features: [],
    color: null,
    condition_keywords: []
  };
  
  // Extract from specifications if available
  if (itemData.specifications) {
    characteristics.material = itemData.specifications.material;
    characteristics.style = itemData.specifications.style;
    characteristics.size = itemData.specifications.size;
    characteristics.era = itemData.specifications.era;
  }
  
  // Extract from materials array (new field from Claude analysis)
  if (itemData.materials && Array.isArray(itemData.materials)) {
    characteristics.material = itemData.materials[0]; // Use primary material
  }
  
  // Extract from keyFeatures array
  if (itemData.keyFeatures && Array.isArray(itemData.keyFeatures)) {
    characteristics.features = itemData.keyFeatures.slice(0, 3); // Top 3 features
  }
  
  // Extract from identifiers
  if (itemData.identifiers) {
    characteristics.color = itemData.identifiers.color;
    
    // Parse visible text for clues
    const text = itemData.identifiers.visible_text?.toLowerCase() || '';
    
    // Material detection from text/description
    const materials = ['wood', 'bamboo', 'metal', 'plastic', 'glass', 'leather', 'fabric', 'ceramic'];
    if (!characteristics.material) {
      characteristics.material = materials.find(m => text.includes(m));
    }
    
    // Style detection
    const styles = ['vintage', 'antique', 'modern', 'mid-century', 'industrial', 'rustic'];
    if (!characteristics.style) {
      characteristics.style = styles.find(s => text.includes(s));
    }
  }
  
  // Extract from condition description
  if (itemData.condition?.description) {
    const desc = itemData.condition.description.toLowerCase();
    
    // Look for material mentions
    const materials = ['bentwood', 'bamboo', 'wood', 'wooden', 'metal', 'steel', 'aluminum', 'plastic', 'fabric'];
    if (!characteristics.material) {
      characteristics.material = materials.find(m => desc.includes(m));
    }
    
    // Look for style indicators
    const styleKeywords = ['vintage', 'antique', 'retro', 'mid-century', 'modern', 'scandinavian'];
    if (!characteristics.style) {
      characteristics.style = styleKeywords.find(s => desc.includes(s));
    }
    
    // Extract features mentioned
    const furnitureFeatures = ['drawer', 'drawers', 'shelves', 'storage', 'fold', 'folding', 'headrest', 'cushion'];
    const foundFeatures = furnitureFeatures.filter(f => desc.includes(f));
    characteristics.features = [...characteristics.features, ...foundFeatures];
  }
  
  return characteristics;
}

/**
 * Build descriptive query based on item characteristics
 */
function buildDescriptiveQuery(itemData, characteristics) {
  const category = itemData.category?.toLowerCase() || '';
  const parts = [];
  
  // For furniture, be very specific
  if (category.includes('furniture') || category.includes('chair') || category.includes('table')) {
    return buildFurnitureDescriptiveQuery(itemData, characteristics);
  }
  
  // Add style/era if detected (but keep it simple)
  if (characteristics.style && !['modern', 'contemporary'].includes(characteristics.style)) {
    parts.push(characteristics.style);
  }
  
  // Add material if detected and relevant
  if (characteristics.material && characteristics.material !== 'unknown') {
    parts.push(characteristics.material);
  }
  
  // Add specific item type based on category
  const specificType = getSpecificItemType(category, characteristics);
  if (specificType) {
    parts.push(specificType);
  }
  
  // Add one key feature if it's distinctive
  if (characteristics.features.length > 0) {
    const distinctiveFeature = getDistinctiveFeature(characteristics.features);
    if (distinctiveFeature) {
      parts.push(distinctiveFeature);
    }
  }
  
  return parts.length >= 2 ? parts.join(' ') : null;
}

/**
 * Build furniture-specific descriptive query
 */
function buildFurnitureDescriptiveQuery(itemData, characteristics) {
  const parts = [];
  const category = itemData.category?.toLowerCase() || '';
  
  // Determine furniture type from category
  let furnitureType = 'furniture';
  if (category.includes('chair')) furnitureType = 'chair';
  else if (category.includes('table')) furnitureType = 'table';
  else if (category.includes('shelf') || category.includes('bookcase')) furnitureType = 'shelf';
  else if (category.includes('desk')) furnitureType = 'desk';
  
  // Add material first (important for furniture)
  if (characteristics.material) {
    parts.push(characteristics.material);
  }
  
  // Add furniture type
  parts.push(furnitureType);
  
  // Add one distinctive feature
  if (characteristics.features.length > 0) {
    const feature = characteristics.features.find(f => 
      ['storage', 'drawer', 'shelves', 'headrest', 'cushion'].includes(f)
    );
    if (feature) {
      parts.push(feature);
    }
  }
  
  return parts.join(' ');
}

/**
 * Get distinctive feature from features list
 */
function getDistinctiveFeature(features) {
  // Prioritize distinctive features over common ones
  const distinctive = features.find(f => 
    ['headrest', 'storage', 'drawer', 'fold', 'wireless', 'bluetooth'].includes(f)
  );
  return distinctive || features[0];
}

/**
 * Build feature-based query
 */
function buildFeatureQuery(itemData, characteristics) {
  const category = itemData.category?.toLowerCase() || '';
  const parts = [];
  
  // Start with specific category term
  const specificType = getSpecificItemType(category, characteristics);
  if (specificType) {
    parts.push(specificType);
  }
  
  // Add material if it's distinctive
  if (characteristics.material && !['wood', 'plastic'].includes(characteristics.material)) {
    parts.push(characteristics.material);
  }
  
  // Add primary feature
  if (characteristics.features.length > 0) {
    parts.push(characteristics.features[0]);
  }
  
  return parts.length >= 2 ? parts.join(' ') : null;
}

/**
 * Get general category for brand searches
 */
function getGeneralCategory(category) {
  const categoryMappings = {
    'furniture': 'furniture',
    'chair': 'furniture',
    'table': 'furniture',
    'electronics': 'electronics',
    'phone': 'electronics',
    'computer': 'electronics',
    'footwear': 'shoes',
    'clothing': 'clothing',
    'tools': 'tools',
    'books': 'books',
    'toys': 'toys'
  };
  
  for (const [key, value] of Object.entries(categoryMappings)) {
    if (category.includes(key)) {
      return value;
    }
  }
  
  return category;
}

/**
 * Get specific category term instead of generic ones
 */
function getSpecificCategoryTerm(category) {
  const categoryLower = category?.toLowerCase() || '';
  
  // Furniture subcategories
  if (categoryLower.includes('chair')) return 'chair';
  if (categoryLower.includes('table')) return 'table';
  if (categoryLower.includes('desk')) return 'desk';
  if (categoryLower.includes('shelf') || categoryLower.includes('bookcase')) return 'bookshelf';
  if (categoryLower.includes('sofa') || categoryLower.includes('couch')) return 'sofa';
  
  // Electronics subcategories
  if (categoryLower.includes('phone')) return 'phone';
  if (categoryLower.includes('laptop')) return 'laptop';
  if (categoryLower.includes('tablet')) return 'tablet';
  if (categoryLower.includes('headphones')) return 'headphones';
  
  // Generic mappings
  const categoryMappings = {
    'furniture': 'chair', // Default to chair for better results
    'footwear': 'shoes',
    'electronics': 'device',
    'tools': 'tool',
    'clothing': 'apparel',
    'books': 'book',
    'toys': 'toy',
    'jewelry': 'jewelry',
    'automotive': 'auto parts'
  };
  
  return categoryMappings[categoryLower] || categoryLower;
}

/**
 * Get specific item type based on category and characteristics
 */
function getSpecificItemType(category, characteristics) {
  const categoryLower = category?.toLowerCase() || '';
  
  // Detailed furniture type detection
  if (categoryLower.includes('furniture') || categoryLower.includes('chair') || categoryLower.includes('table')) {
    if (categoryLower.includes('chair')) {
      // Chair subtypes
      if (characteristics.features.includes('headrest')) return 'armchair';
      if (characteristics.features.includes('office')) return 'office chair';
      return 'chair';
    }
    
    if (categoryLower.includes('table')) {
      // Table subtypes
      if (categoryLower.includes('side') || categoryLower.includes('end')) return 'side table';
      if (categoryLower.includes('coffee')) return 'coffee table';
      if (categoryLower.includes('dining')) return 'dining table';
      return 'table';
    }
    
    // Default furniture handling
    if (characteristics.features.includes('drawer') || characteristics.features.includes('storage')) {
      return 'storage furniture';
    }
    
    return 'furniture';
  }
  
  // Other categories
  switch (categoryLower) {
    case 'footwear':
      return characteristics.style === 'vintage' ? 'vintage shoes' : 'shoes';
    case 'electronics':
      return 'electronics';
    case 'tools':
      return 'tool';
    case 'clothing':
      return characteristics.style === 'vintage' ? 'vintage clothing' : 'clothing';
    default:
      return categoryLower;
  }
}

/**
 * Get fallback category for last resort searches
 */
function getFallbackCategory(category) {
  const categoryLower = category?.toLowerCase() || '';
  
  // Simple fallbacks that usually return results
  if (categoryLower.includes('furniture') || categoryLower.includes('chair') || categoryLower.includes('table')) {
    return 'furniture';
  }
  
  const fallbacks = {
    'electronics': 'electronics',
    'phone': 'phone',
    'clothing': 'clothing',
    'shoes': 'shoes',
    'footwear': 'shoes',
    'tools': 'tools',
    'books': 'books',
    'toys': 'toys',
    'jewelry': 'jewelry'
  };
  
  for (const [key, value] of Object.entries(fallbacks)) {
    if (categoryLower.includes(key)) {
      return value;
    }
  }
  
  return categoryLower || 'item';
}

/**
 * Remove duplicate queries
 */
function removeDuplicateQueries(queries) {
  const seen = new Set();
  return queries.filter(q => {
    const key = q.query.toLowerCase().trim();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Get optimal search query from built queries
 * Returns the highest priority query that's likely to return good results
 */
function getOptimalSearchQuery(itemData) {
  const queries = buildSmartSearchQueries(itemData);
  
  // Return the first query (highest priority)
  if (queries.length > 0) {
    const optimal = queries[0];
    console.log(`Selected optimal query: "${optimal.query}" (${optimal.description})`);
    return optimal.query;
  }
  
  // Fallback
  return itemData.category || 'item';
}

/**
 * Get multiple query strategies for A/B testing
 */
function getQueryStrategies(itemData, maxStrategies = 3) {
  const queries = buildSmartSearchQueries(itemData);
  return queries.slice(0, maxStrategies);
}

// Export all functions
module.exports = {
  buildSmartSearchQueries,
  getOptimalSearchQuery,
  getQueryStrategies,
  extractItemCharacteristics,
  buildDescriptiveQuery,
  buildFeatureQuery,
  isWellKnownBrandModel,
  isMassMarketBrand,
  getSimplifiedCategoryForBrand
};