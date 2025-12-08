// services/ebay/marketDataService.js
// Enhanced market data service with smart query building and price validation

const { config } = require('../../config/environment');
const { getOptimalSearchQuery, getQueryStrategies, isMassMarketBrand } = require('../../capture-sdk/utils/searchQueryBuilder');

class EbayMarketDataService {
  constructor() {
    this.baseUrl = 'https://api.ebay.com';
    this.browseApiUrl = 'https://api.ebay.com/buy/browse/v1';
    // Token cache with expiration tracking
    this.tokenCache = {
      token: null,
      expiresAt: 0  // Unix timestamp in milliseconds
    };
  }

  /**
   * Get a valid eBay access token (with caching)
   * Checks expiration and refreshes if needed
   */
  async getValidAccessToken() {
    const now = Date.now();
    const bufferMs = 60000; // 1 minute buffer before expiration

    // Return cached token if still valid
    if (this.tokenCache.token && this.tokenCache.expiresAt > now + bufferMs) {
      console.log('🔑 Using cached eBay token (expires in', Math.round((this.tokenCache.expiresAt - now) / 1000), 'seconds)');
      return this.tokenCache.token;
    }

    // Token expired or doesn't exist - fetch new one
    console.log('🔄 Refreshing eBay access token...');
    return await this.refreshAccessToken();
  }

