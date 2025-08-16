// functions/capture-sdk/utils/priceEstimate.js
// Enhanced price estimation with better shipping calculations

/**
 * Main price estimation function (this is what routeDisposition.js expects)
 */
export async function estimatePrice(itemData, options = {}) {
  const {
    source = 'manual', // ebay, manual, ml-model
    includeShipping = false,
    condition = itemData.condition?.rating || 'good'
  } = options;

  switch (source) {
    case 'ebay':
      // This will be handled by routeDisposition.js directly
      return await getEbayPricing(itemData, condition);
    case 'manual':
      return getEnhancedManualEstimate(itemData, condition);
    case 'ml-model':
      return await getMLEstimate(itemData);
    default:
      return getEnhancedManualEstimate(itemData, condition);
  }
}

/**
 * eBay pricing function (fallback - mainly for compatibility)
 */
async function getEbayPricing(itemData, condition) {
  try {
    // This is a fallback - the real eBay logic is now in routeDisposition.js
    console.log('eBay pricing called from priceEstimate.js - using manual fallback');
    return getEnhancedManualEstimate(itemData, condition);
  } catch (error) {
    console.error('eBay pricing error:', error);
    return getEnhancedManualEstimate(itemData, condition);
  }
}

/**
 * ML estimation placeholder
 */
async function getMLEstimate(itemData) {
  console.log('ML price estimation for:', itemData);
  return getEnhancedManualEstimate(itemData, itemData.condition?.rating || 'good');
}

/**
 * Estimate shipping cost by item category with size awareness
 */
