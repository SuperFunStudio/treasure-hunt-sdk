// services/ebay/marketDataService.js
// Enhanced market data service with smart query building and price validation

const { config } = require('../../config/environment');
const { getOptimalSearchQuery, getQueryStrategies, isMassMarketBrand } = require('../../capture-sdk/utils/searchQueryBuilder');

class EbayMarketDataService {
  constructor() {
    this.baseUrl = 'https://api.ebay.com';
    this.browseApiUrl = 'https://api.ebay.com/buy/browse/v1';
  }

  /**
   * Get eBay access token for public API calls
   */
  async getPublicAccessToken() {
    try {
      const fetch = (await import('node-fetch')).default;
      
      const credentials = Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString('base64');
      
      const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const tokenData = await response.json();
      return tokenData.access_token;
    } catch (error) {
      console.error('Failed to get eBay public access token:', error);
      throw error;
    }
  }

  /**
   * Enhanced search with multiple query strategies
   */
  async searchCurrentListings(searchParams) {
    try {
      const fetch = (await import('node-fetch')).default;
      
      const {
        keywords,
        brand,
        condition = 'Used',
        categoryId = null,
        maxResults = 50,
        itemData = null // NEW: Pass full item data for smart queries
      } = searchParams;

      // Get access token
      const accessToken = await this.getPublicAccessToken();

      let bestResult = null;

      // NEW: Use smart query strategies if itemData provided
      if (itemData) {
        const queryStrategies = getQueryStrategies(itemData, 3);
        console.log('🎯 Trying multiple search strategies:', queryStrategies.map(q => q.query));

        for (const strategy of queryStrategies) {
          console.log(`🔍 Trying strategy: "${strategy.query}" (${strategy.description})`);
          
          const result = await this.executeSearch(accessToken, {
            query: strategy.query,
            condition,
            categoryId,
            maxResults: Math.min(maxResults, 50)
          });

          if (result.success && result.listings.length > 0) {
            // Validate price ranges for mass market brands
            const validatedResult = this.validatePriceResults(result, itemData);
            
            if (validatedResult.isValid) {
              console.log(`✅ Strategy "${strategy.query}" returned ${validatedResult.result.listings.length} valid results`);
              bestResult = validatedResult.result;
              bestResult.searchStrategy = strategy;
              break;
            } else {
              console.log(`⚠️ Strategy "${strategy.query}" returned invalid prices: ${validatedResult.reason}`);
            }
          } else {
            console.log(`❌ Strategy "${strategy.query}" returned no results`);
          }
        }
      }

      // Fallback to original search if smart queries failed
      if (!bestResult) {
        console.log('🔄 Falling back to original search method');
        let searchQuery = keywords;
        if (brand && brand !== 'Unknown' && brand !== 'Unbranded') {
          searchQuery = `${brand} ${keywords}`;
        }

        bestResult = await this.executeSearch(accessToken, {
          query: searchQuery,
          condition,
          categoryId,
          maxResults
        });
      }

      return bestResult;

    } catch (error) {
      console.error('Failed to search eBay current listings:', error);
      return {
        success: false,
        error: error.message,
        listings: [],
        statistics: null
      };
    }
  }

  /**
   * Execute a single eBay search with given parameters
   */
  async executeSearch(accessToken, { query, condition, categoryId, maxResults }) {
    try {
      const fetch = (await import('node-fetch')).default;

      // Build API URL
      const apiParams = new URLSearchParams({
        q: query,
        limit: Math.min(maxResults, 200)
      });

      // Add condition filter
      const conditionFilter = this.buildConditionFilter(condition);
      if (conditionFilter) {
        apiParams.append('filter', conditionFilter);
      }

      // Add category filter if provided
      if (categoryId) {
        const categoryFilter = `categoryIds:{${categoryId}}`;
        const existingFilter = apiParams.get('filter');
        if (existingFilter) {
          apiParams.set('filter', `${existingFilter},${categoryFilter}`);
        } else {
          apiParams.append('filter', categoryFilter);
        }
      }

      const url = `${this.browseApiUrl}/item_summary/search?${apiParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`eBay Browse API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return this.parseBrowseApiResponse(data, query);

    } catch (error) {
      console.error('eBay search execution failed:', error);
      return {
        success: false,
        error: error.message,
        listings: [],
        statistics: null
      };
    }
  }

