// services/ebay/tokenManager.js
// Enhanced eBay OAuth token management with robust error handling

const { config } = require('../../config/environment');
const { db, admin, serverTimestamp } = require('../../config/firebase');

class EbayTokenManager {
  constructor() {
    this.tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';
    
    // Core scopes that are typically available for most eBay apps
    this.coreScopes = [
      'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.account'
    ];
    
    // Extended scopes that may not be available for all app types
    this.extendedScopes = [
      'https://api.ebay.com/oauth/api_scope/commerce.taxonomy.readonly',
      'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly'
    ];
    
    // Start with core scopes, will be validated and updated
    this.validatedScopes = null;
    this.scopeValidationCache = null;
    this.scopeValidationExpiry = null;
  }

  /**
   * Get the appropriate scopes for the current app configuration
   */
  async getValidScopes() {
    // Use cached validation if still valid (cache for 1 hour)
    const now = Date.now();
    if (this.scopeValidationCache && this.scopeValidationExpiry && now < this.scopeValidationExpiry) {
      return this.scopeValidationCache;
    }

    try {
      // Test with core scopes first
      const coreValidation = await this.testScopes(this.coreScopes);
      if (coreValidation.success) {
        this.scopeValidationCache = this.coreScopes.join(' ');
        this.scopeValidationExpiry = now + (60 * 60 * 1000); // 1 hour
        console.log('✅ Core scopes validated successfully');
        return this.scopeValidationCache;
      }

      // If core scopes fail, try minimal scopes
      const minimalScopes = [
        'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
        'https://api.ebay.com/oauth/api_scope/sell.account.readonly'
      ];
      
      const minimalValidation = await this.testScopes(minimalScopes);
      if (minimalValidation.success) {
        this.scopeValidationCache = minimalScopes.join(' ');
        this.scopeValidationExpiry = now + (60 * 60 * 1000);
        console.log('⚠️ Using minimal scopes - some features may be limited');
        return this.scopeValidationCache;
      }

      // Fallback to basic scope
      const fallbackScope = 'https://api.ebay.com/oauth/api_scope';
      this.scopeValidationCache = fallbackScope;
      this.scopeValidationExpiry = now + (30 * 60 * 1000); // 30 minutes for fallback
      console.log('🔄 Using fallback scope');
      return this.scopeValidationCache;

    } catch (error) {
      console.error('Scope validation failed:', error);
      // Return basic scope as last resort
      return 'https://api.ebay.com/oauth/api_scope';
    }
  }

