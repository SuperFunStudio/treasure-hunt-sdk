// ebay-pricing-bridge.js - Integration bridge to ensure eBay API is used for pricing
// This file bridges your existing pricing logic with the eBay API

const { SimpleEbayAPI } = require('./integrations/ebay/simpleAPI.js');

class EbayPricingBridge {
  constructor(config) {
    this.config = config;
    this.ebayAPI = null;
    this.debugMode = config.debug || false;
    
    // Initialize eBay API if credentials are available
    if (config.ebay && config.ebay.clientId && config.ebay.clientSecret) {
      this.ebayAPI = new SimpleEbayAPI({
        clientId: config.ebay.clientId,
        clientSecret: config.ebay.clientSecret,
        environment: config.ebay.environment || 'production',
        debug: this.debugMode
      });
      
      this.log('✅ eBay API initialized');
    } else {
      this.log('⚠️ eBay API not configured - will use fallback pricing');
    }
  }

  log(message, data = null) {
    if (this.debugMode || true) { // Always log for debugging
      console.log(`[EbayPricingBridge] ${message}`, data || '');
    }
  }

  // Main pricing function that should replace your current enhanced_manual logic
  async getMarketPrice(itemData, options = {}) {
    this.log('Getting market price for item:', {
      category: itemData.category,
      brand: itemData.brand,
      model: itemData.model,
      hasEbayAPI: !!this.ebayAPI
    });

    // Priority 1: Try eBay API if available
    if (this.ebayAPI) {
      try {
        this.log('🛒 Attempting eBay API pricing...');
        const ebayResult = await this.ebayAPI.getPricing(itemData);
        
        // Check if eBay API provided a valid result
        if (ebayResult.suggested && ebayResult.suggested > 0) {
          this.log('✅ eBay API pricing successful:', {
            suggested: ebayResult.suggested,
            confidence: ebayResult.confidence,
            source: ebayResult.source
          });
          
          // Add additional calculated fields
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

    // Priority 2: Fallback to enhanced manual pricing
    return this.getEnhancedManualPrice(itemData, options);
  }

  // Enhanced eBay result with shipping, fees, and profit calculations
  enhanceEbayResult(ebayResult, itemData) {
    const suggestedPrice = ebayResult.suggested;
    
    // Calculate shipping cost (you can make this more sophisticated)
    const shippingCost = this.calculateShippingCost(itemData);
    
    // Calculate eBay fees (13.25% is typical)
    const ebayFeeRate = 0.1325;
    const ebayFees = Math.round((suggestedPrice * ebayFeeRate) * 100) / 100;
    
    // Calculate net profit
    const netProfit = Math.round((suggestedPrice - shippingCost - ebayFees) * 100) / 100;
    
    const enhancedResult = {
      ...ebayResult,
      suggested: suggestedPrice,
      priceRange: ebayResult.priceRange || {
        low: Math.round(suggestedPrice * 0.8),
        high: Math.round(suggestedPrice * 1.2),
        median: suggestedPrice
      },
      shippingCost: shippingCost,
      ebayFees: ebayFees,
      netProfit: netProfit,
      source: 'ebay_api_enhanced',
      factors: {
        category: itemData.category,
        brand: itemData.brand,
        condition: itemData.condition,
        marketData: {
          sampleSize: ebayResult.sampleSize,
          confidence: ebayResult.confidence
        }
      },
      note: `Based on ${ebayResult.sampleSize || 0} eBay listings via API`
    };

    this.log('Enhanced eBay result:', {
      suggested: enhancedResult.suggested,
      netProfit: enhancedResult.netProfit,
      source: enhancedResult.source
    });

    return enhancedResult;
  }

  // Your existing enhanced manual pricing logic as fallback
  getEnhancedManualPrice(itemData, options = {}) {
    this.log('Using enhanced manual pricing...');
    
    // Category-based base pricing
    const categoryPrices = {
      'electronics': 25,
      'clothing': 15,
      'furniture': 35,
      'tools': 20,
      'sporting goods': 18,
      'books': 8,
      'toys': 12,
      'jewelry': 30,
      'collectibles': 40
    };

    const basePrice = categoryPrices[itemData.category?.toLowerCase()] || 15;
    this.log('Base price for category:', { category: itemData.category, basePrice });

    // Brand multiplier
    let brandMultiplier = 1.0;
    if (itemData.brand && itemData.brand !== 'Unknown') {
      // Known brands get a premium
      const premiumBrands = ['apple', 'nike', 'sony', 'samsung', 'canon', 'coach', 'levi'];
      const brand = itemData.brand.toLowerCase();
      
      if (premiumBrands.some(premium => brand.includes(premium))) {
        brandMultiplier = 1.5;
      } else {
        brandMultiplier = 1.2; // Any known brand gets some premium
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

    // Calculate suggested price
    const suggestedPrice = Math.round(basePrice * brandMultiplier * conditionMultiplier);
    
    // Calculate additional costs
    const shippingCost = this.calculateShippingCost(itemData);
    const ebayFees = Math.round((suggestedPrice * 0.1325) * 100) / 100;
    const netProfit = Math.round((suggestedPrice - shippingCost - ebayFees) * 100) / 100;

    const result = {
      suggested: suggestedPrice,
      confidence: 'medium',
      priceRange: {
        low: Math.round(suggestedPrice * 0.7),
        high: Math.round(suggestedPrice * 1.3),
        median: suggestedPrice
      },
      shippingCost: shippingCost,
      ebayFees: ebayFees,
      netProfit: netProfit,
      source: 'enhanced_manual',
      factors: {
        category: basePrice,
        brand: itemData.brand,
        brandMultiplier: brandMultiplier,
        condition: condition,
        conditionMultiplier: conditionMultiplier
      },
      note: 'Based on enhanced category analysis and brand recognition'
    };

    this.log('Enhanced manual result:', {
      suggested: result.suggested,
      netProfit: result.netProfit,
      source: result.source
    });

    return result;
  }

  calculateShippingCost(itemData) {
    // Estimate shipping based on category and size
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

  // Test the bridge functionality
  async testBridge() {
    this.log('Testing eBay pricing bridge...');
    
    const testItem = {
      category: 'clothing',
      brand: 'Nike',
      model: 'Athletic T-shirt',
      condition: { rating: 'good' },
      description: 'Nike athletic t-shirt in good condition'
    };

    try {
      const result = await this.getMarketPrice(testItem);
      
      this.log('Bridge test result:', {
        suggested: result.suggested,
        confidence: result.confidence,
        source: result.source,
        netProfit: result.netProfit
      });

      return {
        success: true,
        result: result,
        usedEbayAPI: result.source.includes('ebay_api')
      };
    } catch (error) {
      this.log('❌ Bridge test failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check if eBay API is properly configured and working
  async healthCheck() {
    const health = {
      ebayConfigured: !!this.ebayAPI,
      ebayWorking: false,
      lastError: null
    };

    if (this.ebayAPI) {
      try {
        const testResult = await this.ebayAPI.testConnection();
        health.ebayWorking = testResult.success;
        if (!testResult.success) {
          health.lastError = testResult.error;
        }
      } catch (error) {
        health.lastError = error.message;
      }
    }

    this.log('Health check result:', health);
    return health;
  }
}

// Usage example and export
module.exports = { EbayPricingBridge };

// Example usage:
/*
const bridge = new EbayPricingBridge({
  ebay: {
    clientId: process.env.EBAY_CLIENT_ID,
    clientSecret: process.env.EBAY_CLIENT_SECRET,
    environment: 'production'
  },
  debug: true
});

// Replace your current pricing logic with:
const marketPrice = await bridge.getMarketPrice(itemData);
*/