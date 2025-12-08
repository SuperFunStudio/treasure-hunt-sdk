// functions/capture-sdk/utils/priceEstimate.js
// Enhanced price estimation with vehicle detection and realistic category pricing

const { 
  detectItemCategory, 
  getPricingTier, 
  validatePriceEstimate,
  calculateCategoryFees
} = require('./vehicle-detector');

/**
 * Main price estimation function with vehicle awareness
 */
async function estimatePrice(itemData, options = {}) {
  const {
    source = 'manual',
    includeShipping = true,
    condition = itemData.condition?.rating || 'good'
  } = options;

  console.log('Price estimation starting:', {
    category: itemData.category,
    brand: itemData.brand,
    source: source
  });

  // Detect category and get pricing tier
  const detectedCategory = detectItemCategory(itemData);
  const pricingTier = getPricingTier(itemData);
  
  const enhancedItemData = {
    ...itemData,
    detectedCategory,
    pricingTier
  };

  switch (source) {
    case 'ebay':
      return await getEbayPricing(enhancedItemData, condition);
    case 'manual':
      return getCategoryAwareManualEstimate(enhancedItemData, condition);
    case 'ml-model':
      return await getMLEstimate(enhancedItemData);
    default:
      return getCategoryAwareManualEstimate(enhancedItemData, condition);
  }
}

/**
 * eBay pricing function (fallback - mainly for compatibility)
 */
async function getEbayPricing(enhancedItemData, condition) {
  try {
    console.log('eBay pricing called from priceEstimate.js - using manual fallback');
    return getCategoryAwareManualEstimate(enhancedItemData, condition);
  } catch (error) {
    console.error('eBay pricing error:', error);
    return getCategoryAwareManualEstimate(enhancedItemData, condition);
  }
}

/**
 * ML estimation placeholder
 */
async function getMLEstimate(enhancedItemData) {
  console.log('ML price estimation for:', enhancedItemData.detectedCategory);
  return getCategoryAwareManualEstimate(enhancedItemData, enhancedItemData.condition?.rating || 'good');
}

/**
 * Category-aware manual estimation with vehicle support
 */
function getCategoryAwareManualEstimate(enhancedItemData, condition) {
  const { detectedCategory, pricingTier } = enhancedItemData;
  
  console.log(`Using category-aware pricing for ${detectedCategory}:`, {
    basePricing: pricingTier.base,
    range: `$${pricingTier.min}-$${pricingTier.max}`
  });

  // Vehicle-specific pricing
  if (['automobile', 'motorcycle', 'boat', 'rv'].includes(detectedCategory)) {
    return getVehiclePricing(enhancedItemData, condition);
  }

  // Auto parts pricing
  if (detectedCategory === 'auto_parts') {
    return getAutoPartsPricing(enhancedItemData, condition);
  }

  // Standard category pricing
  return getStandardCategoryPricing(enhancedItemData, condition);
}

/**
 * Vehicle-specific pricing logic
 */
