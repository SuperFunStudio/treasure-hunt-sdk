// services/ebay/tokenManager.js
// eBay OAuth token management

const { config } = require('../../config/environment');
const { db, admin, serverTimestamp } = require('../../config/firebase');

class EbayTokenManager {
  constructor() {
    this.tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';
    this.scopes = [
      'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.account'
    ].join(' ');
  }

  /**
   * Refresh an eBay access token using refresh token
   */
  async refreshEbayToken(refreshToken) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: this.scopes
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
  }

  /**
   * Get a valid eBay access token for user, refreshing if necessary
   */
  async getValidEbayToken(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.ebay?.isConnected) {
      throw new Error('eBay account not connected');
    }

    const ebayData = userData.ebay;
    const now = new Date();
    const expiresAt = ebayData.expiresAt?.toDate();

    // Refresh if expiring within 5 minutes
    if (!expiresAt || (expiresAt.getTime() - now.getTime()) < 300000) {
      console.log('Refreshing eBay token for user:', userId);
      
      const tokenData = await this.refreshEbayToken(ebayData.refreshToken);

      await db.collection('users').doc(userId).update({
        'ebay.accessToken': tokenData.access_token,
        'ebay.expiresAt': admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + (tokenData.expires_in * 1000))
        ),
        'ebay.refreshToken': tokenData.refresh_token || ebayData.refreshToken,
        'metadata.updatedAt': serverTimestamp()
      });
      
      return tokenData.access_token;
    }
    
    return ebayData.accessToken;
  }

  /**
   * Exchange authorization code for access token (OAuth callback)
   */
  async exchangeCodeForToken(authorizationCode) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: config.EBAY_REDIRECT_URI
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
  }

  /**
   * Store eBay tokens in user document
   */
  async storeUserTokens(userId, tokenData, additionalData = {}) {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    const updateData = {
      'ebay.isConnected': true,
      'ebay.accessToken': tokenData.access_token,
      'ebay.refreshToken': tokenData.refresh_token,
      'ebay.expiresAt': admin.firestore.Timestamp.fromDate(expiresAt),
      'ebay.connectedAt': serverTimestamp(),
      'metadata.updatedAt': serverTimestamp(),
      ...Object.keys(additionalData).reduce((acc, key) => {
        acc[`ebay.${key}`] = additionalData[key];
        return acc;
      }, {})
    };

    await db.collection('users').doc(userId).update(updateData);
    
    console.log('eBay tokens stored for user:', userId);
    return { expiresAt, ...tokenData };
  }

  /**
   * Disconnect eBay account for user
   */
  async disconnectEbayAccount(userId) {
    await db.collection('users').doc(userId).update({
      'ebay.isConnected': false,
      'ebay.accessToken': admin.firestore.FieldValue.delete(),
      'ebay.refreshToken': admin.firestore.FieldValue.delete(),
      'ebay.expiresAt': admin.firestore.FieldValue.delete(),
      'ebay.policies': admin.firestore.FieldValue.delete(),
      'ebay.disconnectedAt': serverTimestamp(),
      'metadata.updatedAt': serverTimestamp()
    });
    
    console.log('eBay account disconnected for user:', userId);
  }

  /**
   * Check if user has valid eBay connection
   */
  async isEbayConnected(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.ebay?.isConnected) {
      return false;
    }

    const expiresAt = userData.ebay.expiresAt?.toDate();
    const now = new Date();
    
    // Consider connected if token expires more than 1 minute from now
    return expiresAt && (expiresAt.getTime() - now.getTime()) > 60000;
  }
}

module.exports = new EbayTokenManager();