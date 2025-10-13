// capture-sdk/core/routeDisposition.js - UPDATED with vehicle detection and realistic pricing

const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
const { 
  detectItemCategory, 
  buildVehicleSearchQuery, 
  getPricingTier, 
  validatePriceEstimate,
  calculateCategoryFees
} = require('../utils/vehicle-detector');

async function routeDisposition(itemData, userPreferences = {}, ebayConfig = null) {
  console.log('🎯 routeDisposition called with enhanced vehicle detection:', {
    category: itemData.category,
    brand: itemData.brand,
    model: itemData.model,
    hasEbayConfig: !!ebayConfig
  });

  try {
    // ENHANCED: Detect vehicle category and get appropriate pricing tier
    const detectedCategory = detectItemCategory(itemData);
    const pricingTier = getPricingTier(itemData);
    
    console.log(`🔍 Detected category: ${detectedCategory} (original: ${itemData.category})`);
    console.log(`💰 Pricing tier: $${pricingTier.min}-$${pricingTier.max}, base: $${pricingTier.base}`);
    
    // Enhanced item data with detected category
    const enhancedItemData = {
      ...itemData,
      detectedCategory,
      pricingTier
    };

    // Get market pricing with category awareness
    const marketAnalysis = await getMarketPrice(enhancedItemData, ebayConfig);
    
    console.log('💰 Market analysis result:', {
      suggested: marketAnalysis.suggested,
      source: marketAnalysis.source,
      confidence: marketAnalysis.confidence,
      isVehicle: ['automobile', 'motorcycle', 'boat', 'rv'].includes(detectedCategory)
    });

    // Calculate routes based on enhanced market analysis
    const routes = calculateRoutes(enhancedItemData, marketAnalysis, userPreferences);
    
    return {
      recommendedRoute: routes.primary,
      alternativeRoutes: routes.alternatives,
      marketAnalysis: {
        estimatedValue: marketAnalysis,
        dataSource: marketAnalysis.source,
        searchQuery: marketAnalysis.searchQuery,
        confidence: marketAnalysis.confidence,
        detectedCategory: detectedCategory,
        pricingTier: pricingTier
      }
    };
  } catch (error) {
    console.error('❌ Route disposition failed:', error);
    
    // Fallback to basic routing
    return {
      recommendedRoute: {
        type: "donation",
        priority: 1,
        estimatedReturn: 0,
        timeToMoney: "immediate",
        effort: "low",
        reason: "Analysis failed, defaulting to donation"
      },
      marketAnalysis: {
        estimatedValue: {
          suggested: null,
          confidence: 'low',
          source: 'error_fallback',
          reason: error.message
        }
      }
    };
  }
}

// Enhanced market pricing with vehicle awareness
async function getMarketPrice(enhancedItemData, ebayConfig) {
  const { detectedCategory, pricingTier } = enhancedItemData;
  
  console.log(`🛒 Getting market price for ${detectedCategory} with eBay config:`, !!ebayConfig);
  
  // Special handling for vehicles
  if (['automobile', 'motorcycle', 'boat', 'rv'].includes(detectedCategory)) {
    return await getVehicleMarketPrice(enhancedItemData, ebayConfig);
  }
  
  // Standard eBay API for non-vehicles
  if (ebayConfig && ebayConfig.clientId && ebayConfig.clientSecret) {
    try {
      console.log('🛒 Attempting eBay API pricing...');
      const ebayResult = await getEbayMarketPricing(enhancedItemData, ebayConfig);
      
      if (ebayResult.suggested && ebayResult.suggested > 0) {
        // Validate price against category tier
        const validatedPrice = validatePriceEstimate(ebayResult.suggested, enhancedItemData);
        
        if (validatedPrice !== ebayResult.suggested) {
          console.log(`💡 Price adjusted from $${ebayResult.suggested} to $${validatedPrice} for category ${detectedCategory}`);
          ebayResult.suggested = validatedPrice;
          ebayResult.note += ` (Price adjusted to fit ${detectedCategory} category range)`;
        }
        
        console.log('✅ eBay API pricing successful:', ebayResult.source);
        return ebayResult;
      } else {
        console.log('⚠️ eBay API returned no valid price, falling back to manual');
      }
    } catch (error) {
      console.error('❌ eBay API failed, falling back to manual:', error.message);
    }
  } else {
    console.log('⚠️ No eBay config available, using enhanced manual pricing');
  }
  
  // Fallback to enhanced manual estimation
  return getEnhancedManualEstimate(enhancedItemData);
}