function getVehiclePricing(enhancedItemData, condition) {
  const { detectedCategory, pricingTier } = enhancedItemData;
  
  console.log(`Vehicle pricing for ${detectedCategory}`);
  
  let basePrice = pricingTier.base;
  
  // Vehicle brand multipliers
  const vehicleBrands = {
    'tesla': 2.2,
    'bmw': 1.7,
    'mercedes': 1.8,
    'audi': 1.6,
    'lexus': 1.5,
    'porsche': 2.5,
    'ferrari': 4.0,
    'lamborghini': 4.5,
    'maserati': 2.0,
    'jaguar': 1.4,
    'land rover': 1.4,
    'volvo': 1.3,
    'acura': 1.2,
    'infiniti': 1.2,
    'cadillac': 1.3,
    'lincoln': 1.2,
    'toyota': 1.1,
    'honda': 1.1,
    'mazda': 1.0,
    'subaru': 1.0,
    'nissan': 1.0,
    'hyundai': 0.9,
    'kia': 0.9,
    'ford': 0.9,
    'chevrolet': 0.9,
    'gmc': 0.9,
    'dodge': 0.8,
    'ram': 0.8,
    'chrysler': 0.8,
    'jeep': 0.9,
    'buick': 0.8,
    'mitsubishi': 0.7
  };
  
  // Apply brand multiplier
  const brand = enhancedItemData.brand?.toLowerCase();
  if (brand && vehicleBrands[brand]) {
    basePrice *= vehicleBrands[brand];
    console.log(`Applied vehicle brand multiplier for ${brand}: ${vehicleBrands[brand]}`);
  }
  
  // Vehicle condition multipliers (more aggressive than other categories)
  const vehicleConditionMultipliers = {
    'excellent': 1.0,
    'good': 0.8,
    'fair': 0.6,
    'poor': 0.3
  };
  
  basePrice *= (vehicleConditionMultipliers[condition] || 0.7);
  
  // Age-based depreciation
  const description = enhancedItemData.description || '';
  const yearMatch = description.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    
    // Vehicle depreciation schedule
    if (age <= 1) basePrice *= 0.85;      // New car loses 15% first year
    else if (age <= 3) basePrice *= 0.65; // 35% total by year 3
    else if (age <= 5) basePrice *= 0.5;  // 50% by year 5
    else if (age <= 10) basePrice *= 0.3; // 70% by year 10
    else if (age <= 20) basePrice *= 0.2; // 80% by year 20
    else basePrice *= 0.15;               // 85% depreciation for 20+ years
    
    // Classic car bonus (25+ years old in excellent condition)
    if (age >= 25 && condition === 'excellent') {
      basePrice *= 2.0; // Classic car premium
    }
    
    console.log(`Vehicle age: ${age} years, applied depreciation`);
  }
  
  const suggestedPrice = validatePriceEstimate(Math.round(basePrice), enhancedItemData);
  const shippingCost = pricingTier.shippingCost; // Usually 0 for vehicles
  const fees = calculateCategoryFees(suggestedPrice, detectedCategory);
  const netProfit = Math.round((suggestedPrice - fees - shippingCost) * 100) / 100;
  
  return {
    suggested: suggestedPrice,
    confidence: 'medium',
    priceRange: {
      low: Math.round(suggestedPrice * 0.8),
      high: Math.round(suggestedPrice * 1.2),
      median: suggestedPrice
    },
    shippingCost: shippingCost,
    ebayFees: fees,
    netProfit: netProfit,
    source: 'vehicle_category_pricing',
    isVehicle: true,
    factors: {
      category: detectedCategory,
      brand: enhancedItemData.brand,
      condition: condition,
      basePricing: pricingTier.base
    },
    note: `${detectedCategory} pricing - typically requires local pickup or transport arrangement`,
    specialHandling: detectedCategory === 'automobile' ? 
      'Consider VIN lookup for accurate valuation' : 
      `${detectedCategory} market pricing with brand and age adjustments`
  };
}

/**
 * Auto parts specific pricing
 */
function getAutoPartsPricing(enhancedItemData, condition) {
  const { pricingTier } = enhancedItemData;
  
  console.log('Auto parts pricing');
  
  let basePrice = pricingTier.base;
  
  // Auto parts brand multipliers
  const autoPartsBrands = {
    'oem': 1.8,         // Original Equipment Manufacturer
    'ac delco': 1.4,    // GM parts
    'motorcraft': 1.4,  // Ford parts
    'mopar': 1.3,       // Chrysler/Dodge/Jeep
    'bosch': 1.5,
    'denso': 1.4,
    'ngk': 1.3,
    'gates': 1.2,
    'dayco': 1.2,
    'monroe': 1.2,
    'bilstein': 1.6,
    'koni': 1.5,
    'brembo': 1.7,
    'akebono': 1.3,
    'wagner': 1.1,
    'cardone': 1.0,
    'duralast': 0.9,
    'valucraft': 0.8
  };
  
  const brand = enhancedItemData.brand?.toLowerCase();
  if (brand && autoPartsBrands[brand]) {
    basePrice *= autoPartsBrands[brand];
    console.log(`Applied auto parts brand multiplier for ${brand}: ${autoPartsBrands[brand]}`);
  }
  
  // Auto parts condition is critical
  const partsConditionMultipliers = {
    'excellent': 1.0,   // New/NOS
    'good': 0.7,        // Used but functional
    'fair': 0.4,        // Needs refurbishment
    'poor': 0.2         // For parts/core only
  };
  
  basePrice *= (partsConditionMultipliers[condition] || 0.6);
  
  const suggestedPrice = validatePriceEstimate(Math.round(basePrice), enhancedItemData);
  const shippingCost = pricingTier.shippingCost;
  const fees = calculateCategoryFees(suggestedPrice, 'auto_parts');
  const netProfit = Math.round((suggestedPrice - fees - shippingCost) * 100) / 100;
  
  return {
    suggested: suggestedPrice,
    confidence: 'medium',
    priceRange: {
      low: Math.round(suggestedPrice * 0.7),
      high: Math.round(suggestedPrice * 1.3),
      median: suggestedPrice
    },
    shippingCost: shippingCost,
    ebayFees: fees,
    netProfit: netProfit,
    source: 'auto_parts_pricing',
    factors: {
      category: 'auto_parts',
      brand: enhancedItemData.brand,
      condition: condition,
      basePricing: pricingTier.base
    },
    note: 'Auto parts pricing - condition is critical for value'
  };
}

