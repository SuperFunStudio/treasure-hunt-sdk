const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');
const express = require('express');
const dotenv = require('dotenv');
const Busboy = require('busboy');
const cors = require('cors');

// NEW: Import the refactored modules
const { EbayApiClient } = require('./api/ebay-api-client.js');
const { EbayPolicyService } = require('./capture-sdk/utils/ebay-policy-service.js');
const { EbayTokenManager } = require('./capture-sdk/utils/ebay-token-manager.js');

// FIXED: Import and initialize the category mapper
const { 
  initializeDatabase, 
  getCategoryMapping, 
  mapCategoryToEbayId, 
  validateCategoryMapping,
  getFallbackMapping 
} = require('./ebay-category-mapper');

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

initializeDatabase(db, admin);
console.log('✅ Category mapper initialized with database access');

const VERIFICATION_TOKEN = 'treasurehunter-sdk-1753715372';
const CLIENT_URL = 'https://treasurehunter-sdk.web.app';

setGlobalOptions({ region: 'us-central1' });

// --- Instantiate refactored services ---
const ebayApiClient = new EbayApiClient();
const ebayPolicyService = new EbayPolicyService();
const ebayTokenManager = new EbayTokenManager();

// --- Main Express App ---
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// --- Core API Endpoints (refactored to use services) ---
app.post('/api/ebay/create-listing', async (req, res) => {
  const { listingData, userId } = req.body;

  try {
    console.log('Creating eBay listing for user:', userId);
    
    const tokenInfo = await ebayTokenManager.getValidAccessToken(userId);
    const accessToken = tokenInfo.accessToken;

    const policies = await ebayPolicyService.getRecommendedPolicies(userId);
    
    // Step 1: Create inventory item
    const inventoryItem = await ebayApiClient.apiCall(
      userId,
      'PUT',
      `/sell/inventory/v1/inventory_item/${listingData.sku}`,
      listingData
    );
    
    // Step 2: Create offer with recommended policies
    const offerData = {
      sku: listingData.sku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      pricingSummary: { price: { currency: 'USD', value: listingData.pricing.buyItNowPrice.toString() } },
      categoryId: listingData.category,
      merchantLocationKey: policies.merchantLocationKey,
      listingPolicies: {
        fulfillmentPolicyId: policies.fulfillmentPolicyId,
        paymentPolicyId: policies.paymentPolicyId,
        returnPolicyId: policies.returnPolicyId,
      },
    };

    const offer = await ebayApiClient.apiCall(
      userId,
      'POST',
      '/sell/inventory/v1/offer',
      offerData
    );
    
    // Step 3: Publish offer
    const publishResult = await ebayApiClient.apiCall(
      userId,
      'POST',
      `/sell/inventory/v1/offer/${offer.offerId}/publish`
    );
    
    const result = {
      success: true,
      listingId: publishResult.listingId,
      sku: inventoryItem.sku,
      offerId: offer.offerId,
      url: ebayApiClient.getEbayConfig().getApiUrl() + `/itm/${publishResult.listingId}`,
    };

    res.json(result);
  } catch (error) {
    console.error('eBay listing creation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- OAuth Endpoints (refactored to use services) ---
app.post('/api/ebay/auth-url', async (req, res) => {
  try {
    const config = ebayApiClient.getEbayConfig();
    const scopes = ebayApiClient.buildScopeFromRequest();
    
    const state = `user_${req.body.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('ebay_oauth_states').doc(state).set({ userId: req.body.userId });

    const authUrl = new URL(config.getAuthUrl());
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', config.redirectRuName);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);

    res.json({ success: true, authUrl: authUrl.toString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ebay/callback', async (req, res) => {
  try {
    const { code, state, userId } = req.body;
    const stateDoc = await db.collection('ebay_oauth_states').doc(state).get();
    if (!stateDoc.exists || stateDoc.data().userId !== userId) {
      throw new Error('Invalid state parameter');
    }

    const config = ebayApiClient.getEbayConfig();
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
      throw new Error('Token exchange failed');
    }
    
    const tokenData = await tokenResponse.json();
    await ebayTokenManager.storeTokens(userId, tokenData);
    await db.collection('ebay_oauth_states').doc(state).delete();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Final export as a single cloud function ---
exports.app = onRequest(app);

// --- Startup Logging ---
console.log('🚀 Functions initialized with refactored services');
console.log('📊 Configuration status:');
console.log('  - eBay Client ID:', !!process.env.EBAY_CLIENT_ID ? '✅' : '❌');
console.log('  - eBay Client Secret:', !!process.env.EBAY_CLIENT_SECRET ? '✅' : '❌');
console.log('  - eBay RuName:', !!process.env.EBAY_REDIRECT_RU_NAME ? '✅' : '❌');
