const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

class EbayApiClient {
  constructor() {
    this.db = getFirestore();
    this.auth = getAuth();
    this.ebayConfig = this.getEbayConfig();
  }

  getEbayConfig() {
    return {
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      environment: process.env.EBAY_ENVIRONMENT || 'production',
      redirectRuName: process.env.EBAY_REDIRECT_RU_NAME,
      
      getAuthUrl() {
        return this.environment === 'sandbox'
          ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
          : 'https://auth.ebay.com/oauth2/authorize';
      },
  
      getTokenUrl() {
        return this.environment === 'sandbox'
          ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
          : 'https://api.ebay.com/identity/v1/oauth2/token';
      },
  
      getApiUrl() {
        return this.environment === 'sandbox'
          ? 'https://api.sandbox.ebay.com'
          : 'https://api.ebay.com';
      },
  
      getBasicAuth() {
        if (!this.clientId || !this.clientSecret) {
          throw new Error('eBay credentials not configured in environment variables');
        }
        return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      }
    };
  }

  buildScopeFromRequest() {
    return [
      'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.account'
    ].join(' ');
  }

  async apiCall(userId, method, endpoint, body = null) {
    const tokenManager = new EbayTokenManager();
    const tokenInfo = await tokenManager.getValidAccessToken(userId);
    const accessToken = tokenInfo.accessToken;

    const config = this.getEbayConfig();
    const response = await fetch(`${config.getApiUrl()}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      body: body ? JSON.stringify(body) : null
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`eBay API Error (${response.status}): ${error.message || JSON.stringify(error)}`);
    }

    return response.status === 204 ? {} : await response.json();
  }
}

module.exports = { EbayApiClient };
