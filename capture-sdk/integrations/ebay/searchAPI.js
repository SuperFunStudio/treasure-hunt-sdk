// capture-sdk/integrations/ebay/searchAPI.js
// eBay Browse API implementation for finding similar items and pricing

export class EbaySearchAPI {
    constructor(config) {
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret;
      this.environment = config.environment || 'production';
      this.accessToken = null;
    }
  
    /**
     * Search for similar items on eBay using Browse API
     */
    async searchSimilarItems(itemData, options = {}) {
      const {
        includeSold = true,
        maxResults = 50,
        conditionFilter = null,
        priceRange = null,
        sortBy = 'price' // price, endingSoonest, newlyListed
      } = options;
  
      try {
        // Get application access token (for Browse API)
        await this.getApplicationToken();
  
        // Build search query
        const searchQuery = this.buildSearchQuery(itemData);
        console.log('Searching eBay for:', searchQuery);
  
        // Search active listings
        const activeListings = await this.searchActiveListings(searchQuery, {
          maxResults: Math.floor(maxResults / 2),
          conditionFilter,
          priceRange,
          sortBy
        });
  
        // Search sold listings (if available and requested)
        let soldListings = [];
        if (includeSold) {
          soldListings = await this.searchSoldListings(searchQuery, {
            maxResults: Math.floor(maxResults / 2),
            conditionFilter
          });
        }
  
        return {
          query: searchQuery,
          activeListings,
          soldListings,
          priceAnalysis: this.analyzePricing(activeListings, soldListings),
          searchMetadata: {
            totalActive: activeListings.length,
            totalSold: soldListings.length,
            searchTerms: searchQuery,
            timestamp: new Date().toISOString()
          }
        };
  
      } catch (error) {
        console.error('eBay search error:', error);
        throw new Error(`eBay search failed: ${error.message}`);
      }
    }
  
    /**
     * Build search query from item analysis data
     */
    buildSearchQuery(itemData) {
      const parts = [];
      
      // Add brand if known and not generic
      if (itemData.brand && itemData.brand !== 'Unknown' && itemData.brand !== 'Generic') {
        parts.push(itemData.brand);
      }
      
      // Add model if known
      if (itemData.model && itemData.model !== 'Unknown' && itemData.model !== 'See photos') {
        parts.push(itemData.model);
      }
      
      // Add category/item type
      if (itemData.category) {
        parts.push(itemData.category);
      }
  
      // Add key descriptive terms from item analysis
      if (itemData.description) {
        const keywords = this.extractKeywords(itemData.description);
        parts.push(...keywords.slice(0, 2)); // Add top 2 keywords
      }
  
      return parts.join(' ').trim();
    }
  
    /**
     * Extract relevant keywords from item description
     */
    extractKeywords(description) {
      // Simple keyword extraction - could be enhanced with NLP
      const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'];
      
      return description
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter(word => word.length > 3 && !commonWords.includes(word))
        .slice(0, 5);
    }
  
