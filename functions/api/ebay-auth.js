const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

try { initializeApp(); } catch (_) {}
const db = getFirestore();
const auth = getAuth();

function buildScopeFromRequest() {
  return [
    'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.account'
  ].join(' ');
}

function getEbayConfig() {
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
      return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    }
  };
}

// 🎯 NEW: Fetch eBay account information
async function fetchEbayAccountInfo(accessToken, config) {
  console.log('🔍 Fetching eBay account information...');
  
  try {
    // Get user account info
    // Use apiz.ebay.com for Identity API instead of api.ebay.com
const identityApiUrl = config.environment === 'sandbox' 
  ? 'https://apiz.sandbox.ebay.com'
  : 'https://apiz.ebay.com';

const userResponse = await fetch(`${identityApiUrl}/commerce/identity/v1/user/`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    let userInfo = null;
    if (userResponse.ok) {
      userInfo = await userResponse.json();
      console.log('✅ User info retrieved:', {
        hasUsername: !!userInfo.username,
        hasDisplayName: !!userInfo.displayName,
        hasEmail: !!userInfo.email
      });
    } else {
      console.warn('⚠️ User info API failed:', userResponse.status);
    }

    // Get seller account privileges
    const privilegeResponse = await fetch(`${config.getApiUrl()}/sell/account/v1/privilege`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    let sellerPrivileges = null;
    if (privilegeResponse.ok) {
      sellerPrivileges = await privilegeResponse.json();
      console.log('✅ Seller privileges retrieved');
    } else {
      console.warn('⚠️ Seller privileges API failed:', privilegeResponse.status);
    }

    // Determine seller capabilities
    const quantity = sellerPrivileges?.sellingLimit?.quantity || 0;
    const canList = quantity > 0;
    const sellerAccount = canList ? 'Seller Account' : 'Basic Account';

    // Structure account information
    const accountInfo = {
      // User identity
      username: userInfo?.username || 'Unknown',
      displayName: userInfo?.displayName || userInfo?.username || 'eBay User',
      email: userInfo?.email || null,
      ebayUserId: userInfo?.userId || null,
      registrationDate: userInfo?.registrationDate || null,
      
      // Seller capabilities
      sellerAccount: sellerAccount,
      canList: canList,
      sellerDetails: sellerPrivileges ? {
        quantity: quantity,
        hasLimits: true,
        currency: sellerPrivileges.sellingLimit?.value?.currency || 'USD'
      } : null,
      
      // API verification
      apiAccessVerified: true,
      accountType: userInfo?.accountType || 'Personal'
    };

    console.log('🎯 Complete eBay account info structured:', {
      username: accountInfo.username,
      displayName: accountInfo.displayName,
      sellerAccount: accountInfo.sellerAccount,
      canList: accountInfo.canList
    });

    return accountInfo;

  } catch (error) {
    console.error('❌ Error fetching eBay account info:', error);
    
    // Return fallback account info
    return {
      username: 'Connected User',
      displayName: 'eBay Account',
      email: null,
      ebayUserId: null,
      registrationDate: null,
      sellerAccount: 'Connected',
      canList: true, // Assume they can list since OAuth succeeded
      sellerDetails: null,
      apiAccessVerified: false,
      accountType: 'Unknown',
      fetchError: error.message
    };
  }
}

async function generateAuthUrl(req, res) {
  try {
    const config = getEbayConfig();
    
    if (!config.redirectRuName) {
      throw new Error('EBAY_REDIRECT_RU_NAME not configured. This should be your RuName from eBay Developer Console.');
    }
    
    console.log('✅ Generating eBay auth URL with RuName:', config.redirectRuName);

    const user = await verifyAuthToken(req.headers.authorization);
    const { userId } = req.body;

    if (!userId || userId !== user.uid) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const scopes = [
      'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly'

    ].join(' ');

    const state = `user_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const stateData = {
      userId,
      ruName: config.redirectRuName,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      userAgent: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || 'unknown'
    };
    
    try {
      await db.collection('ebay_oauth_states').doc(state).set(stateData);
      console.log('✅ OAuth state saved:', state);
    } catch (firestoreError) {
      console.error('❌ Failed to save OAuth state:', firestoreError);
      throw new Error('Failed to initialize OAuth flow. Please try again.');
    }

    const authUrl = new URL(config.getAuthUrl());
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', config.redirectRuName);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);

    console.log('✅ eBay OAuth URL generated successfully');

    res.json({ 
      success: true, 
      authUrl: authUrl.toString(), 
      state,
      ruName: config.redirectRuName,
      expiresIn: 30 * 60,
      note: 'Using eBay RuName as redirect_uri'
    });
  } catch (error) {
    console.error('❌ Error generating eBay auth URL:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// 🎯 FIXED: Complete handleCallback function
async function handleCallback(req, res) {
  try {
    const config = getEbayConfig();
    console.log('✅ Handling eBay OAuth callback');

    const user = await verifyAuthToken(req.headers.authorization);
    const { code, state, userId } = req.body;

    // Basic validation
    if (!code) return res.status(400).json({ success: false, error: 'Authorization code is required' });
    if (!state) return res.status(400).json({ success: false, error: 'State parameter is required' });
    if (!userId || userId !== user.uid) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    // Enhanced state validation
    console.log('🔍 Validating state parameter:', state);

    let stateDoc;
    try {
      stateDoc = await db.collection('ebay_oauth_states').doc(state).get();
    } catch (firestoreError) {
      console.error('❌ Firestore error reading state:', firestoreError);
      return res.status(500).json({
        success: false,
        error: 'Database error during validation',
        details: 'Could not validate OAuth state'
      });
    }

    if (!stateDoc.exists) {
      console.error('❌ State document not found:', state);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired state parameter',
        details: 'OAuth state not found.',
        suggestion: 'Please try connecting to eBay again'
      });
    }
    
    const stateData = stateDoc.data();
    
    // Validate state ownership and expiration
    if (stateData.userId !== userId) {
      console.error('❌ State user mismatch:', { expected: userId, actual: stateData.userId });
      return res.status(400).json({ 
        success: false, 
        error: 'State parameter does not match user'
      });
    }
    
    const now = new Date();
    const expiresAt = stateData.expiresAt?.toDate();
    
    if (!expiresAt || now > expiresAt) {
      console.error('❌ State expired');
      try {
        await db.collection('ebay_oauth_states').doc(state).delete();
      } catch (e) {
        console.warn('Could not delete expired state:', e);
      }
      
      return res.status(400).json({ 
        success: false, 
        error: 'OAuth state has expired',
        suggestion: 'Please try connecting to eBay again'
      });
    }

    console.log('✅ State validation passed');
    console.log('🔄 Exchanging authorization code for tokens...');

    // Token exchange
    const tokenResponse = await fetch(config.getTokenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${config.getBasicAuth()}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectRuName
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ eBay token exchange failed:', errorText);
      
      try {
        await db.collection('ebay_oauth_states').doc(state).delete();
      } catch (e) {
        console.warn('Could not delete state after token failure:', e);
      }
      
      return res.status(400).json({
        success: false,
        error: `eBay token exchange failed: ${tokenResponse.status}`,
        details: errorText
      });
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token exchange successful');

    console.log('🔍 eBay token response analysis:', {
      access_token: !!tokenData.access_token,
      refresh_token: !!tokenData.refresh_token,
      token_type: tokenData.token_type || 'undefined',
      expires_in: tokenData.expires_in || 'undefined',
      scope: tokenData.scope || 'undefined'
    });

    // 🎯 FIXED: Fetch eBay account information using the access token
    const ebayAccountInfo = await fetchEbayAccountInfo(tokenData.access_token, config);

    // 🎯 Calculate token expiration
    const currentTime = Date.now();
    const expiresInMs = (tokenData.expires_in || 7200) * 1000; // Default 2 hours
    const tokenExpiresAt = new Date(currentTime + expiresInMs);
    
    // Handle refresh token expiry
    let refreshExpiresAt;
    if (tokenData.refresh_token_expires_in) {
      refreshExpiresAt = new Date(currentTime + (tokenData.refresh_token_expires_in * 1000));
    } else {
      // eBay refresh tokens typically last 18 months
      refreshExpiresAt = new Date(currentTime + (18 * 30 * 24 * 60 * 60 * 1000));
    }

    // 🎯 CREATE COMPLETE eBay CONFIG FOR SDK
    const ebayTokenData = {
      // Core authentication
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || 'Bearer',
      
      // Token lifecycle
      expiresAt: tokenExpiresAt,
      refreshExpiresAt: refreshExpiresAt,
      
      // API permissions
      scope: tokenData.scope || buildScopeFromRequest(),
      environment: config.environment || 'production',
      ruName: config.redirectRuName,
      
      // 🎯 FIXED: Account information from API
      username: ebayAccountInfo.username,
      displayName: ebayAccountInfo.displayName,
      ebayUserId: ebayAccountInfo.ebayUserId,
      email: ebayAccountInfo.email,
      registrationDate: ebayAccountInfo.registrationDate,
      
      // Seller capabilities
      sellerAccount: ebayAccountInfo.sellerAccount,
      canList: ebayAccountInfo.canList,
      sellerDetails: ebayAccountInfo.sellerDetails,
      
      // Metadata
      isConnected: true,
      connectedAt: new Date(),
      tokenSource: 'oauth_flow',
      lastRefreshed: null,
      apiAccessVerified: ebayAccountInfo.apiAccessVerified
    };

    // Add optional fields only if they exist
    if (tokenData.refresh_token_expires_in) {
      ebayTokenData.refreshExpiresInSeconds = tokenData.refresh_token_expires_in;
    }

    console.log('🎯 Complete eBay account info ready:', {
      username: ebayTokenData.username,
      displayName: ebayTokenData.displayName,
      sellerAccount: ebayTokenData.sellerAccount,
      canList: ebayTokenData.canList
    });

    // 🎯 VALIDATE ALL REQUIRED SDK FIELDS ARE PRESENT
    const requiredForSDK = [
      'accessToken', 
      'refreshToken', 
      'scope', 
      'environment', 
      'ruName', 
      'sellerAccount'
    ];
    
    const missingFields = requiredForSDK.filter(field => !ebayTokenData[field]);
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required SDK fields:', missingFields);
      throw new Error(`Missing critical eBay fields for SDK: ${missingFields.join(', ')}`);
    }

    // 🎯 STORE IN FIRESTORE
    await db.collection('users').doc(userId).set(
      { 
        ebay: ebayTokenData, 
        'metadata.updatedAt': new Date() 
      },
      { merge: true }
    );

    console.log('✅ eBay tokens stored successfully');

    // Clean up OAuth state
    await db.collection('ebay_oauth_states').doc(state).delete();
    console.log('✅ OAuth state cleaned up');

    console.log('🎉 eBay OAuth completed - SDK ready for user:', userId);

    // 🎯 SUCCESS RESPONSE WITH ACCOUNT INFO
    res.json({
      success: true,
      sellerAccount: ebayTokenData.sellerAccount,
      canList: ebayTokenData.canList,
      accountInfo: {
        username: ebayTokenData.username,
        displayName: ebayTokenData.displayName,
        email: ebayTokenData.email,
        ebayUserId: ebayTokenData.ebayUserId,
        sellerAccount: ebayTokenData.sellerAccount,
        canList: ebayTokenData.canList,
        connectedAt: ebayTokenData.connectedAt.toISOString()
      },
      environment: ebayTokenData.environment,
      expiresAt: ebayTokenData.expiresAt.toISOString(),
      message: `Connected to eBay account: ${ebayTokenData.displayName || ebayTokenData.username}`
    });
    
  } catch (error) {
    console.error('❌ Error handling eBay OAuth callback:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error during OAuth callback',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// 🎯 NEW: Get eBay account info function
async function getEbayAccountInfo(req, res) {
  try {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }

    // Verify authentication
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Get user's eBay connection
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userData = userDoc.data();
    const ebayData = userData.ebay;

    if (!ebayData?.isConnected) {
      return res.status(400).json({ success: false, error: 'eBay not connected' });
    }

    // Return account information
    res.json({
      success: true,
      accountInfo: {
        username: ebayData.username || 'Connected User',
        displayName: ebayData.displayName || ebayData.username || 'eBay Account',
        email: ebayData.email,
        ebayUserId: ebayData.ebayUserId,
        sellerAccount: ebayData.sellerAccount || 'Connected',
        canList: ebayData.canList || false,
        connectedAt: ebayData.connectedAt,
        environment: ebayData.environment || 'production',
        apiAccessVerified: ebayData.apiAccessVerified || false
      }
    });

  } catch (error) {
    console.error('❌ Error getting eBay account info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Verification function
async function verifyAuthToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    return await auth.verifyIdToken(idToken);
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid Firebase auth token');
  }
}

async function testConnection(req, res) {
  try {
    const config = getEbayConfig();
    console.log('✅ eBay connection test');

    res.json({
      success: true,
      message: 'eBay Auth function is working',
      config: {
        environment: config.environment,
        hasClientId: !!config.clientId,
        hasClientSecret: !!config.clientSecret,
        redirectRuName: config.redirectRuName,
        hasRuName: !!config.redirectRuName
      },
      endpoints: [
        'POST /auth-url - Generate OAuth URL',
        'POST /callback - Handle OAuth callback', 
        'GET /test - Test connection'
      ]
    });
  } catch (error) {
    console.error('❌ Error testing eBay connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Main exports
exports.ebayAuth = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).send();
    return;
  }

  try {
    const path = req.path || req.url;
    const method = req.method;
    
    console.log(`🔍 eBay Auth API: ${method} ${path}`);

    if (method === 'POST' && path.includes('auth-url')) {
      return await generateAuthUrl(req, res);
    } else if (method === 'POST' && path.includes('callback')) {
      return await handleCallback(req, res);
    } else if (method === 'GET') {
      return await testConnection(req, res);
    } else {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        requestedPath: path,
        method: method
      });
    }
  } catch (error) {
    console.error('❌ eBay Auth API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// 🎯 NEW: Separate export for eBay account info
exports.ebayAccountInfo = functions.https.onRequest(getEbayAccountInfo);