function estimateShippingByCategory(category, itemData = {}) {
  const categoryLower = category?.toLowerCase() || 'unknown';
  
  // Size-based shipping for different item types
  const shippingEstimates = {
    // Electronics - varies by size
    'electronics': () => {
      const brand = itemData.brand?.toLowerCase();
      const model = itemData.model?.toLowerCase();
      
      // Phones/tablets
      if (model?.includes('phone') || model?.includes('iphone') || model?.includes('galaxy')) {
        return 8;
      }
      // Laptops
      if (model?.includes('macbook') || model?.includes('laptop')) {
        return 15;
      }
      // Game consoles
      if (brand?.includes('nintendo') || brand?.includes('playstation') || brand?.includes('xbox')) {
        return 18;
      }
      // Default electronics
      return 12;
    },
    
    // Books - weight based
    'books': () => 5,
    'book': () => 5,
    
    // Clothing - lightweight
    'clothing': () => 8,
    'apparel': () => 8,
    'clothes': () => 8,
    
    // Footwear - size dependent
    'footwear': () => 12,
    'shoes': () => 12,
    'sneakers': () => 12,
    'boots': () => 15,
    
    // Tools - weight dependent
    'tools': () => {
      const model = itemData.model?.toLowerCase() || '';
      const description = itemData.description?.toLowerCase() || '';
      
      // Power tools are heavier
      if (model.includes('drill') || model.includes('saw') || description.includes('power')) {
        return 20;
      }
      // Hand tools
      return 15;
    },
    'tool': () => 15,
    
    // Furniture - FIXED: Size-aware pricing
    'furniture': () => {
      const model = itemData.model?.toLowerCase() || '';
      const description = itemData.description?.toLowerCase() || '';
      
      // Small items (side tables, nightstands, small shelves)
      if (description.includes('side table') || description.includes('end table') || 
          description.includes('nightstand') || description.includes('small')) {
        return 25; // Reduced from 50
      }
      // Medium items (chairs, coffee tables)
      if (description.includes('chair') || description.includes('coffee table')) {
        return 35;
      }
      // Large items (sofas, dining tables, dressers)
      if (description.includes('sofa') || description.includes('couch') || 
          description.includes('dining') || description.includes('dresser')) {
        return 75;
      }
      // Default furniture
      return 35; // More reasonable default
    },
    
    // Sporting goods
    'sporting goods': () => 18,
    'sports': () => 18,
    'fitness': () => 20,
    
    // Toys
    'toys': () => 10,
    'toy': () => 10,
    'games': () => 10,
    
    // Jewelry - small and light
    'jewelry': () => 5,
    'watches': () => 6,
    'accessories': () => 6,
    
    // Automotive - NEW CATEGORIES
    'automotive': () => {
      const model = itemData.model?.toLowerCase() || '';
      const description = itemData.description?.toLowerCase() || '';
      
      // Small parts (filters, bulbs, sensors)
      if (description.includes('filter') || description.includes('bulb') || 
          description.includes('sensor')) {
        return 10;
      }
      // Medium parts (alternators, starters, radiators)
      if (description.includes('alternator') || description.includes('starter') || 
          description.includes('radiator')) {
        return 35;
      }
      // Large parts (bumpers, hoods, doors)
      if (description.includes('bumper') || description.includes('hood') || 
          description.includes('door')) {
        return 85;
      }
      // Wheels/tires
      if (description.includes('wheel') || description.includes('tire')) {
        return 45;
      }
      return 25;
    },
    'auto parts': () => 25,
    'car parts': () => 25,
    
    // Vehicles - SPECIAL CASE (usually local pickup only)
    'automobile': () => 0, // Local pickup
    'car': () => 0,
    'vehicle': () => 0,
    'motorcycle': () => 0,
    'boat': () => 0,
    
    // Home & Garden
    'home & garden': () => 15,
    'home': () => 15,
    'garden': () => 18,
    'kitchen': () => 12,
    
    // Art & Collectibles
    'art': () => 15,
    'collectibles': () => 10,
    'antiques': () => 20,
    
    // Music
    'musical instruments': () => {
      const model = itemData.model?.toLowerCase() || '';
      
      // Large instruments
      if (model.includes('piano') || model.includes('keyboard') || model.includes('drum')) {
        return 45;
      }
      // Guitars
      if (model.includes('guitar') || model.includes('bass')) {
        return 25;
      }
      // Small instruments
      return 15;
    },
    'music': () => 8,
    'cds': () => 5,
    'vinyl': () => 8,
    
    // Default fallback
    'unknown': () => 12,
    'other': () => 12,
    'misc': () => 12,
    'miscellaneous': () => 12
  };

  // Find the shipping estimate function
  const estimator = shippingEstimates[categoryLower] || shippingEstimates['unknown'];
  
  // Call the function to get the shipping cost
  return typeof estimator === 'function' ? estimator() : estimator;
}

/**
 * Enhanced manual estimation with better category intelligence
 */
