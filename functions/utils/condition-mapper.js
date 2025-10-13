// utils/condition-mapper.js
// eBay condition mapping and validation utilities with price adjustments

/**
 * Map internal condition to eBay ConditionEnum values
 */
function mapConditionToEbay(condition) {
  console.log('Mapping condition to eBay ConditionEnum:', { input: condition, type: typeof condition });
  
  let normalizedCondition = condition;
  
  // Handle object conditions (e.g., { rating: 'good' })
  if (typeof condition === 'object' && condition !== null) {
    normalizedCondition = condition.rating || condition.condition || 'good';
  }
  
  const conditionKey = String(normalizedCondition).toLowerCase().trim();
  
  // Use only valid eBay Inventory API ConditionEnum values
  const conditionMap = {
    // New conditions
    'new': 'NEW',
    'like_new': 'LIKE_NEW',
    'like new': 'LIKE_NEW',
    'new_other': 'NEW_OTHER',
    'new other': 'NEW_OTHER',
    'new_with_defects': 'NEW_WITH_DEFECTS',
    'new with defects': 'NEW_WITH_DEFECTS',
    
    // Refurbished conditions
    'certified_refurbished': 'CERTIFIED_REFURBISHED',
    'certified refurbished': 'CERTIFIED_REFURBISHED',
    'excellent_refurbished': 'EXCELLENT_REFURBISHED',
    'excellent refurbished': 'EXCELLENT_REFURBISHED',
    'very_good_refurbished': 'VERY_GOOD_REFURBISHED',
    'very good refurbished': 'VERY_GOOD_REFURBISHED',
    'good_refurbished': 'GOOD_REFURBISHED',
    'good refurbished': 'GOOD_REFURBISHED',
    'seller_refurbished': 'SELLER_REFURBISHED',
    'seller refurbished': 'SELLER_REFURBISHED',
    'refurbished': 'SELLER_REFURBISHED',
    
    // Used conditions
    'excellent': 'USED_EXCELLENT',
    'used_excellent': 'USED_EXCELLENT',
    'used excellent': 'USED_EXCELLENT',
    'very_good': 'USED_VERY_GOOD',
    'very good': 'USED_VERY_GOOD',
    'used_very_good': 'USED_VERY_GOOD',
    'used very good': 'USED_VERY_GOOD',
    'good': 'USED_GOOD',
    'used_good': 'USED_GOOD',
    'used good': 'USED_GOOD',
    'used': 'USED_GOOD',
    'acceptable': 'USED_ACCEPTABLE',
    'used_acceptable': 'USED_ACCEPTABLE',
    'used acceptable': 'USED_ACCEPTABLE',
    'fair': 'USED_ACCEPTABLE',
    
    // Non-working conditions
    'poor': 'FOR_PARTS_OR_NOT_WORKING',
    'for_parts': 'FOR_PARTS_OR_NOT_WORKING',
    'for parts': 'FOR_PARTS_OR_NOT_WORKING',
    'broken': 'FOR_PARTS_OR_NOT_WORKING',
    'damaged': 'FOR_PARTS_OR_NOT_WORKING',
    'not_working': 'FOR_PARTS_OR_NOT_WORKING',
    'not working': 'FOR_PARTS_OR_NOT_WORKING',
    'for_parts_or_not_working': 'FOR_PARTS_OR_NOT_WORKING'
  };
  
  const mappedCondition = conditionMap[conditionKey] || 'USED_GOOD';
  
  console.log('Condition mapped to ConditionEnum:', { 
    input: condition, 
    normalized: conditionKey, 
    output: mappedCondition
  });
  
  return mappedCondition;
}

/**
 * Validate that condition is a valid eBay ConditionEnum
 */
function isValidEbayCondition(condition) {
  const validConditions = [
    'NEW', 'LIKE_NEW', 'NEW_OTHER', 'NEW_WITH_DEFECTS',
    'CERTIFIED_REFURBISHED', 'EXCELLENT_REFURBISHED', 'VERY_GOOD_REFURBISHED', 
    'GOOD_REFURBISHED', 'SELLER_REFURBISHED',
    'USED_EXCELLENT', 'USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE',
    'FOR_PARTS_OR_NOT_WORKING', 'PRE_OWNED_EXCELLENT', 'PRE_OWNED_FAIR'
  ];
  
  return validConditions.includes(condition);
}

/**
 * Format eBay condition for display
 */