    /**
     * Search active eBay listings
     */
    async searchActiveListings(query, options = {}) {
      const {
        maxResults = 25,
        conditionFilter,
        priceRange,
        sortBy = 'price'
      } = options;
  
      const url = `${this.getBrowseApiUrl()}/buy/browse/v1/item_summary/search`;
      
      const params = new URLSearchParams({
        q: query,
        limit: maxResults.toString(),
        sort: sortBy,
        filter: this.buildFilters(conditionFilter, priceRange)
      });
  
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'X-EBAY-C-ENDUSERCTX': 'affiliateCampaignId=<ePNCampaignId>,affiliateReferenceId=<referenceId>'
        }
      });
  
      if (!response.ok) {
        throw new Error(`eBay Browse API error: ${response.status} ${response.statusText}`);
      }
  
      const data = await response.json();
      
      return (data.itemSummaries || []).map(item => ({
        itemId: item.itemId,
        title: item.title,
        price: this.parsePrice(item.price),
        condition: item.condition,
        imageUrl: item.image?.imageUrl,
        itemWebUrl: item.itemWebUrl,
        seller: item.seller?.username,
        shippingCost: this.parsePrice(item.shippingOptions?.[0]?.shippingCost),
        buyItNowAvailable: item.buyingOptions?.includes('FIXED_PRICE'),
        auctionAvailable: item.buyingOptions?.includes('AUCTION'),
        endDate: item.itemEndDate,
        location: item.itemLocation?.country
      }));
    }
  
    /**
     * Search sold listings (requires different approach)
     * Note: eBay's Browse API doesn't directly support sold listings
     * This would typically require the Trading API or alternative methods
     */
    async searchSoldListings(query, options = {}) {
      // For now, return mock data or use alternative approach
      // In production, you might:
      // 1. Use eBay's Trading API with GetSearchResults
      // 2. Use a third-party service like TeraPeak
      // 3. Implement web scraping (against ToS, not recommended)
      
      console.log('Sold listings search would require Trading API or alternative approach');
      return []; // Empty for now
    }
  
    /**
     * Build filter string for eBay API
     */
    buildFilters(conditionFilter, priceRange) {
      const filters = [];
      
      if (conditionFilter) {
        // eBay condition IDs: NEW=1000, LIKE_NEW=1500, EXCELLENT=2000, VERY_GOOD=2500, GOOD=3000, ACCEPTABLE=4000, FOR_PARTS=7000
        const conditionMap = {
          'new': '1000',
          'like_new': '1500',
          'excellent': '2000',
          'very_good': '2500',
          'good': '3000',
          'acceptable': '4000',
          'for_parts': '7000'
        };
        
        const conditionId = conditionMap[conditionFilter.toLowerCase()];
        if (conditionId) {
          filters.push(`conditionIds:{${conditionId}}`);
        }
      }
  
      if (priceRange) {
        if (priceRange.min) filters.push(`price:[${priceRange.min}..]`);
        if (priceRange.max) filters.push(`price:[..${priceRange.max}]`);
      }
  
      return filters.join(',');
    }
  
    /**
     * Analyze pricing from search results
     */
    analyzePricing(activeListings, soldListings = []) {
      if (activeListings.length === 0 && soldListings.length === 0) {
        return {
          suggested: null,
          confidence: 'low',
          reason: 'No comparable items found'
        };
      }
  
      // Combine all prices
      const allPrices = [
        ...activeListings.map(item => item.price).filter(p => p > 0),
        ...soldListings.map(item => item.price).filter(p => p > 0)
      ].sort((a, b) => a - b);
  
      if (allPrices.length === 0) {
        return {
          suggested: null,
          confidence: 'low',
          reason: 'No valid prices found'
        };
      }
  
      // Calculate statistics
      const min = allPrices[0];
      const max = allPrices[allPrices.length - 1];
      const median = allPrices[Math.floor(allPrices.length / 2)];
      const average = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
      
      // Remove outliers (prices more than 2 standard deviations from mean)
      const stdDev = Math.sqrt(allPrices.reduce((a, p) => a + Math.pow(p - average, 2), 0) / allPrices.length);
      const filteredPrices = allPrices.filter(p => Math.abs(p - average) <= 2 * stdDev);
      
      const adjustedMedian = filteredPrices[Math.floor(filteredPrices.length / 2)] || median;
  
      // Determine confidence based on sample size and price variance
      let confidence = 'medium';
      if (allPrices.length >= 10 && stdDev < average * 0.3) {
        confidence = 'high';
      } else if (allPrices.length < 3 || stdDev > average * 0.5) {
        confidence = 'low';
      }
  
      return {
        suggested: Math.round(adjustedMedian),
        priceRange: {
          min: Math.round(min),
          max: Math.round(max),
          median: Math.round(median),
          average: Math.round(average)
        },
        confidence,
        sampleSize: allPrices.length,
        variance: Math.round(stdDev),
        reason: `Based on ${allPrices.length} comparable items`
      };
    }
  
    /**
     * Get application token for Browse API
     */
    async getApplicationToken() {
      if (this.accessToken) {
        return this.accessToken;
      }
  
      const response = await fetch(`${this.getTokenUrl()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${this.getBasicAuth()}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'https://api.ebayapis.com/oauth/api_scope/buy.item.feed'
        })
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('eBay token error:', errorText);
        throw new Error(`Token request failed: ${response.status} - ${errorText}`);
      }
  
      const data = await response.json();
      this.accessToken = data.access_token;
      
      // Set token expiration
      setTimeout(() => {
        this.accessToken = null;
      }, (data.expires_in - 60) * 1000); // Refresh 1 minute before expiry
  
      return this.accessToken;
    }
  
    /**
     * Parse eBay price object
     */
    parsePrice(priceObj) {
      if (!priceObj || !priceObj.value) return 0;
      return parseFloat(priceObj.value);
    }
  
    /**
     * Get Browse API base URL
     */
    getBrowseApiUrl() {
      return this.environment === 'sandbox' 
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com';
    }
  
    /**
     * Get token endpoint URL
     */
    getTokenUrl() {
      return this.environment === 'sandbox'
        ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
        : 'https://api.ebay.com/identity/v1/oauth2/token';
    }
  
    /**
     * Get basic auth header
     */
    getBasicAuth() {
      return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    }
  }