/**
 * Standard category pricing (non-vehicles)
 */
function getStandardCategoryPricing(enhancedItemData, condition) {
  const { detectedCategory, pricingTier } = enhancedItemData;
  
  console.log(`Standard category pricing for ${detectedCategory}`);
  
  let basePrice = pricingTier.base;
  
  // Category-specific brand multipliers - multipliers relative to base price
  const categoryBrandMultipliers = {
    // Laptop brands - applied to $250 base
    'laptop': {
      'apple': 1.8, 'microsoft': 1.3, 'dell': 0.9, 'hp': 0.85,
      'lenovo': 0.95, 'asus': 0.8, 'acer': 0.7
    },
    // Desktop brands - applied to $180 base
    'desktop': {
      'apple': 1.6, 'hp': 0.8, 'dell': 0.85, 'lenovo': 0.8
    },
    // Tablet brands - applied to $150 base
    'tablet': {
      'apple': 1.8, 'samsung': 0.9, 'microsoft': 1.2, 'amazon': 0.5
    },
    // Smartphone brands - applied to $120 base
    'smartphone': {
      'apple': 1.8, 'samsung': 0.95, 'google': 0.85, 'oneplus': 0.7
    },
    // Gaming console brands - applied to $150 base
    'gaming_console': {
      'sony': 1.1, 'microsoft': 1.0, 'nintendo': 1.3
    },
    // Camera brands - applied to $150 base
    'camera': {
      'canon': 1.1, 'nikon': 1.1, 'sony': 1.3, 'fujifilm': 1.2, 'gopro': 0.9
    },
    // Audio brands - applied to $50 base
    'audio': {
      'apple': 1.4, 'bose': 1.3, 'sony': 1.2, 'jbl': 1.0, 'beats': 1.1
    },
    // Generic electronics - applied to $30 base
    'electronics': {
      'apple': 1.3, 'samsung': 0.9, 'sony': 1.0, 'lg': 0.85
    },
    'clothing': {
      'nike': 0.9, 'adidas': 0.85, 'levi': 0.95, 'gucci': 2.0,
      'coach': 1.5, 'ralph lauren': 1.1, 'calvin klein': 1.0,
      'tommy hilfiger': 0.9, 'gap': 0.8, 'old navy': 0.6
    },
    'footwear': {
      'nike': 1.1, 'jordan': 1.6, 'adidas': 0.95, 'converse': 0.8,
      'vans': 0.75, 'puma': 0.85, 'new balance': 0.9, 'skechers': 0.7
    },
    'furniture': {
      'west elm': 0.9, 'pottery barn': 0.95, 'restoration hardware': 1.1,
      'cb2': 0.8, 'crate & barrel': 0.85, 'ikea': 0.4, 'wayfair': 0.6
    },
    'tools': {
      'dewalt': 1.2, 'milwaukee': 1.15, 'makita': 1.1, 'craftsman': 0.9,
      'ryobi': 0.75, 'black & decker': 0.7, 'porter cable': 0.85
    },
    'sporting goods': {
      'nike': 1.0, 'adidas': 0.95, 'under armour': 0.9, 'wilson': 0.85,
      'spalding': 0.8, 'callaway': 1.1, 'titleist': 1.2
    },
    'jewelry': {
      'tiffany': 2.0, 'cartier': 2.5, 'rolex': 3.0, 'omega': 2.0,
      'tag heuer': 1.6, 'citizen': 1.0, 'seiko': 0.95, 'fossil': 0.8
    }
  };
  
  // Apply brand multiplier
  const brandMultipliers = categoryBrandMultipliers[detectedCategory] || {};
  const brand = enhancedItemData.brand?.toLowerCase();
  
  if (brand && brandMultipliers[brand]) {
    basePrice *= brandMultipliers[brand];
    console.log(`Applied ${detectedCategory} brand multiplier for ${brand}: ${brandMultipliers[brand]}`);
  } else if (enhancedItemData.brand && enhancedItemData.brand !== 'Unknown') {
    basePrice *= 1.1; // Generic brand bonus
  }
  
  // Standard condition multipliers - balanced for resale market
  const conditionMultipliers = {
    'excellent': 1.0,   // Like new, minimal wear
    'good': 0.85,       // Normal wear, fully functional
    'fair': 0.65,       // Visible wear, functional
    'poor': 0.40,       // Heavy wear, may need repair
    'parts_only': 0.20  // For non-functional items
  };
  
  basePrice *= (conditionMultipliers[condition] || 0.75);

  // Additional adjustments
  if (enhancedItemData.condition?.usableAsIs === false) {
    basePrice *= 0.6; // Needs repair
  }

  if (enhancedItemData.model && enhancedItemData.model !== 'Unknown') {
    basePrice *= 1.05; // Known model bonus
  }

  // Quantity adjustment - multiply price for sets/multiple items
  const itemCount = enhancedItemData.itemCount || 1;
  const isSet = enhancedItemData.isSet === true;
  if (itemCount > 1 && isSet) {
    // Sets are worth more than single items but not a straight multiplier
    // A pair of chairs might be 1.8x a single chair, not 2x
    const quantityMultiplier = 1 + ((itemCount - 1) * 0.85);
    basePrice *= quantityMultiplier;
    console.log(`Applied quantity multiplier for set of ${itemCount}: ${quantityMultiplier.toFixed(2)}x`);
  }

  // Size category adjustment - miniatures are worth less than full-size
  const sizeCategory = enhancedItemData.sizeCategory || 'full-size';
  if (sizeCategory === 'miniature') {
    // Miniatures/toys typically worth 5-20% of full-size equivalent
    basePrice *= 0.15;
    console.log(`Applied miniature size adjustment: 0.15x`);
  }
  
  // Special category adjustments
  if (detectedCategory === 'furniture') {
    // IKEA gets realistic pricing
    if (brand && brand.includes('ikea')) {
      basePrice *= 0.7; // IKEA furniture depreciates more
      console.log('Applied IKEA furniture depreciation factor');
    }
    
    // Size-based adjustments for furniture
    const description = enhancedItemData.description?.toLowerCase() || '';
    if (description.includes('side table') || description.includes('nightstand')) {
      basePrice *= 0.8; // Smaller furniture
    } else if (description.includes('dining') || description.includes('sofa')) {
      basePrice *= 1.2; // Larger furniture
    }
  }
  
  const suggestedPrice = validatePriceEstimate(Math.round(basePrice), enhancedItemData);
  const shippingCost = pricingTier.shippingCost;
  const fees = calculateCategoryFees(suggestedPrice, detectedCategory);
  const netProfit = Math.round((suggestedPrice - fees - shippingCost) * 100) / 100;
  
  return {
    suggested: suggestedPrice,
    confidence: 'medium',
    priceRange: {
      low: Math.round(suggestedPrice * 0.7),
      high: Math.round(suggestedPrice * 1.4),
      median: suggestedPrice
    },
    shippingCost: shippingCost,
    ebayFees: fees,
    netProfit: netProfit,
    source: `${detectedCategory}_category_pricing`,
    factors: {
      category: detectedCategory,
      brand: enhancedItemData.brand,
      condition: condition,
      basePricing: pricingTier.base
    },
    note: `Enhanced ${detectedCategory} pricing with brand recognition and condition assessment`
  };
}

