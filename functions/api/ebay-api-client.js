const fetch = require('node-fetch');
const Buffer = require('buffer').Buffer;
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

class EbayApiClient {
  constructor() {
    this.db = getFirestore();
    this.auth = getAuth();
    this.environment = process.env.EBAY_ENVIRONMENT || 'production';
    this.clientId = process.env.EBAY_CLIENT_ID;
    this.clientSecret = process.env.EBAY_CLIENT_SECRET;
    this.ruName = process.env.EBAY_REDIRECT_RU_NAME;
  }

  // --- API Configuration and Utilities ---
  getEbayConfig() {
    return {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      environment: this.environment,
      redirectRuName: this.ruName,
      getAuthUrl: () => (this.environment === 'sandbox' ? 'https://auth.sandbox.ebay.com/oauth2/authorize' : 'https://auth.ebay.com/oauth2/authorize'),
      getTokenUrl: () => (this.environment === 'sandbox' ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token' : 'https://api.ebay.com/identity/v1/oauth2/token'),
      getApiUrl: () => (this.environment === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'),
      getBasicAuth: () => Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
    };
  }

  buildScopeFromRequest() {
    return [
      'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.account',
    ].join(' ');
  }

  // --- Token Management and Refreshing ---
  async getValidAccessToken(userId) {
    try {
      console.log('Getting valid eBay access token for user:', userId);
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (!userDoc.exists || !userDoc.data().ebay?.isConnected) {
        throw new Error('eBay account not connected');
      }

      const ebayData = userDoc.data().ebay;
      const now = new Date();
      const expiresAt = ebayData.expiresAt.toDate();

      if (now < expiresAt) {
        console.log('Access token is still valid');
        return { accessToken: ebayData.accessToken, expiresAt, refreshed: false };
      }

      console.log('Access token expired, attempting refresh...');
      const refreshResult = await this.refreshAccessToken(ebayData.refreshToken);
      const newExpiresAt = new Date(Date.now() + (refreshResult.expires_in * 1000));
      
      await this.db.collection('users').doc(userId).update({
        'ebay.accessToken': refreshResult.access_token,
        'ebay.expiresAt': newExpiresAt,
        'ebay.lastRefreshed': new Date(),
        'metadata.updatedAt': new Date()
      });

      console.log('Access token refreshed successfully');
      return { accessToken: refreshResult.access_token, expiresAt: newExpiresAt, refreshed: true };

    } catch (error) {
      console.error('Error getting valid access token:', error);
      throw new Error(`Failed to get valid eBay access token: ${error.message}`);
    }
  }

  async refreshAccessToken(refreshToken) {
    if (!this.clientId || !this.clientSecret || !this.ruName) {
      throw new Error('eBay credentials not configured');
    }

    const tokenUrl = this.getEbayConfig().getTokenUrl();
    const basicAuth = this.getEbayConfig().getBasicAuth();

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        redirect_uri: this.ruName,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  // --- API Call Functions ---
  async apiCall(userId, method, endpoint, body = null) {
    const tokenInfo = await this.getValidAccessToken(userId);
    const accessToken = tokenInfo.accessToken;

    const baseUrl = this.getEbayConfig().getApiUrl();

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      body: body ? JSON.stringify(body) : null
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eBay API error: ${response.status} - ${errorText}`);
    }

    return response.status === 204 ? {} : await response.json();
  }

  async tradingApiCall(userId, callName, xmlBody) {
    const tokenInfo = await this.getValidAccessToken(userId);
    const accessToken = tokenInfo.accessToken;
    const tradingUrl = `${this.getEbayConfig().getApiUrl().replace('/sell', '')}/ws/api.dll`;

    const response = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-DEV-NAME': process.env.EBAY_DEV_ID,
        'X-EBAY-API-APP-NAME': process.env.EBAY_APP_ID,
        'X-EBAY-API-CERT-NAME': process.env.EBAY_CERT_ID,
        'X-EBAY-API-CALL-NAME': callName,
        'X-EBAY-API-SITEID': '0', // 0 for eBay US
        'Content-Type': 'text/xml',
        'X-EBAY-API-IAF-TOKEN': accessToken,
      },
      body: xmlBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eBay Trading API error: ${response.status} - ${errorText}`);
    }

    return await response.text();
  }
}

module.exports = { EbayApiClient };
