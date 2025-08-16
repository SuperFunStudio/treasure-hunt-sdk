// functions/utils/ebay-token-manager.js
// Utility for managing eBay tokens in Firestore

const { getFirestore } = require('firebase-admin/firestore');

class EbayTokenManager {
  constructor() {
    this.db = getFirestore();
    this.environment = process.env.EBAY_ENVIRONMENT || 'production';
    this.clientId = process.env.EBAY_CLIENT_ID;
    this.clientSecret = process.env.EBAY_CLIENT_SECRET;
  }

  /**
   * Get valid eBay access token for a user
   * Automatically refreshes if expired
   */
  async getValidAccessToken(userId) {
    try {
      console.log('Getting valid eBay access token for user:', userId);

      // Get user's eBay data
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      if (!userData.ebay?.isConnected) {
        throw new Error('eBay account not connected');
      }

      const ebayData = userData.ebay;
      const now = new Date();
      const expiresAt = ebayData.expiresAt.toDate();

      // If token is still valid, return it
      if (now < expiresAt) {
        console.log('Access token is still valid');
        return {
          accessToken: ebayData.accessToken,
          expiresAt: expiresAt,
          refreshed: false
        };
      }

      console.log('Access token expired, attempting refresh...');

      // Token is expired, try to refresh
      const refreshResult = await this.refreshAccessToken(ebayData.refreshToken);
      
      // Update stored tokens
      const newExpiresAt = new Date(Date.now() + (refreshResult.expires_in * 1000));
      
      await this.db.collection('users').doc(userId).update({
        'ebay.accessToken': refreshResult.access_token,
        'ebay.expiresAt': newExpiresAt,
        'ebay.lastRefreshed': new Date(),
        'metadata.updatedAt': new Date()
      });

      console.log('Access token refreshed successfully');

      return {
        accessToken: refreshResult.access_token,
        expiresAt: newExpiresAt,
        refreshed: true
      };

    } catch (error) {
      console.error('Error getting valid access token:', error);
      throw new Error(`Failed to get valid eBay access token: ${error.message}`);
    }
  }

  /**
   * Refresh eBay access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('eBay credentials not configured');
    }

    const tokenUrl = this.environment === 'sandbox'
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Refresh token error:', error);
      throw error;
    }
  }

  /**
   * Store eBay tokens for a user
   */
  async storeTokens(userId, tokenData) {
    try {
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
      const refreshExpiresAt = tokenData.refresh_token_expires_in 
        ? new Date(Date.now() + (tokenData.refresh_token_expires_in * 1000))
        : new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 year default

      const ebayTokenData = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresAt: expiresAt,
        refreshExpiresAt: refreshExpiresAt,
        scope: tokenData.scope,
        isConnected: true,
        connectedAt: new Date(),
        environment: this.environment
      };

      await this.db.collection('users').doc(userId).update({
        'ebay': ebayTokenData,
        'metadata.updatedAt': new Date()
      });

      console.log('eBay tokens stored successfully for user:', userId);
      return ebayTokenData;

    } catch (error) {
      console.error('Error storing eBay tokens:', error);
      throw error;
    }
  }

  /**
   * Remove eBay connection for a user
   */
  async disconnectUser(userId) {
    try {
      await this.db.collection('users').doc(userId).update({
        'ebay.isConnected': false,
        'ebay.disconnectedAt': new Date(),
        'metadata.updatedAt': new Date()
      });

      console.log('eBay connection removed for user:', userId);
    } catch (error) {
      console.error('Error disconnecting eBay for user:', error);
      throw error;
    }
  }

  /**
   * Check if user has valid eBay connection
   */
  async isUserConnected(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return false;
      }

      const userData = userDoc.data();
      if (!userData.ebay?.isConnected) {
        return false;
      }

      // Check if refresh token is expired
      const now = new Date();
      const refreshExpiresAt = userData.ebay.refreshExpiresAt.toDate();
      
      return now < refreshExpiresAt;
    } catch (error) {
      console.error('Error checking user connection:', error);
      return false;
    }
  }

  /**
   * Get user's eBay connection info
   */
  async getUserEbayInfo(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      if (!userData.ebay?.isConnected) {
        return {
          connected: false,
          reason: 'Not connected to eBay'
        };
      }

      const ebayData = userData.ebay;
      const now = new Date();
      const accessTokenValid = now < ebayData.expiresAt.toDate();
      const refreshTokenValid = now < ebayData.refreshExpiresAt.toDate();

      return {
        connected: true,
        sellerAccount: ebayData.sellerAccount,
        environment: ebayData.environment,
        connectedAt: ebayData.connectedAt,
        accessTokenValid: accessTokenValid,
        refreshTokenValid: refreshTokenValid,
        scope: ebayData.scope
      };

    } catch (error) {
      console.error('Error getting user eBay info:', error);
      throw error;
    }
  }

  /**
   * Clean up expired OAuth states
   */
  async cleanupExpiredStates() {
    try {
      const now = new Date();
      const expiredStates = await this.db.collection('ebay_oauth_states')
        .where('expiresAt', '<', now)
        .get();

      if (expiredStates.empty) {
        return 0;
      }

      const batch = this.db.batch();
      expiredStates.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Cleaned up ${expiredStates.size} expired OAuth states`);
      return expiredStates.size;

    } catch (error) {
      console.error('Error cleaning up expired states:', error);
      throw error;
    }
  }

  /**
   * Create eBay API client with auto-refreshing tokens
   */
  async createEbayClient(userId) {
    const tokenInfo = await this.getValidAccessToken(userId);
    
    return {
      accessToken: tokenInfo.accessToken,
      environment: this.environment,
      
      // Helper method to make authenticated requests
      async apiCall(method, endpoint, body = null) {
        const baseUrl = this.environment === 'sandbox' 
          ? 'https://api.sandbox.ebay.com'
          : 'https://api.ebay.com';

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method,
          headers: {
            'Authorization': `Bearer ${tokenInfo.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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
    };
  }
}

module.exports = { EbayTokenManager };