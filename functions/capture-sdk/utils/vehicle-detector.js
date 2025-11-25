// utils/vehicle-detector.js
// Vehicle detection and category-specific handling

/**
 * Enhanced vehicle detection with specific automotive categories
 */
function detectItemCategory(itemData) {
  const category = itemData.category?.toLowerCase() || '';
  const description = itemData.description?.toLowerCase() || '';
  const brand = itemData.brand?.toLowerCase() || '';
  const model = itemData.model?.toLowerCase() || '';

  // Combined text for analysis
  const allText = `${category} ${description} ${brand} ${model}`.toLowerCase();

  // EXCLUSIONS: Items that contain vehicle keywords but are NOT vehicles
  const excludePatterns = [
    'car seat', 'carseat', 'infant seat', 'child seat', 'baby seat',
    'booster seat', 'doona', 'graco', 'chicco', 'britax', 'evenflo',
    'safety 1st', 'baby jogger', 'uppababy', 'nuna', 'cybex',
    'stroller', 'bassinet', 'carrier', 'infant', 'toddler', 'baby',
    'toy car', 'remote control car', 'rc car', 'matchbox', 'hot wheels',
    'die cast', 'model car', 'toy truck', 'toy vehicle'
  ];

  // Check exclusions first - if matched, not a vehicle
  if (excludePatterns.some(pattern => allText.includes(pattern))) {
    console.log(`Excluded from vehicle detection: matched pattern in "${allText}"`);
    return category; // Return original category, not a vehicle
  }

  // Vehicle detection patterns
  const vehiclePatterns = {
    'automobile': [
      'sedan', 'suv', 'truck', 'van', 'coupe', 'hatchback',
      'convertible', 'wagon', 'crossover', 'minivan', 'pickup',
      'vehicle', 'automobile', 'auto', 'ford', 'chevrolet', 'toyota',
      'honda', 'nissan', 'bmw', 'mercedes', 'audi', 'volkswagen',
      'hyundai', 'kia', 'mazda', 'subaru', 'lexus', 'acura',
      'cadillac', 'buick', 'lincoln', 'jeep', 'ram', 'dodge',
      'chrysler', 'mitsubishi', 'infiniti', 'genesis'
    ],
    'motorcycle': [
      'motorcycle', 'motorbike', 'bike', 'scooter', 'moped',
      'harley', 'yamaha', 'honda', 'kawasaki', 'suzuki',
      'ducati', 'triumph', 'ktm', 'bmw motorcycle'
    ],
    'boat': [
      'boat', 'yacht', 'sailboat', 'speedboat', 'pontoon',
      'fishing boat', 'jet ski', 'watercraft', 'vessel'
    ],
    'rv': [
      'rv', 'motorhome', 'camper', 'trailer', 'recreational vehicle',
      'travel trailer', 'fifth wheel', 'pop-up camper'
    ]
  };
  
  // Check for vehicle types
  for (const [vehicleType, patterns] of Object.entries(vehiclePatterns)) {
    if (patterns.some(pattern => allText.includes(pattern))) {
      console.log(`Vehicle detected: ${vehicleType} based on pattern match`);
      return vehicleType;
    }
  }
  
  // Auto parts detection
  const autoPartsPatterns = [
    'alternator', 'starter', 'radiator', 'transmission', 'engine',
    'brake', 'tire', 'wheel', 'bumper', 'headlight', 'taillight',
    'mirror', 'battery', 'filter', 'spark plug', 'carburetor',
    'muffler', 'exhaust', 'suspension', 'steering', 'clutch'
  ];
  
  if (autoPartsPatterns.some(pattern => allText.includes(pattern))) {
    console.log('Auto parts detected');
    return 'auto_parts';
  }
  
  // Return original category if not a vehicle
  return category;
}

/**
 * Enhanced vehicle-specific search query builder
 */