  /**
   * Validate price results against known constraints
   */
  validatePriceResults(result, itemData) {
    if (!result.success || !result.statistics) {
      return { isValid: false, reason: 'No valid statistics', result };
    }

    const { brand, category } = itemData;
    const { price } = result.statistics;

    // Price validation rules for mass market brands
    if (isMassMarketBrand(brand)) {
      const maxPrice = this.getMaxPriceForMassMarketBrand(brand, category);
      
      if (price.median > maxPrice) {
        console.log(`⚠️ Price validation failed: ${brand} median $${price.median} exceeds max $${maxPrice}`);
        return { 
          isValid: false, 
          reason: `${brand} items typically don't exceed $${maxPrice}`,
          result 
        };
      }

      // Check for unrealistic high prices (3x brand typical max)
      if (price.max > maxPrice * 3) {
        console.log(`⚠️ Outlier detection: Max price $${price.max} is ${Math.round(price.max/maxPrice)}x typical for ${brand}`);
        // Filter outliers and recalculate
        const filteredResult = this.filterPriceOutliers(result, maxPrice * 2);
        return { isValid: true, reason: 'Filtered outliers', result: filteredResult };
      }
    }

    // General validation: reject if median is unrealistically high for category
    const categoryMaxPrice = this.getMaxPriceForCategory(category);
    if (price.median > categoryMaxPrice) {
      console.log(`⚠️ Category validation failed: ${category} median $${price.median} exceeds category max $${categoryMaxPrice}`);
      return { 
        isValid: false, 
        reason: `${category} items typically don't exceed $${categoryMaxPrice}`,
        result 
      };
    }

    // Sample size validation
    if (result.listings.length < 3) {
      return { 
        isValid: false, 
        reason: 'Insufficient sample size',
        result 
      };
    }

    return { isValid: true, reason: 'Valid price range', result };
  }

  /**
   * Get maximum price for mass market brands
   */
  getMaxPriceForMassMarketBrand(brand, category) {
    const brandLimits = {
      'IKEA': {
        'furniture': 200,
        'chair': 150,
        'table': 200,
        'storage': 150,
        'default': 200
      },
      'Target': {
        'furniture': 300,
        'clothing': 50,
        'electronics': 200,
        'default': 250
      },
      'Walmart': {
        'furniture': 250,
        'clothing': 40,
        'electronics': 150,
        'default': 200
      }
    };

    const limits = brandLimits[brand];
    if (!limits) return 300; // Default mass market limit

    const categoryLower = category?.toLowerCase() || '';
    for (const [key, value] of Object.entries(limits)) {
      if (categoryLower.includes(key)) {
        return value;
      }
    }

    return limits.default;
  }

  /**
   * Get maximum price for category (regardless of brand)
   */
  getMaxPriceForCategory(category) {
    const categoryLower = category?.toLowerCase() || '';
    
    const categoryLimits = {
      'furniture': 1000,
      'chair': 500,
      'table': 800,
      'electronics': 2000,
      'phone': 1200,
      'laptop': 3000,
      'clothing': 200,
      'shoes': 300,
      'toys': 150,
      'books': 50,
      'jewelry': 500
    };

    for (const [key, value] of Object.entries(categoryLimits)) {
      if (categoryLower.includes(key)) {
        return value;
      }
    }

    return 1000; // Default category limit
  }

  /**
   * Filter price outliers from results
   */
  filterPriceOutliers(result, maxPrice) {
    const filteredListings = result.listings.filter(listing => 
      listing.price <= maxPrice
    );

    if (filteredListings.length < 3) {
      // If filtering leaves too few results, keep original but flag it
      return {
        ...result,
        outlierFiltered: true,
        originalCount: result.listings.length
      };
    }

    // Recalculate statistics with filtered data
    const newStatistics = this.calculateMarketStatistics(filteredListings);
    
    return {
      ...result,
      listings: filteredListings,
      statistics: newStatistics,
      outlierFiltered: true,
      originalCount: result.listings.length,
      filteredCount: filteredListings.length
    };
  }

  /**
   * Enhanced buildSearchKeywords function (FIXED)
   * Now uses smart query builder instead of naive keyword concatenation
   */
  buildSearchKeywords(itemData) {
    console.log('🔍 Building enhanced search keywords for:', {
      category: itemData.category,
      brand: itemData.brand,
      model: itemData.model
    });

    // Use the smart query builder for optimal search terms
    const optimalQuery = getOptimalSearchQuery(itemData);
    
    console.log(`✅ Selected search query: "${optimalQuery}"`);
    return optimalQuery;
  }

