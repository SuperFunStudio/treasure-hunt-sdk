// capture-sdk/integrations/ebay/simpleAPI.js
// Simple eBay API integration using the exact working method

export class SimpleEbayAPI {
    constructor(config) {
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret;
      this.environment = config.environment || 'production';
      this.accessToken = null;
    }
  
    async getToken() {
      if (this.accessToken) {
        return this.accessToken;
      }
  
      const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await fetch(this.getTokenUrl(), {
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
        throw new Error(`Token failed: ${response.status} - ${errorText}`);
      }
  
      const data = await response.json();
      this.accessToken = data.access_token;
      
      // Auto-expire token
      setTimeout(() => {
        this.accessToken = null;
      }, (data.expires_in - 60) * 1000);
  
      return this.accessToken;
    }
  
    async searchItems(query, options = {}) {
      const token = await this.getToken();
      
      const searchUrl = `${this.getApiUrl()}/buy/browse/v1/item_summary/search`;
      const params = new URLSearchParams({
        q: query,
        limit: options.limit || '25',
        ...(options.categoryId && { category_ids: options.categoryId }),
        ...(options.condition && { filter: `conditionIds:{${options.condition}}` })
      });
  
      const response = await fetch(`${searchUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search failed: ${response.status} - ${errorText}`);
      }
  
      const data = await response.json();
      return data.itemSummaries || [];
    }
  
    async getPricing(itemData) {
      try {
        // Build search query - prioritize model and descriptive terms over "Unknown" brand
        const searchTerms = [];
        
        // Only add brand if it's not "Unknown" or generic
        if (itemData.brand && 
            itemData.brand !== 'Unknown' && 
            itemData.brand !== 'Generic' && 
            itemData.brand.length > 2) {
          searchTerms.push(itemData.brand);
        }
        
        // Add model/description - this is often the most descriptive
        if (itemData.model && itemData.model !== 'Unknown') {
          // Avoid duplicating terms already in the query
          const modelTerms = itemData.model.toLowerCase().split(' ');
          const newTerms = modelTerms.filter(term => 
            !searchTerms.some(existing => existing.toLowerCase().includes(term))
          );
          if (newTerms.length > 0) {
            searchTerms.push(newTerms.join(' '));
          }
        }
        
        // Add category for context, but make it more specific
        if (itemData.category) {
          // Don't add generic "furniture" - be more specific if possible
          if (itemData.category !== 'furniture' || searchTerms.length === 0) {
            searchTerms.push(itemData.category);
          }
        }
        
        // If we only have category, try to extract keywords from description
        if (searchTerms.length === 1 && itemData.description) {
          const keywords = this.extractKeywords(itemData.description);
          searchTerms.push(...keywords.slice(0, 2));
        }
        
        const query = searchTerms.join(' ');
        console.log(`Searching eBay for: "${query}"`);
  
        // Search for similar items
        const items = await this.searchItems(query, { limit: 20 });
        
        if (items.length === 0) {
          return { 
            suggested: null, 
            confidence: 'low', 
            reason: `No similar items found for "${query}"`,
            source: 'ebay_no_results'
          };
        }
  
        // Extract prices
        const prices = items
          .map(item => parseFloat(item.price?.value || 0))
          .filter(price => price > 0)
          .sort((a, b) => a - b);
  
        if (prices.length === 0) {
          return { 
            suggested: null, 
            confidence: 'low', 
            reason: 'No valid prices found',
            source: 'ebay_no_prices'
          };
        }
  
        // Calculate statistics
        const median = prices[Math.floor(prices.length / 2)];
        const average = prices.reduce((a, b) => a + b, 0) / prices.length;
        const min = prices[0];
        const max = prices[prices.length - 1];
  
        // Adjust for condition
        const conditionMultiplier = this.getConditionMultiplier(itemData.condition?.rating || 'good');
        const suggestedPrice = Math.round(median * conditionMultiplier);
  
        return {
          suggested: suggestedPrice,
          confidence: prices.length >= 5 ? 'high' : 'medium',
          priceRange: { min, max, median, average },
          sampleSize: prices.length,
          searchQuery: query,
          comparableItems: items.slice(0, 5).map(item => ({
            title: item.title,
            price: parseFloat(item.price?.value || 0),
            url: item.itemWebUrl,
            condition: item.condition
          })),
          source: 'ebay_api'
        };
  
      } catch (error) {
        console.error('eBay pricing error:', error.message);
        return { 
          suggested: null, 
          confidence: 'low', 
          reason: error.message,
          source: 'ebay_error'
        };
      }
    }
  
    extractKeywords(description) {
      // Extract meaningful keywords from description
      const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'has', 'have', 'shows', 'some', 'signs'];
      
      return description
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter(word => word.length > 3 && !stopWords.includes(word))
        .slice(0, 3);
    }
  
    getConditionMultiplier(condition) {
      const multipliers = {
        'excellent': 1.0,
        'good': 0.85,
        'fair': 0.65,
        'poor': 0.35
      };
      return multipliers[condition] || 0.75;
    }
  
    getApiUrl() {
      return this.environment === 'sandbox' 
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com';
    }
  
    getTokenUrl() {
      return this.environment === 'sandbox'
        ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
        : 'https://api.ebay.com/identity/v1/oauth2/token';
    }
  }