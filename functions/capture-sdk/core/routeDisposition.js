// capture-sdk/core/routeDisposition.js - FIXED CommonJS version

// ✅ FIXED: Use CommonJS require instead of ES modules
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

async function routeDisposition(itemData, userPreferences = {}, ebayConfig = null) {
  console.log('🎯 routeDisposition called with:', {
    category: itemData.category,
    brand: itemData.brand,
    model: itemData.model,
    hasEbayConfig: !!ebayConfig
  });

  try {
    // Get market pricing - this will now use REAL eBay API if available
    const marketAnalysis = await getMarketPrice(itemData, ebayConfig);
    
    console.log('💰 Market analysis result:', {
      suggested: marketAnalysis.suggested,
      source: marketAnalysis.source,
      confidence: marketAnalysis.confidence
    });

    // Calculate routes based on market analysis
    const routes = calculateRoutes(itemData, marketAnalysis, userPreferences);
    
    return {
      recommendedRoute: routes.primary,
      alternativeRoutes: routes.alternatives,
      marketAnalysis: {
        estimatedValue: marketAnalysis,
        dataSource: marketAnalysis.source,
        searchQuery: marketAnalysis.searchQuery,
        confidence: marketAnalysis.confidence
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

// Enhanced market pricing that uses REAL eBay API
async function getMarketPrice(itemData, ebayConfig) {
  console.log('🛒 Getting market price with eBay config:', !!ebayConfig);
  
  // If we have eBay config, try the real eBay API first
  if (ebayConfig && ebayConfig.clientId && ebayConfig.clientSecret) {
    try {
      console.log('🛒 Attempting eBay API pricing...');
      const ebayResult = await getEbayMarketPricing(itemData, ebayConfig);
      
      if (ebayResult.suggested && ebayResult.suggested > 0) {
        console.log('✅ eBay API pricing successful:', ebayResult.source);
        return ebayResult;
      } else {
        console.log('⚠️ eBay API returned no valid price, falling back to manual');
      }
    } catch (error) {
      console.error('❌ eBay API failed, falling back to manual:', error.message);
    }
  } else {
    console.log('⚠️ No eBay config available, using manual pricing');
  }
  
  // Fallback to existing price estimation
  const manualPrice = getEnhancedManualEstimate(itemData);
  return {
    suggested: manualPrice,
    confidence: 'medium',
    source: 'enhanced_manual',
    priceRange: {
      low: Math.round(manualPrice * 0.7),
      high: Math.round(manualPrice * 1.3),
      median: manualPrice
    },
    shippingCost: calculateShippingCost(itemData),
    ebayFees: Math.round((manualPrice * 0.1325) * 100) / 100,
    netProfit: Math.round((manualPrice - calculateShippingCost(itemData) - (manualPrice * 0.1325)) * 100) / 100,
    note: 'Based on enhanced category analysis and brand recognition'
  };
}

// ✅ BRAND-AWARE manual pricing
function getEnhancedManualEstimate(itemData) {
  console.log('Using enhanced manual pricing for:', {
    category: itemData.category,
    brand: itemData.brand,
    condition: itemData.condition?.rating
  });

  // Base category pricing
  const categoryPricing = {
    'electronics': 45,
    'furniture': 35,
    'clothing': 15,
    'footwear': 25,
    'tools': 25,
    'books': 8,
    'toys': 12,
    'jewelry': 35,
    'automotive': 40,
    'sporting goods': 20,
    'home & garden': 18,
    'collectibles': 25
  };

  const category = itemData.category?.toLowerCase() || 'unknown';
  let basePrice = categoryPricing[category] || 20;

  // ✅ IKEA-aware brand multipliers
  let brandMultiplier = 1.0;
  if (itemData.brand && itemData.brand !== 'Unknown') {
    const brand = itemData.brand.toLowerCase();
    
    // IKEA gets realistic pricing
    if (brand.includes('ikea')) {
      brandMultiplier = 0.4; // IKEA furniture is typically 40% of generic furniture pricing
      console.log('🏷️ IKEA detected - applying 0.4x multiplier');
    }
    // Premium brands
    else if (['apple', 'samsung', 'sony', 'nike', 'adidas'].some(premium => brand.includes(premium))) {
      brandMultiplier = 2.0;
    }
    // Good brands
    else if (['hp', 'dell', 'canon', 'levi', 'gap'].some(good => brand.includes(good))) {
      brandMultiplier = 1.3;
    }
    // Any other known brand
    else {
      brandMultiplier = 1.1;
    }
  }

  // Condition multiplier
  const conditionMultipliers = {
    'excellent': 1.0,
    'good': 0.85,
    'fair': 0.65,
    'poor': 0.35
  };
  
  const condition = itemData.condition?.rating || 'good';
  const conditionMultiplier = conditionMultipliers[condition] || 0.75;

  const suggestedPrice = Math.round(basePrice * brandMultiplier * conditionMultiplier);
  
  console.log('💰 Enhanced pricing calculation:', {
    basePrice,
    brandMultiplier,
    conditionMultiplier,
    suggestedPrice
  });

  return suggestedPrice;
}

// REAL eBay API implementation with condition awareness
async function getEbayMarketPricing(itemData, ebayConfig) {
  console.log('🛒 Starting condition-aware eBay API market pricing...');
  console.log('📋 Item condition:', itemData.condition?.rating || 'unknown');
  
  // Get eBay access token
  const accessToken = await getEbayAccessToken(ebayConfig);
  
  // Build enhanced search query
  const query = buildEnhancedSearchQuery(itemData);
  console.log(`🔍 Enhanced eBay search query: "${query}"`);
  
  if (!query.trim()) {
    throw new Error('No valid search terms could be generated');
  }
  
  // Search eBay with condition filtering
  const items = await searchEbayItemsWithCondition(query, accessToken, ebayConfig, itemData.condition);
  
  if (items.length === 0) {
    throw new Error(`No similar items found for "${query}"`);
  }
  
  // Analyze prices with condition awareness
  const priceAnalysis = analyzeConditionAwarePricing(items, itemData.condition, query);
  
  if (!priceAnalysis) {
    throw new Error('No valid prices found in search results');
  }
  
  // Calculate additional costs
  const shippingCost = calculateShippingCost(itemData);
  const ebayFees = Math.round((priceAnalysis.suggestedPrice * 0.1325) * 100) / 100;
  const netProfit = Math.round((priceAnalysis.suggestedPrice - shippingCost - ebayFees) * 100) / 100;
  
  const result = {
    suggested: priceAnalysis.suggestedPrice,
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
    source: 'ebay_api_condition_aware',
    conditionMatched: true,
    conditionDistribution: priceAnalysis.conditionDistribution,
    note: `Based on ${priceAnalysis.sampleSize} condition-matched eBay listings`,
    comparableItems: items.slice(0, 3).map(item => ({
      title: item.title,
      price: parseFloat(item.price?.value || 0),
      url: item.itemWebUrl,
      condition: item.condition || 'Not specified'
    }))
  };
  
  console.log('✅ Condition-aware eBay pricing complete:', {
    suggested: result.suggested,
    netProfit: result.netProfit,
    source: result.source,
    sampleSize: result.sampleSize,
    conditionMatched: result.conditionMatched
  });
  
  return result;
}

// ✅ BRAND-AWARE search query builder
function buildEnhancedSearchQuery(itemData) {
  console.log('🔍 Building enhanced search query for:', {
    category: itemData.category,
    brand: itemData.brand,
    materials: itemData.materials,
    keyFeatures: itemData.keyFeatures
  });
  
  const queryParts = [];
  const excludeGeneric = ['unknown', 'generic', 'see photos', 'item', 'object'];
  
  // 1. Use specific category (most important)
  if (itemData.category && 
      !excludeGeneric.some(term => itemData.category.toLowerCase().includes(term))) {
    queryParts.push(itemData.category);
  }
  
  // 2. Add brand if it's meaningful (INCLUDING IKEA!)
  if (itemData.brand && 
      !excludeGeneric.some(term => itemData.brand.toLowerCase().includes(term)) &&
      itemData.brand.length > 2) {
    queryParts.push(itemData.brand);
    console.log('✅ Added brand to search:', itemData.brand);
  }
  
  // 3. Add primary material if distinctive
  if (itemData.materials && itemData.materials.length > 0) {
    const primaryMaterial = itemData.materials[0];
    if (primaryMaterial && 
        !['unknown', 'generic'].includes(primaryMaterial.toLowerCase()) &&
        !queryParts.some(part => part.toLowerCase().includes(primaryMaterial.toLowerCase()))) {
      queryParts.push(primaryMaterial);
    }
  }
  
  const query = queryParts.join(' ').trim();
  console.log('🎯 Enhanced query built:', `"${query}"`);
  
  return query;
}

// Helper functions (keeping the same as before)
function mapConditionToEbayFilters(itemCondition) {
  const condition = itemCondition?.rating?.toLowerCase() || 'good';
  
  const conditionMappings = {
    'excellent': {
      primary: ['1000', '1500', '2000'],
      fallback: ['2500', '3000'],
      description: 'excellent to new condition'
    },
    'good': {
      primary: ['2500', '3000'],
      fallback: ['2000', '4000'],
      description: 'good to very good condition'
    },
    'fair': {
      primary: ['3000', '4000'],
      fallback: ['2500', '5000'],
      description: 'fair to acceptable condition'
    },
    'poor': {
      primary: ['4000', '5000', '7000'],
      fallback: ['3000'],
      description: 'poor to for parts condition'
    }
  };
  
  return conditionMappings[condition] || conditionMappings['good'];
}

async function searchEbayItemsWithCondition(query, accessToken, ebayConfig, itemCondition) {
  const apiUrl = ebayConfig.environment === 'sandbox'
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';
  
  const conditionMapping = mapConditionToEbayFilters(itemCondition);
  
  console.log(`🔍 Searching eBay with condition filter for ${itemCondition?.rating || 'unknown'} condition`);
  console.log(`📋 Using eBay condition IDs: ${conditionMapping.primary.join(', ')}`);
  
  let items = await performEbaySearch(query, accessToken, apiUrl, conditionMapping.primary);
  
  if (items.length < 5 && conditionMapping.fallback.length > 0) {
    console.log(`⚠️ Only ${items.length} items found with primary conditions, expanding search...`);
    const expandedConditions = [...conditionMapping.primary, ...conditionMapping.fallback];
    items = await performEbaySearch(query, accessToken, apiUrl, expandedConditions);
    console.log(`📈 Expanded search found ${items.length} items`);
  }
  
  if (items.length < 3) {
    console.log(`⚠️ Still only ${items.length} items found, searching without condition filter...`);
    items = await performEbaySearch(query, accessToken, apiUrl, []);
    console.log(`🔓 Unrestricted search found ${items.length} items`);
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
    console.log(`🏷️ Applied condition filter: ${conditionFilter}`);
  }
  
  console.log(`🔍 eBay API call: ${searchUrl}?${params}`);
  
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
  
  console.log(`✅ Found ${items.length} items${conditionIds.length ? ' with condition filter' : ' (no condition filter)'}`);
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
  
  const conditionCounts = prices.reduce((acc, item) => {
    const condition = item.condition || 'Unknown';
    acc[condition] = (acc[condition] || 0) + 1;
    return acc;
  }, {});
  
  console.log('📊 Condition distribution in results:', conditionCounts);
  
  const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);
  
  const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
  const average = sortedPrices.reduce((a, b) => a + b, 0) / sortedPrices.length;
  
  const conditionMultiplier = getConditionMultiplier(itemCondition?.rating || 'good');
  const suggestedPrice = Math.round(median * conditionMultiplier);
  
  console.log('💰 Condition-aware pricing:', {
    medianFromEbay: median,
    conditionMultiplier: conditionMultiplier,
    finalSuggestedPrice: suggestedPrice,
    sampleSize: prices.length
  });
  
  return {
    median,
    average,
    min: sortedPrices[0],
    max: sortedPrices[sortedPrices.length - 1],
    suggestedPrice,
    sampleSize: prices.length,
    conditionDistribution: conditionCounts,
    conditionAdjusted: true
  };
}

async function getEbayAccessToken(ebayConfig) {
  const basicAuth = Buffer.from(`${ebayConfig.clientId}:${ebayConfig.clientSecret}`).toString('base64');
  
  const tokenUrl = ebayConfig.environment === 'sandbox'
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';
  
  console.log('🔑 Getting eBay access token...');
  
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
  console.log('✅ eBay access token acquired');
  return data.access_token;
}

function getConditionMultiplier(condition) {
  const multipliers = {
    'excellent': 1.0,
    'good': 0.85,
    'fair': 0.65,
    'poor': 0.35
  };
  return multipliers[condition] || 0.75;
}

function calculateShippingCost(itemData) {
  const shippingRates = {
    'electronics': 12,
    'clothing': 6,
    'furniture': 25,
    'tools': 15,
    'sporting goods': 18,
    'books': 4,
    'toys': 8,
    'jewelry': 5,
    'collectibles': 10
  };
  return shippingRates[itemData.category?.toLowerCase()] || 8;
}

function calculateRoutes(itemData, marketAnalysis, userPreferences) {
  const suggestedPrice = marketAnalysis.suggested || 0;
  const netProfit = marketAnalysis.netProfit || 0;
  
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

// ✅ FIXED: Proper CommonJS export
module.exports = { 
  routeDisposition,
  getEbayAccessToken,
  getConditionMultiplier,
  calculateShippingCost
};