// functions/capture-sdk/integrations/ebay/enhanced-integration.js
// Enhanced eBay Integration with OAuth token management

const { EbayTokenManager } = require('../../../utils/ebay-token-manager.js');
const { EbayCategoryHandler } = require('../../utils/ebayCategoryHandler.js');

class EnhancedEbayIntegration {
  constructor(config = {}) {
    this.tokenManager = new EbayTokenManager();
    this.environment = config.environment || process.env.EBAY_ENVIRONMENT || 'production';
    this.categoryHandler = new EbayCategoryHandler(this);
    
    // Policy cache to avoid recreating policies
    this.policyCache = {
      fulfillment: null,
      payment: null,
      return: null
    };
  }

  /**
   * Create listing for authenticated user
   */
  async createUserListing(userId, listingData) {
    try {
      console.log('Creating eBay listing for user:', userId);

      // Get valid access token
      const tokenInfo = await this.tokenManager.getValidAccessToken(userId);
      
      // Set access token for this session
      this.accessToken = tokenInfo.accessToken;

      // Validate listing data
      this.validateListingData(listingData);
      
      // Step 1: Create inventory item
      const inventoryItem = await this.createInventoryItem(listingData);
      
      // Step 2: Create offer
      const offer = await this.createOffer(inventoryItem.sku, listingData);
      
      // Step 3: Publish offer
      const publishResult = await this.publishOffer(offer.offerId);
      
      const result = {
        success: true,
        listingId: publishResult.listingId,
        sku: inventoryItem.sku,
        offerId: offer.offerId,
        url: this.getListingUrl(publishResult.listingId),
        ebayItemId: publishResult.listingId,
        status: 'active',
        userId: userId,
        createdAt: new Date().toISOString()
      };

      console.log('eBay listing created successfully:', result.listingId);
      return result;

    } catch (error) {
      console.error('eBay listing creation failed:', error);
      return {
        success: false,
        error: error.message,
        details: error.response || error,
        userId: userId
      };
    }
  }

