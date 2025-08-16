// capture-sdk/index.js - Updated SDK with Claude as default provider
const { analyzeItem } = require('./core/analyzeItem.js');
const { routeDisposition } = require('./core/routeDisposition.js');
const { generateListing } = require('./core/generateListing.js');

class CaptureSDK {
  constructor(config = {}) {
    // Claude is now the default and only vision provider
    this.visionProvider = 'claude';
    this.apiKeys = config.apiKeys || {};
    
    // Support both old (gpt4v) and new (claude) key formats for migration
    if (config.apiKeys?.gpt4v && !config.apiKeys?.claude) {
      console.warn('⚠️ Warning: gpt4v API key provided but Claude is now the default. Please update to use claude API key.');
    }
    
    // eBay configuration
    this.ebayConfig = config.ebay || config.integrations?.ebay || null;
    
    // Log initialization status
    console.log('🚀 Capture SDK initialized with Claude:', {
      hasClaudeKey: !!(this.apiKeys.claude || process.env.CLAUDE_API_KEY),
      hasEbayConfig: !!(this.ebayConfig?.clientId && this.ebayConfig?.clientSecret),
      ebayEnvironment: this.ebayConfig?.environment || 'none'
    });

    // Validate Claude API key
    const claudeKey = this.apiKeys.claude || process.env.CLAUDE_API_KEY;
    if (!claudeKey) {
      console.warn('⚠️ Warning: No Claude API key found. Set CLAUDE_API_KEY environment variable or pass apiKeys.claude in config.');
    }
  }

  /**
   * Analyze item images using Claude
   * @param {Array} images - Array of image data (Buffer, base64, or data URLs)
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Normalized item analysis
   */
  async analyzeItem(images, options = {}) {
    const analysisOptions = {
      ...options,
      apiKey: this.apiKeys.claude || process.env.CLAUDE_API_KEY,
      model: options.model || 'claude-sonnet-4-20250514',
      temperature: options.temperature || 0.1,
      maxTokens: options.maxTokens || 1500
    };
    
    console.log('🔍 Starting item analysis with Claude:', {
      imageCount: images?.length,
      model: analysisOptions.model,
      hasApiKey: !!analysisOptions.apiKey
    });
    
    return await analyzeItem(images, analysisOptions);
  }

  /**
   * Get disposition routes with eBay pricing integration
   */
  async getRoutes(itemData, userPreferences = {}, ebayConfigOverride = null) {
    const ebayConfig = ebayConfigOverride || this.ebayConfig;
    
    console.log('📊 Getting routes with eBay integration:', {
      hasConfig: !!ebayConfig,
      hasClientId: !!ebayConfig?.clientId,
      category: itemData.category,
      brand: itemData.brand
    });
    
    return await routeDisposition(itemData, userPreferences, ebayConfig);
  }

  /**
   * Generate marketplace listing
   */
  async generateListing(itemData, route, options = {}) {
    console.log('📝 Generating listing:', {
      platform: options.platform || 'ebay',
      routeType: route.type,
      category: itemData.category
    });
    
    return generateListing(itemData, route, options);
  }

