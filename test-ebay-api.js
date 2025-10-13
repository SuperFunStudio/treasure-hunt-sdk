// test-ebay-api.js - Comprehensive eBay API Connection Test
// Run this in your Firebase Functions environment to test eBay API connectivity

const functions = require('firebase-functions');

// Import your eBay modules (adjust paths as needed)
// const { EbaySearchAPI } = require('./integrations/ebay/searchAPI.js');
// const { SimpleEbayAPI } = require('./integrations/ebay/simpleAPI.js');

// Test configuration - replace with your actual config
const testConfig = {
  clientId: process.env.EBAY_CLIENT_ID || 'YOUR_CLIENT_ID',
  clientSecret: process.env.EBAY_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  environment: process.env.EBAY_ENVIRONMENT || 'production'
};

// Simple inline eBay API class for testing (to avoid import issues)
class TestEbayAPI {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.environment = config.environment || 'production';
    this.accessToken = null;
  }

  async getToken() {
    const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
    
    if (this.accessToken) {
      return this.accessToken;
    }

    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    console.log('🔑 Requesting eBay access token...');
    console.log('Environment:', this.environment);
    console.log('Client ID prefix:', this.clientId.substring(0, 10) + '...');
    
    const tokenUrl = this.environment === 'sandbox' 
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

    try {
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

      const responseText = await response.text();
      console.log('Token response status:', response.status);
      console.log('Token response:', responseText);

      if (!response.ok) {
        throw new Error(`Token failed: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      this.accessToken = data.access_token;
      
      console.log('✅ Token acquired successfully');
      console.log('Token type:', data.token_type);
      console.log('Expires in:', data.expires_in, 'seconds');
      
      return this.accessToken;
    } catch (error) {
      console.error('❌ Token acquisition failed:', error.message);
      throw error;
    }
  }

  async searchItems(query, options = {}) {
    const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
    
    try {
      const token = await this.getToken();
      
      const apiUrl = this.environment === 'sandbox' 
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com';
      
      const searchUrl = `${apiUrl}/buy/browse/v1/item_summary/search`;
      const params = new URLSearchParams({
        q: query,
        limit: options.limit || '10',
        ...(options.categoryId && { category_ids: options.categoryId })
      });

      console.log(`🔍 Searching eBay for: "${query}"`);
      console.log('Search URL:', `${searchUrl}?${params}`);

      const response = await fetch(`${searchUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Accept': 'application/json'
        }
      });

      const responseText = await response.text();
      console.log('Search response status:', response.status);
      console.log('Search response length:', responseText.length, 'characters');

      if (!response.ok) {
        console.error('Search response error:', responseText);
        throw new Error(`Search failed: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('✅ Search successful');
      console.log('Items found:', data.itemSummaries?.length || 0);
      
      if (data.itemSummaries && data.itemSummaries.length > 0) {
        console.log('First item example:');
        const firstItem = data.itemSummaries[0];
        console.log('- Title:', firstItem.title);
        console.log('- Price:', firstItem.price?.value, firstItem.price?.currency);
        console.log('- Condition:', firstItem.condition);
        console.log('- URL:', firstItem.itemWebUrl);
      }

      return data.itemSummaries || [];
    } catch (error) {
      console.error('❌ Search failed:', error.message);
      throw error;
    }
  }

  async testPricing(itemData) {
    try {
      console.log('\n🧪 Testing pricing logic...');
      console.log('Item data:', JSON.stringify(itemData, null, 2));

      // Build search query like your actual implementation
      const searchTerms = [];
      
      if (itemData.brand && 
          itemData.brand !== 'Unknown' && 
          itemData.brand !== 'Generic' && 
          itemData.brand.length > 2) {
        searchTerms.push(itemData.brand);
      }
      
      if (itemData.model && itemData.model !== 'Unknown') {
        const modelTerms = itemData.model.toLowerCase().split(' ');
        const newTerms = modelTerms.filter(term => 
          !searchTerms.some(existing => existing.toLowerCase().includes(term))
        );
        if (newTerms.length > 0) {
          searchTerms.push(newTerms.join(' '));
        }
      }
      
      if (itemData.category) {
        if (itemData.category !== 'furniture' || searchTerms.length === 0) {
          searchTerms.push(itemData.category);
        }
      }

      const query = searchTerms.join(' ');
      console.log('Generated search query:', `"${query}"`);

      if (!query.trim()) {
        throw new Error('No valid search terms generated');
      }

      const items = await this.searchItems(query, { limit: 20 });
      
      if (items.length === 0) {
        return { 
          suggested: null, 
          confidence: 'low', 
          reason: `No similar items found for "${query}"`,
          source: 'ebay_no_results',
          searchQuery: query
        };
      }

      // Extract and analyze prices
      const prices = items
        .map(item => parseFloat(item.price?.value || 0))
        .filter(price => price > 0)
        .sort((a, b) => a - b);

      console.log('Valid prices found:', prices);

      if (prices.length === 0) {
        return { 
          suggested: null, 
          confidence: 'low', 
          reason: 'No valid prices found',
          source: 'ebay_no_prices',
          searchQuery: query
        };
      }

      const median = prices[Math.floor(prices.length / 2)];
      const average = prices.reduce((a, b) => a + b, 0) / prices.length;
      const min = prices[0];
      const max = prices[prices.length - 1];

      // Condition adjustment
     const conditionMultipliers = {
  'excellent': 1.0,
  'good': 0.75,      // Was 0.85 - too high
  'fair': 0.50,      // Was 0.65 - too high
  'poor': 0.25,      // Was 0.35 - way too high
  'parts_only': 0.15  // NEW - for non-functional items
};
      
      const conditionMultiplier = conditionMultipliers[itemData.condition?.rating || 'good'] || 0.75;
      const suggestedPrice = Math.round(median * conditionMultiplier);

      console.log('Pricing calculation:');
      console.log('- Median price:', median);
      console.log('- Condition multiplier:', conditionMultiplier);
      console.log('- Suggested price:', suggestedPrice);

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
      console.error('❌ Pricing test failed:', error.message);
      return { 
        suggested: null, 
        confidence: 'low', 
        reason: error.message,
        source: 'ebay_error'
      };
    }
  }
}

// Test function to run comprehensive eBay API tests
async function runEbayTests() {
  console.log('🚀 Starting comprehensive eBay API tests...\n');
  
  // Test 1: Configuration Check
  console.log('1️⃣ Configuration Check:');
  console.log('Client ID present:', !!testConfig.clientId && testConfig.clientId !== 'YOUR_CLIENT_ID');
  console.log('Client Secret present:', !!testConfig.clientSecret && testConfig.clientSecret !== 'YOUR_CLIENT_SECRET');
  console.log('Environment:', testConfig.environment);
  
  if (!testConfig.clientId || testConfig.clientId === 'YOUR_CLIENT_ID') {
    console.error('❌ eBay Client ID not configured');
    return { success: false, error: 'Missing eBay Client ID' };
  }
  
  if (!testConfig.clientSecret || testConfig.clientSecret === 'YOUR_CLIENT_SECRET') {
    console.error('❌ eBay Client Secret not configured');
    return { success: false, error: 'Missing eBay Client Secret' };
  }

  try {
    const api = new TestEbayAPI(testConfig);
    
    // Test 2: Token Acquisition
    console.log('\n2️⃣ Token Acquisition Test:');
    await api.getToken();
    
    // Test 3: Basic Search
    console.log('\n3️⃣ Basic Search Test:');
    const basicResults = await api.searchItems('iPhone');
    console.log('Basic search returned', basicResults.length, 'items');
    
    // Test 4: Category-specific Search
    console.log('\n4️⃣ Category Search Test:');
    const clothingResults = await api.searchItems('nike shirt');
    console.log('Clothing search returned', clothingResults.length, 'items');
    
    // Test 5: Pricing Logic Test
    console.log('\n5️⃣ Pricing Logic Test:');
    const testItem = {
      category: 'clothing',
      brand: 'Nike',
      model: 'T-shirt',
      condition: { rating: 'good' },
      description: 'Nike athletic t-shirt in good condition'
    };
    
    const pricingResult = await api.testPricing(testItem);
    console.log('Pricing result:', JSON.stringify(pricingResult, null, 2));
    
    // Test 6: Edge Cases
    console.log('\n6️⃣ Edge Case Tests:');
    
    // Test with Unknown brand
    const unknownBrandItem = {
      category: 'furniture',
      brand: 'Unknown',
      model: 'chair',
      condition: { rating: 'fair' }
    };
    
    const unknownResult = await api.testPricing(unknownBrandItem);
    console.log('Unknown brand test result:', unknownResult.source, unknownResult.confidence);
    
    // Test with very specific item
    const specificItem = {
      category: 'electronics',
      brand: 'Apple',
      model: 'iPhone 12 Pro',
      condition: { rating: 'excellent' }
    };
    
    const specificResult = await api.testPricing(specificItem);
    console.log('Specific item test result:', specificResult.source, specificResult.suggested);
    
    console.log('\n✅ All eBay API tests completed successfully!');
    
    return {
      success: true,
      results: {
        tokenAcquisition: true,
        basicSearch: basicResults.length > 0,
        categorySearch: clothingResults.length > 0,
        pricingLogic: pricingResult.source === 'ebay_api',
        edgeCases: {
          unknownBrand: unknownResult.source,
          specificItem: specificResult.source
        }
      }
    };
    
  } catch (error) {
    console.error('❌ eBay API test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Firebase Function to run tests (optional)
exports.testEbayAPI = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }
  
  try {
    const results = await runEbayTests();
    res.json(results);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// For local testing
if (require.main === module) {
  runEbayTests()    
    .then(results => {
      console.log('\n📊 Final Test Results:');
      console.log(JSON.stringify(results, null, 2));
    })
    .catch(error => {
      console.error('Test execution failed:', error);
    });
}

module.exports = { runEbayTests, TestEbayAPI };