  /**
   * Get user's eBay selling privileges
   */
  async getUserPrivileges(userId) {
    try {
      const tokenInfo = await this.tokenManager.getValidAccessToken(userId);
      this.accessToken = tokenInfo.accessToken;

      const privileges = await this.apiCall('GET', '/sell/account/v1/privilege');
      return {
        success: true,
        privileges: privileges
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Smart listing creation with category adaptation
   */
  async createAdaptiveListing(userId, listingData, itemAnalysis = {}) {
    try {
      const tokenInfo = await this.tokenManager.getValidAccessToken(userId);
      this.accessToken = tokenInfo.accessToken;

      return await this.categoryHandler.createAdaptiveListing(listingData, itemAnalysis);
    } catch (error) {
      throw new Error(`Adaptive listing failed: ${error.message}`);
    }
  }

  /**
   * Test eBay API connection for user
   */
  async testUserConnection(userId) {
    try {
      const isConnected = await this.tokenManager.isUserConnected(userId);
      if (!isConnected) {
        return {
          success: false,
          error: 'User not connected to eBay'
        };
      }

      const tokenInfo = await this.tokenManager.getValidAccessToken(userId);
      this.accessToken = tokenInfo.accessToken;

      // Test API call
      const privileges = await this.apiCall('GET', '/sell/account/v1/privilege');
      
      return {
        success: true,
        connected: true,
        tokenValid: true,
        tokenRefreshed: tokenInfo.refreshed,
        privileges: privileges
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        connected: false
      };
    }
  }

  // Validate listing data before submission
  validateListingData(listingData) {
    const required = ['title', 'description', 'images', 'pricing', 'condition'];
    const missing = required.filter(field => !listingData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required listing data: ${missing.join(', ')}`);
    }
    
    if (!listingData.images || listingData.images.length === 0) {
      throw new Error('At least one image is required');
    }
    
    if (!listingData.pricing.buyItNowPrice || listingData.pricing.buyItNowPrice <= 0) {
      throw new Error('Valid buy-it-now price is required');
    }
  }

  async createInventoryItem(listingData) {
    // Generate unique SKU
    const sku = `TS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const inventoryItem = {
      condition: this.mapCondition(listingData.condition),
      product: {
        title: listingData.title.substring(0, 80), // eBay title limit
        description: listingData.description,
        imageUrls: listingData.images.slice(0, 12), // eBay image limit
        aspects: listingData.itemSpecifics || {}
      },
      availability: {
        shipToLocationAvailability: {
          quantity: 1
        }
      },
      // Add package details for shipping requirements
      packageWeightAndSize: {
        weight: { value: listingData.weight || 1.0, unit: "POUND" },
        dimensions: {
          length: listingData.length || 10.0,
          width: listingData.width || 8.0,
          height: listingData.height || 6.0,
          unit: "INCH"
        }
      }
    };

    const response = await this.apiCall('PUT', `/sell/inventory/v1/inventory_item/${sku}`, inventoryItem);
    
    return { sku, ...response };
  }

  // Map conditions to eBay standard values (numeric IDs)
  mapCondition(condition) {
    const conditionMap = {
      'new': '1000',           // New
      'like new': '1500',      // Open box/New Other  
      'excellent': '3000',     // Used
      'very good': '3000',     // Used
      'good': '3000',          // Used
      'acceptable': '3000',    // Used
      'for parts': '7000'      // For parts or not working
    };
    
    return conditionMap[condition.toLowerCase()] || '3000'; // Default to Used
  }

  async createOffer(sku, listingData) {
    const offer = {
      sku: sku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      pricingSummary: {
        price: {
          currency: 'USD',
          value: listingData.pricing.buyItNowPrice.toString()
        }
      },
      categoryId: listingData.category || await this.suggestCategory(listingData.title),
      merchantLocationKey: await this.getOrCreateMerchantLocation(),
      listingPolicies: {
        fulfillmentPolicyId: await this.getOrCreateFulfillmentPolicy(),
        paymentPolicyId: await this.getOrCreatePaymentPolicy(),
        returnPolicyId: await this.getOrCreateReturnPolicy()
      }
    };

    // Support for best offers
    if (listingData.pricing.acceptOffers && listingData.pricing.minimumOffer) {
      offer.pricingSummary.minimumAdvertisedPrice = {
        currency: 'USD',
        value: listingData.pricing.minimumOffer.toString()
      };
    }

    return await this.apiCall('POST', '/sell/inventory/v1/offer', offer);
  }

  // Proper category suggestion using eBay API
  async suggestCategory(title) {
    try {
      const response = await this.apiCall('GET', 
        `/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(title)}`
      );
      
      if (response.categorySuggestions && response.categorySuggestions.length > 0) {
        return response.categorySuggestions[0].category.categoryId;
      }
    } catch (error) {
      console.warn('Category suggestion failed, using default:', error.message);
    }
    
    return '171485'; // Default: Collectibles > Other Collectibles
  }

  async publishOffer(offerId) {
    return await this.apiCall('POST', `/sell/inventory/v1/offer/${offerId}/publish`);
  }

  // Enhanced API call with automatic token refresh
  async apiCall(method, endpoint, body = null) {
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        if (!this.accessToken) {
          throw new Error('No access token available. User must authenticate first.');
        }

        const response = await fetch(`${this.getApiUrl()}${endpoint}`, {
          method,
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Language': 'en-US',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
          },
          body: body ? JSON.stringify(body) : null
        });

        if (response.status === 401) {
          throw new Error('Access token invalid or expired. User needs to re-authenticate.');
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`eBay API Error (${response.status}): ${error.message || JSON.stringify(error)}`);
        }

        return response.status === 204 ? {} : await response.json();
      } catch (error) {
        if (retries === maxRetries || error.message.includes('Access token invalid')) {
          throw error;
        }
        retries++;
      }
    }
  }

  // Policy management methods
  async getOrCreateFulfillmentPolicy() {
    if (this.policyCache.fulfillment) {
      return this.policyCache.fulfillment;
    }
    
    try {
      const policies = await this.apiCall('GET', '/sell/account/v1/fulfillment_policy');
      
      if (policies.fulfillmentPolicies && policies.fulfillmentPolicies.length > 0) {
        this.policyCache.fulfillment = policies.fulfillmentPolicies[0].fulfillmentPolicyId;
        return this.policyCache.fulfillment;
      }
      
      // Create default policy if none exists
      const newPolicy = {
        name: 'ThriftSpot Default Shipping',
        marketplaceId: 'EBAY_US',
        categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
        shippingOptions: [{
          optionType: 'DOMESTIC',
          costType: 'CALCULATED',
          shippingServices: [{
            serviceName: 'USPSGround',
            freeShipping: false
          }]
        }],
        globalShipping: false
      };
      
      const created = await this.apiCall('POST', '/sell/account/v1/fulfillment_policy', newPolicy);
      this.policyCache.fulfillment = created.fulfillmentPolicyId;
      return this.policyCache.fulfillment;
      
    } catch (error) {
      console.warn('Failed to get/create fulfillment policy:', error.message);
      throw new Error('Unable to set up shipping policy. Please configure shipping in your eBay seller account.');
    }
  }