  /**
   * Test if given scopes are valid for this eBay app
   */
  async testScopes(scopes) {
    try {
      const fetch = (await import('node-fetch')).default;
      const scopeString = Array.isArray(scopes) ? scopes.join(' ') : scopes;
      
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: scopeString
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Scope validation successful for: ${scopeString}`);
        return { success: true, token: data.access_token };
      } else {
        const errorText = await response.text();
        console.log(`❌ Scope validation failed for: ${scopeString} - ${errorText}`);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.error('Scope test error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh an eBay access token using refresh token with enhanced error handling
   */
  async refreshEbayToken(refreshToken, userId = null) {
    const fetch = (await import('node-fetch')).default;
    
    console.log('🔄 Starting token refresh process...');
    
    // Get user's stored scopes if available
    let scopesToUse = await this.getValidScopes();
    
    if (userId) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (userData?.ebay?.scopes) {
          scopesToUse = userData.ebay.scopes;
          console.log('📋 Using user-specific scopes:', scopesToUse);
        }
      } catch (error) {
        console.warn('Could not retrieve user scopes, using validated scopes');
      }
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Token refresh attempt ${attempt}/${maxRetries}`);
        
        const response = await fetch(this.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString('base64')}`
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            scope: scopesToUse
          })
        });

        if (response.ok) {
          const tokenData = await response.json();
          console.log('✅ Token refresh successful');
          return tokenData;
        }

        const errorText = await response.text();
        console.error(`❌ Token refresh failed (attempt ${attempt}):`, response.status, errorText);
        
        // Parse error response
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: 'unknown', error_description: errorText };
        }

        // Handle specific error types
        if (errorData.error === 'invalid_scope') {
          console.log('🔍 Invalid scope detected, trying with core scopes...');
          
          if (attempt === 1) {
            // Try with just core scopes
            scopesToUse = this.coreScopes.join(' ');
            continue;
          } else if (attempt === 2) {
            // Try with minimal scopes
            scopesToUse = 'https://api.ebay.com/oauth/api_scope';
            continue;
          }
        }

        if (errorData.error === 'invalid_grant') {
          // Refresh token is invalid/expired - cannot retry
          throw new Error(`Refresh token invalid or expired. User needs to re-authenticate. Error: ${errorText}`);
        }

        lastError = new Error(`Token refresh failed: ${response.status} - ${errorText}`);
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

      } catch (error) {
        console.error(`❌ Token refresh error (attempt ${attempt}):`, error);
        lastError = error;
        
        if (error.message.includes('re-authenticate')) {
          // Don't retry if user needs to re-authenticate
          break;
        }
      }
    }

    throw lastError || new Error('Token refresh failed after all attempts');
  }

  /**
   * Get a valid eBay access token for user, refreshing if necessary
   */
  async getValidEbayToken(userId) {
    console.log('🔑 Getting valid eBay token for user:', userId);
    
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.ebay?.isConnected) {
      throw new Error('eBay account not connected');
    }

    const ebayData = userData.ebay;
    const now = new Date();
    const expiresAt = ebayData.expiresAt?.toDate();

    // Check if token exists and is not expired
    if (expiresAt && (expiresAt.getTime() - now.getTime()) > 300000) { // 5 minute buffer
      console.log('✅ Using existing valid token');
      return ebayData.accessToken;
    }

    console.log('🔄 Token expired or expiring soon, refreshing...');
    
    try {
      const tokenData = await this.refreshEbayToken(ebayData.refreshToken, userId);

      // Update user document with new token data
      const updateData = {
        'ebay.accessToken': tokenData.access_token,
        'ebay.expiresAt': admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + (tokenData.expires_in * 1000))
        ),
        'metadata.updatedAt': serverTimestamp()
      };

      // Update refresh token if provided
      if (tokenData.refresh_token) {
        updateData['ebay.refreshToken'] = tokenData.refresh_token;
      }

      await db.collection('users').doc(userId).update(updateData);
      
      console.log('✅ Token refreshed and stored successfully');
      return tokenData.access_token;

    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      
      // If refresh failed due to invalid token, mark as disconnected
      if (error.message.includes('re-authenticate') || error.message.includes('invalid_grant')) {
        console.log('🔌 Marking eBay account as disconnected due to invalid refresh token');
        await db.collection('users').doc(userId).update({
          'ebay.isConnected': false,
          'ebay.disconnectedReason': 'refresh_token_invalid',
          'ebay.disconnectedAt': serverTimestamp(),
          'metadata.updatedAt': serverTimestamp()
        });
      }
      
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token (OAuth callback)
   */
  async exchangeCodeForToken(authorizationCode) {
    const fetch = (await import('node-fetch')).default;
    
    console.log('🔄 Exchanging authorization code for tokens...');
    
    try {
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
        console.error('❌ Token exchange failed:', response.status, errorText);
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }
      
      const tokenData = await response.json();
      console.log('✅ Token exchange successful');
      return tokenData;

    } catch (error) {
      console.error('❌ Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Store eBay tokens in user document with enhanced metadata
   */
  async storeUserTokens(userId, tokenData, additionalData = {}) {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    // Determine which scopes were actually granted
    const grantedScopes = await this.getValidScopes();
    
    const updateData = {
      'ebay.isConnected': true,
      'ebay.accessToken': tokenData.access_token,
      'ebay.refreshToken': tokenData.refresh_token,
      'ebay.expiresAt': admin.firestore.Timestamp.fromDate(expiresAt),
      'ebay.scopes': grantedScopes,
      'ebay.connectedAt': serverTimestamp(),
      'ebay.tokenType': tokenData.token_type || 'Bearer',
      'ebay.lastRefreshAt': serverTimestamp(),
      'metadata.updatedAt': serverTimestamp(),
      ...Object.keys(additionalData).reduce((acc, key) => {
        acc[`ebay.${key}`] = additionalData[key];
        return acc;
      }, {})
    };

    await db.collection('users').doc(userId).update(updateData);
    
    console.log('✅ eBay tokens stored successfully for user:', userId);
    console.log('📋 Granted scopes:', grantedScopes);
    
    return { expiresAt, grantedScopes, ...tokenData };
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
      'ebay.scopes': admin.firestore.FieldValue.delete(),
      'ebay.policies': admin.firestore.FieldValue.delete(),
      'ebay.disconnectedAt': serverTimestamp(),
      'ebay.disconnectedReason': 'manual',
      'metadata.updatedAt': serverTimestamp()
    });
    
    console.log('🔌 eBay account disconnected for user:', userId);
  }

  /**
   * Get application-level token for taxonomy API
   */
  async getAppToken() {
    const fetch = (await import('node-fetch')).default;
    
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'https://api.ebay.com/oauth/api_scope/commerce.taxonomy.readonly'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ App token request failed:', response.status, errorText);
        throw new Error(`App token request failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ App token acquired successfully');
      return data.access_token;

    } catch (error) {
      console.error('❌ App token error:', error);
      throw error;
    }
  }

  /**
   * Check if user has valid eBay connection
   */
  async isEbayConnected(userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.ebay?.isConnected) {
        return { connected: false, reason: 'not_connected' };
      }

      const expiresAt = userData.ebay.expiresAt?.toDate();
      const now = new Date();
      
      // Consider connected if token expires more than 1 minute from now
      const isValid = expiresAt && (expiresAt.getTime() - now.getTime()) > 60000;
      
      return {
        connected: isValid,
        reason: isValid ? 'connected' : 'token_expired',
        expiresAt: expiresAt,
        scopes: userData.ebay.scopes
      };

    } catch (error) {
      console.error('Error checking eBay connection:', error);
      return { connected: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Get user's eBay connection status with detailed information
   */
  async getConnectionStatus(userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.ebay) {
        return {
          status: 'not_connected',
          message: 'eBay account not linked',
          action: 'connect'
        };
      }

      const ebayData = userData.ebay;
      
      if (!ebayData.isConnected) {
        return {
          status: 'disconnected',
          message: `eBay account disconnected: ${ebayData.disconnectedReason || 'unknown reason'}`,
          action: 'reconnect',
          disconnectedAt: ebayData.disconnectedAt
        };
      }

      const expiresAt = ebayData.expiresAt?.toDate();
      const now = new Date();
      
      if (!expiresAt || (expiresAt.getTime() - now.getTime()) < 60000) {
        return {
          status: 'expired',
          message: 'eBay token expired',
          action: 'refresh',
          expiresAt: expiresAt
        };
      }

      return {
        status: 'connected',
        message: 'eBay account connected and active',
        expiresAt: expiresAt,
        scopes: ebayData.scopes,
        connectedAt: ebayData.connectedAt
      };

    } catch (error) {
      console.error('Error getting connection status:', error);
      return {
        status: 'error',
        message: 'Unable to check eBay connection status',
        error: error.message
      };
    }
  }

  /**
   * Validate current scopes and update if needed
   */
  async validateAndUpdateScopes(userId) {
    try {
      const currentScopes = await this.getValidScopes();
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (userData?.ebay?.scopes !== currentScopes) {
        console.log('📋 Updating user scopes to:', currentScopes);
        await db.collection('users').doc(userId).update({
          'ebay.scopes': currentScopes,
          'metadata.updatedAt': serverTimestamp()
        });
      }
      
      return currentScopes;
    } catch (error) {
      console.error('Error validating scopes:', error);
      return null;
    }
  }
}

module.exports = new EbayTokenManager();