function formatConditionForEbay(condition) {
  const conditionDisplay = {
    'NEW': 'New',
    'LIKE_NEW': 'Like New',
    'NEW_OTHER': 'New other (see details)',
    'NEW_WITH_DEFECTS': 'New with defects',
    'CERTIFIED_REFURBISHED': 'Certified - Refurbished',
    'EXCELLENT_REFURBISHED': 'Excellent - Refurbished',
    'VERY_GOOD_REFURBISHED': 'Very Good - Refurbished',
    'GOOD_REFURBISHED': 'Good - Refurbished',
    'SELLER_REFURBISHED': 'Seller refurbished',
    'USED_EXCELLENT': 'Used - Excellent',
    'USED_VERY_GOOD': 'Used - Very Good',
    'USED_GOOD': 'Used - Good',
    'USED_ACCEPTABLE': 'Used - Acceptable',
    'FOR_PARTS_OR_NOT_WORKING': 'For parts or not working',
    'PRE_OWNED_EXCELLENT': 'Pre-owned - Excellent',
    'PRE_OWNED_FAIR': 'Pre-owned - Fair'
  };
  
  const key = String(condition).toUpperCase().trim();
  return conditionDisplay[key] || 'Used - Good';
}

/**
 * Get eBay numeric condition ID (for Trading API)
 */
function getEbayConditionId(condition) {
  const normalizedCondition = condition?.toLowerCase()?.trim();

  // Map normalized strings to correct eBay numeric IDs
  const conditionIdMap = {
    'new': 1000,
    'like_new': 1500,
    'new other': 1750,
    'new_other': 1750,
    'new with defects': 2000,
    'new_with_defects': 2000,
    'certified refurbished': 2500,
    'certified_refurbished': 2500,
    'excellent refurbished': 2750,
    'excellent_refurbished': 2750,
    'very good refurbished': 3000,
    'very_good_refurbished': 3000,
    'good refurbished': 4000,
    'good_refurbished': 4000,
    'seller refurbished': 5000,
    'seller_refurbished': 5000,
    'used': 3000,
    'excellent': 3000,
    'used_excellent': 3000,
    'used excellent': 3000,
    'very_good': 3000,
    'used_very_good': 3000,
    'used very good': 3000,
    'good': 3000,
    'used_good': 3000,
    'used good': 3000,
    'acceptable': 3000,
    'used_acceptable': 3000,
    'used acceptable': 3000,
    'fair': 3000,
    'poor': 7000,
    'for_parts': 7000,
    'for parts': 7000,
    'broken': 7000,
    'damaged': 7000,
    'not_working': 7000,
    'not working': 7000,
    'for_parts_or_not_working': 7000,
  };

  // Return the mapped ID or a fallback
  return conditionIdMap[normalizedCondition] || 3000; // Default to 'Used - Good'
}

/**
 * Get price adjustment factor based on condition (NEW FUNCTION)
 * Returns multiplier to apply to base/new price
 */
function getConditionPriceAdjustment(condition) {
  const normalizedCondition = condition?.toLowerCase()?.trim();
  
  // Handle object conditions
  let conditionString = normalizedCondition;
  if (typeof condition === 'object' && condition !== null) {
    conditionString = (condition.rating || condition.condition || 'good').toLowerCase().trim();
  }

  // Price adjustment factors (percentage of original/new price)
  const adjustmentFactors = {
    // New conditions (100% - 95%)
    'new': 1.00,
    'like_new': 0.95,
    'like new': 0.95,
    'new_other': 0.90,
    'new other': 0.90,
    'new_with_defects': 0.85,
    'new with defects': 0.85,
    
    // Refurbished conditions (90% - 70%)
    'certified_refurbished': 0.90,
    'certified refurbished': 0.90,
    'excellent_refurbished': 0.85,
    'excellent refurbished': 0.85,
    'very_good_refurbished': 0.80,
    'very good refurbished': 0.80,
    'good_refurbished': 0.75,
    'good refurbished': 0.75,
    'seller_refurbished': 0.70,
    'seller refurbished': 0.70,
    'refurbished': 0.70,
    
    // Used conditions (80% - 35%)
    'excellent': 0.80,
    'used_excellent': 0.80,
    'used excellent': 0.80,
    'very_good': 0.75,
    'very good': 0.75,
    'used_very_good': 0.75,
    'used very good': 0.75,
    'good': 0.65,         // KEY: "Good" condition = 65% of new price
    'used_good': 0.65,
    'used good': 0.65,
    'used': 0.65,
    'acceptable': 0.50,
    'used_acceptable': 0.50,
    'used acceptable': 0.50,
    'fair': 0.45,
    
    // Non-working conditions (35% - 15%)
    'poor': 0.35,
    'for_parts': 0.25,
    'for parts': 0.25,
    'broken': 0.20,
    'damaged': 0.25,
    'not_working': 0.15,
    'not working': 0.15,
    'for_parts_or_not_working': 0.20
  };
  
  const adjustment = adjustmentFactors[conditionString] || 0.65; // Default to "good" condition
  
  console.log('Condition price adjustment:', {
    input: condition,
    normalized: conditionString,
    adjustment: adjustment,
    percentage: `${(adjustment * 100).toFixed(0)}%`
  });
  
  return adjustment;
}