  /**
   * Build condition filter for Browse API
   */
  buildConditionFilter(condition) {
    const conditionMap = {
      'New': [1000, 1500, 1750, 2000], // New variants
      'Like New': [1500, 2500], // Like new, certified refurbished
      'Used': [2500, 3000, 2000, 4000], // Various used conditions
      'For parts or not working': [7000]
    };

    const conditionIds = conditionMap[condition] || conditionMap['Used'];
    return `conditionIds:{${conditionIds.join('|')}}`;
  }

  /**
   * Parse Browse API response
   */
  parseBrowseApiResponse(data, searchQuery = '') {
    try {
      if (!data || !data.itemSummaries) {
        return {
          success: false,
          error: 'No items found',
          listings: [],
          statistics: null
        };
      }

      const items = data.itemSummaries;
      const listings = items.map(item => this.parseListingItem(item)).filter(item => item);
      
      // Apply quality filters to remove obvious outliers
      const filteredListings = this.applyQualityFilters(listings, searchQuery);
      const statistics = this.calculateMarketStatistics(filteredListings);

      console.log(`Found ${listings.length} raw listings, ${filteredListings.length} after quality filtering`);

      return {
        success: true,
        listings: filteredListings,
        statistics,
        totalFound: data.total || listings.length,
        rawCount: listings.length,
        filteredCount: filteredListings.length,
        searchUrl: this.buildEbaySearchUrl(searchQuery)
      };

    } catch (error) {
      console.error('Error parsing Browse API response:', error);
      return {
        success: false,
        error: 'Failed to parse API response',
        listings: [],
        statistics: null
      };
    }
  }

