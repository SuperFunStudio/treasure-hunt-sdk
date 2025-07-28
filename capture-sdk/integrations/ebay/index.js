// capture-sdk/integrations/ebay/index.js
export class EbayIntegration {
    constructor(config) {
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret;
      this.environment = config.environment || 'production';
      this.accessToken = null;
      this.refreshToken = config.refreshToken;
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
  
      const data = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      
      return {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresIn: data.expires_in
      };
    }
  
    async createListing(listingData) {
      try {
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
          url: this.getListingUrl(publishResult.listingId)
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          details: error.response
        };
      }
    }
  
    async createInventoryItem(listingData) {
      const sku = `SDK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const inventoryItem = {
        condition: listingData.condition,
        product: {
          title: listingData.title,
          description: listingData.description,
          imageUrls: listingData.images,
          aspects: listingData.itemSpecifics
        },
        availability: {
          shipToLocationAvailability: {
            quantity: 1
          }
        }
      };
  
      const response = await this.apiCall('POST', `/sell/inventory/v1/inventory_item/${sku}`, inventoryItem);
      
      return { sku, ...response };
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
        categoryId: listingData.category,
        merchantLocationKey: 'default',
        listingPolicies: {
          fulfillmentPolicyId: await this.getOrCreateFulfillmentPolicy(),
          paymentPolicyId: await this.getOrCreatePaymentPolicy(),
          returnPolicyId: await this.getOrCreateReturnPolicy(listingData.returnPolicy)
        }
      };
  
      if (listingData.pricing.acceptOffers) {
        offer.pricingSummary.minimumAdvertisedPrice = {
          currency: 'USD',
          value: listingData.pricing.minimumOffer.toString()
        };
      }
  
      return await this.apiCall('POST', '/sell/inventory/v1/offer', offer);
    }
  
    async publishOffer(offerId) {
      return await this.apiCall('POST', `/sell/inventory/v1/offer/${offerId}/publish`);
    }
  
    async apiCall(method, endpoint, body = null) {
      if (!this.accessToken) {
        await this.refreshAccessToken();
      }
  
      const response = await fetch(`${this.getApiUrl()}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: body ? JSON.stringify(body) : null
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`eBay API Error: ${error.message || response.statusText}`);
      }
  
      return await response.json();
    }
  
    async getOrCreateFulfillmentPolicy() {
      // Simplified - would check existing policies first
      return 'DEFAULT_FULFILLMENT_POLICY_ID';
    }
  
    async getOrCreatePaymentPolicy() {
      return 'DEFAULT_PAYMENT_POLICY_ID';
    }
  
    async getOrCreateReturnPolicy(returnPeriod) {
      return 'DEFAULT_RETURN_POLICY_ID';
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
      return `https://www.ebay.com/itm/${listingId}`;
    }
  
    async refreshAccessToken() {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }
  
      const response = await fetch(this.getTokenUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${this.getBasicAuth()}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken
        })
      });
  
      const data = await response.json();
      this.accessToken = data.access_token;
      
      return this.accessToken;
    }
  }
  