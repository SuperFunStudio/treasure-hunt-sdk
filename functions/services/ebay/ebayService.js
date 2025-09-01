// services/ebay/ebayService.js
// Core eBay API service functions

const { config } = require('../../config/environment');

class EbayService {
  constructor() {
    this.baseUrl = 'https://api.ebay.com';
    this.tradingUrl = 'https://api.ebay.com/ws/api.dll';
  }

  /**
   * Make authenticated calls to eBay REST APIs
   */
  async callEbayAPI(accessToken, method, endpoint, body = null) {
    const fetch = (await import('node-fetch')).default;
    console.log(`Calling eBay API: ${method} ${endpoint}`);

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    };

    // Add Content-Language header for Inventory API calls
    if (endpoint.includes('/sell/inventory/')) {
      headers['Content-Language'] = 'en-US';
      console.log('Added Content-Language: en-US header for Inventory API');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const responseText = await response.text();
    let responseData = null;
    
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      console.error('Failed to parse eBay response:', responseText);
    }

    if (!response.ok) {
      console.error('eBay API error details:', {
        status: response.status,
        endpoint: endpoint,
        response: responseText
      });
      throw new Error(`eBay API error ${response.status}: ${responseText}`);
    }
    
    return responseData;
  }

  /**
   * Make calls to eBay Trading API (XML-based legacy API)
   */
  async callTradingAPI(accessToken, apiCallName, xmlPayload) {
    const fetch = (await import('node-fetch')).default;
    console.log(`Calling eBay Trading API: ${apiCallName}`);

    const headers = {
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1183',
      'X-EBAY-API-CALL-NAME': apiCallName,
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-IAF-TOKEN': accessToken,
      'Content-Type': 'text/xml'
    };

    const response = await fetch(this.tradingUrl, {
      method: 'POST',
      headers,
      body: xmlPayload
    });

    const responseText = await response.text();
    console.log('Raw Trading API response:', responseText);

    if (!response.ok) {
      console.error('eBay Trading API error details:', {
        status: response.status,
        endpoint: this.tradingUrl,
        response: responseText
      });
      throw new Error(`eBay Trading API error ${response.status}: ${responseText}`);
    }

    return responseText;
  }

  /**
   * Get all policies from eBay account
   */
  async fetchAllEbayPolicies(accessToken) {
    console.log('Fetching all eBay policies...');
    
    try {
      // Fetch all three types of policies
      const [fulfillmentResponse, paymentResponse, returnResponse] = await Promise.all([
        this.callEbayAPI(accessToken, 'GET', '/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US')
          .catch(err => ({ fulfillmentPolicies: [] })),
        this.callEbayAPI(accessToken, 'GET', '/sell/account/v1/payment_policy?marketplace_id=EBAY_US')
          .catch(err => ({ paymentPolicies: [] })),
        this.callEbayAPI(accessToken, 'GET', '/sell/account/v1/return_policy?marketplace_id=EBAY_US')
          .catch(err => ({ returnPolicies: [] }))
      ]);
      
      const policies = {
        fulfillment: fulfillmentResponse.fulfillmentPolicies || [],
        payment: paymentResponse.paymentPolicies || [],
        return: returnResponse.returnPolicies || [],
        hasCompletePolicySet: false,
        selected: null
      };
      
      // Check if we have at least one of each type
      if (policies.fulfillment.length > 0 && 
          policies.payment.length > 0 && 
          policies.return.length > 0) {
        
        policies.hasCompletePolicySet = true;
        
        // Select the first or default policy of each type
        policies.selected = {
          fulfillmentPolicyId: policies.fulfillment[0].fulfillmentPolicyId,
          paymentPolicyId: policies.payment[0].paymentPolicyId,
          returnPolicyId: policies.return[0].returnPolicyId
        };
      }
      
      console.log(`Found policies - Fulfillment: ${policies.fulfillment.length}, Payment: ${policies.payment.length}, Return: ${policies.return.length}`);
      
      return policies;
      
    } catch (error) {
      console.error('Failed to fetch policies:', error);
      return {
        fulfillment: [],
        payment: [],
        return: [],
        hasCompletePolicySet: false,
        selected: null
      };
    }
  }

  /**
   * Create missing eBay policies
   */
  async createMissingPolicies(accessToken, existingPolicies) {
    console.log('Creating missing policies...');
    
    const timestamp = Date.now();
    const createdPolicies = {};
    
    // Create fulfillment policy if missing
    if (existingPolicies.fulfillment.length === 0) {
      console.log('Creating fulfillment policy...');
      const fulfillmentResult = await this.callEbayAPI(accessToken, 'POST', '/sell/account/v1/fulfillment_policy', {
        name: `Default Shipping Policy ${timestamp}`,
        marketplaceId: 'EBAY_US',
        categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }],
        handlingTime: { value: 1, unit: 'DAY' },
        shippingOptions: [{
          optionType: 'DOMESTIC',
          costType: 'FLAT_RATE',
          shippingServices: [{
            sortOrder: 1,
            shippingServiceCode: 'USPSPriority',
            shippingCost: { currency: 'USD', value: '9.99' },
            additionalShippingCost: { currency: 'USD', value: '5.00' }
          }, {
            sortOrder: 2,
            shippingServiceCode: 'USPSFirstClass',
            shippingCost: { currency: 'USD', value: '5.99' },
            additionalShippingCost: { currency: 'USD', value: '3.00' }
          }]
        }],
        globalShipping: false,
        pickupDropOff: false,
        freightShipping: false
      });
      createdPolicies.fulfillmentPolicyId = fulfillmentResult.fulfillmentPolicyId;
    } else {
      createdPolicies.fulfillmentPolicyId = existingPolicies.fulfillment[0].fulfillmentPolicyId;
    }
    
    // Create payment policy if missing
    if (existingPolicies.payment.length === 0) {
      console.log('Creating payment policy...');
      const paymentResult = await this.callEbayAPI(accessToken, 'POST', '/sell/account/v1/payment_policy', {
        name: `Default Payment Policy ${timestamp}`,
        marketplaceId: 'EBAY_US',
        categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }],
        immediatePayRequired: true
      });
      createdPolicies.paymentPolicyId = paymentResult.paymentPolicyId;
    } else {
      createdPolicies.paymentPolicyId = existingPolicies.payment[0].paymentPolicyId;
    }
    
    // Create return policy if missing
    if (existingPolicies.return.length === 0) {
      console.log('Creating return policy...');
      const returnResult = await this.callEbayAPI(accessToken, 'POST', '/sell/account/v1/return_policy', {
        name: `Default Return Policy ${timestamp}`,
        marketplaceId: 'EBAY_US',
        categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }],
        returnsAccepted: true,
        returnPeriod: { value: 30, unit: 'DAY' },
        returnShippingCostPayer: 'BUYER',
        returnMethod: 'MONEY_BACK',
        description: '30-day returns. Buyer pays return shipping.'
      });
      createdPolicies.returnPolicyId = returnResult.returnPolicyId;
    } else {
      createdPolicies.returnPolicyId = existingPolicies.return[0].returnPolicyId;
    }
    
    console.log('Policies created:', createdPolicies);
    return createdPolicies;
  }

  /**
   * Ensure default location exists for inventory
   */
  async ensureDefaultLocation(accessToken) {
    try {
      const locations = await this.callEbayAPI(accessToken, 'GET', '/sell/inventory/v1/location');
      console.log('Existing locations:', JSON.stringify(locations, null, 2));
      
      if (!locations.locations?.some(loc => loc.merchantLocationKey === 'default')) {
        const locationData = {
          name: 'Default Location',
          locationTypes: ['WAREHOUSE'],
          merchantLocationStatus: 'ENABLED',
          location: {
            address: {
              addressLine1: '123 Main St',
              city: 'New York',
              stateOrProvince: 'NY',
              postalCode: '10001',
              country: 'US'
            }
          }
        };
        
        await this.callEbayAPI(accessToken, 'POST', '/sell/inventory/v1/location/default', locationData);
        console.log('Created default location');
      }
    } catch (error) {
      console.log('Location setup failed:', error.message);
    }
  }
}

module.exports = new EbayService();