function getEnhancedManualEstimate(itemData, condition) {
  console.log('Using enhanced category-based pricing...');
  console.log('Item category:', itemData.category);
  console.log('Item details:', { brand: itemData.brand, model: itemData.model });

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
    
    // Footwear
    'footwear': {
      base: 25,
      brandMultipliers: {
        'Nike': 2.0,
        'Jordan': 2.5,
        'Adidas': 1.8,
        'Converse': 1.3,
        'Vans': 1.2,
        'Generic': 0.7
      }
    },
    
    // Automotive - NEW
    'automotive': {
      base: 40,
      brandMultipliers: {
        'OEM': 1.5,
        'AC Delco': 1.3,
        'Bosch': 1.4,
        'Motorcraft': 1.3,
        'Generic': 0.8
      }
    },
    
    // Vehicles (special case - high value)
    'automobile': {
      base: 5000, // Base for cars
      brandMultipliers: {
        'Tesla': 2.0,
        'BMW': 1.8,
        'Mercedes': 1.9,
        'Lexus': 1.7,
        'Toyota': 1.3,
        'Honda': 1.2,
        'Ford': 1.0,
        'Chevrolet': 1.0,
        'Dodge': 0.9,
        'Generic': 0.7
      }
    },
    'car': { base: 5000, brandMultipliers: {} }, // Alias for automobile
    'vehicle': { base: 5000, brandMultipliers: {} },
    
    // Default categories
    'books': { base: 8, brandMultipliers: {} },
    'sporting goods': { base: 20, brandMultipliers: {} },
    'toys': { base: 12, brandMultipliers: {} },
    'jewelry': { base: 35, brandMultipliers: {} },
    'home & garden': { base: 18, brandMultipliers: {} },
    'collectibles': { base: 25, brandMultipliers: {} },
    'art': { base: 50, brandMultipliers: {} },
    'musical instruments': { base: 75, brandMultipliers: {} }
  };

  const category = itemData.category?.toLowerCase() || 'unknown';
  const pricing = categoryPricing[category] || { base: 20, brandMultipliers: {} };
  
  let basePrice = pricing.base;
  
  // Apply brand multiplier if available
  if (itemData.brand && pricing.brandMultipliers[itemData.brand]) {
    basePrice *= pricing.brandMultipliers[itemData.brand];
  }
  
  // Apply condition multiplier
  let conditionRating = condition;
  if (typeof condition === 'number') {
    if (condition >= 8) conditionRating = 'excellent';
    else if (condition >= 6) conditionRating = 'good';
    else if (condition >= 4) conditionRating = 'fair';
    else conditionRating = 'poor';
  }
  
  const conditionMultipliers = {
    'excellent': 1.0,
    'good': 0.85,
    'fair': 0.65,
    'poor': 0.35
  };
  
  const conditionMultiplier = conditionMultipliers[conditionRating] || 0.75;
  basePrice *= conditionMultiplier;
  
  // Additional adjustments
  if (itemData.condition?.usableAsIs === false) {
    basePrice *= 0.6; // 40% reduction for items needing repair
  }
  
  if (itemData.model && itemData.model !== 'Unknown') {
    basePrice *= 1.1; // 10% bonus for known model
  }
  
  // Special handling for vehicles
  if (['automobile', 'car', 'vehicle'].includes(category)) {
    // Adjust for year if available
    const currentYear = new Date().getFullYear();
    const description = itemData.description?.toLowerCase() || '';
    const yearMatch = description.match(/\b(19|20)\d{2}\b/);
    
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      const age = currentYear - year;
      
      // Depreciation curve
      if (age <= 1) basePrice *= 0.85;
      else if (age <= 3) basePrice *= 0.7;
      else if (age <= 5) basePrice *= 0.55;
      else if (age <= 10) basePrice *= 0.35;
      else if (age <= 20) basePrice *= 0.2;
      else basePrice *= 0.15; // Classic/vintage
      
      // Classic car bonus (25+ years)
      if (age >= 25 && conditionRating === 'excellent') {
        basePrice *= 1.5; // Classic car premium
      }
    }
  }

  const suggestedPrice = Math.round(basePrice);
  
  // Calculate shipping with enhanced logic
  const shippingCost = estimateShippingByCategory(category, itemData);
  
  // Calculate eBay fees
  const ebayFees = calculateEbayFees(suggestedPrice);
  
  // Calculate net profit
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
    note: category === 'automobile' ? 'Vehicle pricing - typically local pickup only' : 'Based on enhanced category analysis and brand recognition'
  };
}

/**
 * Calculate eBay fees (final value fee + payment processing)
 */
function calculateEbayFees(salePrice) {
  if (!salePrice) return 0;

  // eBay final value fee: ~13.25% for most categories
  // Vehicles have different fee structure (capped)
  let finalValueFee;
  
  if (salePrice > 1000) {
    // Vehicle fee structure (capped at $900)
    finalValueFee = Math.min(salePrice * 0.035, 900);
  } else {
    // Standard fee structure
    finalValueFee = salePrice * 0.1325;
  }
  
  // Payment processing fee: ~2.9% + $0.30
  const paymentFee = (salePrice * 0.029) + 0.30;
  
  return Math.round((finalValueFee + paymentFee) * 100) / 100;
}

// Also export the enhanced functions for compatibility
export {
  getEnhancedManualEstimate,
  estimateShippingByCategory,
  calculateEbayFees
};