// NEW: Vehicle-specific market pricing
async function getVehicleMarketPrice(enhancedItemData, ebayConfig) {
  const { detectedCategory, pricingTier } = enhancedItemData;
  
  console.log(`🚗 Getting vehicle market price for ${detectedCategory}`);
  
  // Try eBay Motors API if configured
  if (ebayConfig && ebayConfig.clientId && ebayConfig.clientSecret) {
    try {
      const ebayResult = await getEbayMotorsPricing(enhancedItemData, ebayConfig);
      if (ebayResult.suggested && ebayResult.suggested > 0) {
        return ebayResult;
      }
    } catch (error) {
      console.error('❌ eBay Motors API failed:', error.message);
    }
  }
  
  // Fallback to enhanced vehicle estimation
  return getVehicleManualEstimate(enhancedItemData);
}

// NEW: eBay Motors specific pricing
async function getEbayMotorsPricing(enhancedItemData, ebayConfig) {
  console.log('🏁 Using eBay Motors API for vehicle pricing...');
  
  const accessToken = await getEbayAccessToken(ebayConfig);
  const query = buildVehicleSearchQuery(enhancedItemData);
  
  console.log(`🔍 eBay Motors search query: "${query}"`);
  
  // Search eBay Motors categories specifically
  const items = await searchEbayMotors(query, accessToken, ebayConfig, enhancedItemData.condition);
  
  if (items.length === 0) {
    throw new Error(`No similar vehicles found for "${query}"`);
  }
  
  // Analyze vehicle pricing
  const priceAnalysis = analyzeVehiclePricing(items, enhancedItemData.condition, query);
  
  if (!priceAnalysis) {
    throw new Error('No valid vehicle prices found in search results');
  }
  
  // Vehicle-specific fee calculation
  const vehicleFees = calculateCategoryFees(priceAnalysis.suggestedPrice, enhancedItemData.detectedCategory);
  const shippingCost = enhancedItemData.pricingTier.shippingCost; // Usually 0 for vehicles
  const netProfit = Math.round((priceAnalysis.suggestedPrice - vehicleFees - shippingCost) * 100) / 100;
  
  return {
    suggested: priceAnalysis.suggestedPrice,
    confidence: priceAnalysis.sampleSize >= 3 ? 'high' : 'medium',
    priceRange: {
      low: priceAnalysis.min,
      high: priceAnalysis.max,
      median: priceAnalysis.median,
      average: Math.round(priceAnalysis.average)
    },
    shippingCost: shippingCost,
    ebayFees: vehicleFees,
    netProfit: netProfit,
    sampleSize: priceAnalysis.sampleSize,
    searchQuery: query,
    source: 'ebay_motors_api',
    isVehicle: true,
    note: `Based on ${priceAnalysis.sampleSize} eBay Motors listings`,
    comparableItems: items.slice(0, 3).map(item => ({
      title: item.title,
      price: parseFloat(item.price?.value || 0),
      url: item.itemWebUrl,
      condition: item.condition || 'Not specified'
    }))
  };
}