function buildVehicleSearchQuery(itemData) {
  const detectedCategory = detectItemCategory(itemData);
  
  if (['automobile', 'motorcycle', 'boat', 'rv'].includes(detectedCategory)) {
    return buildMotorVehicleQuery(itemData, detectedCategory);
  }
  
  if (detectedCategory === 'auto_parts') {
    return buildAutoPartsQuery(itemData);
  }
  
  // Use standard query for non-vehicles
  return buildStandardQuery(itemData);
}

function buildMotorVehicleQuery(itemData, vehicleType) {
  const parts = [];
  
  // Extract year from description
  const description = itemData.description || '';
  const yearMatch = description.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    parts.push(yearMatch[0]);
  }
  
  // Add brand (most important for vehicles)
  if (itemData.brand && itemData.brand !== 'Unknown') {
    parts.push(itemData.brand);
  }
  
  // Add model if available and specific
  if (itemData.model && itemData.model !== 'Unknown' && itemData.model.length > 2) {
    // Clean up model name
    const cleanModel = itemData.model
      .replace(/\b(automobile|car|sedan|suv|truck)\b/gi, '')
      .trim();
    if (cleanModel) {
      parts.push(cleanModel);
    }
  }
  
  // Add vehicle type if not already included
  if (vehicleType === 'automobile') {
    // Don't add 'automobile' - use more specific terms
    if (!parts.some(part => ['sedan', 'suv', 'truck', 'coupe'].includes(part.toLowerCase()))) {
      // Try to determine specific type from description
      const desc = description.toLowerCase();
      if (desc.includes('sedan')) parts.push('sedan');
      else if (desc.includes('suv')) parts.push('suv');
      else if (desc.includes('truck')) parts.push('truck');
      else if (desc.includes('coupe')) parts.push('coupe');
    }
  } else {
    parts.push(vehicleType);
  }
  
  const query = parts.join(' ').trim();
  console.log(`Vehicle search query: "${query}"`);
  return query || 'used car';
}

function buildAutoPartsQuery(itemData) {
  const parts = [];
  
  if (itemData.brand && itemData.brand !== 'Unknown') {
    parts.push(itemData.brand);
  }
  
  if (itemData.model && itemData.model !== 'Unknown') {
    parts.push(itemData.model);
  }
  
  // Add category for context
  if (itemData.category && !itemData.category.includes('Unknown')) {
    parts.push(itemData.category);
  }
  
  // Add "auto part" to make it clear
  parts.push('auto part');
  
  return parts.join(' ').trim() || 'auto parts';
}

function buildStandardQuery(itemData) {
  const parts = [];

  // Brand is most important for non-vehicles
  if (itemData.brand && itemData.brand !== 'Unknown') {
    parts.push(itemData.brand);
  }

  // Materials are critical for furniture/home goods (glass table vs wood table)
  if (itemData.materials && Array.isArray(itemData.materials) && itemData.materials.length > 0) {
    const primaryMaterial = itemData.materials[0];
    if (primaryMaterial && primaryMaterial.toLowerCase() !== 'unknown') {
      parts.push(primaryMaterial);
    }
  }

  // Category provides context
  if (itemData.category && !itemData.category.includes('Unknown')) {
    parts.push(itemData.category);
  }

  // Model adds specificity (for electronics, appliances, etc.)
  if (itemData.model && itemData.model !== 'Unknown' && itemData.model.length > 2) {
    parts.push(itemData.model);
  }

  const query = parts.join(' ').trim();
  console.log(`Standard search query: "${query}" (brand: ${itemData.brand}, materials: ${itemData.materials?.join(', ')}, category: ${itemData.category})`);

  return query || 'item';
}

/**
 * Category-specific pricing tiers with realistic ranges
 */