/**
 * Enhanced shipping cost calculation with size awareness
 */
function estimateShippingByCategory(category, itemData = {}) {
  const detectedCategory = detectItemCategory(itemData);
  const pricingTier = getPricingTier(itemData);
  
  // Use the pricing tier's shipping cost (already calculated based on category)
  return pricingTier.shippingCost;
}

/**
 * Calculate eBay fees using the enhanced category system
 */
function calculateEbayFees(salePrice, itemData = {}) {
  const detectedCategory = detectItemCategory(itemData);
  return calculateCategoryFees(salePrice, detectedCategory);
}

/**
 * Comprehensive price validation with logging
 */
function validateItemPrice(price, itemData, source = 'unknown') {
  const originalPrice = price;
  const validatedPrice = validatePriceEstimate(price, itemData);
  
  if (originalPrice !== validatedPrice) {
    console.log(`Price validation: ${source} suggested ${originalPrice}, adjusted to ${validatedPrice} for ${itemData.category}`);
  }
  
  return validatedPrice;
}

/**
 * Get comprehensive pricing information for an item
 */
async function getComprehensivePricing(itemData, options = {}) {
  const results = {};
  
  try {
    // Get manual estimate
    results.manual = await estimatePrice(itemData, { ...options, source: 'manual' });
  } catch (error) {
    console.error('Manual pricing failed:', error.message);
    results.manual = { error: error.message };
  }
  
  try {
    // Get eBay estimate if configured
    if (options.ebayConfig) {
      results.ebay = await estimatePrice(itemData, { ...options, source: 'ebay' });
    }
  } catch (error) {
    console.error('eBay pricing failed:', error.message);
    results.ebay = { error: error.message };
  }
  
  // Determine best estimate
  if (results.ebay && results.ebay.suggested && results.ebay.confidence === 'high') {
    results.recommended = results.ebay;
    results.recommendedSource = 'ebay';
  } else if (results.manual && results.manual.suggested) {
    results.recommended = results.manual;
    results.recommendedSource = 'manual';
  } else {
    results.recommended = {
      suggested: 15,
      confidence: 'low',
      source: 'fallback',
      note: 'All pricing methods failed - using fallback estimate'
    };
    results.recommendedSource = 'fallback';
  }
  
  return results;
}