/**
 * Calculate adjusted price based on condition (NEW FUNCTION)
 */
function calculateConditionAdjustedPrice(basePrice, condition) {
  if (!basePrice || typeof basePrice !== 'number' || basePrice <= 0) {
    console.warn('Invalid base price for condition adjustment:', basePrice);
    return basePrice || 0;
  }

  const adjustment = getConditionPriceAdjustment(condition);
  const adjustedPrice = basePrice * adjustment;
  
  console.log('Price adjustment calculation:', {
    basePrice: basePrice,
    condition: condition,
    adjustment: adjustment,
    adjustedPrice: adjustedPrice,
    difference: basePrice - adjustedPrice
  });
  
  return Math.round(adjustedPrice * 100) / 100; // Round to 2 decimal places
}

/**
 * Get condition quality score for comparison (NEW FUNCTION)
 * Returns 0-100 score where 100 = new condition
 */
function getConditionQualityScore(condition) {
  const adjustment = getConditionPriceAdjustment(condition);
  return Math.round(adjustment * 100);
}

/**
 * Compare two conditions and return which is better (NEW FUNCTION)
 */
function compareConditions(condition1, condition2) {
  const score1 = getConditionQualityScore(condition1);
  const score2 = getConditionQualityScore(condition2);
  
  if (score1 > score2) return 1;   // condition1 is better
  if (score1 < score2) return -1;  // condition2 is better
  return 0;                        // conditions are equivalent
}

/**
 * Get price range based on condition uncertainty (NEW FUNCTION)
 */
function getConditionPriceRange(basePrice, condition, uncertainty = 0.1) {
  const adjustedPrice = calculateConditionAdjustedPrice(basePrice, condition);
  const margin = adjustedPrice * uncertainty;
  
  return {
    low: Math.round((adjustedPrice - margin) * 100) / 100,
    high: Math.round((adjustedPrice + margin) * 100) / 100,
    suggested: adjustedPrice
  };
}

/**
 * Validate condition adjustment calculation (NEW FUNCTION)
 */
function validateConditionPricing(originalPrice, adjustedPrice, condition) {
  const expectedAdjustment = getConditionPriceAdjustment(condition);
  const actualAdjustment = adjustedPrice / originalPrice;
  const tolerance = 0.05; // 5% tolerance
  
  const isValid = Math.abs(actualAdjustment - expectedAdjustment) <= tolerance;
  
  return {
    isValid,
    expectedAdjustment,
    actualAdjustment,
    difference: Math.abs(actualAdjustment - expectedAdjustment),
    tolerance
  };
}

/**
 * Enhanced condition mapping for market analysis (NEW FUNCTION)
 */
function getMarketConditionEquivalents(condition) {
  const normalizedCondition = condition?.toLowerCase()?.trim();
  
  // Handle object conditions
  let conditionString = normalizedCondition;
  if (typeof condition === 'object' && condition !== null) {
    conditionString = (condition.rating || condition.condition || 'good').toLowerCase().trim();
  }

  // Map to equivalent conditions for market search
  const equivalents = {
    'new': ['new', 'brand new'],
    'like_new': ['like new', 'mint', 'pristine'],
    'excellent': ['excellent', 'mint'],
    'very_good': ['very good', 'great'],
    'good': ['good', 'fair'],
    'acceptable': ['acceptable', 'fair', 'ok'],
    'fair': ['fair', 'acceptable'],
    'poor': ['poor', 'rough', 'worn'],
    'for_parts': ['for parts', 'parts only', 'broken', 'not working']
  };

  return equivalents[conditionString] || ['used'];
}

module.exports = {
  mapConditionToEbay,
  isValidEbayCondition,
  formatConditionForEbay,
  getEbayConditionId,
  
  // NEW: Price adjustment functions
  getConditionPriceAdjustment,
  calculateConditionAdjustedPrice,
  getConditionQualityScore,
  compareConditions,
  getConditionPriceRange,
  validateConditionPricing,
  getMarketConditionEquivalents
};