const CATEGORY_PRICING_TIERS = {
  // Vehicles - high value items
  'automobile': {
    min: 500,
    max: 100000,
    base: 8000,
    shippingCost: 0, // Usually local pickup
    feeStructure: 'vehicle' // Special eBay Motors fees
  },
  'motorcycle': {
    min: 300,
    max: 50000,
    base: 4000,
    shippingCost: 200,
    feeStructure: 'vehicle'
  },
  'boat': {
    min: 1000,
    max: 200000,
    base: 15000,
    shippingCost: 0,
    feeStructure: 'vehicle'
  },
  'rv': {
    min: 2000,
    max: 300000,
    base: 25000,
    shippingCost: 0,
    feeStructure: 'vehicle'
  },
  
  // Auto parts
  'auto_parts': {
    min: 5,
    max: 2000,
    base: 75,
    shippingCost: 25,
    feeStructure: 'standard'
  },
  
  // Standard categories
  'electronics': {
    min: 5,
    max: 3000,
    base: 45,
    shippingCost: 12,
    feeStructure: 'standard'
  },
  'furniture': {
    min: 10,
    max: 1000,
    base: 35,
    shippingCost: 35,
    feeStructure: 'standard'
  },
  'clothing': {
    min: 3,
    max: 300,
    base: 15,
    shippingCost: 8,
    feeStructure: 'standard'
  },
  'footwear': {
    min: 5,
    max: 500,
    base: 25,
    shippingCost: 12,
    feeStructure: 'standard'
  },
  'tools': {
    min: 5,
    max: 800,
    base: 25,
    shippingCost: 15,
    feeStructure: 'standard'
  },
  'sporting goods': {
    min: 5,
    max: 600,
    base: 20,
    shippingCost: 18,
    feeStructure: 'standard'
  },
  'books': {
    min: 1,
    max: 100,
    base: 8,
    shippingCost: 4,
    feeStructure: 'standard'
  },
  'toys': {
    min: 2,
    max: 200,
    base: 12,
    shippingCost: 10,
    feeStructure: 'standard'
  },
  'jewelry': {
    min: 5,
    max: 5000,
    base: 35,
    shippingCost: 5,
    feeStructure: 'standard'
  },
  'collectibles': {
    min: 5,
    max: 2000,
    base: 25,
    shippingCost: 10,
    feeStructure: 'standard'
  },
  'home & garden': {
    min: 3,
    max: 400,
    base: 18,
    shippingCost: 15,
    feeStructure: 'standard'
  }
};

/**
 * Get pricing tier for detected category
 */
function getPricingTier(itemData) {
  const detectedCategory = detectItemCategory(itemData);
  const tier = CATEGORY_PRICING_TIERS[detectedCategory] || CATEGORY_PRICING_TIERS['electronics'];
  
  console.log(`Pricing tier for ${detectedCategory}:`, {
    base: tier.base,
    range: `$${tier.min}-$${tier.max}`,
    shipping: tier.shippingCost
  });
  
  return { category: detectedCategory, ...tier };
}

/**
 * Validate price estimate against category tier
 */
function validatePriceEstimate(price, itemData) {
  const tier = getPricingTier(itemData);
  
  if (price < tier.min) {
    console.warn(`Price ${price} below minimum for ${tier.category}, adjusting to ${tier.min}`);
    return tier.min;
  }
  
  if (price > tier.max) {
    console.warn(`Price ${price} above maximum for ${tier.category}, adjusting to ${tier.max}`);
    return tier.max;
  }
  
  return price;
}

/**
 * Calculate category-appropriate eBay fees
 */
function calculateCategoryFees(price, category) {
  const tier = CATEGORY_PRICING_TIERS[category] || CATEGORY_PRICING_TIERS['electronics'];
  
  if (tier.feeStructure === 'vehicle') {
    // eBay Motors fee structure - capped at lower percentage
    return Math.min(price * 0.035, 900); // 3.5% capped at $900
  } else {
    // Standard eBay fee structure
    return price * 0.1325; // 13.25% typical final value fee
  }
}

module.exports = {
  detectItemCategory,
  buildVehicleSearchQuery,
  getPricingTier,
  validatePriceEstimate,
  calculateCategoryFees,
  CATEGORY_PRICING_TIERS
};