  /**
   * Refresh the eBay access token
   */
  async refreshAccessToken() {
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

      // Cache the token with expiration (eBay tokens typically expire in 7200 seconds / 2 hours)
      const expiresInMs = (tokenData.expires_in || 7200) * 1000;
      this.tokenCache = {
        token: tokenData.access_token,
        expiresAt: Date.now() + expiresInMs
      };

      console.log('✅ eBay token refreshed, expires in', tokenData.expires_in, 'seconds');
      return tokenData.access_token;
    } catch (error) {
      console.error('Failed to refresh eBay access token:', error);
      // Clear cache on error
      this.tokenCache = { token: null, expiresAt: 0 };
      throw error;
    }
  }

  /**
   * Execute an API call with automatic retry on 401 (token expired)
   */
  async executeWithRetry(apiCallFn, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await apiCallFn();
      } catch (error) {
        const isAuthError = error.message?.includes('401') ||
                           error.status === 401 ||
                           error.message?.includes('Unauthorized');

        if (isAuthError && attempt < maxRetries) {
          console.log(`🔄 Auth error on attempt ${attempt + 1}, refreshing token and retrying...`);
          // Clear cached token and retry
          this.tokenCache = { token: null, expiresAt: 0 };
          continue;
        }

        // Re-throw if not auth error or max retries reached
        throw error;
      }
    }
  }

  /**
   * Get eBay access token for public API calls (DEPRECATED - use getValidAccessToken)
   */
  async getPublicAccessToken() {
    return await this.getValidAccessToken();
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
            maxResults: Math.min(maxResults, 50),
            itemData: itemData
          });

          if (result.success && result.listings.length > 0) {
            // Validate price ranges AND relevance for mass market brands
            const validatedResult = this.validatePriceResults(result, itemData, strategy.query);

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
          maxResults,
          itemData: itemData
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
   * Execute a single eBay search with given parameters (with retry on auth errors)
   * @param {string} _accessToken - Deprecated, token is now fetched internally with caching
   */
  async executeSearch(_accessToken, { query, condition, categoryId, maxResults, itemData = null }) {
    // Wrap the actual search in retry logic
    return await this.executeWithRetry(async () => {
      try {
        const fetch = (await import('node-fetch')).default;

        // Get fresh token (in case this is a retry)
        const token = await this.getValidAccessToken();

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
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`eBay Browse API error: ${response.status} - ${errorText}`);
          error.status = response.status;
          throw error;
        }

        const data = await response.json();
        return this.parseBrowseApiResponse(data, query, itemData);

      } catch (error) {
        console.error('eBay search execution failed:', error);
        // Re-throw to let executeWithRetry handle it
        throw error;
      }
    }).catch(error => {
      // Final fallback if all retries failed
      console.error('eBay search failed after retries:', error.message);
      return {
        success: false,
        error: error.message,
        listings: [],
        statistics: null
      };
    });
  }

  /**
   * Validate search result relevance - ensure results actually match what we're searching for
   */
  validateSearchRelevance(result, itemData, searchQuery) {
    if (!result.success || !result.listings || result.listings.length === 0) {
      return { isRelevant: false, reason: 'No listings to validate', relevanceScore: 0 };
    }

    const { brand, category } = itemData;
    const listings = result.listings;
    const searchLower = (searchQuery || '').toLowerCase();

    // Calculate brand match rate
    let brandMatchRate = 1.0; // Default to 1 if no brand specified
    if (brand && brand !== 'Unknown' && brand !== 'Unbranded') {
      const brandLower = brand.toLowerCase();
      const brandMatches = listings.filter(l =>
        l.title.toLowerCase().includes(brandLower)
      ).length;
      brandMatchRate = brandMatches / listings.length;
    }

    // Calculate category match rate
    let categoryMatchRate = 1.0; // Default to 1 if no category
    if (category && category !== 'Unknown') {
      // Extract key category words (skip common words)
      const categoryWords = category.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !['with', 'and', 'the', 'for'].includes(word));

      if (categoryWords.length > 0) {
        const categoryMatches = listings.filter(l => {
          const titleLower = l.title.toLowerCase();
          return categoryWords.some(word => titleLower.includes(word));
        }).length;
        categoryMatchRate = categoryMatches / listings.length;
      }
    }

    // Calculate price consistency (coefficient of variation)
    let priceConsistency = 1.0;
    if (result.statistics && result.statistics.price) {
      const prices = listings.map(l => l.price).filter(p => p > 0);
      if (prices.length > 1) {
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
        const coefficientOfVariation = Math.sqrt(variance) / mean;
        // Convert CV to consistency score (lower CV = higher consistency)
        // CV of 0.5 = 75% consistency, CV of 1.0 = 50% consistency
        priceConsistency = Math.max(0, 1 - (coefficientOfVariation * 0.5));
      }
    }

    // Calculate overall relevance score (weighted average)
    const relevanceScore = (brandMatchRate * 0.4) + (categoryMatchRate * 0.4) + (priceConsistency * 0.2);

    const relevanceDetails = {
      brandMatchRate: Math.round(brandMatchRate * 100) / 100,
      categoryMatchRate: Math.round(categoryMatchRate * 100) / 100,
      priceConsistency: Math.round(priceConsistency * 100) / 100,
      overallScore: Math.round(relevanceScore * 100) / 100
    };

    console.log(`📊 Search relevance for "${searchQuery}":`, relevanceDetails);

    // Threshold: require at least 50% relevance score
    const isRelevant = relevanceScore >= 0.5;

    if (!isRelevant) {
      console.log(`⚠️ Low relevance score (${relevanceScore.toFixed(2)}): brand=${brandMatchRate.toFixed(2)}, category=${categoryMatchRate.toFixed(2)}, price=${priceConsistency.toFixed(2)}`);
    }

    return {
      isRelevant,
      reason: isRelevant ? 'Results are relevant' : `Low relevance score: ${relevanceScore.toFixed(2)}`,
      relevanceScore,
      details: relevanceDetails
    };
  }

  /**
   * Validate price results against known constraints
   */
  validatePriceResults(result, itemData, searchQuery = '') {
    if (!result.success || !result.statistics) {
      return { isValid: false, reason: 'No valid statistics', result };
    }

    // First check relevance
    const relevanceCheck = this.validateSearchRelevance(result, itemData, searchQuery);
    if (!relevanceCheck.isRelevant) {
      return {
        isValid: false,
        reason: relevanceCheck.reason,
        result,
        relevanceScore: relevanceCheck.relevanceScore
      };
    }

    // Add relevance score to result
    result.relevanceScore = relevanceCheck.details;

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
      'tv': 3000,
      'television': 3000,
      'monitor': 2000,
      'furniture': 1000,
      'chair': 500,
      'table': 800,
      'electronics': 2000,
      'phone': 1200,
      'laptop': 3000,
      'computer': 3000,
      'gaming': 1500,
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

    return 1500; // Default category limit (increased from 1000)
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
  parseBrowseApiResponse(data, searchQuery = '', itemData = null) {
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
      const filteredListings = this.applyQualityFilters(listings, searchQuery, itemData);
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
  applyQualityFilters(listings, searchQuery = '', itemData = null) {
    if (!listings || listings.length === 0) return listings;

    // Check if user is searching for a set of items
    const isSearchingForSet = itemData?.isSet || false;
    const itemCount = itemData?.itemCount || 1;

    // First pass: Calculate median for context-aware filtering
    const validPrices = listings.filter(l => l.price > 0).map(l => l.price).sort((a, b) => a - b);
    const medianPrice = validPrices[Math.floor(validPrices.length / 2)] || 100;

    return listings.filter(listing => {
      const title = listing.title.toLowerCase();
      const searchLower = searchQuery.toLowerCase();

      // Filter 1: Remove extremely high prices (likely commercial)
      if (listing.price > 10000) {
        console.log(`Filtered high price: ${listing.price} - ${listing.title.substring(0, 50)}`);
        return false;
      }

      // Filter 2: Remove obvious wholesale/commercial listings
      const commercialKeywords = [
        'wholesale', 'bulk', 'lot of', 'pallet', 'case of',
        'dozen', 'commercial', 'restaurant', 'business',
        'industrial', 'professional grade'
      ];

      if (commercialKeywords.some(keyword => title.includes(keyword))) {
        console.log(`Filtered commercial: ${listing.title.substring(0, 50)}`);
        return false;
      }

      // Filter 2.5: TV-specific accessories filter
      if (searchLower.includes('tv') || searchLower.includes('television')) {
        const tvAccessories = [
          'mount', 'mounting', 'bracket', 'stand', 'holder',
          'remote', 'control', 'cable', 'cord', 'adapter',
          'screen protector', 'cover', 'case', 'hdmi',
          'wall mount', 'tv stand', 'tv mount', 'antenna',
          'streaming device', 'stick', 'box', 'dongle'
        ];

        // Check if this is an accessory listing
        const isAccessory = tvAccessories.some(accessory => {
          // Use word boundaries to avoid false positives
          const pattern = new RegExp(`\\b${accessory}\\b`, 'i');
          return pattern.test(title);
        });

        if (isAccessory) {
          console.log(`Filtered TV accessory: ${listing.title.substring(0, 50)}`);
          return false;
        }

        // Also filter if listing doesn't contain "tv" or "television" in the title
        // (helps catch accessories that snuck through)
        if (!title.includes('tv') && !title.includes('television') &&
            !title.includes('hdtv') && !title.includes('smart tv')) {
          console.log(`Filtered non-TV item: ${listing.title.substring(0, 50)}`);
          return false;
        }
      }

      // Filter 3: Detect and filter multi-item sets (ENHANCED)
      const multiItemPatterns = [
        /\b\d+\s*(x|chairs?|pieces?|items?)\b/i,                    // "2 x", "2 chairs", "3 pieces"
        /\bset of \d+\b/i,                                           // "set of 2"
        /\b\d+\s*piece set\b/i,                                      // "3 piece set"
        /\b\d+\s*(chair|table|lamp|shelf)\b/i,                       // "2 chair", "3 table"
        /\bpair of\b/i,                                              // "pair of"
        /\blot of\b/i,                                               // "lot of"
        /with (ottoman|cushion|table|stand|footstool|matching)/i,   // "with ottoman", "with matching"
        /with matching (ottoman|cushion|footstool)/i,                // "with matching ottoman"
        /\+ (ottoman|cushion|table|stand|footstool)/i,               // "+ ottoman"
        /and (ottoman|cushion|table|stand|footstool)/i,              // "and ottoman"
        /including (ottoman|cushion|table|stand)/i,                  // "including ottoman"
        /w\/ (ottoman|cushion|table|stand)/i,                        // "w/ ottoman"
        /& (ottoman|cushion|table|stand|footstool)/i,                // "& ottoman"
        /\bchair and ottoman\b/i,                                    // "chair and ottoman"
        /\barmchair with\b/i,                                        // "armchair with"
        /\bcombo\b/i,                                                // "combo"
        /\bbundle\b/i                                                // "bundle"
      ];

      const hasMultiItemIndicator = multiItemPatterns.some(pattern => pattern.test(title));

      if (hasMultiItemIndicator) {
        // SMART FILTERING: Only filter multi-item listings if user has a SINGLE item
        // If user uploaded a set (isSet=true or itemCount>1), allow multi-item listings
        if (isSearchingForSet || itemCount > 1) {
          console.log(`✓ Keeping multi-item listing (user has set): ${listing.title.substring(0, 50)}`);
          return true; // Keep this listing - user wants sets
        }

        // Exception: Don't filter if the search query specifically mentions the multi-item aspect
        const searchLower = searchQuery.toLowerCase();
        const searchIncludesMultiItem = searchLower.includes('with') ||
                                        searchLower.includes('set') ||
                                        searchLower.includes('ottoman') ||
                                        searchLower.includes('cushion');

        if (!searchIncludesMultiItem) {
          console.log(`Filtered multi-item set: ${listing.price} - ${listing.title.substring(0, 50)}`);
          return false;
        }
      }

      // Filter 3.5: Number-only filtering for furniture
      // Catches "2 IKEA chairs" but allows "IKEA Poang 2"
      // SKIP if user has multiple items
      if (!isSearchingForSet && itemCount === 1) {
        if (searchLower.includes('chair') || searchLower.includes('table') ||
            searchLower.includes('furniture')) {
          // Look for numbers at the beginning indicating quantity
          const quantityAtStart = /^\d+\s+/i.test(title);
          const quantityPattern = /\b[2-9]\d*\s+(ikea|vintage|modern|wood|wooden|metal)\s+(chair|table|shelf)/i;

          if (quantityAtStart || quantityPattern.test(title)) {
            console.log(`Filtered quantity listing: ${listing.title.substring(0, 50)}`);
            return false;
          }
        }
      }

      // Filter 4: Filter suspiciously low prices (likely broken/parts)
      if (listing.price < 1) {
        console.log(`Filtered low price: ${listing.price} - ${listing.title.substring(0, 50)}`);
        return false;
      }

      // Filter 5: Smart vintage filtering
      // Vintage items are valuable but should match the item being scanned
      const vintageKeywords = ['vintage', 'antique', 'retro', 'collectible', 'rare', 'original', 'classic'];
      const isVintage = vintageKeywords.some(keyword => title.includes(keyword));

      if (isVintage && listing.price > medianPrice * 3) {
        // This is likely a genuinely valuable vintage item
        // Only keep it if the search query suggests we're looking for vintage
        const searchLower = searchQuery.toLowerCase();
        const searchingForVintage = vintageKeywords.some(keyword => searchLower.includes(keyword));

        if (!searchingForVintage) {
          console.log(`Filtered vintage outlier: ${listing.price} (median: ${medianPrice}) - ${listing.title.substring(0, 50)}`);
          return false;
        }
      }

      // Filter 6: Brand-specific filters
      if (searchQuery.toLowerCase().includes('ikea')) {
        // Remove IKEA parts/instructions
        if (title.includes('instruction') || title.includes('manual') ||
            title.includes('replacement part') || title.includes('screw') ||
            title.includes('hardware only')) {
          console.log(`Filtered IKEA non-item: ${listing.title.substring(0, 50)}`);
          return false;
        }

        // IKEA items rarely sell for >$300 used (unless vintage or large furniture sets)
        if (listing.price > 300 && !title.includes('sectional') && !title.includes('sofa')) {
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
        seller: item.seller?.username || null,
        categoryPath: item.categoryPath || null,
        url: item.itemWebUrl || null,
        image: item.image?.imageUrl || null,
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
        brand: itemData.brand || null,
        condition: this.mapConditionForSearch(itemData.condition),
        categoryId: itemData.categoryId || null,
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

  /**
   * Get market data for itemized items in an assortment (e.g., box of books)
   * Only looks up items marked as searchable to avoid wasting API calls
   * @param {Array} itemizedList - Array of items from analysis.itemizedList
   * @param {Object} options - Options like maxLookups, skipNonSearchable
   * @returns {Object} - Enhanced itemized list with market data
   */
  async getMarketDataForItemizedList(itemizedList, options = {}) {
    const {
      maxLookups = 10,  // Limit API calls
      skipNonSearchable = true,
      delayBetweenCalls = 200  // ms between API calls to avoid rate limiting
    } = options;

    if (!Array.isArray(itemizedList) || itemizedList.length === 0) {
      return {
        success: true,
        itemizedList: [],
        totalValue: { low: 0, high: 0 },
        lookupCount: 0,
        skippedCount: 0
      };
    }

    console.log(`📚 Looking up market data for ${itemizedList.length} itemized items (max: ${maxLookups})`);

    const enhancedItems = [];
    let lookupCount = 0;
    let skippedCount = 0;
    let totalValueLow = 0;
    let totalValueHigh = 0;

    for (const item of itemizedList) {
      // Skip non-searchable items if option is set
      if (skipNonSearchable && !item.searchable) {
        console.log(`⏭️ Skipping non-searchable item: ${item.title}`);
        enhancedItems.push({
          ...item,
          marketData: null,
          lookupSkipped: true,
          skipReason: 'marked_non_searchable'
        });
        skippedCount++;
        continue;
      }

      // Respect max lookups limit
      if (lookupCount >= maxLookups) {
        console.log(`⏭️ Skipping item (max lookups reached): ${item.title}`);
        enhancedItems.push({
          ...item,
          marketData: null,
          lookupSkipped: true,
          skipReason: 'max_lookups_reached'
        });
        skippedCount++;
        continue;
      }

      try {
        // Build search query for this specific item
        const searchQuery = this.buildItemizedSearchQuery(item);

        if (!searchQuery) {
          console.log(`⏭️ Could not build search query for: ${item.title}`);
          enhancedItems.push({
            ...item,
            marketData: null,
            lookupSkipped: true,
            skipReason: 'no_search_query'
          });
          skippedCount++;
          continue;
        }

        console.log(`🔍 Looking up: "${searchQuery}" for "${item.title}"`);

        // Perform the search
        const marketData = await this.searchCurrentListings({
          keywords: searchQuery,
          condition: this.mapConditionForSearch(item.condition),
          maxResults: 20,
          itemData: { title: item.title, brand: item.author }
        });

        lookupCount++;

        if (marketData.success && marketData.statistics?.price) {
          const priceRange = {
            low: Math.round(marketData.statistics.price.p25 * 0.8 * 100) / 100,
            high: Math.round(marketData.statistics.price.p75 * 0.8 * 100) / 100,
            median: marketData.statistics.price.median
          };

          totalValueLow += priceRange.low;
          totalValueHigh += priceRange.high;

          enhancedItems.push({
            ...item,
            marketData: {
              found: true,
              priceRange,
              sampleSize: marketData.statistics.count,
              confidence: marketData.statistics.confidence,
              searchQuery
            }
          });

          console.log(`✅ Found market data for "${item.title}": $${priceRange.low}-$${priceRange.high}`);
        } else {
          enhancedItems.push({
            ...item,
            marketData: {
              found: false,
              searchQuery,
              error: marketData.error || 'No results'
            }
          });
          console.log(`❌ No market data found for "${item.title}"`);
        }

        // Delay between calls to avoid rate limiting
        if (lookupCount < maxLookups && delayBetweenCalls > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenCalls));
        }

      } catch (error) {
        console.error(`Error looking up item "${item.title}":`, error.message);
        enhancedItems.push({
          ...item,
          marketData: {
            found: false,
            error: error.message
          }
        });
      }
    }

    console.log(`📊 Itemized lookup complete: ${lookupCount} lookups, ${skippedCount} skipped`);
    console.log(`💰 Estimated total value: $${totalValueLow.toFixed(2)} - $${totalValueHigh.toFixed(2)}`);

    return {
      success: true,
      itemizedList: enhancedItems,
      totalValue: {
        low: Math.round(totalValueLow * 100) / 100,
        high: Math.round(totalValueHigh * 100) / 100
      },
      lookupCount,
      skippedCount,
      totalItems: itemizedList.length
    };
  }

  /**
   * Build a search query for an individual itemized item
   * @param {Object} item - Item from itemizedList
   * @returns {string|null} - Search query or null if not searchable
   */
  buildItemizedSearchQuery(item) {
    if (!item || !item.title) {
      return null;
    }

    const parts = [];

    // Clean the title - remove common non-searchable phrases
    let cleanTitle = item.title
      .replace(/\(partial\)/gi, '')
      .replace(/\(visible\)/gi, '')
      .replace(/unknown/gi, '')
      .trim();

    if (cleanTitle.length < 3) {
      return null;
    }

    parts.push(cleanTitle);

    // Add author/brand if meaningful
    if (item.author &&
        item.author !== 'Unknown' &&
        item.author.length > 1 &&
        !cleanTitle.toLowerCase().includes(item.author.toLowerCase())) {
      parts.push(item.author);
    }

    // Add type for context (helps narrow results)
    if (item.type && item.type !== 'Unknown') {
      // Only add type if it's specific
      const specificTypes = ['hardcover', 'board book', 'art book', 'textbook', 'novel'];
      if (specificTypes.some(t => item.type.toLowerCase().includes(t))) {
        parts.push(item.type);
      }
    }

    const query = parts.join(' ').trim();

    // Minimum query length check
    if (query.length < 5) {
      return null;
    }

    return query;
  }
}

// Export singleton instance
module.exports = new EbayMarketDataService();