  /**
   * Test Claude API connection
   */
  async testClaudeConnection() {
    const claudeKey = this.apiKeys.claude || process.env.CLAUDE_API_KEY;
    
    if (!claudeKey) {
      return {
        success: false,
        error: 'No Claude API key configured',
        solution: 'Set CLAUDE_API_KEY environment variable or pass apiKeys.claude in config'
      };
    }

    try {
      // Simple test with a basic image (1x1 pixel base64 image)
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      
      const result = await this.analyzeItem([testImage], {
        maxTokens: 500,  // Increased for complete JSON response
        temperature: 0.1
      });
      
      return {
        success: true,
        message: 'Claude API connection successful',
        testResult: {
          category: result.category,
          confidence: result.confidence,
          hasError: !!result.error
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: 'Check your Claude API key and network connection'
      };
    }
  }

  /**
   * Test eBay API connection
   */
  async testEbayConnection() {
    if (!this.ebayConfig?.clientId || !this.ebayConfig?.clientSecret) {
      return {
        success: false,
        error: 'eBay configuration missing',
        solution: 'Provide ebay.clientId and ebay.clientSecret in SDK config'
      };
    }

    try {
      // Test with a simple item
      const testItem = {
        category: 'electronics',
        brand: 'Apple',
        model: 'iPhone',
        condition: { rating: 'good' }
      };

      const routes = await this.getRoutes(testItem);
      
      return {
        success: true,
        message: 'eBay API connection successful',
        testResult: {
          hasEbayPricing: routes.marketAnalysis?.dataSource?.includes('ebay'),
          suggestedPrice: routes.marketAnalysis?.estimatedValue?.suggested
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: 'Check your eBay API credentials and permissions'
      };
    }
  }

  /**
   * Full system health check
   */
  async healthCheck() {
    console.log('🏥 Running SDK health check...');
    
    const [claudeTest, ebayTest] = await Promise.all([
      this.testClaudeConnection(),
      this.testEbayConnection()
    ]);

    const health = {
      status: claudeTest.success ? 'healthy' : 'degraded',
      claude: claudeTest,
      ebay: ebayTest,
      features: {
        itemAnalysis: claudeTest.success,
        ebayPricing: ebayTest.success,
        basicPricing: true,
        listingGeneration: true
      },
      timestamp: new Date().toISOString()
    };

    console.log('🏥 Health check complete:', {
      status: health.status,
      claudeOk: claudeTest.success,
      ebayOk: ebayTest.success
    });

    return health;
  }

  // Legacy map-related methods (placeholder implementations)
  async dropPin(pinData) {
    console.log('📍 dropPin called:', pinData);
    return { 
      pinId: `pin_${Date.now()}`,
      ...pinData,
      status: 'active'
    };
  }

  async getNearbyPins(location, radius = 5) {
    console.log('🗺️ getNearbyPins called:', location, radius);
    return [];
  }

  /**
   * Quick analyze - simplified method for single image analysis
   */
  async quickAnalyze(image, options = {}) {
    return await this.analyzeItem([image], {
      ...options,
      maxTokens: 800,
      temperature: 0.1
    });
  }

  /**
   * Get simple price estimate without full route analysis
   */
  async getQuickPrice(itemData) {
    try {
      const routes = await this.getRoutes(itemData);
      return {
        suggested: routes.marketAnalysis?.estimatedValue?.suggested || 0,
        confidence: routes.marketAnalysis?.estimatedValue?.confidence || 'low',
        source: routes.marketAnalysis?.dataSource || 'manual'
      };
    } catch (error) {
      console.error('Quick price failed:', error);
      return {
        suggested: 0,
        confidence: 'low',
        source: 'error',
        error: error.message
      };
    }
  }
}

// Static helper methods
CaptureSDK.createConfig = function(claudeApiKey, ebayConfig = null) {
  return {
    apiKeys: {
      claude: claudeApiKey
    },
    ebay: ebayConfig
  };
};

CaptureSDK.validateImage = function(image) {
  if (!image) return { valid: false, error: 'No image provided' };
  
  if (typeof image === 'string') {
    if (image.startsWith('data:image/') || image.startsWith('http')) {
      return { valid: true };
    }
    if (image.length > 100) { // Likely base64
      return { valid: true };
    }
    return { valid: false, error: 'Invalid image string format' };
  }
  
  if (Buffer.isBuffer(image)) {
    return { valid: true };
  }
  
  if (typeof image === 'object' && (image.buffer || image.base64 || image.url)) {
    return { valid: true };
  }
  
  return { valid: false, error: 'Unsupported image format' };
};

// Export for both CommonJS and ES modules
module.exports = CaptureSDK;
module.exports.default = CaptureSDK;

// Usage examples in comments:
/*
// Basic usage with Claude
const sdk = new CaptureSDK({
  apiKeys: {
    claude: 'your-claude-api-key'
  }
});

// With eBay integration
const sdk = new CaptureSDK({
  apiKeys: {
    claude: process.env.CLAUDE_API_KEY
  },
  ebay: {
    clientId: process.env.EBAY_CLIENT_ID,
    clientSecret: process.env.EBAY_CLIENT_SECRET,
    environment: 'production'
  }
});

// Quick analysis
const result = await sdk.analyzeItem([imageBuffer]);

// Full workflow
const itemData = await sdk.analyzeItem([image1, image2]);
const routes = await sdk.getRoutes(itemData);
const listing = await sdk.generateListing(itemData, routes.recommendedRoute);

// Health check
const health = await sdk.healthCheck();
console.log('SDK Status:', health.status);
*/