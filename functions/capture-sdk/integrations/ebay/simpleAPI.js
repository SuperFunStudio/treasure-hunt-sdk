// functions/capture-sdk/integrations/ebay/simpleAPI.js - FIXED VERSION
// Fixed exports, imports, and enhanced error handling

// Add fetch import for Node.js environments
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

class SimpleEbayAPI {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.environment = config.environment || 'production';
    this.accessToken = null;
    this.debugMode = config.debug || false;
    
    this.log('SimpleEbayAPI initialized', {
      environment: this.environment,
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret
    });
  }

  log(message, data = null) {
    if (this.debugMode || true) { // Always log for debugging
      console.log(`[SimpleEbayAPI] ${message}`, data || '');
    }
  }

  async getToken() {
    if (this.accessToken) {
      this.log('Using cached access token');
      return this.accessToken;
    }

    this.log('Requesting new access token...');
    
    if (!this.clientId || !this.clientSecret) {
      const error = 'Missing eBay credentials (clientId or clientSecret)';
      this.log('❌ ' + error);
      throw new Error(error);
    }

    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    try {
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

      const responseText = await response.text();
      this.log('Token response status:', response.status);
      
      if (!response.ok) {
        this.log('❌ Token request failed:', responseText);
        throw new Error(`Token failed: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      this.accessToken = data.access_token;
      
      // Auto-expire token
      setTimeout(() => {
        this.log('Access token expired, will request new one');
        this.accessToken = null;
      }, (data.expires_in - 60) * 1000);

      this.log('✅ Token acquired successfully');
      return this.accessToken;
    } catch (error) {
      this.log('❌ Token acquisition failed:', error.message);
      throw error;
    }
  }

  async searchItems(query, options = {}) {
    this.log(`Searching eBay for: "${query}"`, options);
    
    try {
      const token = await this.getToken();
      
      const searchUrl = `${this.getApiUrl()}/buy/browse/v1/item_summary/search`;
      const params = new URLSearchParams({
        q: query,
        limit: options.limit || '25',
        ...(options.categoryId && { category_ids: options.categoryId }),
        ...(options.condition && { filter: `conditionIds:{${options.condition}}` })
      });

      this.log('Search URL:', `${searchUrl}?${params}`);

      const response = await fetch(`${searchUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Accept': 'application/json'
        }
      });

      const responseText = await response.text();
      this.log('Search response status:', response.status);
      this.log('Response length:', responseText.length + ' characters');

      if (!response.ok) {
        this.log('❌ Search request failed:', responseText);
        throw new Error(`Search failed: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      const items = data.itemSummaries || [];
      
      this.log(`✅ Search successful: ${items.length} items found`);
      
      if (items.length > 0) {
        this.log('Sample item:', {
          title: items[0].title?.substring(0, 50) + '...',
          price: items[0].price?.value,
          condition: items[0].condition
        });
      }

      return items;
    } catch (error) {
      this.log('❌ Search failed:', error.message);
      throw error;
    }
  }

  async getPricing(itemData) {
    this.log('Getting pricing for item:', {
      category: itemData.category,
      brand: itemData.brand,
      model: itemData.model,
      condition: itemData.condition?.rating
    });

    try {
      // Build search query - prioritize model and descriptive terms over "Unknown" brand
      const searchTerms = [];
      
      // Only add brand if it's not "Unknown" or generic
      if (itemData.brand && 
          itemData.brand !== 'Unknown' && 
          itemData.brand !== 'Generic' && 
          itemData.brand.length > 2) {
        searchTerms.push(itemData.brand);
        this.log('Added brand to search:', itemData.brand);
      } else {
        this.log('Skipping brand (Unknown/Generic):', itemData.brand);
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
          this.log('Added model terms:', newTerms);
        }
      } else {
        this.log('Skipping model (Unknown):', itemData.model);
      }
      
      // Add category for context, but make it more specific
      if (itemData.category) {
        // Don't add generic "furniture" - be more specific if possible
        if (itemData.category !== 'furniture' || searchTerms.length === 0) {
          searchTerms.push(itemData.category);
          this.log('Added category:', itemData.category);
        }
      }
      
      // If we only have category, try to extract keywords from description
      if (searchTerms.length === 1 && itemData.description) {
        const keywords = this.extractKeywords(itemData.description);
        if (keywords.length > 0) {
          searchTerms.push(...keywords.slice(0, 2));
          this.log('Added keywords from description:', keywords.slice(0, 2));
        }
      }
      
      const query = searchTerms.join(' ');
      this.log(`Final search query: "${query}"`);

      // Validate query
      if (!query.trim()) {
        this.log('❌ No valid search terms generated');
        return { 
          suggested: null, 
          confidence: 'low', 
          reason: 'No valid search terms could be generated from item data',
          source: 'ebay_no_query',
          searchAttempted: true,
          itemData: {
            category: itemData.category,
            brand: itemData.brand,
            model: itemData.model
          }
        };
      }

      // Search for similar items
      const items = await this.searchItems(query, { limit: 20 });
      
      if (items.length === 0) {
        this.log('❌ No items found on eBay');
        return { 
          suggested: null, 
          confidence: 'low', 
          reason: `No similar items found for "${query}"`,
          source: 'ebay_no_results',
          searchQuery: query,
          searchAttempted: true
        };
      }

      // Extract prices
      const prices = items
        .map(item => {
          const price = parseFloat(item.price?.value || 0);
          this.log('Item price extracted:', {
            title: item.title?.substring(0, 30) + '...',
            price: price,
            currency: item.price?.currency
          });
          return price;
        })
        .filter(price => price > 0)
        .sort((a, b) => a - b);

      this.log('Valid prices found:', prices);

      if (prices.length === 0) {
        this.log('❌ No valid prices found');
        return { 
          suggested: null, 
          confidence: 'low', 
          reason: 'No valid prices found in search results',
          source: 'ebay_no_prices',
          searchQuery: query,
          itemsFound: items.length,
          searchAttempted: true
        };
      }

      // Calculate statistics
      const median = prices[Math.floor(prices.length / 2)];
      const average = prices.reduce((a, b) => a + b, 0) / prices.length;
      const min = prices[0];
      const max = prices[prices.length - 1];

      this.log('Price statistics:', { min, max, median, average, count: prices.length });

      // Adjust for condition
      const conditionMultiplier = this.getConditionMultiplier(itemData.condition?.rating || 'good');
      const suggestedPrice = Math.round(median * conditionMultiplier);

      this.log('Price calculation:', {
        median: median,
        conditionMultiplier: conditionMultiplier,
        suggestedPrice: suggestedPrice
      });

      const result = {
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
        source: 'ebay_api',
        searchAttempted: true,
        conditionAdjustment: conditionMultiplier
      };

      this.log('✅ Pricing complete:', {
        suggested: result.suggested,
        confidence: result.confidence,
        sampleSize: result.sampleSize,
        source: result.source
      });

      return result;

    } catch (error) {
      this.log('❌ Pricing error:', error.message);
      return { 
        suggested: null, 
        confidence: 'low', 
        reason: `eBay API error: ${error.message}`,
        source: 'ebay_error',
        searchAttempted: true,
        error: error.message
      };
    }
  }

  extractKeywords(description) {
    // Extract meaningful keywords from description
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'has', 'have', 'shows', 'some', 'signs'];
    
    const keywords = description
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, 3);
    
    this.log('Extracted keywords:', keywords);
    return keywords;
  }

  getConditionMultiplier(condition) {
    const multipliers = {
      'excellent': 1.0,
      'good': 0.85,
      'fair': 0.65,
      'poor': 0.35
    };
    
    const multiplier = multipliers[condition] || 0.75;
    this.log('Condition multiplier:', { condition, multiplier });
    return multiplier;
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

  // Test function to verify API connectivity
  async testConnection() {
    this.log('Testing eBay API connection...');
    
    try {
      // Test 1: Token acquisition
      const token = await this.getToken();
      this.log('✅ Token test passed');
      
      // Test 2: Basic search
      const items = await this.searchItems('test', { limit: 5 });
      this.log('✅ Search test passed:', items.length + ' items');
      
      // Test 3: Pricing test
      const testItem = {
        category: 'electronics',
        brand: 'Apple',
        model: 'iPhone',
        condition: { rating: 'good' }
      };
      
      const pricing = await this.getPricing(testItem);
      this.log('✅ Pricing test:', pricing.source);
      
      return {
        success: true,
        tests: {
          token: true,
          search: items.length > 0,
          pricing: pricing.source === 'ebay_api'
        }
      };
      
    } catch (error) {
      this.log('❌ Connection test failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// FIXED: Correct module export
module.exports = { SimpleEbayAPI };