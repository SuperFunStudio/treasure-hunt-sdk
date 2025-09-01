// utils/condition-mapper.js
// eBay condition mapping and validation utilities

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

module.exports = {
  mapConditionToEbay,
  isValidEbayCondition,
  formatConditionForEbay,
  getEbayConditionId
};