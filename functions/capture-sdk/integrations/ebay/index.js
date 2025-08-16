  // functions/capture-sdk/integrations/ebay/index.js
  const EbayCategoryHandler = require('../../utils/ebayCategoryHandler.js').EbayCategoryHandler;



  class EbayIntegration {
      constructor(config) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.environment = config.environment || 'production'; // Default to production
        this.redirectUri = config.redirectUri;
        this.refreshToken = config.refreshToken;
        this.accessToken = config.accessToken || null; // Add this line

        
        // Policy cache to avoid recreating policies
        this.policyCache = {
          fulfillment: null,
          payment: null,
          return: null
        };

        // Initialize category handler
        this.categoryHandler = new EbayCategoryHandler(this);
      }

      // Single authorization URL method for production
      getAuthUrl(state = null) {
        const baseUrl = this.environment === 'sandbox' 
          ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
          : 'https://auth.ebay.com/oauth2/authorize';
        
        // Essential scopes only
        const scopes = [
          'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
          'https://api.ebay.com/oauth/api_scope/sell.inventory',
          'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
          'https://api.ebay.com/oauth/api_scope/sell.account'
        ].join(' ');
        
        const params = new URLSearchParams({
          client_id: this.clientId,
          response_type: 'code',
          redirect_uri: this.redirectUri,
          scope: scopes
        });
        
        if (state) params.append('state', state);
        
        return `${baseUrl}?${params.toString()}`;
      }
    
      async authenticate(authCode) {
        const response = await fetch(this.getTokenUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${this.getBasicAuth()}`
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: this.redirectUri
          })
        });
    
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Authentication failed: ${error.error_description || error.error}`);
        }
    
        const data = await response.json();
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        
        return {
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresIn: data.expires_in
        };
      }
    
      // Check if user is authenticated
      isAuthenticated() {
        return !!this.accessToken || !!this.refreshToken;
      }
    
      // Smart listing creation with category adaptation
      async createAdaptiveListing(listingData, itemAnalysis = {}) {
        if (!this.isAuthenticated()) {
          throw new Error('User must authenticate with eBay first');
        }

        return await this.categoryHandler.createAdaptiveListing(listingData, itemAnalysis);
      }

      // Suggest categories for item classification  
      async suggestCategory(itemTitle, itemDescription = '') {
        return await this.categoryHandler.suggestCategory(itemTitle, itemDescription);
      }

      async createListing(listingData) {
        if (!this.isAuthenticated()) {
          throw new Error('User must authenticate with eBay first');
        }
    
        try {
          // Better error handling and validation
          this.validateListingData(listingData);
          
          // Step 1: Create inventory item
          const inventoryItem = await this.createInventoryItem(listingData);
          
          // Step 2: Create offer
          const offer = await this.createOffer(inventoryItem.sku, listingData);
          
          // Step 3: Publish offer
          const publishResult = await this.publishOffer(offer.offerId);
          
          return {
            success: true,
            listingId: publishResult.listingId,
            sku: inventoryItem.sku,
            offerId: offer.offerId,
            url: this.getListingUrl(publishResult.listingId),
            ebayItemId: publishResult.listingId,
            status: 'active'
          };
        } catch (error) {
          console.error('eBay listing creation failed:', error);
          return {
            success: false,
            error: error.message,
            details: error.response || error
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
        // Updated SKU prefix for ThriftSpot
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
    
      // Better error handling and token refresh
      async apiCall(method, endpoint, body = null) {
        let retries = 0;
        const maxRetries = 2;
        
        while (retries <= maxRetries) {
          try {
            // For Auth'n'Auth tokens, we don't refresh - we just use what we have
            if (!this.accessToken) {
              throw new Error('No access token available. Please set accessToken in config or get one from eBay Developer Console.');
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
              throw new Error('Access token invalid or expired. Get a new token from eBay Developer Console "Sign in to Production".');
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
    
      // Implement proper policy management
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
            name: 'ThriftSpot Default Shipping', // Updated for ThriftSpot branding
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
    
      // Get listing status
      async getListingStatus(offerId) {
        try {
          return await this.apiCall('GET', `/sell/inventory/v1/offer/${offerId}`);
        } catch (error) {
          console.error('Failed to get listing status:', error);
          return null;
        }
      }
    
      // End listing
      async endListing(offerId, reason = 'OUT_OF_STOCK') {
        try {
          return await this.apiCall('POST', `/sell/inventory/v1/offer/${offerId}/withdraw`, {
            reason: reason
          });
        } catch (error) {
          console.error('Failed to end listing:', error);
          throw error;
        }
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
    
      getBasicAuth() {
        return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      }
    
      getListingUrl(listingId) {
        const baseUrl = this.environment === 'sandbox' 
          ? 'https://www.sandbox.ebay.com'
          : 'https://www.ebay.com';
        return `${baseUrl}/itm/${listingId}`;
      }
    
      async refreshAccessToken() {
        if (!this.refreshToken) {
          throw new Error('No refresh token available. User needs to re-authenticate.');
        }
    
        const response = await fetch(this.getTokenUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${this.getBasicAuth()}`
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
            // Use same scopes as getAuthUrl for consistency
            scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account.readonly https://api.ebay.com/oauth/api_scope/sell.account'
          })
        });
    
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
        }
    
        const data = await response.json();
        this.accessToken = data.access_token;
        
        // Update refresh token if eBay provides a new one
        if (data.refresh_token) {
          this.refreshToken = data.refresh_token;
          console.log('🔄 Refresh token updated - save this to your .env file:', data.refresh_token);
        }
        
        return this.accessToken;
      }
  }

  module.exports = { EbayIntegration };
