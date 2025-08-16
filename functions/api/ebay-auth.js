// functions/api/ebay-auth.js
// Cloud Function to handle eBay OAuth flow

const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// CORS
const cors = require('cors')({
  origin: true,
  credentials: true
});

// Init Firebase Admin (idempotent)
try { initializeApp(); } catch (_) {}

const db = getFirestore();
const auth = getAuth();

// eBay OAuth Configuration
const EBAY_CONFIG = {
  clientId: process.env.EBAY_CLIENT_ID,
  clientSecret: process.env.EBAY_CLIENT_SECRET,
  environment: process.env.EBAY_ENVIRONMENT || 'production', // 'sandbox' | 'production'
  redirectRuName: process.env.EBAY_REDIRECT_RU_NAME, // <-- YOUR RuName (e.g., SUPERFUN_STUDIO-SUPERFUN-S-PRD--gmotfjins)

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

  getBasicAuth() {
    return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
  }
};

// Validate eBay configuration
function validateEbayConfig() {
  if (!EBAY_CONFIG.clientId || !EBAY_CONFIG.clientSecret || !EBAY_CONFIG.redirectRuName) {
    throw new Error(
      'eBay credentials not configured. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_REDIRECT_RU_NAME.'
    );
  }
}

// Verify Firebase Auth token
async function verifyAuthToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    return await auth.verifyIdToken(idToken);
  } catch {
    throw new Error('Invalid Firebase auth token');
  }
}

// Generate eBay OAuth URL
async function generateAuthUrl(req, res) {
  try {
    validateEbayConfig();

    // Verify user authentication
    const user = await verifyAuthToken(req.headers.authorization);
    const { userId } = req.body;

    if (!userId || userId !== user.uid) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    // Scopes required for listing
    const scopes = [
      'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.account'
    ].join(' ');

    // CSRF state
    const state = `user_${userId}_${Date.now()}`;
    await db.collection('ebay_oauth_states').doc(state).set({
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 min
    });

    // Build authorize URL — NOTE: redirect_uri must be the RuName
    const authUrl = new URL(EBAY_CONFIG.getAuthUrl());
    authUrl.searchParams.set('client_id', EBAY_CONFIG.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', EBAY_CONFIG.redirectRuName);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);

    res.json({ success: true, authUrl: authUrl.toString(), state });
  } catch (error) {
    console.error('Error generating eBay auth URL:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Handle eBay OAuth callback
async function handleCallback(req, res) {
  try {
    validateEbayConfig();

    // Verify user authentication
    const user = await verifyAuthToken(req.headers.authorization);
    const { code, state, userId } = req.body;

    if (!code) return res.status(400).json({ success: false, error: 'Authorization code is required' });
    if (!state) return res.status(400).json({ success: false, error: 'State parameter is required' });
    if (!userId || userId !== user.uid) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    // Validate state
    const stateDoc = await db.collection('ebay_oauth_states').doc(state).get();
    if (!stateDoc.exists) {
      return res.status(400).json({ success: false, error: 'Invalid or expired state parameter' });
    }
    const stateData = stateDoc.data();
    if (stateData.userId !== userId) {
      return res.status(400).json({ success: false, error: 'State parameter does not match user' });
    }
    if (new Date() > stateData.expiresAt.toDate()) {
      return res.status(400).json({ success: false, error: 'OAuth state has expired' });
    }

    // Exchange code for tokens — redirect_uri must match authorize step (RuName)
    const tokenResponse = await fetch(EBAY_CONFIG.getTokenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${EBAY_CONFIG.getBasicAuth()}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: EBAY_CONFIG.redirectRuName
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('eBay token exchange failed:', errorText);
      return res.status(400).json({
        success: false,
        error: `eBay token exchange failed: ${tokenResponse.status} - ${errorText}`
      });
    }

    const tokenData = await tokenResponse.json();

    // Expirations
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    const refreshExpiresAt = tokenData.refresh_token_expires_in
      ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // Optional seller privilege fetch
    let sellerAccount = 'Connected';
    try {
      const base = EBAY_CONFIG.environment === 'sandbox'
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com';
      const userResponse = await fetch(`${base}/sell/account/v1/privilege`, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' }
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        sellerAccount = userData.sellingLimit?.quantity ? 'Seller Account' : 'Basic Account';
      }
    } catch (e) {
      console.warn('Could not fetch seller account info:', e.message);
    }

    // Persist tokens
    const ebayTokenData = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || 'Bearer',
      expiresAt,
      refreshExpiresAt,
      scope: tokenData.scope,
      sellerAccount,
      isConnected: true,
      connectedAt: new Date(),
      environment: EBAY_CONFIG.environment
    };

    await db.collection('users').doc(userId).set(
      { ebay: ebayTokenData, 'metadata.updatedAt': new Date() },
      { merge: true }
    );

    // Clean up state
    await db.collection('ebay_oauth_states').doc(state).delete();

    res.json({
      success: true,
      sellerAccount,
      environment: EBAY_CONFIG.environment,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Error handling eBay OAuth callback:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Test eBay connection
async function testConnection(req, res) {
  try {
    const user = await verifyAuthToken(req.headers.authorization);

    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) return res.status(404).json({ success: false, error: 'User not found' });

    const userData = userDoc.data();
    if (!userData.ebay?.isConnected) {
      return res.status(400).json({ success: false, error: 'eBay account not connected' });
    }

    let { accessToken } = userData.ebay;
    const now = new Date();
    const expiresAt = userData.ebay.expiresAt.toDate();

    if (now >= expiresAt) {
      // Refresh
      const refreshResult = await refreshEbayToken(userData.ebay.refreshToken);
      accessToken = refreshResult.access_token;
      await db.collection('users').doc(user.uid).update({
        'ebay.accessToken': refreshResult.access_token,
        'ebay.expiresAt': new Date(Date.now() + refreshResult.expires_in * 1000),
        'metadata.updatedAt': new Date()
      });
    }

    const base = EBAY_CONFIG.environment === 'sandbox'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';

    const testResponse = await fetch(`${base}/sell/account/v1/privilege`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      return res.status(400).json({ success: false, error: `eBay API test failed: ${testResponse.status} - ${errorText}` });
    }

    const privilegeData = await testResponse.json();
    res.json({
      success: true,
      connected: true,
      sellerAccount: userData.ebay.sellerAccount,
      environment: userData.ebay.environment,
      privileges: privilegeData,
      tokenValid: true
    });
  } catch (error) {
    console.error('Error testing eBay connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Refresh eBay token
async function refreshEbayToken(refreshToken) {
  const response = await fetch(EBAY_CONFIG.getTokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${EBAY_CONFIG.getBasicAuth()}`
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
}

// Main Cloud Function handler
exports.ebayAuth = onRequest({ cors: true }, async (req, res) => {
  return cors(req, res, async () => {
    try {
      const path = req.path || req.url;
      const method = req.method;
      console.log(`eBay Auth API called: ${method} ${path}`);

      if (method === 'POST' && path.includes('/auth-url')) {
        return await generateAuthUrl(req, res);
      } else if (method === 'POST' && path.includes('/callback')) {
        return await handleCallback(req, res);
      } else if (method === 'GET' && path.includes('/test')) {
        return await testConnection(req, res);
      }

      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
          'POST /auth-url - Generate OAuth URL',
          'POST /callback - Handle OAuth callback',
          'GET /test - Test connection'
        ]
      });
    } catch (error) {
      console.error('eBay Auth API error:', error);
      res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
    }
  });
});
