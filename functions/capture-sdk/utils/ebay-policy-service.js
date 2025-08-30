const { EbayApiClient } = require('../../api/ebay-api-client.js');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { validateEbayPolicies } = require('./ebayPolicyValidator.js');

class EbayPolicyService {
  constructor() {
    this.ebayClient = new EbayApiClient();
    this.db = getFirestore();
  }

  async getRecommendedPolicies(userId) {
    console.log('🔍 Getting recommended policies for user:', userId);
    const userPolicies = await this.getUserEbayPolicies(userId);
    
    // Check if the user has valid policies
    const validationResult = await validateEbayPolicies(userPolicies.accessToken);
    if (validationResult.success) {
      return validationResult.recommendedPolicies;
    }
    
    // If not, try to create them
    console.warn('⚠️ User has no valid policies, attempting to create defaults...');
    const newPolicies = await this.createCompleteNewPolicies(userId);
    const newValidation = await validateEbayPolicies(newPolicies.accessToken);
    
    if (!newValidation.success) {
      console.error('❌ Failed to create valid policies. User must set up manually.');
      throw new Error('eBay policy setup failed. Please configure payment, shipping, and return policies in your eBay seller account manually.');
    }
    
    return newValidation.recommendedPolicies;
  }

  async createCompleteNewPolicies(userId) {
    const userPolicies = await this.getUserEbayPolicies(userId);
    const accessToken = userPolicies.accessToken;
    
    // Check if policies exist first
    const existingFulfillment = await this.ebayClient.apiCall(userId, 'GET', '/sell/account/v1/fulfillment_policy');
    const existingPayment = await this.ebayClient.apiCall(userId, 'GET', '/sell/account/v1/payment_policy');
    const existingReturn = await this.ebayClient.apiCall(userId, 'GET', '/sell/account/v1/return_policy');
    
    if (existingFulfillment.total > 0 && existingPayment.total > 0 && existingReturn.total > 0) {
      console.log('✅ User already has policies. Skipping creation.');
      return userPolicies;
    }

    // Define default policies
    const defaultFulfillment = {
      name: `ThriftSpot Default Shipping`,
      marketplaceId: 'EBAY_US',
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      shippingOptions: [{
        optionType: 'DOMESTIC',
        costType: 'CALCULATED',
        shippingServices: [{
          serviceName: 'USPSPriorityFlatRateBox',
          shippingServiceId: '1000',
          freeShipping: false
        }]
      }],
      globalShipping: false
    };

    const defaultPayment = {
      name: `ThriftSpot Default Payment`,
      marketplaceId: 'EBAY_US',
      paymentMethods: [{
        paymentMethodType: 'PAYPAL',
        recipientAccountReference: {
          referenceType: 'PAYPAL_EMAIL',
          referenceValue: 'your-paypal-email@example.com' // TODO: Replace with user's PayPal email or dynamically set
        }
      }]
    };
    
    const defaultReturn = {
      name: `ThriftSpot Default Return`,
      marketplaceId: 'EBAY_US',
      returnsAccepted: false
    };

    // Create policies
    const fulfillmentPromise = existingFulfillment.total === 0 ? this.ebayClient.apiCall(userId, 'POST', '/sell/account/v1/fulfillment_policy', defaultFulfillment) : Promise.resolve({});
    const paymentPromise = existingPayment.total === 0 ? this.ebayClient.apiCall(userId, 'POST', '/sell/account/v1/payment_policy', defaultPayment) : Promise.resolve({});
    const returnPromise = existingReturn.total === 0 ? this.ebayClient.apiCall(userId, 'POST', '/sell/account/v1/return_policy', defaultReturn) : Promise.resolve({});
    
    const [fulfillmentResult, paymentResult, returnResult] = await Promise.all([
      fulfillmentPromise, 
      paymentPromise, 
      returnPromise
    ]);

    console.log('✅ Default policies created successfully.');
    return {
      accessToken,
      fulfillmentPolicyId: fulfillmentResult.fulfillmentPolicyId,
      paymentPolicyId: paymentResult.paymentPolicyId,
      returnPolicyId: returnResult.returnPolicyId
    };
  }

  async getUserEbayPolicies(userId) {
    const accessToken = await this.ebayClient.getValidAccessToken(userId);
    const policies = await Promise.all([
      this.ebayClient.apiCall(userId, 'GET', '/sell/account/v1/fulfillment_policy'),
      this.ebayClient.apiCall(userId, 'GET', '/sell/account/v1/payment_policy'),
      this.ebayClient.apiCall(userId, 'GET', '/sell/account/v1/return_policy'),
      this.ebayClient.apiCall(userId, 'GET', '/sell/inventory/v1/location')
    ]);

    return {
      accessToken,
      fulfillmentPolicies: policies[0].fulfillmentPolicies,
      paymentPolicies: policies[1].paymentPolicies,
      returnPolicies: policies[2].returnPolicies,
      merchantLocation: policies[3].locations && policies[3].locations[0]
    };
  }

  async createNewPolicy(userId, policyType, policyData) {
    const endpoint = `/sell/account/v1/${policyType}_policy`;
    return this.ebayClient.apiCall(userId, 'POST', endpoint, policyData);
  }

  async deleteEbayPolicy(userId, policyId, policyType) {
    const endpoint = `/sell/account/v1/${policyType}_policy/${policyId}`;
    return this.ebayClient.apiCall(userId, 'DELETE', endpoint);
  }
}

module.exports = { EbayPolicyService };
