const { EbayPricingService } = require('../utils/ebay-pricing-service.js');
const { getEnhancedManualEstimate, estimateShippingByCategory, calculateEbayFees } = require('../utils/priceEstimate.js');
const { EbayApiClient } = require('../../api/ebay-api-client.js');

const ebayPricingService = new EbayPricingService();
const ebayApiClient = new EbayApiClient();

async function routeDisposition(itemData, userId, userPreferences = {}) {
  console.log('🎯 routeDisposition called with:', {
    category: itemData.category,
    brand: itemData.brand,
    model: itemData.model,
    hasUserId: !!userId
  });

  try {
    const marketAnalysis = await ebayPricingService.getMarketPrice(itemData, userId);
    
    console.log('💰 Market analysis result:', {
      suggested: marketAnalysis.suggested,
      source: marketAnalysis.source,
      confidence: marketAnalysis.confidence
    });

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

module.exports = { 
  routeDisposition,
};