/**
 * Price estimation with confidence scoring
 */
function calculatePriceConfidence(itemData, priceResult) {
  let confidence = 0;
  
  // Brand recognition adds confidence
  if (itemData.brand && itemData.brand !== 'Unknown') {
    confidence += 2;
  }
  
  // Model recognition adds confidence
  if (itemData.model && itemData.model !== 'Unknown') {
    confidence += 1;
  }
  
  // Clear condition assessment adds confidence
  if (itemData.condition && itemData.condition.rating) {
    confidence += 2;
  }
  
  // Price within reasonable range adds confidence
  const detectedCategory = detectItemCategory(itemData);
  const pricingTier = getPricingTier(itemData);
  
  if (priceResult.suggested >= pricingTier.min && priceResult.suggested <= pricingTier.max) {
    confidence += 3;
  }
  
  // Market data source adds confidence
  if (priceResult.source && priceResult.source.includes('ebay')) {
    confidence += 2;
  }
  
  // Convert to descriptive confidence level
  if (confidence >= 8) return 'very_high';
  if (confidence >= 6) return 'high';
  if (confidence >= 4) return 'medium';
  if (confidence >= 2) return 'low';
  return 'very_low';
}

// Export all functions for compatibility and testing
module.exports = {
  estimatePrice,
  getCategoryAwareManualEstimate,
  getVehiclePricing,
  getAutoPartsPricing,
  getStandardCategoryPricing,
  estimateShippingByCategory,
  calculateEbayFees,
  validateItemPrice,
  getComprehensivePricing,
  calculatePriceConfidence
};

// Also support ES6 imports for modern environments
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS export (current)
  module.exports.default = estimatePrice;
} else if (typeof exports !== 'undefined') {
  // ES6 export fallback
  exports.estimatePrice = estimatePrice;
  exports.getCategoryAwareManualEstimate = getCategoryAwareManualEstimate;
  exports.estimateShippingByCategory = estimateShippingByCategory;
  exports.calculateEbayFees = calculateEbayFees;
}