  /**
   * Apply quality filters to remove commercial listings and outliers
   */
  applyQualityFilters(listings, searchQuery = '') {
    if (!listings || listings.length === 0) return listings;

    return listings.filter(listing => {
      // Filter 1: Remove extremely high prices (likely commercial)
      if (listing.price > 10000) {
        console.log(`Filtered high price: ${listing.price} - ${listing.title.substring(0, 50)}`);
        return false;
      }

      // Filter 2: Remove obvious wholesale/commercial listings
      const title = listing.title.toLowerCase();
      const commercialKeywords = [
        'wholesale', 'bulk', 'lot of', 'pallet', 'case of',
        'dozen', 'commercial', 'restaurant', 'business',
        'industrial', 'professional grade'
      ];
      
      if (commercialKeywords.some(keyword => title.includes(keyword))) {
        console.log(`Filtered commercial: ${listing.title.substring(0, 50)}`);
        return false;
      }

      // Filter 3: Remove listings with suspiciously low prices (likely broken/parts)
      if (listing.price < 1) {
        console.log(`Filtered low price: ${listing.price} - ${listing.title.substring(0, 50)}`);
        return false;
      }

      // Filter 4: For IKEA items, apply specific filters
      if (searchQuery.toLowerCase().includes('ikea')) {
        // Remove listings that are clearly not the item we want
        if (title.includes('instruction') || title.includes('manual') || 
            title.includes('replacement part') || title.includes('screw') ||
            title.includes('hardware only')) {
          console.log(`Filtered IKEA non-item: ${listing.title.substring(0, 50)}`);
          return false;
        }

        // Cap IKEA prices at reasonable levels
        if (listing.price > 300) {
          console.log(`Filtered high IKEA price: ${listing.price} - ${listing.title.substring(0, 50)}`);
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Parse individual listing item from Browse API
   */
  parseListingItem(item) {
    try {
      if (!item || !item.price) {
        return null;
      }

      const listing = {
        itemId: item.itemId,
        title: item.title,
        price: parseFloat(item.price.value || '0'),
        currency: item.price.currency || 'USD',
        condition: item.condition || 'Unknown',
        location: item.itemLocation?.country || 'Unknown',
        seller: item.seller?.username,
        categoryPath: item.categoryPath,
        url: item.itemWebUrl,
        image: item.image?.imageUrl,
        shippingOptions: item.shippingOptions || [],
        listingType: 'current' // Mark as current listing
      };

      // Estimate shipping cost
      listing.shippingCost = this.estimateShippingCost(item.shippingOptions);
      listing.totalCost = listing.price + listing.shippingCost;

      return listing;
    } catch (error) {
      console.error('Error parsing listing item:', error);
      return null;
    }
  }

  /**
   * Estimate shipping cost from shipping options
   */
  estimateShippingCost(shippingOptions) {
    if (!shippingOptions || shippingOptions.length === 0) {
      return 0; // Free shipping or unknown
    }

    // Find cheapest shipping option
    let minCost = Infinity;
    shippingOptions.forEach(option => {
      if (option.shippingCost && option.shippingCost.value) {
        const cost = parseFloat(option.shippingCost.value);
        if (cost < minCost) {
          minCost = cost;
        }
      }
    });

    return minCost === Infinity ? 10 : minCost; // Default $10 if unknown
  }

  /**
   * Calculate market statistics from listings with outlier detection
   */
  calculateMarketStatistics(listings) {
    if (!listings || listings.length === 0) {
      return null;
    }

    const validListings = listings.filter(l => l && l.price > 0);
    if (validListings.length === 0) {
      return null;
    }

    const prices = validListings.map(l => l.price);
    const totalCosts = validListings.map(l => l.totalCost);

    // Apply statistical outlier removal (IQR method)
    const cleanedPrices = this.removeStatisticalOutliers(prices);
    const cleanedTotalCosts = this.removeStatisticalOutliers(totalCosts);

    cleanedPrices.sort((a, b) => a - b);
    cleanedTotalCosts.sort((a, b) => a - b);

    const statistics = {
      count: validListings.length,
      cleanedCount: cleanedPrices.length,
      price: {
        min: Math.min(...cleanedPrices),
        max: Math.max(...cleanedPrices),
        average: cleanedPrices.reduce((a, b) => a + b, 0) / cleanedPrices.length,
        median: this.calculateMedian(cleanedPrices),
        p25: this.calculatePercentile(cleanedPrices, 25),
        p75: this.calculatePercentile(cleanedPrices, 75)
      },
      totalCost: {
        min: Math.min(...cleanedTotalCosts),
        max: Math.max(...cleanedTotalCosts),
        average: cleanedTotalCosts.reduce((a, b) => a + b, 0) / cleanedTotalCosts.length,
        median: this.calculateMedian(cleanedTotalCosts)
      },
      conditions: this.analyzeConditions(validListings),
      dataType: 'current_listings',
      confidence: this.calculateConfidenceScore(validListings, cleanedPrices),
      outlierRemovalApplied: cleanedPrices.length < prices.length
    };

    console.log(`📊 Market statistics: Median ${statistics.price.median}, Range ${statistics.price.min}-${statistics.price.max}, Sample: ${statistics.cleanedCount}/${statistics.count}`);

    return statistics;
  }

  /**
   * Remove statistical outliers using IQR method
   */
  removeStatisticalOutliers(values) {
    if (values.length < 4) return values; // Need at least 4 points for IQR

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.calculatePercentile(sorted, 25);
    const q3 = this.calculatePercentile(sorted, 75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - (1.5 * iqr);
    const upperBound = q3 + (1.5 * iqr);
    
    const filtered = values.filter(v => v >= lowerBound && v <= upperBound);
    
    if (filtered.length < values.length) {
      console.log(`📈 Removed ${values.length - filtered.length} statistical outliers (IQR method)`);
    }
    
    return filtered.length >= 3 ? filtered : values; // Keep original if too few remain
  }

  /**
   * Calculate median value
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  /**
   * Calculate percentile
   */
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Analyze condition distribution
   */
  analyzeConditions(listings) {
    const conditions = {};
    listings.forEach(listing => {
      const condition = listing.condition || 'Unknown';
      if (!conditions[condition]) {
        conditions[condition] = { count: 0, prices: [] };
      }
      conditions[condition].count++;
      conditions[condition].prices.push(listing.price);
    });

    Object.keys(conditions).forEach(condition => {
      const prices = conditions[condition].prices;
      conditions[condition].averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    });

    return conditions;
  }

  /**
   * Calculate confidence score based on data quality
   */
  calculateConfidenceScore(listings, cleanedPrices) {
    let score = 0;

    // Base score from sample size
    if (cleanedPrices.length >= 20) score += 40;
    else if (cleanedPrices.length >= 10) score += 30;
    else if (cleanedPrices.length >= 5) score += 20;
    else score += 10;

    // Current listings are less reliable than sold listings
    score -= 10; // Penalty for using current vs sold listings

    // Bonus for price consistency (low variance)
    if (cleanedPrices.length > 1) {
      const mean = cleanedPrices.reduce((a, b) => a + b, 0) / cleanedPrices.length;
      const variance = cleanedPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / cleanedPrices.length;
      const coefficientOfVariation = Math.sqrt(variance) / mean;

      if (coefficientOfVariation < 0.3) score += 20;
      else if (coefficientOfVariation < 0.5) score += 10;
    }

    // Bonus for multiple conditions represented
    const conditions = new Set(listings.map(l => l.condition));
    if (conditions.size >= 3) score += 10;

    // Bonus for outlier removal (indicates quality filtering)
    if (cleanedPrices.length < listings.length) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Build eBay search URL for reference
   */
  buildEbaySearchUrl(searchQuery) {
    if (!searchQuery) return '';
    return 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(searchQuery);
  }

  /**
   * Get market data for specific item (ENHANCED)
   */
  async getMarketDataForItem(itemData) {
    try {
      const searchParams = {
        keywords: this.buildSearchKeywords(itemData), // Now uses smart query builder
        brand: itemData.brand,
        condition: this.mapConditionForSearch(itemData.condition),
        categoryId: itemData.categoryId,
        maxResults: 50,
        itemData: itemData // NEW: Pass full item data for smart queries
      };

      console.log('Fetching market data for item (enhanced search):', {
        title: itemData.title,
        brand: itemData.brand,
        condition: itemData.condition,
        searchKeywords: searchParams.keywords
      });

      const marketData = await this.searchCurrentListings(searchParams);

      if (marketData.success && marketData.statistics) {
        return {
          success: true,
          marketData: marketData,
          recommendation: this.generatePriceRecommendation(marketData.statistics, itemData.condition),
          confidence: marketData.statistics.confidence,
          dataSource: 'ebay_current_listings_enhanced',
          searchParams: searchParams,
          searchStrategy: marketData.searchStrategy // Include which strategy worked
        };
      } else {
        return {
          success: false,
          error: marketData.error || 'No market data found',
          marketData: null,
          recommendation: null,
          confidence: 0
        };
      }

    } catch (error) {
      console.error('Error getting market data for item:', error);
      return {
        success: false,
        error: error.message,
        marketData: null,
        recommendation: null,
        confidence: 0
      };
    }
  }

  /**
   * Map internal condition to eBay search condition
   */
  mapConditionForSearch(condition) {
    if (!condition) return 'Used';

    const conditionString = typeof condition === 'object' 
      ? (condition.rating || condition.condition || 'good')
      : String(condition);

    const normalized = conditionString.toLowerCase().trim();

    const conditionMap = {
      'new': 'New',
      'like new': 'Like New',
      'excellent': 'Used',
      'very good': 'Used',
      'good': 'Used',
      'acceptable': 'Used',
      'fair': 'Used',
      'poor': 'For parts or not working'
    };

    return conditionMap[normalized] || 'Used';
  }

  /**
   * Generate price recommendation based on market data (ENHANCED)
   */
  generatePriceRecommendation(statistics, itemCondition) {
    if (!statistics || !statistics.price) {
      return null;
    }

    const conditionModifiers = {
      'new': 1.0,
      'like new': 0.9,
      'excellent': 0.8,
      'very good': 0.75,
      'good': 0.65,
      'acceptable': 0.5,
      'fair': 0.4,
      'poor': 0.25
    };

    const conditionString = typeof itemCondition === 'object' 
      ? (itemCondition.rating || itemCondition.condition || 'good')
      : String(itemCondition || 'good');

    const normalized = conditionString.toLowerCase().trim();
    const modifier = conditionModifiers[normalized] || 0.65;

    // Use current listing median as base, apply conservative discount for resale
    const basePrice = statistics.price.median * 0.8; // 20% discount from current listings
    const adjustedPrice = basePrice * modifier;

    return {
      suggested: Math.round(adjustedPrice * 100) / 100,
      range: {
        low: Math.round(statistics.price.p25 * modifier * 0.8 * 100) / 100,
        high: Math.round(statistics.price.p75 * modifier * 0.8 * 100) / 100
      },
      market: {
        median: statistics.price.median,
        average: statistics.price.average,
        range: {
          min: statistics.price.min,
          max: statistics.price.max
        }
      },
      conditionAdjustment: modifier,
      sampleSize: statistics.cleanedCount || statistics.count,
      confidence: statistics.confidence,
      dataType: 'current_listings_enhanced',
      outlierRemovalApplied: statistics.outlierRemovalApplied
    };
  }
}

// Export singleton instance
module.exports = new EbayMarketDataService();