// capture-sdk/utils/priceEstimate.js
// Enhanced price estimation with real eBay data integration

// Import will be done dynamically to avoid circular imports

export async function estimatePrice(itemData, options = {}) {
  const {
    source = 'ebay', // ebay, manual, ml-model
    includeShipping = false,
    condition = itemData.condition?.rating || 'good',
    ebayConfig = null
  } = options;

  console.log(`Estimating price for ${itemData.category} using ${source} method`);

  switch (source) {
    case 'ebay':
      return await getEbayPricing(itemData, condition, ebayConfig, includeShipping);
    case 'manual':
      return getManualEstimate(itemData);
    case 'ml-model':
      return await getMLEstimate(itemData);
    default:
      return getManualEstimate(itemData);
  }
}

/**
 * Get pricing data from eBay using Browse API
 */
async function getEbayPricing(itemData, condition, ebayConfig, includeShipping) {
  console.log('getEbayPricing called with:', {
    hasEbayConfig: !!ebayConfig,
    clientId: ebayConfig?.clientId ? 'present' : 'missing',
    clientSecret: ebayConfig?.clientSecret ? 'present' : 'missing',
    condition,
    category: itemData.category
  });
  
  if (!ebayConfig || !ebayConfig.clientId || !ebayConfig.clientSecret) {
    console.warn('No eBay config provided, falling back to manual estimate');
    return getEnhancedManualEstimate(itemData, condition);
  }

  try {
    // Use the simple working approach instead of the complex EbaySearchAPI
    const { SimpleEbayAPI } = await import('../integrations/ebay/simpleAPI.js');
    const ebayAPI = new SimpleEbayAPI(ebayConfig);
    
    // Get pricing data
    const pricingData = await ebayAPI.getPricing(itemData);
    
    if (!pricingData.suggested) {
      return {
        ...getEnhancedManualEstimate(itemData, condition),
        source: 'manual_fallback',
        reason: pricingData.reason || 'No eBay pricing data available'
      };
    }

    // Calculate additional costs
    const shippingCost = includeShipping ? estimateShippingCost(itemData, pricingData.comparableItems || []) : 0;
    const ebayFees = calculateEbayFees(pricingData.suggested);
    const netProfit = pricingData.suggested - ebayFees - shippingCost;

    return {
      suggested: pricingData.suggested,
      confidence: pricingData.confidence,
      priceRange: {
        low: Math.round(pricingData.priceRange.min * getConditionMultiplier(condition)),
        high: Math.round(pricingData.priceRange.max * getConditionMultiplier(condition)),
        median: Math.round(pricingData.priceRange.median)
      },
      marketData: {
        activeListings: pricingData.sampleSize,
        searchQuery: pricingData.searchQuery,
        sampleSize: pricingData.sampleSize
      },
      shippingCost,
      netProfit,
      ebayFees,
      comparableItems: pricingData.comparableItems,
      source: 'ebay_api',
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('eBay pricing failed:', error);
    return {
      ...getEnhancedManualEstimate(itemData, condition),
      source: 'manual_fallback',
      reason: `eBay API error: ${error.message}`
    };
  }
}

/**
 * Map internal condition rating to eBay condition filter
 */
function mapConditionToEbay(condition) {
  const conditionMap = {
    'excellent': 'excellent',
    'good': 'good',
    'fair': 'acceptable',
    'poor': 'for_parts'
  };
  
  return conditionMap[condition] || 'good';
}

/**
 * Adjust price based on item condition
 */
function adjustPriceForCondition(basePrice, condition, usableAsIs = true) {
  if (!basePrice) return 0;

  const conditionMultiplier = getConditionMultiplier(condition);
  let adjustedPrice = basePrice * conditionMultiplier;

  // Additional adjustment if item is not usable as-is
  if (!usableAsIs) {
    adjustedPrice *= 0.6; // 40% reduction for items needing repair
  }

  return Math.round(adjustedPrice);
}

/**
 * Get condition-based price multiplier
 */
function getConditionMultiplier(condition) {
  const multipliers = {
    'excellent': 1.0,
    'good': 0.85,
    'fair': 0.65,
    'poor': 0.35
  };
  
  return multipliers[condition] || 0.75;
}

/**
 * Estimate shipping cost based on item data and comparable listings
 */
function estimateShippingCost(itemData, comparableListings) {
  // Extract shipping costs from comparable listings
  const shippingCosts = comparableListings
    .map(item => item.shippingCost)
    .filter(cost => cost > 0);

  if (shippingCosts.length > 0) {
    // Use median shipping cost from comparable items
    const sortedCosts = shippingCosts.sort((a, b) => a - b);
    return sortedCosts[Math.floor(sortedCosts.length / 2)];
  }

  // Fallback to category-based estimate
  return estimateShippingByCategory(itemData.category);
}

/**
 * Estimate shipping cost by item category
 */
function estimateShippingByCategory(category) {
  const shippingEstimates = {
    'electronics': 12,
    'books': 5,
    'clothing': 8,
    'tools': 15,
    'furniture': 50,
    'sporting goods': 18,
    'toys': 10,
    'jewelry': 5,
    'automotive': 25
  };

  return shippingEstimates[category?.toLowerCase()] || 12;
}

/**
 * Calculate eBay fees (final value fee + payment processing)
 */
function calculateEbayFees(salePrice) {
  if (!salePrice) return 0;

  // eBay final value fee: ~13.25% for most categories
  const finalValueFee = salePrice * 0.1325;
  
  // Payment processing fee: ~2.9% + $0.30
  const paymentFee = (salePrice * 0.029) + 0.30;
  
  return Math.round((finalValueFee + paymentFee) * 100) / 100;
}

/**
 * Calculate net profit after fees and shipping
 */
function calculateNetProfit(salePrice, shippingCost = 0) {
  if (!salePrice) return 0;

  const ebayFees = calculateEbayFees(salePrice);
  const netProfit = salePrice - ebayFees - shippingCost;
  
  return Math.round(netProfit * 100) / 100;
}

/**
 * ML-based estimation (placeholder for future implementation)
 */
async function getMLEstimate(itemData) {
  // Future: Train ML model on historical eBay data
  console.log('ML estimation not yet implemented, falling back to manual');
  return getEnhancedManualEstimate(itemData, itemData.condition?.rating || 'fair');
}

/**
 * Enhanced manual estimation with better category intelligence
 */
function getEnhancedManualEstimate(itemData, condition) {
  console.log('Using enhanced category-based pricing...');

  // More detailed category-based pricing
  const categoryPricing = {
    // Electronics with brand multipliers
    'electronics': {
      base: 45,
      brandMultipliers: {
        'Apple': 2.5,
        'Samsung': 1.8,
        'Sony': 1.6,
        'Microsoft': 1.7,
        'Nintendo': 1.9,
        'HP': 1.2,
        'Dell': 1.1,
        'Generic': 0.6
      }
    },
    
    // Tools with condition sensitivity
    'tools': {
      base: 25,
      brandMultipliers: {
        'DeWalt': 1.8,
        'Milwaukee': 1.7,
        'Makita': 1.6,
        'Craftsman': 1.3,
        'Ryobi': 1.1,
        'Generic': 0.7
      }
    },
    
    // Furniture with style awareness
    'furniture': {
      base: 35,
      brandMultipliers: {
        'West Elm': 1.5,
        'IKEA': 0.8,
        'Pottery Barn': 1.6,
        'Restoration Hardware': 2.0,
        'CB2': 1.4,
        'Generic': 0.9
      }
    },
    
    // Clothing with brand awareness
    'clothing': {
      base: 15,
      brandMultipliers: {
        'Nike': 1.8,
        'Adidas': 1.7,
        'Levi\'s': 1.4,
        'Gucci': 3.0,
        'Coach': 2.2,
        'Generic': 0.8
      }
    },
    
    // Default categories
    'books': { base: 8, brandMultipliers: {} },
    'sporting goods': { base: 20, brandMultipliers: {} },
    'toys': { base: 12, brandMultipliers: {} },
    'jewelry': { base: 35, brandMultipliers: {} },
    'automotive': { base: 40, brandMultipliers: {} },
    'home & garden': { base: 18, brandMultipliers: {} }
  };

  const category = itemData.category?.toLowerCase() || 'unknown';
  const pricing = categoryPricing[category] || { base: 20, brandMultipliers: {} };
  
  let basePrice = pricing.base;
  
  // Apply brand multiplier if available
  if (itemData.brand && pricing.brandMultipliers[itemData.brand]) {
    basePrice *= pricing.brandMultipliers[itemData.brand];
  }
  
  // Apply condition multiplier - handle both rating numbers and strings
  let conditionRating = condition;
  if (typeof condition === 'number') {
    // Convert numeric rating (1-10) to string
    if (condition >= 8) conditionRating = 'excellent';
    else if (condition >= 6) conditionRating = 'good';
    else if (condition >= 4) conditionRating = 'fair';
    else conditionRating = 'poor';
  }
  
  const conditionMultiplier = getConditionMultiplier(conditionRating);
  basePrice *= conditionMultiplier;
  
  // Additional adjustments
  if (itemData.condition?.usableAsIs === false) {
    basePrice *= 0.6; // 40% reduction for items needing repair
  }
  
  if (itemData.model && itemData.model !== 'Unknown') {
    basePrice *= 1.1; // 10% bonus for known model
  }

  const suggestedPrice = Math.round(basePrice);
  
  // Calculate shipping and fees
  const shippingCost = estimateShippingByCategory(category);
  const ebayFees = calculateEbayFees(suggestedPrice);
  const netProfit = suggestedPrice - ebayFees - shippingCost;

  return {
    suggested: suggestedPrice,
    confidence: 'medium',
    priceRange: {
      low: Math.round(suggestedPrice * 0.7),
      high: Math.round(suggestedPrice * 1.4),
      median: suggestedPrice
    },
    shippingCost,
    ebayFees,
    netProfit,
    source: 'enhanced_manual',
    factors: {
      category: pricing.base,
      brand: itemData.brand,
      condition: conditionRating,
      usableAsIs: itemData.condition?.usableAsIs !== false
    },
    note: 'Based on enhanced category analysis and brand recognition'
  };
}

/**
 * Fallback manual estimation based on category and condition
 */
function getManualEstimate(itemData) {
  // Category-based base prices
  const basePrices = {
    'electronics': 45,
    'tools': 25,
    'furniture': 30,
    'books': 8,
    'clothing': 15,
    'sporting goods': 20,
    'toys': 12,
    'jewelry': 35,
    'automotive': 40,
    'home & garden': 18
  };

  const basePrice = basePrices[itemData.category?.toLowerCase()] || 20;
  const condition = itemData.condition?.rating || 'fair';
  const conditionMultiplier = getConditionMultiplier(condition);
  
  const suggestedPrice = Math.round(basePrice * conditionMultiplier);
  
  return {
    suggested: suggestedPrice,
    confidence: 'low',
    priceRange: {
      low: Math.round(suggestedPrice * 0.7),
      high: Math.round(suggestedPrice * 1.5),
      median: suggestedPrice
    },
    source: 'manual_estimate',
    reason: 'Based on category defaults and condition assessment'
  };
}