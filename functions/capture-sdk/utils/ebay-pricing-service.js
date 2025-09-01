const { EbaySearchAPI } = require('../integrations/ebay/searchAPI.js');
const { getEnhancedManualEstimate, calculateEbayFees, estimateShippingByCategory } = require('./priceEstimate.js');
const { buildEnhancedSearchQuery } = require('./enhancedSearch.js');
const { EbayApiClient } = require('../../api/ebay-api-client.js');

class EbayPricingService {
  constructor(config = {}) {
    this.ebayClient = new EbayApiClient();
    this.ebaySearchAPI = new EbaySearchAPI({
      clientId: this.ebayClient.clientId,
      clientSecret: this.ebayClient.clientSecret,
      environment: this.ebayClient.environment,
      debug: config.debug
    });
    this.debugMode = config.debug || false;
  }

  log(message, data = null) {
    if (this.debugMode) {
      console.log(`[EbayPricingService] ${message}`, data || '');
    }
  }

  async getMarketPrice(itemData, userId) {
    this.log('Getting market price for item:', {
      category: itemData.category,
      brand: itemData.brand,
      model: itemData.model,
      hasEbayAPI: !!this.ebayClient.clientId
    });

    if (this.ebayClient.clientId) {
      try {
        this.log('🛒 Attempting eBay API pricing...');
        
        const accessToken = await this.ebayClient.getValidAccessToken(userId);
        
        const ebayResult = await this.getEbayPricing(itemData, accessToken);
        
        if (ebayResult.suggested && ebayResult.suggested > 0) {
          this.log('✅ eBay API pricing successful:', ebayResult.source);
          return this.enhanceEbayResult(ebayResult, itemData);
        } else {
          this.log('⚠️ eBay API returned no price, using fallback:', ebayResult.reason);
        }
      } catch (error) {
        this.log('❌ eBay API failed, using fallback:', error.message);
      }
    } else {
      this.log('⚠️ eBay API not available, using enhanced manual pricing');
    }

    // Fallback to enhanced manual pricing
    return getEnhancedManualEstimate(itemData, itemData.condition?.rating);
  }
  
  async getEbayPricing(itemData, accessToken) {
    const query = buildEnhancedSearchQuery(itemData);
    
    if (!query.trim()) {
      return { suggested: null, reason: 'No valid search terms' };
    }
    
    const items = await this.ebaySearchAPI.searchSimilarItems({ ...itemData, query }, { accessToken });
    
    if (items.activeListings.length === 0 && items.soldListings.length === 0) {
      return { suggested: null, reason: 'No comparable items found' };
    }
    
    const allPrices = [
      ...items.activeListings.map(item => item.price),
      ...items.soldListings.map(item => item.price)
    ].filter(p => p > 0).sort((a, b) => a - b);
    
    if (allPrices.length === 0) {
      return { suggested: null, reason: 'No valid prices found' };
    }
    
    const median = allPrices[Math.floor(allPrices.length / 2)];
    const conditionMultiplier = this.getConditionMultiplier(itemData.condition?.rating);
    const suggestedPrice = Math.round(median * conditionMultiplier);
    
    return {
      suggested: suggestedPrice,
      confidence: allPrices.length >= 5 ? 'high' : 'medium',
      priceRange: { min: allPrices[0], max: allPrices[allPrices.length - 1], median },
      sampleSize: allPrices.length,
      searchQuery: query,
      source: 'ebay_api_combined'
    };
  }

  enhanceEbayResult(ebayResult, itemData) {
    const suggestedPrice = ebayResult.suggested;
    const shippingCost = estimateShippingByCategory(itemData.category, itemData);
    const ebayFees = calculateEbayFees(suggestedPrice);
    const netProfit = Math.round((suggestedPrice - shippingCost - ebayFees) * 100) / 100;
    
    return {
      ...ebayResult,
      suggested: suggestedPrice,
      shippingCost,
      ebayFees,
      netProfit,
      source: 'ebay_api_enhanced',
      factors: {
        category: itemData.category,
        brand: itemData.brand,
        condition: itemData.condition
      },
      note: `Based on ${ebayResult.sampleSize || 0} eBay listings via API`
    };
  }
  
  getConditionMultiplier(condition) {
    const multipliers = {
      'excellent': 1.0,
      'good': 0.85,
      'fair': 0.65,
      'poor': 0.35
    };
    const multiplier = multipliers[condition?.toLowerCase()] || 0.75;
    this.log('Condition multiplier:', { condition, multiplier });
    return multiplier;
  }
}

module.exports = { EbayPricingService };