// NEW: Search eBay Motors categories
async function searchEbayMotors(query, accessToken, ebayConfig, itemCondition) {
  const apiUrl = ebayConfig.environment === 'sandbox'
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';
  
  const searchUrl = `${apiUrl}/buy/browse/v1/item_summary/search`;
  
  // eBay Motors category IDs
  const motorsCategoryIds = [
    '6001', // Cars & Trucks
    '6024', // Motorcycles
    '26429', // Boats
    '50054'  // RVs & Campers
  ];
  
  const params = new URLSearchParams({
    q: query,
    category_ids: motorsCategoryIds.join(','),
    limit: '20',
    filter: 'buyingOptions:{FIXED_PRICE|AUCTION}'
  });
  
  console.log(`🔍 eBay Motors API call: ${searchUrl}?${params}`);
  
  const response = await fetch(`${searchUrl}?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay Motors search failed: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  const items = data.itemSummaries || [];
  
  console.log(`✅ Found ${items.length} vehicle listings`);
  return items;
}

// NEW: Analyze vehicle pricing with age consideration
function analyzeVehiclePricing(items, itemCondition, query) {
  const prices = items
    .map(item => ({
      price: parseFloat(item.price?.value || 0),
      condition: item.condition,
      title: item.title,
      year: extractYearFromTitle(item.title)
    }))
    .filter(item => item.price > 500) // Filter out unrealistic vehicle prices
    .filter(item => item.price < 200000); // Filter out exotic cars
  
  if (prices.length === 0) {
    return null;
  }
  
  console.log('🚗 Vehicle price distribution:', prices.map(p => `$${p.price}`).join(', '));
  
  const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);
  
  const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
  const average = sortedPrices.reduce((a, b) => a + b, 0) / sortedPrices.length;
  
  // For vehicles, use median as base (more reliable than average)
  const suggestedPrice = Math.round(median);
  
  console.log('🚗 Vehicle pricing analysis:', {
    medianPrice: median,
    averagePrice: average,
    suggestedPrice: suggestedPrice,
    sampleSize: prices.length
  });
  
  return {
    median,
    average,
    min: sortedPrices[0],
    max: sortedPrices[sortedPrices.length - 1],
    suggestedPrice,
    sampleSize: prices.length,
    priceAnalyzed: true
  };
}

// NEW: Extract year from vehicle title
function extractYearFromTitle(title) {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? parseInt(yearMatch[0]) : null;
}

// NEW: Vehicle manual estimation
function getVehicleManualEstimate(enhancedItemData) {
  const { detectedCategory, pricingTier } = enhancedItemData;
  
  console.log(`🚗 Using vehicle manual estimation for ${detectedCategory}`);
  
  let basePrice = pricingTier.base;
  
  // Brand multipliers for vehicles
  const vehicleBrandMultipliers = {
    'tesla': 1.8,
    'bmw': 1.6,
    'mercedes': 1.7,
    'audi': 1.5,
    'lexus': 1.4,
    'acura': 1.2,
    'infiniti': 1.2,
    'cadillac': 1.3,
    'toyota': 1.1,
    'honda': 1.1,
    'nissan': 1.0,
    'ford': 0.9,
    'chevrolet': 0.9,
    'dodge': 0.8,
    'kia': 0.8,
    'hyundai': 0.8
  };
  
  // Apply brand multiplier
  const brand = enhancedItemData.brand?.toLowerCase();
  if (brand && vehicleBrandMultipliers[brand]) {
    basePrice *= vehicleBrandMultipliers[brand];
    console.log(`🏷️ Applied ${brand} multiplier: ${vehicleBrandMultipliers[brand]}`);
  }
  
  // Apply condition multiplier
  const condition = enhancedItemData.condition?.rating || 'good';
 const conditionMultipliers = {
  'excellent': 1.0,
  'good': 0.75,      // Was 0.85 - too high
  'fair': 0.50,      // Was 0.65 - too high
  'poor': 0.25,      // Was 0.35 - way too high
  'parts_only': 0.15  // NEW - for non-functional items
};
  
  basePrice *= (conditionMultipliers[condition] || 0.75);
  
  // Age-based depreciation for vehicles
  const description = enhancedItemData.description || '';
  const yearMatch = description.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    
    // Vehicle depreciation curve
    if (age <= 1) basePrice *= 0.85; // 15% depreciation first year
    else if (age <= 3) basePrice *= 0.7; // 30% total depreciation
    else if (age <= 5) basePrice *= 0.55; // 45% total depreciation
    else if (age <= 10) basePrice *= 0.35; // 65% total depreciation
    else if (age <= 20) basePrice *= 0.2; // 80% total depreciation
    else basePrice *= 0.15; // Classic/vintage (85% depreciation)
    
    // Classic car bonus (25+ years)
    if (age >= 25 && condition === 'excellent') {
      basePrice *= 1.5; // Classic car premium
    }
    
    console.log(`🗓️ Vehicle age: ${age} years, depreciation applied`);
  }
  
  const suggestedPrice = validatePriceEstimate(Math.round(basePrice), enhancedItemData);
  
  // Calculate vehicle-specific costs
  const shippingCost = pricingTier.shippingCost;
  const vehicleFees = calculateCategoryFees(suggestedPrice, detectedCategory);
  const netProfit = Math.round((suggestedPrice - vehicleFees - shippingCost) * 100) / 100;
  
  return {
    suggested: suggestedPrice,
    confidence: 'medium',
    priceRange: {
      low: Math.round(suggestedPrice * 0.8),
      high: Math.round(suggestedPrice * 1.2),
      median: suggestedPrice
    },
    shippingCost: shippingCost,
    ebayFees: vehicleFees,
    netProfit: netProfit,
    source: 'vehicle_manual_estimate',
    isVehicle: true,
    note: detectedCategory === 'automobile' ? 
      'Vehicle pricing estimate - typically requires local pickup/delivery' : 
      `${detectedCategory} pricing estimate based on category analysis`,
    factors: {
      category: detectedCategory,
      brand: enhancedItemData.brand,
      condition: condition,
      basePricing: pricingTier.base
    }
  };
}

// Enhanced manual estimation for non-vehicles (existing logic improved)
function getEnhancedManualEstimate(enhancedItemData) {
  const { detectedCategory, pricingTier } = enhancedItemData;
  
  console.log(`💡 Using enhanced manual pricing for ${detectedCategory}`);
  
  let basePrice = pricingTier.base;
  
  // Brand multipliers by category
  const brandMultipliers = {
  'electronics': {
    'apple': 1.0,        // Was 2.5 - way too high! Apple retains ~50% vs generic 25%, so 2x generic
    'samsung': 0.7,      // Was 1.8 - Samsung loses value faster than Apple
    'sony': 0.8,         // Was 1.6
    'microsoft': 0.9,    // Was 1.7
    'nintendo': 1.1,     // Was 1.9 - Nintendo holds value well but not 90% premium
    'hp': 0.6,          // Was 1.2 - HP loses value quickly
    'dell': 0.55        // Was 1.1 - Dell loses value quickly
  },
  'clothing': {
    'nike': 0.6,        // Was 1.8 - Regular Nike clothing loses 70% value
    'adidas': 0.55,     // Was 1.7
    'levi': 0.7,        // Was 1.4 - Denim holds better
    'gucci': 1.5,       // Was 3.0 - Still luxury but not 3x
    'coach': 1.2,       // Was 2.2 - Premium but not that high
    'ralph lauren': 0.8  // Was 1.6 - Not luxury tier
  },
  'footwear': {
    'nike': 0.8,        // Was 2.0 - Regular Nike shoes
    'jordan': 1.5,      // Was 2.5 - Jordans do hold value but not 2.5x
    'adidas': 0.7,      // Was 1.8
    'converse': 0.5,    // Was 1.3 - Basic shoes
    'vans': 0.45        // Was 1.2 - Basic shoes
  },
  'furniture': {
    'west elm': 0.8,    // Was 1.5 - Furniture depreciates heavily
    'pottery barn': 0.85, // Was 1.6
    'restoration hardware': 1.0, // Was 2.0 - Quality but still used furniture
    'cb2': 0.7,         // Was 1.4
    'ikea': 0.3         // Was 0.8 - IKEA loses 70-75% immediately
  },
  'tools': {
    'dewalt': 1.2,      // Was 1.8 - Tools hold value but not 80% premium
    'milwaukee': 1.15,   // Was 1.7
    'makita': 1.1,      // Was 1.6
    'craftsman': 0.9,   // Was 1.3
    'ryobi': 0.7        // Was 1.1 - Budget brand
  }
};

  
  // Apply brand multiplier if available
  const categoryMultipliers = brandMultipliers[detectedCategory] || {};
  const brand = enhancedItemData.brand?.toLowerCase();
  if (brand && categoryMultipliers[brand]) {
    basePrice *= categoryMultipliers[brand];
    console.log(`Applied ${brand} multiplier for ${detectedCategory}: ${categoryMultipliers[brand]}`);
  } else if (enhancedItemData.brand && enhancedItemData.brand !== 'Unknown') {
    basePrice *= 1.1; // Generic brand bonus
  }
  
  // Apply condition multiplier
  const condition = enhancedItemData.condition?.rating || 'good';
 const conditionMultipliers = {
  'excellent': 1.0,
  'good': 0.75,      // Was 0.85 - too high
  'fair': 0.50,      // Was 0.65 - too high
  'poor': 0.25,      // Was 0.35 - way too high
  'parts_only': 0.15  // NEW - for non-functional items
};
  
  basePrice *= (conditionMultipliers[condition] || 0.75);
  
  // Additional adjustments
  if (enhancedItemData.condition?.usableAsIs === false) {
    basePrice *= 0.6; // 40% reduction for items needing repair
  }
  
  if (enhancedItemData.model && enhancedItemData.model !== 'Unknown') {
    basePrice *= 1.1; // 10% bonus for known model
  }
  
  const suggestedPrice = validatePriceEstimate(Math.round(basePrice), enhancedItemData);
  
  // Calculate costs
  const shippingCost = pricingTier.shippingCost;
  const ebayFees = calculateCategoryFees(suggestedPrice, detectedCategory);
  const netProfit = Math.round((suggestedPrice - ebayFees - shippingCost) * 100) / 100;
  
  return {
    suggested: suggestedPrice,
    confidence: 'medium',
    priceRange: {
      low: Math.round(suggestedPrice * 0.7),
      high: Math.round(suggestedPrice * 1.4),
      median: suggestedPrice
    },
    shippingCost: shippingCost,
    ebayFees: ebayFees,
    netProfit: netProfit,
    source: 'enhanced_manual',
    factors: {
      category: detectedCategory,
      brand: enhancedItemData.brand,
      condition: condition,
      basePricing: pricingTier.base
    },
    note: `Based on enhanced ${detectedCategory} category analysis and brand recognition`
  };
}

// Enhanced eBay API implementation with smart query building
async function getEbayMarketPricing(enhancedItemData, ebayConfig) {
  console.log('Starting enhanced eBay API market pricing...');
  
  const accessToken = await getEbayAccessToken(ebayConfig);
  const query = buildVehicleSearchQuery(enhancedItemData); // Now handles all categories
  
  console.log(`Enhanced eBay search query: "${query}"`);
  
  if (!query.trim()) {
    throw new Error('No valid search terms could be generated');
  }
  
  // Search eBay with condition filtering
  const items = await searchEbayItemsWithCondition(query, accessToken, ebayConfig, enhancedItemData.condition);
  
  if (items.length === 0) {
    throw new Error(`No similar items found for "${query}"`);
  }
  
  // Analyze prices with condition awareness
  const priceAnalysis = analyzeConditionAwarePricing(items, enhancedItemData.condition, query);
  
  if (!priceAnalysis) {
    throw new Error('No valid prices found in search results');
  }
  
  // Validate price against category
  const validatedPrice = validatePriceEstimate(priceAnalysis.suggestedPrice, enhancedItemData);
  
  // Calculate additional costs
  const shippingCost = enhancedItemData.pricingTier.shippingCost;
  const ebayFees = calculateCategoryFees(validatedPrice, enhancedItemData.detectedCategory);
  const netProfit = Math.round((validatedPrice - shippingCost - ebayFees) * 100) / 100;
  
  const result = {
    suggested: validatedPrice,
    confidence: priceAnalysis.sampleSize >= 5 ? 'high' : 'medium',
    priceRange: {
      low: priceAnalysis.min,
      high: priceAnalysis.max,
      median: priceAnalysis.median,
      average: Math.round(priceAnalysis.average)
    },
    shippingCost: shippingCost,
    ebayFees: ebayFees,
    netProfit: netProfit,
    sampleSize: priceAnalysis.sampleSize,
    searchQuery: query,
    source: 'ebay_api_enhanced',
    detectedCategory: enhancedItemData.detectedCategory,
    note: `Based on ${priceAnalysis.sampleSize} eBay listings for ${enhancedItemData.detectedCategory}`,
    comparableItems: items.slice(0, 3).map(item => ({
      title: item.title,
      price: parseFloat(item.price?.value || 0),
      url: item.itemWebUrl,
      condition: item.condition || 'Not specified'
    }))
  };
  
  console.log('Enhanced eBay pricing complete:', {
    suggested: result.suggested,
    netProfit: result.netProfit,
    source: result.source,
    category: enhancedItemData.detectedCategory
  });
  
  return result;
}

// Existing helper functions (keeping the same)
function mapConditionToEbayFilters(itemCondition) {
  const condition = itemCondition?.rating?.toLowerCase() || 'good';
  
  const conditionMappings = {
    'excellent': {
      primary: ['1000', '1500', '2000'],
      fallback: ['2500', '3000']
    },
    'good': {
      primary: ['2500', '3000'],
      fallback: ['2000', '4000']
    },
    'fair': {
      primary: ['3000', '4000'],
      fallback: ['2500', '5000']
    },
    'poor': {
      primary: ['4000', '5000', '7000'],
      fallback: ['3000']
    }
  };
  
  return conditionMappings[condition] || conditionMappings['good'];
}

async function searchEbayItemsWithCondition(query, accessToken, ebayConfig, itemCondition) {
  const apiUrl = ebayConfig.environment === 'sandbox'
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';
  
  const conditionMapping = mapConditionToEbayFilters(itemCondition);
  
  console.log(`Searching eBay with condition filter for ${itemCondition?.rating || 'unknown'} condition`);
  
  let items = await performEbaySearch(query, accessToken, apiUrl, conditionMapping.primary);
  
  if (items.length < 5 && conditionMapping.fallback.length > 0) {
    console.log(`Only ${items.length} items found with primary conditions, expanding search...`);
    const expandedConditions = [...conditionMapping.primary, ...conditionMapping.fallback];
    items = await performEbaySearch(query, accessToken, apiUrl, expandedConditions);
  }
  
  if (items.length < 3) {
    console.log(`Still only ${items.length} items found, searching without condition filter...`);
    items = await performEbaySearch(query, accessToken, apiUrl, []);
  }
  
  return items;
}

async function performEbaySearch(query, accessToken, apiUrl, conditionIds = []) {
  const searchUrl = `${apiUrl}/buy/browse/v1/item_summary/search`;
  const params = new URLSearchParams({
    q: query,
    limit: '25'
  });
  
  if (conditionIds.length > 0) {
    const conditionFilter = `conditionIds:{${conditionIds.join('|')}}`;
    params.append('filter', conditionFilter);
  }
  
  console.log(`eBay API call: ${searchUrl}?${params}`);
  
  const response = await fetch(`${searchUrl}?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay search failed: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  const items = data.itemSummaries || [];
  
  console.log(`Found ${items.length} items`);
  return items;
}

function analyzeConditionAwarePricing(items, itemCondition, query) {
  const prices = items
    .map(item => ({
      price: parseFloat(item.price?.value || 0),
      condition: item.condition,
      title: item.title
    }))
    .filter(item => item.price > 0);
  
  if (prices.length === 0) {
    return null;
  }
  
  const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);
  
  // Remove statistical outliers using IQR method
  const q1 = sortedPrices[Math.floor(sortedPrices.length * 0.25)];
  const q3 = sortedPrices[Math.floor(sortedPrices.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  const filteredPrices = sortedPrices.filter(price => price >= lowerBound && price <= upperBound);
  
  if (filteredPrices.length < 2) {
    // Fallback to original prices if too many filtered out
    const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
    const average = sortedPrices.reduce((a, b) => a + b, 0) / sortedPrices.length;
    
    return {
      median,
      average,
      min: sortedPrices[0],
      max: sortedPrices[sortedPrices.length - 1],
      suggestedPrice: Math.round(median),
      sampleSize: prices.length
    };
  }
  
  const median = filteredPrices[Math.floor(filteredPrices.length / 2)];
  const average = filteredPrices.reduce((a, b) => a + b, 0) / filteredPrices.length;
  
  console.log(`Market statistics: Median ${median}, Range ${filteredPrices[0]}-${filteredPrices[filteredPrices.length - 1]}, Sample: ${filteredPrices.length}/${prices.length}`);
  
  return {
    median,
    average,
    min: filteredPrices[0],
    max: filteredPrices[filteredPrices.length - 1],
    suggestedPrice: Math.round(median),
    sampleSize: filteredPrices.length
  };
}

async function getEbayAccessToken(ebayConfig) {
  const basicAuth = Buffer.from(`${ebayConfig.clientId}:${ebayConfig.clientSecret}`).toString('base64');
  
  const tokenUrl = ebayConfig.environment === 'sandbox'
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope'
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay token request failed: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

function calculateRoutes(enhancedItemData, marketAnalysis, userPreferences) {
  const suggestedPrice = marketAnalysis.suggested || 0;
  const netProfit = marketAnalysis.netProfit || 0;
  const { detectedCategory } = enhancedItemData;
  
  // Vehicle-specific routing
  if (['automobile', 'motorcycle', 'boat', 'rv'].includes(detectedCategory)) {
    return {
      primary: {
        type: "local_pickup",
        priority: 1,
        estimatedReturn: netProfit,
        timeToMoney: "1-7 days",
        effort: "medium",
        details: {
          listingPrice: suggestedPrice,
          estimatedFees: marketAnalysis.ebayFees,
          shippingCost: 0,
          netProfit: netProfit
        },
        note: "Vehicles typically require local pickup or arranged transport"
      },
      alternatives: [
        {
          type: "ebay_motors",
          priority: 2,
          estimatedReturn: netProfit,
          timeToMoney: "7-21 days",
          effort: "high",
          note: "List on eBay Motors for wider reach"
        },
        {
          type: "donation",
          priority: 3,
          estimatedReturn: 0,
          timeToMoney: "immediate",
          effort: "low",
          note: "Tax deduction for charitable donation"
        }
      ]
    };
  }
  
  // Standard item routing
  let primaryRoute = {
    type: "ebay",
    priority: 1,
    estimatedReturn: netProfit,
    timeToMoney: "7-14 days",
    effort: "medium",
    details: {
      listingPrice: suggestedPrice,
      estimatedFees: marketAnalysis.ebayFees,
      shippingCost: marketAnalysis.shippingCost,
      netProfit: netProfit
    }
  };
  
  if (!suggestedPrice || suggestedPrice < 10 || netProfit <= 2) {
    primaryRoute = {
      type: "donation",
      priority: 1,
      estimatedReturn: 0,
      timeToMoney: "immediate",
      effort: "low",
      reason: "Low resale value - better suited for donation"
    };
  }
  
  const alternatives = [
    {
      type: "local_pickup",
      priority: 2,
      estimatedReturn: suggestedPrice ? Math.round(suggestedPrice * 0.9) : 0,
      timeToMoney: "1-3 days",
      effort: "low"
    },
    {
      type: "donation",
      priority: 3,
      estimatedReturn: 0,
      timeToMoney: "immediate",
      effort: "minimal"
    }
  ];
  
  return {
    primary: primaryRoute,
    alternatives: alternatives
  };
}

/**
 * NEW: Get preliminary routes without eBay API for instant response
 * Uses AI-suggested pricing for <1s response time
 */
function getPreliminaryRoutes(itemData, userPreferences = {}) {
  console.log('⚡ Getting preliminary routes (no API calls):', {
    category: itemData.category,
    brand: itemData.brand
  });

  try {
    const detectedCategory = detectItemCategory(itemData);
    const pricingTier = getPricingTier(itemData);

    // Use AI-suggested price or tier-based estimate
    let estimatedPrice = itemData.resale?.priceRange?.high || pricingTier.base;

    // Quick validation
    estimatedPrice = validatePriceEstimate(estimatedPrice, itemData);

    // Calculate quick estimates
    const shippingCost = pricingTier.shippingCost;
    const fees = calculateCategoryFees(estimatedPrice, detectedCategory);
    const netProfit = Math.round((estimatedPrice - shippingCost - fees) * 100) / 100;

    const marketAnalysis = {
      suggested: estimatedPrice,
      confidence: 'preliminary',
      priceRange: {
        low: Math.round(estimatedPrice * 0.7),
        high: Math.round(estimatedPrice * 1.3),
        median: estimatedPrice
      },
      shippingCost,
      ebayFees: fees,
      netProfit,
      source: 'ai_preliminary',
      note: 'Preliminary estimate - market pricing in progress'
    };

    const routes = calculateRoutes(
      { ...itemData, detectedCategory, pricingTier },
      marketAnalysis,
      userPreferences
    );

    console.log('⚡ Preliminary routes complete:', {
      estimatedPrice,
      netProfit,
      routeType: routes.primary.type
    });

    return {
      recommendedRoute: routes.primary,
      alternativeRoutes: routes.alternatives,
      marketAnalysis: {
        estimatedValue: marketAnalysis,
        dataSource: 'preliminary',
        confidence: 'low',
        detectedCategory,
        pricingTier,
        isPreliminary: true
      }
    };
  } catch (error) {
    console.error('❌ Preliminary routes failed:', error);

    // Ultra-safe fallback
    return {
      recommendedRoute: {
        type: "evaluate",
        priority: 1,
        estimatedReturn: 0,
        timeToMoney: "unknown",
        effort: "medium",
        reason: "Getting market pricing..."
      },
      alternativeRoutes: [],
      marketAnalysis: {
        estimatedValue: {
          suggested: null,
          confidence: 'none',
          source: 'preliminary_error'
        },
        isPreliminary: true
      }
    };
  }
}

module.exports = {
  routeDisposition,
  getPreliminaryRoutes,
  getEbayAccessToken,
  calculateCategoryFees
};