  async getOrCreatePaymentPolicy() {
    if (this.policyCache.payment) {
      return this.policyCache.payment;
    }
    
    try {
      const policies = await this.apiCall('GET', '/sell/account/v1/payment_policy');
      
      if (policies.paymentPolicies && policies.paymentPolicies.length > 0) {
        this.policyCache.payment = policies.paymentPolicies[0].paymentPolicyId;
        return this.policyCache.payment;
      }
      
      throw new Error('No payment policy found. Please set up payment methods in your eBay seller account.');
      
    } catch (error) {
      console.warn('Failed to get payment policy:', error.message);
      throw new Error('Unable to access payment policy. Please configure payment methods in your eBay seller account.');
    }
  }

  async getOrCreateReturnPolicy() {
    if (this.policyCache.return) {
      return this.policyCache.return;
    }
    
    try {
      const policies = await this.apiCall('GET', '/sell/account/v1/return_policy');
      
      if (policies.returnPolicies && policies.returnPolicies.length > 0) {
        this.policyCache.return = policies.returnPolicies[0].returnPolicyId;
        return this.policyCache.return;
      }
      
      throw new Error('No return policy found. Please set up return policy in your eBay seller account.');
      
    } catch (error) {
      console.warn('Failed to get return policy:', error.message);
      throw new Error('Unable to access return policy. Please configure returns in your eBay seller account.');
    }
  }

  // Get or create merchant location
  async getOrCreateMerchantLocation() {
    try {
      const locations = await this.apiCall('GET', '/sell/inventory/v1/location');
      
      if (locations.locations && locations.locations.length > 0) {
        return locations.locations[0].merchantLocationKey;
      }
      
      throw new Error('No merchant location found. Please set up a location in your eBay seller account.');
      
    } catch (error) {
      console.warn('Failed to get merchant location:', error.message);
      return 'default'; // Fallback to default
    }
  }

  // Get user's listings
  async getUserListings(userId, options = {}) {
    try {
      const tokenInfo = await this.tokenManager.getValidAccessToken(userId);
      this.accessToken = tokenInfo.accessToken;

      const { limit = 25, offset = 0 } = options;
      
      const response = await this.apiCall('GET', 
        `/sell/inventory/v1/offer?limit=${limit}&offset=${offset}`
      );

      return {
        success: true,
        offers: response.offers || [],
        total: response.total || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // End/withdraw listing
  async endUserListing(userId, offerId, reason = 'OUT_OF_STOCK') {
    try {
      const tokenInfo = await this.tokenManager.getValidAccessToken(userId);
      this.accessToken = tokenInfo.accessToken;

      const result = await this.apiCall('POST', `/sell/inventory/v1/offer/${offerId}/withdraw`, {
        reason: reason
      });

      return {
        success: true,
        result: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get listing performance data
  async getListingMetrics(userId, offerId) {
    try {
      const tokenInfo = await this.tokenManager.getValidAccessToken(userId);
      this.accessToken = tokenInfo.accessToken;

      const offerData = await this.apiCall('GET', `/sell/inventory/v1/offer/${offerId}`);
      
      return {
        success: true,
        offer: offerData,
        metrics: {
          status: offerData.status,
          listingId: offerData.listingId,
          price: offerData.pricingSummary?.price,
          views: offerData.watchCount || 0,
          watchers: offerData.watchCount || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Utility methods
  getApiUrl() {
    return this.environment === 'sandbox' 
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
  }

  getListingUrl(listingId) {
    const baseUrl = this.environment === 'sandbox' 
      ? 'https://www.sandbox.ebay.com'
      : 'https://www.ebay.com';
    return `${baseUrl}/itm/${listingId}`;
  }

  // Disconnect user from eBay
  async disconnectUser(userId) {
    try {
      await this.tokenManager.disconnectUser(userId);
      return {
        success: true,
        message: 'eBay account disconnected successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = { EnhancedEbayIntegration };