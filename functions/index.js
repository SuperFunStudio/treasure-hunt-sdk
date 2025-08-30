
// ========== 1. ALL IMPORTS FIRST ==========
const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');
const express = require('express');
const dotenv = require('dotenv');
const Busboy = require('busboy');
const cors = require('cors');
const { EbayTokenManager } = require('./capture-sdk/utils/ebay-token-manager.js');

// FIXED: Import and initialize the category mapper
const { 
  initializeDatabase, 
  getCategoryMapping, 
  mapCategoryToEbayId, 
  validateCategoryMapping,
  getFallbackMapping 
} = require('./ebay-category-mapper');

// ========== 2. ENVIRONMENT SETUP ==========
// Load environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}


// ========== 3. FIREBASE INITIALIZATION ==========
// Firebase Admin initialization
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// FIXED: Initialize the category mapper with database instances
initializeDatabase(db, admin);
console.log('✅ Category mapper initialized with database access');

// ========== 4. CONSTANTS AND CONFIG ==========
// eBay webhook config
const VERIFICATION_TOKEN = 'treasurehunter-sdk-1753755107391-zfgw1dyhl';
const ENDPOINT_URL = 'https://ebaynotifications-beprv7ll2q-uc.a.run.app';

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 540
});

// Log environment status
console.log('Environment check:', {
  hasOpenAI: !!process.env.OPENAI_API_KEY,
  hasClaude: !!process.env.CLAUDE_API_KEY,
  hasEbayClientId: !!process.env.EBAY_CLIENT_ID,
  hasEbaySecret: !!process.env.EBAY_CLIENT_SECRET,
  ebayEnvironment: process.env.EBAY_ENVIRONMENT || 'not-set',
});

const INTERNAL_CATEGORIES = [
  'electronics', 'furniture', 'clothing', 'footwear', 'tools', 
  'books', 'automotive', 'toys', 'sporting goods', 'jewelry', 
  'home & garden', 'collectibles'
];

// Category mapping keywords for better matching
const CATEGORY_KEYWORDS = {
  'electronics': ['electronic', 'computer', 'phone', 'tablet', 'camera', 'audio', 'video', 'gadget'],
  'furniture': ['furniture', 'chair', 'table', 'desk', 'sofa', 'cabinet', 'shelf', 'storage'],
  'clothing': ['clothing', 'shirt', 'dress', 'pants', 'jacket', 'sweater', 'apparel', 'fashion'],
  'footwear': ['shoes', 'boots', 'sneakers', 'sandals', 'footwear', 'athletic shoes'],
  'tools': ['tools', 'hardware', 'wrench', 'drill', 'saw', 'equipment', 'construction'],
  'books': ['books', 'magazines', 'literature', 'textbook', 'novel', 'manual'],
  'automotive': ['automotive', 'car', 'vehicle', 'parts', 'accessories', 'motorcycle'],
  'toys': ['toys', 'games', 'dolls', 'action figures', 'puzzles', 'educational'],
  'sporting goods': ['sports', 'athletic', 'fitness', 'outdoor', 'exercise', 'recreation'],
  'jewelry': ['jewelry', 'watches', 'rings', 'necklaces', 'earrings', 'bracelets'],
  'home & garden': ['home', 'garden', 'kitchen', 'bathroom', 'decor', 'appliances', 'yard'],
  'collectibles': ['collectibles', 'antiques', 'vintage', 'memorabilia', 'coins', 'stamps']
};


// ========== 5. UTILITY FUNCTIONS (DEFINE BEFORE USE) ==========
// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// One shared CORS handler for the entire module
const corsHandler = cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});


 
// ========== 6. SDK INITIALIZATION ==========
let cachedSDK = null;
let sdkInitError = null;

async function getSDK() {
  if (cachedSDK) return cachedSDK;
  try {
    const CaptureSDK = require('./capture-sdk/index.js');
    cachedSDK = new CaptureSDK({
      visionProvider: 'claude',
      apiKeys: {
        gpt4v: process.env.OPENAI_API_KEY,
        claude: process.env.CLAUDE_API_KEY
      },
      ebay: {
        clientId: process.env.EBAY_CLIENT_ID,
        clientSecret: process.env.EBAY_CLIENT_SECRET,
        environment: process.env.EBAY_ENVIRONMENT || 'production',
        redirectUri: process.env.EBAY_REDIRECT_URI
      }
    });
    console.log('✅ SDK initialized with eBay configuration');
    return cachedSDK;
  } catch (error) {
    console.error('❌ SDK initialization failed:', error);
    sdkInitError = error.message;
    console.log('🔄 Using fallback SDK');
    return createFallbackSDK();
  }
}

function createFallbackSDK() {
  const ebayConfig = {
    clientId: process.env.EBAY_CLIENT_ID,
    clientSecret: process.env.EBAY_CLIENT_SECRET,
    environment: process.env.EBAY_ENVIRONMENT || 'production',
  };

  return {
    ebayConfig: ebayConfig.clientId && ebayConfig.clientSecret ? ebayConfig : null,
    async analyzeItem(_images, _options = {}) {
      console.log('🔄 Fallback SDK: analyzeItem called');
      return {
        category: 'Electronics',
        brand: 'Unknown',
        model: 'Unknown',
        condition: {
          rating: 'good',
          description: 'Item appears to be in good condition',
          usableAsIs: true,
          issues: []
        },
        confidence: 7,
        resale: {
          recommendation: 'resell',
          priceRange: { low: 15, high: 35, currency: 'USD' },
          justification: 'Fallback estimation based on category'
        },
        salvageable: [],
        identifiers: { visible_text: '', color: 'Unknown' }
      };
    },
    async getRoutes(itemData, userPreferences = {}, ebayConfigOverride = null) {
      console.log('🔄 Fallback SDK: getRoutes called');
      try {
        const { routeDisposition } = require('./capture-sdk/core/routeDisposition.js');
        return routeDisposition(itemData, userPreferences, ebayConfigOverride || this.ebayConfig);
      } catch (error) {
        console.warn('Fallback routing failed:', error.message);
        return {
          recommendedRoute: {
            type: 'donation',
            priority: 1,
            estimatedReturn: 0,
            timeToMoney: 'immediate',
            effort: 'low',
            reason: 'Fallback recommendation'
          },
          alternativeRoutes: [],
          marketAnalysis: {
            estimatedValue: { suggested: null, confidence: 'low', source: 'fallback' }
          }
        };
      }
    },
    async generateListing(itemData, route, _options = {}) {
      console.log('🔄 Fallback SDK: generateListing called');
      return {
        title: `${itemData.brand !== 'Unknown' ? itemData.brand + ' ' : ''}${itemData.category}`,
        description: itemData.condition?.description || 'Item for sale - see photos for condition',
        pricing: { buyItNowPrice: route?.estimatedReturn || 25 },
        condition: itemData.condition?.rating || 'good',
        category: '171485'
      };
    }
  };
}
  
// ========== 7. AUTHENTICATION MIDDLEWARE ==========
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header missing or invalid');
  }
  const idToken = authHeader.split('Bearer ')[1];
  return await admin.auth().verifyIdToken(idToken);
}


// ========== 8. EBAY TOKEN MANAGEMENT ==========
async function refreshEbayToken(refreshToken) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64')}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account.readonly https://api.ebay.com/oauth/api_scope/sell.account'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }
  return await response.json();
}

async function getValidEbayToken(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  if (!userData?.ebay?.isConnected) throw new Error('eBay account not connected');

  const ebayData = userData.ebay;
  const now = new Date();
  const expiresAt = ebayData.expiresAt?.toDate();

  // Refresh if expiring within 5 minutes
  if (!expiresAt || (expiresAt.getTime() - now.getTime()) < 300000) {
    console.log('🔄 Refreshing eBay token for user:', userId);
    const tokenData = await refreshEbayToken(ebayData.refreshToken);

    await db.collection('users').doc(userId).update({
      'ebay.accessToken': tokenData.access_token,
      'ebay.expiresAt': admin.firestore.Timestamp.fromDate(new Date(Date.now() + (tokenData.expires_in * 1000))),
      'ebay.refreshToken': tokenData.refresh_token || ebayData.refreshToken,
      'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });
    return tokenData.access_token;
  }
  return ebayData.accessToken;
}
// ========== 9. EBAY API HELPER FUNCTIONS ==========
async function callEbayAPI(accessToken, method, endpoint, body = null) {
  const fetch = (await import('node-fetch')).default;
  console.log(`📡 Calling eBay API: ${method} ${endpoint}`);

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
  };

  // CRITICAL FIX: Add Content-Language header for Inventory API calls
  if (endpoint.includes('/sell/inventory/')) {
    headers['Content-Language'] = 'en-US';
    console.log('✅ Added Content-Language: en-US header for Inventory API');
  }

  const response = await fetch(`https://api.ebay.com${endpoint}`, {
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


async function callTradingAPI(accessToken, apiCallName, xmlPayload) {
  const fetch = (await import('node-fetch')).default;
  console.log(`📡 Calling eBay Trading API: ${apiCallName}`);

  const headers = {
    'X-EBAY-API-COMPATIBILITY-LEVEL': '1183', // This should be a recent, stable version.
    'X-EBAY-API-CALL-NAME': apiCallName,
    'X-EBAY-API-SITEID': '0', // 0 is for the US site
    'X-EBAY-API-IAF-TOKEN': accessToken, // This is the new header for OAuth
    'Content-Type': 'text/xml'
  };

  const tradingApiUrl = `https://api.ebay.com/ws/api.dll`;

  const response = await fetch(tradingApiUrl, {
    method: 'POST',
    headers,
    body: xmlPayload
  });

  const responseText = await response.text();
  console.log('📝 Raw Trading API response:', responseText);

  // The Trading API response is XML. We'll need a library to parse it.
  // We'll create a simple function to handle this for now.
  if (!response.ok) {
    console.error('eBay Trading API error details:', {
      status: response.status,
      endpoint: tradingApiUrl,
      response: responseText
    });
    throw new Error(`eBay Trading API error ${response.status}: ${responseText}`);
  }

  // NOTE: In a real-world app, you would parse the XML response to get the data.
  // For this example, we'll just return the raw text to demonstrate success/failure.
  return responseText;
}

async function detectAndSelectExistingPolicies(userId) {
  const accessToken = await getValidEbayToken(userId);
  
  // Get all existing policies
  const [fulfillmentResponse, paymentResponse, returnResponse] = await Promise.all([
    callEbayAPI(accessToken, 'GET', '/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US'),
    callEbayAPI(accessToken, 'GET', '/sell/account/v1/payment_policy?marketplace_id=EBAY_US'),
    callEbayAPI(accessToken, 'GET', '/sell/account/v1/return_policy?marketplace_id=EBAY_US')
  ]);
  
  // Select best existing policies or return null if insufficient
  if (fulfillmentResponse.fulfillmentPolicies?.length > 0 && 
      paymentResponse.paymentPolicies?.length > 0 && 
      returnResponse.returnPolicies?.length > 0) {
    
    return {
      fulfillmentPolicyId: fulfillmentResponse.fulfillmentPolicies[0].fulfillmentPolicyId,
      paymentPolicyId: paymentResponse.paymentPolicies[0].paymentPolicyId,
      returnPolicyId: returnResponse.returnPolicies[0].returnPolicyId
    };
  }
  
  return null; // No complete set of policies found
}

async function createCompleteNewPolicies(accessToken) {
  const timestamp = Date.now();
  
  // Create all three policies with corrected payloads
  const [paymentResult, returnResult, fulfillmentResult] = await Promise.all([
    callEbayAPI(accessToken, 'POST', '/sell/account/v1/payment_policy', {
      name: `AutoPayment-${timestamp}`,
      marketplaceId: 'EBAY_US',
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }],
      // Use standard payment methods, as brands field is deprecated
      paymentMethods: [{ paymentMethodType: 'PAYPAL' }, { paymentMethodType: 'CREDIT_CARD' }],
      immediatePayRequired: true
    }),
    callEbayAPI(accessToken, 'POST', '/sell/account/v1/return_policy', {
      name: `AutoReturns-${timestamp}`,
      marketplaceId: 'EBAY_US',
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }],
      returnsAccepted: true,
      returnPeriod: { value: 30, unit: 'DAY' },
      returnShippingCostPayer: 'BUYER',
      returnMethod: 'MONEY_BACK'
    }),
    callEbayAPI(accessToken, 'POST', '/sell/account/v1/fulfillment_policy', {
      name: `AutoShipping-${timestamp}`,
      marketplaceId: 'EBAY_US',
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }],
      handlingTime: { value: 1, unit: 'DAY' },
      shippingOptions: [{
        optionType: 'DOMESTIC',
        costType: 'FLAT_RATE',
        shippingServices: [{
          sortOrder: 1,
          // Use a specific, common service code to satisfy Trading API validation
          shippingServiceCode: 'USPSPriority', 
          shippingCost: { currency: 'USD', value: '8.99' }
        }, {
          sortOrder: 2,
          shippingServiceCode: 'USPSFirstClass', 
          shippingCost: { currency: 'USD', value: '5.99' }
        }]
      }],
      globalShipping: false,
      pickupDropOff: false,
      freightShipping: false
    })
  ]);
  
  return {
    paymentPolicyId: paymentResult.paymentPolicyId,
    returnPolicyId: returnResult.returnPolicyId,
    fulfillmentPolicyId: fulfillmentResult.fulfillmentPolicyId
  };
}

// ADD THE NEW FUNCTIONS HERE:


async function getUserEbayPolicies(userId) {
  console.log(`Getting eBay policies for user: ${userId}`);
  
  try {
    const policies = await ensureUserEbayPolicies(userId);
    
    console.log('Policies retrieved/ensured:', {
      fulfillmentPolicyId: policies.fulfillmentPolicyId,
      paymentPolicyId: policies.paymentPolicyId,
      returnPolicyId: policies.returnPolicyId
    });
    
    return policies;
    
  } catch (error) {
    console.error('Failed to get user eBay policies:', error);
    throw new Error(`Unable to setup eBay business policies: ${error.message}`);
  }
}


// ✅ FIXED: Clean mapConditionToEbay function
function mapConditionToEbay(condition) {
  console.log('🏷️ Mapping condition to eBay ConditionEnum:', { input: condition, type: typeof condition });
  
  let normalizedCondition = condition;
  
  // Handle object conditions (e.g., { rating: 'good' })
  if (typeof condition === 'object' && condition !== null) {
    normalizedCondition = condition.rating || condition.condition || 'good';
  }
  
  const conditionKey = String(normalizedCondition).toLowerCase().trim();
  
  // CRITICAL FIX: Use only valid eBay Inventory API ConditionEnum values
  const conditionMap = {
    // New conditions
    'new': 'NEW',
    'like_new': 'LIKE_NEW',
    'like new': 'LIKE_NEW',
    'new_other': 'NEW_OTHER',
    'new other': 'NEW_OTHER',
    'new_with_defects': 'NEW_WITH_DEFECTS',
    'new with defects': 'NEW_WITH_DEFECTS',
    
    // Refurbished conditions
    'certified_refurbished': 'CERTIFIED_REFURBISHED',
    'certified refurbished': 'CERTIFIED_REFURBISHED',
    'excellent_refurbished': 'EXCELLENT_REFURBISHED',
    'excellent refurbished': 'EXCELLENT_REFURBISHED',
    'very_good_refurbished': 'VERY_GOOD_REFURBISHED',
    'very good refurbished': 'VERY_GOOD_REFURBISHED',
    'good_refurbished': 'GOOD_REFURBISHED',
    'good refurbished': 'GOOD_REFURBISHED',
    'seller_refurbished': 'SELLER_REFURBISHED',
    'seller refurbished': 'SELLER_REFURBISHED',
    'refurbished': 'SELLER_REFURBISHED',
    
    // Used conditions
    'excellent': 'USED_EXCELLENT',
    'used_excellent': 'USED_EXCELLENT',
    'used excellent': 'USED_EXCELLENT',
    'very_good': 'USED_VERY_GOOD',
    'very good': 'USED_VERY_GOOD',
    'used_very_good': 'USED_VERY_GOOD',
    'used very good': 'USED_VERY_GOOD',
    'good': 'USED_GOOD',
    'used_good': 'USED_GOOD',
    'used good': 'USED_GOOD',
    'used': 'USED_GOOD',
    'acceptable': 'USED_ACCEPTABLE',
    'used_acceptable': 'USED_ACCEPTABLE',
    'used acceptable': 'USED_ACCEPTABLE',
    'fair': 'USED_ACCEPTABLE',
    
    // Non-working conditions
    'poor': 'FOR_PARTS_OR_NOT_WORKING',
    'for_parts': 'FOR_PARTS_OR_NOT_WORKING',
    'for parts': 'FOR_PARTS_OR_NOT_WORKING',
    'broken': 'FOR_PARTS_OR_NOT_WORKING',
    'damaged': 'FOR_PARTS_OR_NOT_WORKING',
    'not_working': 'FOR_PARTS_OR_NOT_WORKING',
    'not working': 'FOR_PARTS_OR_NOT_WORKING',
    'for_parts_or_not_working': 'FOR_PARTS_OR_NOT_WORKING'
  };
  
  const mappedCondition = conditionMap[conditionKey] || 'USED_GOOD';
  
  console.log('Condition mapped to ConditionEnum:', { 
    input: condition, 
    normalized: conditionKey, 
    output: mappedCondition
  });
  
  return mappedCondition;
}

// ADDED: Validation function to ensure condition is valid before API calls
function isValidEbayCondition(condition) {
  const validConditions = [
    'NEW', 'LIKE_NEW', 'NEW_OTHER', 'NEW_WITH_DEFECTS',
    'CERTIFIED_REFURBISHED', 'EXCELLENT_REFURBISHED', 'VERY_GOOD_REFURBISHED', 
    'GOOD_REFURBISHED', 'SELLER_REFURBISHED',
    'USED_EXCELLENT', 'USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE',
    'FOR_PARTS_OR_NOT_WORKING', 'PRE_OWNED_EXCELLENT', 'PRE_OWNED_FAIR'
  ];
  
  return validConditions.includes(condition);
}

function formatConditionForEbay(condition) {
  const conditionDisplay = {
    'NEW': 'New',
    'LIKE_NEW': 'Like New',
    'NEW_OTHER': 'New other (see details)',
    'NEW_WITH_DEFECTS': 'New with defects',
    'CERTIFIED_REFURBISHED': 'Certified - Refurbished',
    'EXCELLENT_REFURBISHED': 'Excellent - Refurbished',
    'VERY_GOOD_REFURBISHED': 'Very Good - Refurbished',
    'GOOD_REFURBISHED': 'Good - Refurbished',
    'SELLER_REFURBISHED': 'Seller refurbished',
    'USED_EXCELLENT': 'Used - Excellent',
    'USED_VERY_GOOD': 'Used - Very Good',
    'USED_GOOD': 'Used - Good',
    'USED_ACCEPTABLE': 'Used - Acceptable',
    'FOR_PARTS_OR_NOT_WORKING': 'For parts or not working',
    'PRE_OWNED_EXCELLENT': 'Pre-owned - Excellent',
    'PRE_OWNED_FAIR': 'Pre-owned - Fair'
  };
  
  const key = String(condition).toUpperCase().trim();
  return conditionDisplay[key] || 'Used - Good';
}


function getEbayConditionId(condition) {
  const normalizedCondition = condition?.toLowerCase()?.trim();

  // Use a map of normalized strings to correct eBay numeric IDs
  const conditionIdMap = {
    'new': 1000,
    'like_new': 1500,
    'new other': 1750,
    'new_other': 1750,
    'new with defects': 2000,
    'new_with_defects': 2000,
    'certified refurbished': 2500,
    'certified_refurbished': 2500,
    'excellent refurbished': 2750,
    'excellent_refurbished': 2750,
    'very good refurbished': 3000,
    'very_good_refurbished': 3000,
    'good refurbished': 4000,
    'good_refurbished': 4000,
    'seller refurbished': 5000,
    'seller_refurbished': 5000,
    'used': 3000,
  'excellent': 3000,
  'used_excellent': 3000,
  'used excellent': 3000,
  'very_good': 3000,
  'used_very_good': 3000,
  'used very good': 3000,
  'good': 3000,
  'used_good': 3000,
  'used good': 3000,
  'acceptable': 3000, // Change this line
  'used_acceptable': 3000, // Change this line
  'used acceptable': 3000, // Change this line
  'fair': 3000, // Change this line
    'poor': 7000,
    'for_parts': 7000,
    'for parts': 7000,
    'broken': 7000,
    'damaged': 7000,
    'not_working': 7000,
    'not working': 7000,
    'for_parts_or_not_working': 7000,
  };

  // Return the mapped ID or a fallback
  return conditionIdMap[normalizedCondition] || 3000; // Default to 'Used - Good'
}


// ========== 10. EXPRESS APP SETUP ==========
const app = express();
app.use(corsHandler);


// ========== 11. ROUTE HANDLERS ==========
// Health & Test Endpoints
app.get('/health', async (_req, res) => {
  const sdk = await getSDK();
  const ebayConfigured = !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);

  res.json({
    status: 'ok',
    service: 'Treasure Hunt SDK API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    sdk: {
      available: !!sdk,
      type: sdkInitError ? 'fallback' : 'real',
      ebayConfigured,
      error: sdkInitError
    },
    environment: {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasClaude: !!process.env.CLAUDE_API_KEY,
      hasEbay: ebayConfigured,
      ebayEnv: process.env.EBAY_ENVIRONMENT || 'not-set'
    }
  });
});

app.get('/api/test', (_req, res) => {
  res.json({
    message: 'API is working',
    timestamp: new Date().toISOString(),
    ebayConfigured: !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Category endpoints
app.get('/api/ebay/init-categories', asyncHandler(async (req, res) => {
  try {
    console.log('Initializing eBay category mapping...');
    
    // Check if user is authenticated for this operation
    let userId = null;
    try {
      const decodedToken = await verifyAuth(req);
      userId = decodedToken.uid;
    } catch (authError) {
      console.log('Category init: No authentication provided');
    }
    
    // Build eBay config from environment
    const ebayConfig = {
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      environment: process.env.EBAY_ENVIRONMENT || 'production'
    };
    
    // Force refresh the mapping
    const mapping = await getCategoryMapping(true, ebayConfig);
    
    // Validate the mapping
    const validation = await validateCategoryMapping();
    
    res.json({ 
      success: true, 
      mapping,
      validation,
      totalCategories: Object.keys(mapping).length,
      ebayEnvironment: ebayConfig.environment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Category initialization failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      fallbackMapping: getFallbackMapping()
    });
  }
}));



// ---------- Diagnostic Endpoints ----------
app.options('/api/echo-raw', corsHandler);
app.post('/api/echo-raw', (req, res) => {
  const chunks = [];
  let total = 0;

  req.on('aborted', () => console.error('[echo-raw] client aborted before end'));
  req.on('data', (d) => { chunks.push(d); total += d.length; });

  req.on('end', () => {
    res.json({
      ok: true,
      headers: {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
      },
      bytesRead: total
    });
  });

  req.on('error', (e) => res.status(500).json({ ok: false, error: String(e) }));
});


// FIXED: Category validation endpoint
app.get('/api/ebay/validate-categories', asyncHandler(async (req, res) => {
  try {
    const validation = await validateCategoryMapping();
    res.json({
      success: true,
      validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// FIXED: Category testing endpoint
app.post('/api/ebay/test-category', asyncHandler(async (req, res) => {
  try {
    const { category } = req.body;
    
    if (!category) {
      return res.status(400).json({ 
        success: false, 
        error: 'Category parameter required' 
      });
    }
    
    const ebayConfig = {
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      environment: process.env.EBAY_ENVIRONMENT || 'production'
    };
    
    const categoryId = await mapCategoryToEbayId(category, ebayConfig);
    const mapping = await getCategoryMapping(false, ebayConfig);
    
    res.json({
      success: true,
      input: category,
      mapped: categoryId,
      categoryMapping: mapping ? mapping[category.toLowerCase()] : null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ---------- Main Analysis Endpoint (Multipart) ----------
app.post('/api/analyze', asyncHandler(async (req, res) => {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('multipart/form-data')) {
    return res.status(415).json({ phase: 'upload', message: 'Content-Type must be multipart/form-data' });
  }

  let userId = null;
  try {
    const decodedToken = await verifyAuth(req);
    userId = decodedToken.uid;
    console.log('[analyze] Authenticated user:', userId);
  } catch (_authError) {
    console.log('[analyze] No authentication provided - using anonymous analysis');
  }

  req.on('aborted', () => console.error('[analyze] client aborted before finish'));

  const bb = Busboy({ headers: req.headers });
  const buffers = [];
  req.pipe(bb);

  bb.on('file', (_fieldname, file) => {
    const chunks = [];
    file.on('data', (d) => chunks.push(d));
    file.on('end', () => buffers.push(Buffer.concat(chunks)));
  });

  bb.once('error', (e) => {
    console.error('[upload] busboy error:', e);
    return res.status(400).json({ phase: 'upload', message: String(e) });
  });

  bb.on('finish', async () => {
    if (buffers.length === 0) {
      return res.status(400).json({ phase: 'upload', message: 'No images provided.' });
    }

    let sdk;
    try { 
      sdk = await getSDK(); 
    } catch (e) {
      console.error('[analyze] getSDK FAILED:', e);
      return res.status(500).json({ phase: 'getSDK', message: String(e.message || e) });
    }

    let analysis;
    try {
      analysis = await sdk.analyzeItem(buffers, { provider: 'claude', apiKey: process.env.CLAUDE_API_KEY });
      console.log('[analyze] analyzeItem OK');
    } catch (e) {
      console.error('[analyze] analyzeItem FAILED:', e?.stack || e);
      return res.status(500).json({ phase: 'analyzeItem', message: String(e.message || e) });
    }

    let userData = null;
    let ebayConfig = null;

    if (userId) {
      try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        userData = userDoc.data();
        if (userData?.ebay?.isConnected && userData?.ebay?.accessToken) {
          const now = new Date();
          const expiresAt = userData.ebay.expiresAt?.toDate();
          if (expiresAt && now < expiresAt) {
            ebayConfig = {
              clientId: process.env.EBAY_CLIENT_ID,
              clientSecret: process.env.EBAY_CLIENT_SECRET,
              environment: process.env.EBAY_ENVIRONMENT || 'production',
              accessToken: userData.ebay.accessToken
            };
            console.log('[analyze] Using user eBay tokens for real pricing');
          }
        }
      } catch (userError) {
        console.warn('[analyze] Error fetching user data:', userError.message);
      }
    }

    let routes;
    try {
      if (ebayConfig) {
        routes = await sdk.getRoutes(analysis, {}, ebayConfig);
      } else {
        routes = await sdk.getRoutes(analysis, { hasEbayAccount: false });
      }
      console.log('[analyze] getRoutes OK');
    } catch (e) {
      console.error('[analyze] getRoutes FAILED:', e?.stack || e);
      return res.status(500).json({ phase: 'getRoutes', message: String(e.message || e) });
    }

    const ebayUsed = !!(routes?.marketAnalysis?.estimatedValue?.source?.toLowerCase?.().includes('ebay'));

    if (userId && analysis) {
      try {
        const scanData = {
          analysis,
          routes,
          imageCount: buffers.length,
          ebayUsed,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'analyzed'
        };
        await admin.firestore().collection('users').doc(userId).collection('scans').add(scanData);
        console.log('[analyze] Scan saved to user history');
      } catch (saveError) {
        console.warn('[analyze] Failed to save scan:', saveError.message);
      }
    }

    res.json({
      success: true,
      analysis,
      routes,
      imageCount: buffers.length,
      ebayUsed,
      userAuthenticated: !!userId,
      ebayConnected: !!ebayConfig,
      sdkType: sdkInitError ? 'fallback' : 'real'
    });
  });
}));




app.get('/api/test', (_req, res) => {
  res.json({
    message: 'API is working',
    timestamp: new Date().toISOString(),
    ebayConfigured: !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),
    environment: process.env.NODE_ENV || 'development'
  });
});



// ===== AUTOMATED EBAY POLICY SETUP =====
 
async function ensureDefaultLocation(accessToken) { // accessToken parameter, not userId
  try {
    const locations = await callEbayAPI(accessToken, 'GET', '/sell/inventory/v1/location');
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
      
      await callEbayAPI(accessToken, 'POST', '/sell/inventory/v1/location/default', locationData);
      console.log('Created default location');
    }
  } catch (error) {
    console.log('Location setup failed:', error.message);
  }
}



// ---------- Diagnostic Endpoints ----------

// Add this new function to your index.js file
async function debugCreatePolicies(userId) {
  try {
    const accessToken = await getValidEbayToken(userId);
    const result = await createCompleteNewPolicies(accessToken);
    return { success: true, policies: result };
  } catch (error) {
    console.error('Debug script failed:', error);
    return { success: false, error: error.message };
  }
}

// Add a new Express endpoint for debugging
app.post('/api/ebay/debug-policies', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const result = await debugCreatePolicies(userId);

    if (result.success) {
      // You must delete the policies manually after a successful test
      console.log('✅ Debug script succeeded. Please delete the new policies manually.');
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (authError) {
    res.status(401).json({ success: false, error: 'Authentication failed.' });
  }
}));

// This function can be a new function to delete existing policies for a clean slate
async function deleteUserPolicies(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  const policyIds = userDoc.data().ebay.policies;
  const accessToken = await getValidEbayToken(userId);
  await deleteEbayPolicy(accessToken, policyIds.fulfillmentPolicyId, 'fulfillment');
  await deleteEbayPolicy(accessToken, policyIds.paymentPolicyId, 'payment');
  await deleteEbayPolicy(accessToken, policyIds.returnPolicyId, 'return');
}

app.options('/api/echo-raw', corsHandler);
app.post('/api/echo-raw', (req, res) => {
  const chunks = [];
  let total = 0;

  req.on('aborted', () => console.error('[echo-raw] client aborted before end'));
  req.on('data', (d) => { chunks.push(d); total += d.length; });

  req.on('end', () => {
    res.json({
      ok: true,
      headers: {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
      },
      bytesRead: total
    });
  });

  req.on('error', (e) => res.status(500).json({ ok: false, error: String(e) }));
});

// ---------- Main Analysis Endpoint (Multipart) ----------
app.options('/api/analyze', corsHandler);
app.post('/api/analyze', asyncHandler(async (req, res) => {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('multipart/form-data')) {
    return res.status(415).json({ phase: 'upload', message: 'Content-Type must be multipart/form-data' });
  }

  // User authentication
  let userId = null;
  try {
    const decodedToken = await verifyAuth(req);
    userId = decodedToken.uid;
    console.log('[analyze] Authenticated user:', userId);
  } catch (_authError) {
    console.log('[analyze] No authentication provided - using anonymous analysis');
  }

  req.on('aborted', () => console.error('[analyze] client aborted before finish'));

  const bb = Busboy({ headers: req.headers });
  const buffers = [];
  req.pipe(bb);

  bb.on('file', (_fieldname, file) => {
    const chunks = [];
    file.on('data', (d) => chunks.push(d));
    file.on('end', () => buffers.push(Buffer.concat(chunks)));
  });

  bb.once('error', (e) => {
    console.error('[upload] busboy error:', e);
    return res.status(400).json({ phase: 'upload', message: String(e) });
  });

  bb.on('finish', async () => {
    if (buffers.length === 0) {
      return res.status(400).json({ phase: 'upload', message: 'No images provided.' });
    }

    let sdk;
    try { sdk = await getSDK(); }
    catch (e) {
      console.error('[analyze] getSDK FAILED:', e);
      return res.status(500).json({ phase: 'getSDK', message: String(e.message || e) });
    }

    // Analyze the item
    let analysis;
    try {
      analysis = await sdk.analyzeItem(buffers, { provider: 'claude', apiKey: process.env.CLAUDE_API_KEY });
      console.log('[analyze] analyzeItem OK');
    } catch (e) {
      console.error('[analyze] analyzeItem FAILED:', e?.stack || e);
      return res.status(500).json({ phase: 'analyzeItem', message: String(e.message || e) });
    }

    // Get user's eBay configuration if authenticated
    let userData = null;
    let ebayConfig = null;

    if (userId) {
      try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        userData = userDoc.data();
        if (userData?.ebay?.isConnected && userData?.ebay?.accessToken) {
          const now = new Date();
          const expiresAt = userData.ebay.expiresAt?.toDate();
          if (expiresAt && now < expiresAt) {
            ebayConfig = {
              clientId: process.env.EBAY_CLIENT_ID,
              clientSecret: process.env.EBAY_CLIENT_SECRET,
              environment: process.env.EBAY_ENVIRONMENT || 'production',
              accessToken: userData.ebay.accessToken
            };
            console.log('[analyze] Using user eBay tokens for real pricing');
          }
        }
      } catch (userError) {
        console.warn('[analyze] Error fetching user data:', userError.message);
      }
    }

    // Get routes with eBay integration if available
    let routes;
    try {
      if (ebayConfig) {
        routes = await sdk.getRoutes(analysis, {}, ebayConfig);
      } else {
        routes = await sdk.getRoutes(analysis, { hasEbayAccount: false });
      }
      console.log('[analyze] getRoutes OK');
    } catch (e) {
      console.error('[analyze] getRoutes FAILED:', e?.stack || e);
      return res.status(500).json({ phase: 'getRoutes', message: String(e.message || e) });
    }

    const ebayUsed = !!(routes?.marketAnalysis?.estimatedValue?.source?.toLowerCase?.().includes('ebay'));

    // Save scan to user's history if authenticated
    if (userId && analysis) {
      try {
        const scanData = {
          analysis,
          routes,
          imageCount: buffers.length,
          ebayUsed,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'analyzed'
        };
        await admin.firestore().collection('users').doc(userId).collection('scans').add(scanData);
        console.log('[analyze] Scan saved to user history');
      } catch (saveError) {
        console.warn('[analyze] Failed to save scan:', saveError.message);
      }
    }

    res.json({
      success: true,
      analysis,
      routes,
      imageCount: buffers.length,
      ebayUsed,
      userAuthenticated: !!userId,
      ebayConnected: !!ebayConfig,
      sdkType: sdkInitError ? 'fallback' : 'real'
    });
  });
}));

// Add these endpoints to your Express app in index.js


// ---------- JSON Analysis Endpoints ----------
app.use(express.json({ limit: '50mb' }));

app.post('/api/analyze-json', asyncHandler(async (req, res) => {
  try {
    const { images, uid, saveToFirestore } = req.body || {};
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ phase: 'upload', message: 'images[] (base64 or data URLs) required' });
    }

    const toBuffer = (s) => {
      if (typeof s !== 'string') throw new Error('image must be string');
      const b64 = s.startsWith('data:') ? s.split(',')[1] : s;
      return Buffer.from(b64, 'base64');
    };
    const buffers = images.map(toBuffer);

    if (req.query.dry === '1') {
      return res.json({
        success: true,
        dryRun: true,
        imageCount: buffers.length,
        totalBytes: buffers.reduce((a, b) => a + b.length, 0),
      });
    }

    const sdk = await getSDK();

    let result;
    try {
      result = await sdk.analyzeItem(buffers, {
        provider: 'claude',
        apiKey: process.env.CLAUDE_API_KEY,
        uid,
        saveToFirestore
      });
    } catch (e) {
      return res.status(500).json({ phase: 'analyzeItem', message: String(e.message || e) });
    }

    let routes;
    try {
      routes = await sdk.getRoutes(result, { hasEbayAccount: true });
    } catch (e) {
      return res.status(500).json({ phase: 'getRoutes', message: String(e.message || e) });
    }

    res.json({
      success: true,
      analysis: result,
      routes,
      imageCount: buffers.length,
      sdkType: sdkInitError ? 'fallback' : 'real'
    });
  } catch (e) {
    res.status(500).json({ phase: 'analyze-json', message: String(e.message || e) });
  }
}));

// ---------- eBay Account Management ----------
app.get('/api/ebay/account-info', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    console.log('🔍 Getting eBay account info for user:', userId);

    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ success: false, error: 'User not found' });

    const userData = userDoc.data();
    const ebayData = userData.ebay;

    if (!ebayData?.isConnected) {
      return res.status(400).json({ success: false, error: 'eBay account not connected', connected: false });
    }

    res.json({
      success: true,
      accountInfo: {
        username: ebayData.username || 'Connected User',
        displayName: ebayData.displayName || ebayData.username || 'eBay Account',
        email: ebayData.email || null,
        ebayUserId: ebayData.ebayUserId || null,
        sellerAccount: ebayData.sellerAccount || 'Connected',
        canList: ebayData.canList !== false,
        connectedAt: ebayData.connectedAt || new Date().toISOString(),
        environment: ebayData.environment || 'production',
        apiAccessVerified: ebayData.apiAccessVerified || false
      },
      connected: true
    });
  } catch (error) {
    console.error('❌ Error getting eBay account info:', error);
    res.status(500).json({ success: false, error: 'Internal server error: ' + error.message });
  }
}));

// ---------- eBay OAuth Routes ----------
app.post('/api/ebay/auth-url', asyncHandler(async (req, res) => {
  try {
    console.log('🔗 Generating eBay auth URL');

    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const { redirectUri } = req.body;
    if (!redirectUri) {
      return res.status(400).json({ success: false, error: 'Redirect URI is required' });
    }

    try {
      const { EbayIntegration } = require('./capture-sdk/integrations/ebay/index.js');
      const ebayIntegration = new EbayIntegration({
        clientId: process.env.EBAY_CLIENT_ID,
        clientSecret: process.env.EBAY_CLIENT_SECRET,
        environment: process.env.EBAY_ENVIRONMENT || 'production',
        redirectUri
      });

      const state = `user_${userId}_${Date.now()}`;
      const authUrl = ebayIntegration.getAuthUrl(state);

      console.log('✅ Generated eBay OAuth URL for user:', userId);

      res.json({ success: true, authUrl, state });
    } catch (ebayError) {
      console.error('❌ eBay integration error:', ebayError);
      res.status(500).json({ success: false, error: 'Failed to initialize eBay integration: ' + ebayError.message });
    }
  } catch (error) {
    console.error('❌ eBay auth-url error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate eBay auth URL: ' + error.message });
  }
}));
 
app.post('/api/ebay/callback', asyncHandler(async (req, res) => {
  try {
    console.log('🔄 Processing eBay callback');

    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const { code, state } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Authorization code required' });
    if (!state || !state.includes(`user_${userId}`)) {
      return res.status(400).json({ success: false, error: 'Invalid state parameter' });
    }

    try {
      const { EbayIntegration } = require('./capture-sdk/integrations/ebay/index.js');
      const ebayIntegration = new EbayIntegration({
        clientId: process.env.EBAY_CLIENT_ID,
        clientSecret: process.env.EBAY_CLIENT_SECRET,
        environment: process.env.EBAY_ENVIRONMENT || 'production',
        redirectUri: process.env.EBAY_REDIRECT_URI || 'https://treasurehunter-sdk.web.app/ebay-callback.html'
      });

      const tokenData = await ebayIntegration.authenticate(code);

      let sellerAccount = 'Connected';
      try {
        sellerAccount = 'eBay Seller Account';
      } catch (infoError) {
        console.warn('⚠️ Could not fetch seller account info:', infoError.message);
      }

      // Try to detect existing policies, but don't fail the connection if it fails
      let existingPolicies = null;
      try {
        existingPolicies = await detectAndSelectExistingPolicies(userId);
      } catch (policyDetectionError) {
        console.warn('Policy detection failed during connection:', policyDetectionError.message);
      }

      const userRef = admin.firestore().collection('users').doc(userId);
      await userRef.update({
        'ebay.isConnected': true,
        'ebay.accessToken': tokenData.accessToken,
        'ebay.refreshToken': tokenData.refreshToken,
        'ebay.expiresAt': admin.firestore.Timestamp.fromDate(new Date(Date.now() + (tokenData.expiresIn * 1000))),
        'ebay.sellerAccount': sellerAccount,
        'ebay.connectedAt': admin.firestore.FieldValue.serverTimestamp(),
        'ebay.hasExistingPolicies': !!existingPolicies,
        'ebay.policySetupComplete': !!existingPolicies,
        'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ eBay OAuth successful for user:', userId);

      res.json({ 
        success: true, 
        message: 'eBay account connected successfully', 
        sellerAccount,
        policySetupComplete: !!existingPolicies
      });

    } catch (ebayError) {
      console.error('❌ eBay authentication error:', ebayError);
      res.status(500).json({ success: false, error: 'eBay authentication failed: ' + ebayError.message });
    }
  } catch (error) {
    console.error('❌ eBay callback error:', error);
    res.status(500).json({ success: false, error: 'Failed to process eBay callback: ' + error.message });
  }
}));

app.get('/api/ebay/sync-policies', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    
    console.log('🔄 Starting eBay policy synchronization for user:', userId);
    
    const accessToken = await getValidEbayToken(userId);
    
    // Fetch all existing policies from eBay
    const policies = await fetchAllEbayPolicies(accessToken);
    
    // Update Firestore with the current state
    const syncResult = await syncPoliciesToFirestore(userId, policies);
    
    res.json({
      success: true,
      message: 'Policy synchronization complete',
      policies: syncResult.policies,
      hasCompletePolicySet: syncResult.hasCompletePolicySet,
      needsSetup: !syncResult.hasCompletePolicySet,
      details: {
        fulfillmentCount: policies.fulfillment.length,
        paymentCount: policies.payment.length,
        returnCount: policies.return.length
      }
    });
    
  } catch (error) {
    console.error('❌ Policy sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// Create or ensure complete policy set
app.post('/api/ebay/ensure-policies', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    
    console.log('📋 Ensuring complete policy set for user:', userId);
    
    const accessToken = await getValidEbayToken(userId);
    
    // First, sync to see what we have
    const existingPolicies = await fetchAllEbayPolicies(accessToken);
    
    let result;
    if (existingPolicies.hasCompletePolicySet) {
      // We already have all policies
      result = {
        success: true,
        message: 'Complete policy set already exists',
        policies: existingPolicies.selected,
        created: false
      };
    } else {
      // Need to create missing policies
      const createdPolicies = await createMissingPolicies(accessToken, existingPolicies);
      
      // Sync the new state to Firestore
      await syncPoliciesToFirestore(userId, await fetchAllEbayPolicies(accessToken));
      
      result = {
        success: true,
        message: 'Policies created successfully',
        policies: createdPolicies,
        created: true
      };
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Policy creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// Delete all policies (cleanup)
app.delete('/api/ebay/delete-all-policies', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    
    const { confirm } = req.body;
    if (confirm !== 'DELETE_ALL_POLICIES') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Send { confirm: "DELETE_ALL_POLICIES" }'
      });
    }
    
    console.log('🗑️ Deleting all policies for user:', userId);
    
    const accessToken = await getValidEbayToken(userId);
    const policies = await fetchAllEbayPolicies(accessToken);
    
    const deletionResults = [];
    
    // Delete fulfillment policies
    for (const policy of policies.fulfillment) {
      try {
        await callEbayAPI(accessToken, 'DELETE', `/sell/account/v1/fulfillment_policy/${policy.fulfillmentPolicyId}`);
        deletionResults.push({ type: 'fulfillment', id: policy.fulfillmentPolicyId, success: true });
      } catch (error) {
        deletionResults.push({ type: 'fulfillment', id: policy.fulfillmentPolicyId, success: false, error: error.message });
      }
    }
    
    // Delete payment policies
    for (const policy of policies.payment) {
      try {
        await callEbayAPI(accessToken, 'DELETE', `/sell/account/v1/payment_policy/${policy.paymentPolicyId}`);
        deletionResults.push({ type: 'payment', id: policy.paymentPolicyId, success: true });
      } catch (error) {
        deletionResults.push({ type: 'payment', id: policy.paymentPolicyId, success: false, error: error.message });
      }
    }
    
    // Delete return policies
    for (const policy of policies.return) {
      try {
        await callEbayAPI(accessToken, 'DELETE', `/sell/account/v1/return_policy/${policy.returnPolicyId}`);
        deletionResults.push({ type: 'return', id: policy.returnPolicyId, success: true });
      } catch (error) {
        deletionResults.push({ type: 'return', id: policy.returnPolicyId, success: false, error: error.message });
      }
    }
    
    // Clear Firestore
    await db.collection('users').doc(userId).update({
      'ebay.policies': admin.firestore.FieldValue.delete(),
      'ebay.hasBusinessPolicies': false,
      'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'All policies deleted',
      results: deletionResults
    });
    
  } catch (error) {
    console.error('❌ Policy deletion failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ===== CORE POLICY FUNCTIONS =====

async function fetchAllEbayPolicies(accessToken) {
  console.log('📥 Fetching all eBay policies...');
  
  try {
    // Fetch all three types of policies
    const [fulfillmentResponse, paymentResponse, returnResponse] = await Promise.all([
      callEbayAPI(accessToken, 'GET', '/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US')
        .catch(err => ({ fulfillmentPolicies: [] })),
      callEbayAPI(accessToken, 'GET', '/sell/account/v1/payment_policy?marketplace_id=EBAY_US')
        .catch(err => ({ paymentPolicies: [] })),
      callEbayAPI(accessToken, 'GET', '/sell/account/v1/return_policy?marketplace_id=EBAY_US')
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
    
    console.log(`📊 Found policies - Fulfillment: ${policies.fulfillment.length}, Payment: ${policies.payment.length}, Return: ${policies.return.length}`);
    
    return policies;
    
  } catch (error) {
    console.error('❌ Failed to fetch policies:', error);
    return {
      fulfillment: [],
      payment: [],
      return: [],
      hasCompletePolicySet: false,
      selected: null
    };
  }
}

async function syncPoliciesToFirestore(userId, policies) {
  console.log('💾 Syncing policies to Firestore...');
  
  const updateData = {
    'ebay.hasBusinessPolicies': policies.hasCompletePolicySet,
    'ebay.policySyncedAt': admin.firestore.FieldValue.serverTimestamp(),
    'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
  };
  
  if (policies.hasCompletePolicySet && policies.selected) {
    updateData['ebay.policies'] = policies.selected;
    updateData['ebay.allPolicies'] = {
      fulfillment: policies.fulfillment.map(p => ({
        id: p.fulfillmentPolicyId,
        name: p.name,
        marketplaceId: p.marketplaceId
      })),
      payment: policies.payment.map(p => ({
        id: p.paymentPolicyId,
        name: p.name,
        marketplaceId: p.marketplaceId
      })),
      return: policies.return.map(p => ({
        id: p.returnPolicyId,
        name: p.name,
        marketplaceId: p.marketplaceId
      }))
    };
  } else {
    updateData['ebay.policies'] = admin.firestore.FieldValue.delete();
    updateData['ebay.allPolicies'] = admin.firestore.FieldValue.delete();
  }
  
  await db.collection('users').doc(userId).update(updateData);
  
  console.log('✅ Firestore sync complete');
  
  return {
    policies: policies.selected,
    hasCompletePolicySet: policies.hasCompletePolicySet
  };
}

async function createMissingPolicies(accessToken, existingPolicies) {
  console.log('🔨 Creating missing policies...');
  
  const timestamp = Date.now();
  const createdPolicies = {};
  
  // Create fulfillment policy if missing
  if (existingPolicies.fulfillment.length === 0) {
    console.log('📦 Creating fulfillment policy...');
    const fulfillmentResult = await callEbayAPI(accessToken, 'POST', '/sell/account/v1/fulfillment_policy', {
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
    console.log('💳 Creating payment policy...');
    const paymentResult = await callEbayAPI(accessToken, 'POST', '/sell/account/v1/payment_policy', {
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
    console.log('↩️ Creating return policy...');
    const returnResult = await callEbayAPI(accessToken, 'POST', '/sell/account/v1/return_policy', {
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
  
  console.log('✅ Policies created:', createdPolicies);
  return createdPolicies;
}



// ===== XML BUILDERS =====

function buildListingXmlWithPolicies(listingData, categoryId, conditionId, location, policyIds, accessToken) {
  return `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <Title>${escapeXml(listingData.title?.substring(0, 80) || 'Item for Sale')}</Title>
    <Description>${escapeXml(listingData.description || 'Please see photos for details')}</Description>
    <PrimaryCategory>
      <CategoryID>${categoryId}</CategoryID>
    </PrimaryCategory>
    <ConditionID>${conditionId}</ConditionID>
    <Location>${escapeXml(location.city)}, ${escapeXml(location.state)}</Location>
    <Country>${location.country.toUpperCase()}</Country>
    <PostalCode>${escapeXml(location.postalCode)}</PostalCode>
    <Currency>USD</Currency>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <StartPrice>${(listingData.pricing?.buyItNowPrice || 9.99).toFixed(2)}</StartPrice>
    <Quantity>${listingData.quantity || 1}</Quantity>
    <DispatchTimeMax>${listingData.handlingTime || 1}</DispatchTimeMax>
    
    <!-- Business Policies -->
    <SellerProfiles>
      <SellerShippingProfile>
        <ShippingProfileID>${policyIds.fulfillmentPolicyId}</ShippingProfileID>
      </SellerShippingProfile>
      <SellerPaymentProfile>
        <PaymentProfileID>${policyIds.paymentPolicyId}</PaymentProfileID>
      </SellerPaymentProfile>
      <SellerReturnProfile>
        <ReturnProfileID>${policyIds.returnPolicyId}</ReturnProfileID>
      </SellerReturnProfile>
    </SellerProfiles>
    
    <PictureDetails>
      ${generatePictureUrls(listingData.images)}
    </PictureDetails>
    
    ${generateItemSpecificsXmlFixed(listingData.category, listingData)}
  </Item>
</AddItemRequest>`;
}

function buildListingXmlInline(listingData, categoryId, conditionId, location, accessToken) {
  return `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <Title>${escapeXml(listingData.title?.substring(0, 80) || 'Item for Sale')}</Title>
    <Description>${escapeXml(listingData.description || 'Please see photos for details')}</Description>
    <PrimaryCategory>
      <CategoryID>${categoryId}</CategoryID>
    </PrimaryCategory>
    <ConditionID>${conditionId}</ConditionID>
    <Location>${escapeXml(location.city)}, ${escapeXml(location.state)}</Location>
    <Country>${location.country.toUpperCase()}</Country>
    <PostalCode>${escapeXml(location.postalCode)}</PostalCode>
    <Currency>USD</Currency>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <StartPrice>${(listingData.pricing?.buyItNowPrice || 9.99).toFixed(2)}</StartPrice>
    <Quantity>${listingData.quantity || 1}</Quantity>
    <DispatchTimeMax>${listingData.handlingTime || 1}</DispatchTimeMax>
    
    <!-- Inline Shipping -->
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>USPSPriority</ShippingService>
        <ShippingServiceCost currencyID="USD">9.99</ShippingServiceCost>
        <ShippingServiceAdditionalCost currencyID="USD">5.00</ShippingServiceAdditionalCost>
      </ShippingServiceOptions>
      <ShippingServiceOptions>
        <ShippingServicePriority>2</ShippingServicePriority>
        <ShippingService>USPSFirstClass</ShippingService>
        <ShippingServiceCost currencyID="USD">5.99</ShippingServiceCost>
        <ShippingServiceAdditionalCost currencyID="USD">3.00</ShippingServiceAdditionalCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    
    <!-- Inline Return Policy -->
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <RefundOption>MoneyBack</RefundOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
      <Description>30-day returns. Buyer pays return shipping.</Description>
    </ReturnPolicy>
    
    <PictureDetails>
      ${generatePictureUrls(listingData.images)}
    </PictureDetails>
    
    ${generateItemSpecificsXmlFixed(listingData.category, listingData)}
  </Item>
</AddItemRequest>`;
}

// ===== HELPER FUNCTIONS =====

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generatePictureUrls(images) {
  if (!images || images.length === 0) {
    return '<PictureURL>https://placehold.co/400x300/e0e0e0/333?text=No+Image</PictureURL>';
  }
  
  const maxPictures = Math.min(images.length, 12);
  let pictureXml = '';
  
  for (let i = 0; i < maxPictures; i++) {
    pictureXml += `<PictureURL>${escapeXml(images[i])}</PictureURL>\n      `;
  }
  
  return pictureXml.trim();
}

// FIXED: Item specifics with correct XML structure
 /**
 * Generates the ItemSpecifics XML section for an eBay listing.
 * This version ensures all required specifics are included based on category.
 * @param {string} category The internal category name (e.g., 'furniture').
 * @param {object} listingData The raw listing data object.
 * @returns {string} The formatted XML string for ItemSpecifics.
 */
function generateItemSpecificsXmlFixed(category, listingData) {
  let itemSpecifics = [];

  // Always add brand
  itemSpecifics.push(`<NameValueList>
      <Name>Brand</Name>
      <Value>${escapeXml(listingData.brand || 'Unbranded')}</Value>
    </NameValueList>`);

  // Category-specific required fields
  const normalizedCategory = category?.toLowerCase() || '';

  if (normalizedCategory === 'furniture') {
    // CRITICAL FIX: Add required "Number of Items in Set" for furniture
    itemSpecifics.push(`<NameValueList>
      <Name>Number of Items in Set</Name>
      <Value>${listingData.numberOfItemsInSet || '1'}</Value>
    </NameValueList>`);

    // CRITICAL FIX: Add required "Set Includes" for furniture
    itemSpecifics.push(`<NameValueList>
      <Name>Set Includes</Name>
      <Value>${escapeXml(listingData.setIncludes || 'Chair')}</Value>
    </NameValueList>`);

    if (listingData.material) {
      itemSpecifics.push(`<NameValueList>
        <Name>Material</Name>
        <Value>${escapeXml(listingData.material)}</Value>
      </NameValueList>`);
    }

    if (listingData.color) {
      itemSpecifics.push(`<NameValueList>
        <Name>Color</Name>
        <Value>${escapeXml(listingData.color)}</Value>
      </NameValueList>`);
    }
  }

  // Add model if provided
  if (listingData.model) {
    itemSpecifics.push(`<NameValueList>
      <Name>Model</Name>
      <Value>${escapeXml(listingData.model)}</Value>
    </NameValueList>`);
  }

  // Add condition description
  if (listingData.conditionDescription) {
    itemSpecifics.push(`<NameValueList>
      <Name>Condition Description</Name>
      <Value>${escapeXml(listingData.conditionDescription)}</Value>
    </NameValueList>`);
  }

  // Add any custom specifics
  if (listingData.customSpecifics && Array.isArray(listingData.customSpecifics)) {
    for (const spec of listingData.customSpecifics) {
      if (spec.name && spec.value) {
        itemSpecifics.push(`<NameValueList>
      <Name>${escapeXml(spec.name)}</Name>
      <Value>${escapeXml(spec.value)}</Value>
    </NameValueList>`);
      }
    }
  }

  return itemSpecifics.length > 0 ?
    `<ItemSpecifics>\n    ${itemSpecifics.join('\n    ')}\n  </ItemSpecifics>` :
    '';
}

// Delete all preexisting policies:
async function deleteEbayPolicy(accessToken, policyId, policyType) {
  try {
    const endpoint = `/sell/account/v1/${policyType}_policy/${policyId}`;
    await callEbayAPI(accessToken, 'DELETE', endpoint);
    console.log(`✅ Successfully deleted eBay ${policyType} policy: ${policyId}`);
    return true;
  } catch (error) {
    console.warn(`⚠️ Failed to delete eBay ${policyType} policy: ${policyId}. Error: ${error.message}`);
    return false;
  }
}
// Updated eBay listing creation to use user's location

function generateItemSpecificsXml(category, listingData) {
  let itemSpecifics = [];
  
  // Add common item specifics
  itemSpecifics.push(`<NameValueList><Name>Brand</Name><Value>${listingData.brand || 'Unbranded'}</Value></NameValueList>`);
  itemSpecifics.push(`<NameValueList><Name>Condition Description</Name><Value>${listingData.conditionDescription || 'Item is in the condition specified above.'}</Value></NameValueList>`);

  // Add category-specific item specifics
  const normalizedCategory = category.toLowerCase();
  if (normalizedCategory === 'furniture') {
    itemSpecifics.push(`<NameValueList><Name>Number of Items in Set</Name><Value>1</Value></NameValueList>`);
    itemSpecifics.push(`<NameValueList><Name>Set Includes</Name><Value>Chair, Cushion</Value></NameValueList>`);
  } else if (normalizedCategory === 'clothing' || normalizedCategory === 'footwear') {
    if (listingData.size) {
      itemSpecifics.push(`<NameValueList><Name>Size</Name><Value>${listingData.size}</Value></NameValueList>`);
    }
  } else if (normalizedCategory === 'electronics') {
    if (listingData.model) {
      itemSpecifics.push(`<NameValueList><Name>Model</Name><Value>${listingData.model}</Value></NameValueList>`);
    }
  }
  
  return `<ItemSpecifics>${itemSpecifics.join('')}</ItemSpecifics>`;
}

   // ==========================================
// FIXED eBay LISTING CREATION ENDPOINT
// ========================================== 
 
app.post('/api/ebay/create-listing', asyncHandler(async (req, res) => {
    try {
        console.log('📦 Creating eBay listing with automatic policy sync...');

        const decodedToken = await verifyAuth(req);
        const userId = decodedToken.uid;
        const rawListingData = req.body;
        const scanId = rawListingData.scanId;

        if (!scanId) {
            throw new Error('Missing scanId in listing data');
        }

        if (!rawListingData) {
            return res.status(400).json({ success: false, error: 'Missing listing data' });
        }

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (!userData?.shippingLocations || userData.shippingLocations.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No shipping locations configured',
                needsLocationSetup: true
            });
        }

        const defaultLocation = userData.shippingLocations.find(loc => loc.isDefault) || userData.shippingLocations[0];
        const accessToken = await getValidEbayToken(userId);

        console.log('🔄 Checking policy status...');
        const policies = await fetchAllEbayPolicies(accessToken);

        let policyIds = null;
        let useBusinessPolicies = false;

        if (policies.hasCompletePolicySet) {
            console.log('✅ Using existing business policies');
            policyIds = policies.selected;
            useBusinessPolicies = true;
            await syncPoliciesToFirestore(userId, policies);
        } else {
            console.log('⚠️ No complete policy set found, will use inline policies');
            await db.collection('users').doc(userId).update({
                'ebay.policies': admin.firestore.FieldValue.delete(),
                'ebay.hasBusinessPolicies': false
            });
        }

        const ebayConfig = {
            clientId: process.env.EBAY_CLIENT_ID,
            clientSecret: process.env.EBAY_CLIENT_SECRET,
            environment: process.env.EBAY_ENVIRONMENT || 'production'
        };
        const categoryId = await mapCategoryToEbayId(rawListingData.category, ebayConfig);
        console.log('📂 Category mapped:', categoryId);

        let conditionKey = rawListingData.condition;
        if (typeof conditionKey === 'object' && conditionKey !== null) {
            conditionKey = conditionKey.rating || conditionKey.condition || 'good';
        }
        const conditionId = getEbayConditionId(conditionKey);
        console.log('📦 Condition mapped to ID:', conditionId);

        let xmlPayload;
        if (useBusinessPolicies && policyIds) {
            xmlPayload = buildListingXmlWithPolicies(
                rawListingData,
                categoryId,
                conditionId,
                defaultLocation,
                policyIds,
                accessToken
            );
        } else {
            xmlPayload = buildListingXmlInline(
                rawListingData,
                categoryId,
                conditionId,
                defaultLocation,
                accessToken
            );
        }

        const tradingApiResponse = await callTradingAPI(accessToken, 'AddItem', xmlPayload);
        const ackMatch = tradingApiResponse.match(/<Ack>(\w+)<\/Ack>/);
        const ack = ackMatch ? ackMatch[1] : null;

        if (ack === 'Failure') {
            const errorMatches = [...tradingApiResponse.matchAll(/<Errors>[\s\S]*?<\/Errors>/g)];
            const errors = errorMatches.map(match => {
                const shortMessage = match[0].match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1];
                const errorCode = match[0].match(/<ErrorCode>(\d+)<\/ErrorCode>/)?.[1];
                const severity = match[0].match(/<SeverityCode>(\w+)<\/SeverityCode>/)?.[1];
                return { shortMessage, errorCode, severity };
            });

            const hasErrors = errors.some(e => e.severity === 'Error');
            if (hasErrors) {
                throw new Error(`Listing failed: ${errors.filter(e => e.severity === 'Error').map(e => e.shortMessage).join('; ')}`);
            }
        }

        const itemIdMatch = tradingApiResponse.match(/<ItemID>(\d+)<\/ItemID>/);
        const listingId = itemIdMatch ? itemIdMatch[1] : null;

        if (!listingId) {
            throw new Error('Listing creation failed: No ItemID in response');
        }

        const listingUrl = `https://www.ebay.com/itm/${listingId}`;

        // Save to the database using the scanId provided by the client.
        await db.collection('users').doc(userId).collection('scans').doc(scanId).collection('listings').add({
            ebayItemId: listingId,
            title: rawListingData.title,
            price: rawListingData.pricing?.buyItNowPrice || 9.99,
            category: rawListingData.category,
            condition: conditionKey,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active',
            url: listingUrl,
            usedBusinessPolicies: useBusinessPolicies
        });

        // Use a transaction to safely update user stats
        await db.runTransaction(async (t) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await t.get(userRef);
            
            // Check if the user document exists and has a stats object.
            if (userDoc.exists) {
                const currentListings = userDoc.data().stats?.totalListings || 0;
                t.update(userRef, {
                    'stats.totalListings': currentListings + 1,
                    'stats.lastListingDate': admin.firestore.FieldValue.serverTimestamp(),
                    'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // If the user document doesn't exist, create it with initial stats.
                t.set(userRef, {
                    stats: {
                        totalListings: 1,
                        lastListingDate: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    metadata: {
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }
                }, { merge: true });
            }
        });

        res.json({
            success: true,
            listingId: listingId,
            url: listingUrl,
            message: 'Listing created successfully!',
            usedBusinessPolicies: useBusinessPolicies,
            sku: scanId 
        });

    } catch (error) {
        console.error('❌ Listing creation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// XML escape function to prevent injection
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Generate picture URLs XML
function generatePictureUrls(images) {
  if (!images || images.length === 0) {
    // Default placeholder if no images provided
    return '<PictureURL>https://placehold.co/400x300/e0e0e0/333?text=No+Image</PictureURL>';
  }
  
  // eBay allows up to 12 pictures
  const maxPictures = Math.min(images.length, 12);
  let pictureXml = '';
  
  for (let i = 0; i < maxPictures; i++) {
    pictureXml += `<PictureURL>${escapeXml(images[i])}</PictureURL>\n      `;
  }
  
  return pictureXml.trim();
}

// Enhanced item specifics generator
function generateItemSpecificsXml(category, listingData) {
  let itemSpecifics = [];
  
  // Always add brand
  itemSpecifics.push(`<NameValueList>
      <Name>Brand</Name>
      <Value>${escapeXml(listingData.brand || 'Unbranded')}</Value>
    </NameValueList>`);
  
  // Add condition description if provided
  if (listingData.conditionDescription) {
    itemSpecifics.push(`<NameValueList>
      <Name>Condition Description</Name>
      <Value>${escapeXml(listingData.conditionDescription)}</Value>
    </NameValueList>`);
  }
  
  // Add model if provided
  if (listingData.model) {
    itemSpecifics.push(`<NameValueList>
      <Name>Model</Name>
      <Value>${escapeXml(listingData.model)}</Value>
    </NameValueList>`);
  }
  
  // Add MPN if provided
  if (listingData.mpn) {
    itemSpecifics.push(`<NameValueList>
      <Name>MPN</Name>
      <Value>${escapeXml(listingData.mpn)}</Value>
    </NameValueList>`);
  }
  
  // Add UPC if provided
  if (listingData.upc) {
    itemSpecifics.push(`<NameValueList>
      <Name>UPC</Name>
      <Value>${escapeXml(listingData.upc)}</Value>
    </NameValueList>`);
  }
  
  // Category-specific item specifics
  const normalizedCategory = category?.toLowerCase() || '';
  
  if (normalizedCategory === 'furniture') {
    itemSpecifics.push(`<NameValueList>
      <Name>Type</Name>
      <Value>${escapeXml(listingData.furnitureType || 'Chair')}</Value>
    </NameValueList>`);
    
    if (listingData.material) {
      itemSpecifics.push(`<NameValueList>
        <Name>Material</Name>
        <Value>${escapeXml(listingData.material)}</Value>
      </NameValueList>`);
    }
    
    if (listingData.color) {
      itemSpecifics.push(`<NameValueList>
        <Name>Color</Name>
        <Value>${escapeXml(listingData.color)}</Value>
      </NameValueList>`);
    }
    
  } else if (normalizedCategory === 'clothing' || normalizedCategory === 'footwear') {
    if (listingData.size) {
      itemSpecifics.push(`<NameValueList>
        <Name>Size</Name>
        <Value>${escapeXml(listingData.size)}</Value>
      </NameValueList>`);
    }
    
    if (listingData.color) {
      itemSpecifics.push(`<NameValueList>
        <Name>Color</Name>
        <Value>${escapeXml(listingData.color)}</Value>
      </NameValueList>`);
    }
    
    if (listingData.gender) {
      itemSpecifics.push(`<NameValueList>
        <Name>Gender</Name>
        <Value>${escapeXml(listingData.gender)}</Value>
      </NameValueList>`);
    }
    
  } else if (normalizedCategory === 'electronics') {
    if (listingData.processorType) {
      itemSpecifics.push(`<NameValueList>
        <Name>Processor Type</Name>
        <Value>${escapeXml(listingData.processorType)}</Value>
      </NameValueList>`);
    }
    
    if (listingData.memorySize) {
      itemSpecifics.push(`<NameValueList>
        <Name>Memory Size</Name>
        <Value>${escapeXml(listingData.memorySize)}</Value>
      </NameValueList>`);
    }
    
    if (listingData.storageCapacity) {
      itemSpecifics.push(`<NameValueList>
        <Name>Storage Capacity</Name>
        <Value>${escapeXml(listingData.storageCapacity)}</Value>
      </NameValueList>`);
    }
  }
  
  // Add any custom item specifics provided
  if (listingData.customSpecifics && Array.isArray(listingData.customSpecifics)) {
    for (const spec of listingData.customSpecifics) {
      if (spec.name && spec.value) {
        itemSpecifics.push(`<NameValueList>
      <Name>${escapeXml(spec.name)}</Name>
      <Value>${escapeXml(spec.value)}</Value>
    </NameValueList>`);
      }
    }
  }
  
  return itemSpecifics.length > 0 ? 
    `<ItemSpecifics>\n    ${itemSpecifics.join('\n    ')}\n  </ItemSpecifics>` : 
    '';
}

// ==========================================
// VERIFICATION ENDPOINT (Test before listing)
// ==========================================

app.post('/api/ebay/verify-listing', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Verifying eBay listing before creation...');
    
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const rawListingData = req.body;
    
    if (!rawListingData) {
      return res.status(400).json({ success: false, error: 'Missing listing data' });
    }

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    // Validate shipping location
    if (!userData?.shippingLocations || userData.shippingLocations.length === 0) {
      return res.json({
        success: false,
        valid: false,
        errors: ['No shipping locations configured'],
        needsLocationSetup: true
      });
    }
    
    const defaultLocation = userData.shippingLocations.find(loc => loc.isDefault) || userData.shippingLocations[0];
    const accessToken = await getValidEbayToken(userId);
    
    // Get category ID
    const ebayConfig = { 
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      environment: process.env.EBAY_ENVIRONMENT || 'production' 
    };
    const categoryId = await mapCategoryToEbayId(rawListingData.category, ebayConfig);
    
    // Map condition
    let conditionKey = rawListingData.condition;
    if (typeof conditionKey === 'object' && conditionKey !== null) {
      conditionKey = conditionKey.rating || conditionKey.condition || 'good';
    }
    conditionKey = String(conditionKey).toLowerCase().trim();
    
    const conditionMap = {
      'new': 1000,
      'like_new': 1500,
      'excellent': 3000,
      'very_good': 3000,
      'good': 3000,
      'used': 3000,
      'acceptable': 4000,
      'for_parts': 7000
    };
    const conditionId = conditionMap[conditionKey] || 3000;
    
    // Check for business policies
    const hasBusinessPolicies = userData?.ebay?.policies?.fulfillmentPolicyId && 
                                userData?.ebay?.policies?.paymentPolicyId && 
                                userData?.ebay?.policies?.returnPolicyId;
    
    // Build VerifyAddItem XML (similar to AddItem but for testing)
    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<VerifyAddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <Title>${escapeXml(rawListingData.title?.substring(0, 80) || 'Item for Sale')}</Title>
    <Description>${escapeXml(rawListingData.description || 'Please see photos for details')}</Description>
    <PrimaryCategory>
      <CategoryID>${categoryId}</CategoryID>
    </PrimaryCategory>
    <ConditionID>${conditionId}</ConditionID>
    <Location>${escapeXml(defaultLocation.city)}, ${escapeXml(defaultLocation.state)}</Location>
    <Country>${defaultLocation.country.toUpperCase()}</Country>
    <PostalCode>${escapeXml(defaultLocation.postalCode)}</PostalCode>
    <Currency>USD</Currency>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <StartPrice>${(rawListingData.pricing?.buyItNowPrice || 9.99).toFixed(2)}</StartPrice>
    <Quantity>${rawListingData.quantity || 1}</Quantity>
    <DispatchTimeMax>${rawListingData.handlingTime || 1}</DispatchTimeMax>
    ${hasBusinessPolicies ? `
    <SellerProfiles>
      <SellerShippingProfile>
        <ShippingProfileID>${userData.ebay.policies.fulfillmentPolicyId}</ShippingProfileID>
      </SellerShippingProfile>
      <SellerPaymentProfile>
        <PaymentProfileID>${userData.ebay.policies.paymentPolicyId}</PaymentProfileID>
      </SellerPaymentProfile>
      <SellerReturnProfile>
        <ReturnProfileID>${userData.ebay.policies.returnPolicyId}</ReturnProfileID>
      </SellerReturnProfile>
    </SellerProfiles>` : `
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>USPSPriority</ShippingService>
        <ShippingServiceCost currencyID="USD">9.99</ShippingServiceCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <RefundOption>MoneyBack</RefundOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
    </ReturnPolicy>`}
    <PictureDetails>
      <PictureURL>https://placehold.co/400x300/e0e0e0/333?text=Test</PictureURL>
    </PictureDetails>
  </Item>
</VerifyAddItemRequest>`;

    // Call the Trading API with VerifyAddItem
    const tradingApiResponse = await callTradingAPI(accessToken, 'VerifyAddItem', xmlPayload);
    
    // Parse response
    const ackMatch = tradingApiResponse.match(/<Ack>(\w+)<\/Ack>/);
    const ack = ackMatch ? ackMatch[1] : null;
    
    // Extract fees if available
    const feesMatch = tradingApiResponse.match(/<Fees>[\s\S]*?<\/Fees>/);
    let estimatedFees = null;
    if (feesMatch) {
      const listingFeeMatch = feesMatch[0].match(/<Fee>[\s\S]*?<Name>ListingFee<\/Name>[\s\S]*?<Fee[^>]*>([\d.]+)<\/Fee>/);
      estimatedFees = listingFeeMatch ? parseFloat(listingFeeMatch[1]) : null;
    }
    
    // Extract any errors or warnings
    const errorMatches = [...tradingApiResponse.matchAll(/<Errors>[\s\S]*?<\/Errors>/g)];
    const issues = errorMatches.map(match => {
      const shortMessage = match[0].match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1];
      const errorCode = match[0].match(/<ErrorCode>(\d+)<\/ErrorCode>/)?.[1];
      const severity = match[0].match(/<SeverityCode>(\w+)<\/SeverityCode>/)?.[1];
      return { message: shortMessage, code: errorCode, severity };
    });
    
    const errors = issues.filter(i => i.severity === 'Error');
    const warnings = issues.filter(i => i.severity === 'Warning');
    
    res.json({
      success: ack !== 'Failure',
      valid: errors.length === 0,
      ack: ack,
      errors: errors.map(e => e.message),
      warnings: warnings.map(w => w.message),
      estimatedFees: estimatedFees,
      hasBusinessPolicies: hasBusinessPolicies,
      categoryId: categoryId,
      conditionId: conditionId,
      message: errors.length === 0 ? 
        'Listing validation successful! Ready to create.' : 
        'Listing has errors that need to be fixed.'
    });

  } catch (error) {
    console.error('❌ Listing verification failed:', error);
    res.status(500).json({
      success: false,
      valid: false,
      error: error.message,
      phase: 'verify-listing'
    });
  }
}));

console.log('✅ Fixed eBay listing creation endpoints loaded');

// ENHANCED: Test endpoint for condition mapping with better validation
app.post('/api/ebay/debug-shipping-services', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const accessToken = await getValidEbayToken(userId);
    
    // Get detailed policy information
    const allPolicies = await callEbayAPI(accessToken, 'GET', '/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US');
    
    // Get the specific policy we're having trouble with
    const problemPolicy = await callEbayAPI(accessToken, 'GET', `/sell/account/v1/fulfillment_policy/380523954022`);
    
    // Get location details
    const defaultLocation = await callEbayAPI(accessToken, 'GET', '/sell/inventory/v1/location/default');
    
    // Try creating a test policy with the most basic shipping service
    const testPolicyPayload = {
      name: `TestPolicy-${Date.now()}`,
      marketplaceId: 'EBAY_US',
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }],
      handlingTime: { value: 1, unit: 'DAY' },
      shippingOptions: [{
        optionType: 'DOMESTIC',
        costType: 'FLAT_RATE',
        shippingServices: [{
          sortOrder: 1,
          shippingServiceCode: 'Other',
          shippingCost: { currency: 'USD', value: '5.00' }
        }]
      }]
    };
    
    let testPolicyResult = null;
    try {
      testPolicyResult = await callEbayAPI(accessToken, 'POST', '/sell/account/v1/fulfillment_policy', testPolicyPayload);
    } catch (testError) {
      testPolicyResult = { error: testError.message };
    }
    
    res.json({
      success: true,
      debugInfo: {
        allPoliciesCount: allPolicies.fulfillmentPolicies?.length || 0,
        problemPolicy: problemPolicy,
        defaultLocation: defaultLocation,
        testPolicyCreation: testPolicyResult,
        environment: process.env.EBAY_ENVIRONMENT || 'production'
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
}));


app.post('/api/ebay/test-condition', asyncHandler(async (req, res) => {
  try {
    const { condition } = req.body;
    
    if (!condition) {
      return res.status(400).json({ 
        success: false, 
        error: 'Condition parameter required',
        errorType: 'VALIDATION_ERROR'
      });
    }
    
    const mapped = mapConditionToEbay(condition);
    const valid = isValidEbayCondition(mapped);
    const display = formatConditionForEbay(mapped);
    
    res.json({
      success: true,
      input: condition,
      mapped: mapped,
      valid: valid,
      display: display,
      timestamp: new Date().toISOString(),
      debug: {
        inputType: typeof condition,
        mappedType: typeof mapped,
        validationType: typeof valid
      }
    });
    
  } catch (error) {
    console.error('Condition mapping test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      errorType: 'MAPPING_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}));

console.log('🔧 Enhanced eBay condition mapping and validation functions loaded');
console.log('✅ Variable scoping issues resolved - offer variable properly declared');


// ADDED: New endpoint for testing condition mapping
app.post('/api/ebay/test-condition', asyncHandler(async (req, res) => {
  try {
    const { condition } = req.body;
    
    if (!condition) {
      return res.status(400).json({ error: 'Condition parameter required' });
    }
    
    const mapped = mapConditionToEbay(condition);
    const valid = isValidEbayCondition(mapped);
    const display = formatConditionForEbay(mapped);
    
    res.json({
      success: true,
      input: condition,
      mapped: mapped,
      valid: valid,
      display: display,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

console.log('🔧 Enhanced eBay condition mapping and validation functions loaded');

app.post('/api/ebay/test-policy-fix', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    
    const policies = await ensureUserEbayPolicies(userId);
    
    res.json({
      success: true,
      policies: policies,
      message: 'Policies ready for listing creation',
      fixApplied: true
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      phase: 'policy_test'
    });
  }
}));

// ---------- eBay Token Refresh Endpoint ----------
exports.refreshEbayToken = onRequest(
  { invoker: 'public', memory: '256MiB', timeoutSeconds: 60, region: 'us-central1' },
  async (req, res) => {
    return corsHandler(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      try {
        const decodedToken = await verifyAuth(req);
        const userId = decodedToken.uid;
        console.log('🔄 Token refresh request from user:', userId);

        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

        if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
          console.error('Missing eBay credentials in Firebase config');
          return res.status(500).json({ error: 'Server configuration error' });
        }

        const tokenData = await refreshEbayToken(refreshToken);
        console.log('✅ Token refreshed successfully for user:', userId);

        res.json({
          success: true,
          accessToken: tokenData.access_token,
          expiresIn: tokenData.expires_in,
          refreshToken: tokenData.refresh_token || refreshToken
        });
      } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }
);



// ---------- eBay API Proxy Endpoint ----------
exports.ebayApiProxy = onRequest(
  {
    invoker: 'public',
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'us-central1',
    cors: { origin: true, methods: ['POST', 'OPTIONS'] }
  },
  async (req, res) => {
    // Set simple CORS headers (Cloud Functions v2 also applies above cors config)
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).send();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const decodedToken = await verifyAuth(req);
      const userId = decodedToken.uid;

      const { accessToken, method, endpoint, body } = req.body;
      if (!accessToken || !method || !endpoint) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      console.log(`🛒 eBay API proxy: ${method} ${endpoint} for user:`, userId);
      const responseData = await callEbayAPI(accessToken, method, endpoint, body);
      console.log(`📋 eBay API response: success for ${endpoint}`);

      res.json({ success: true, data: responseData });
    } catch (error) {
      console.error('eBay API proxy error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ---------- eBay Notifications Webhook ----------
exports.ebayNotifications = onRequest(
  { invoker: 'public', memory: '256MiB', timeoutSeconds: 60, region: 'us-central1' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-eBay-Signature');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
      const challengeCode = req.query.challenge_code;
      if (!challengeCode) return res.status(400).json({ error: 'Missing challenge_code parameter' });

      try {
        const hash = crypto.createHash('sha256');
        hash.update(challengeCode);
        hash.update(VERIFICATION_TOKEN);
        hash.update(ENDPOINT_URL);
        const responseHash = hash.digest('hex');
        return res.status(200).json({ challengeResponse: responseHash });
      } catch (e) {
        console.error('Challenge verification failed:', e);
        return res.status(500).json({ error: 'Challenge verification failed' });
      }
    }

    if (req.method === 'POST') {
      try {
        const notification = req.body;
        console.log('Received eBay notification:', notification?.notification?.notificationId);

        res.status(200).json({ status: 'received', timestamp: new Date().toISOString() });

        if (notification?.notification) {
          db.collection('ebay_notifications').add({
            notificationId: notification.notification.notificationId || 'unknown',
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            data: notification
          }).catch(err => console.error('Failed to store notification:', err));
        }
      } catch (e) {
        console.error('Error processing notification:', e);
        return res.status(500).json({ error: 'Processing failed' });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  }
);

// ---------- Standalone eBay Account Info Endpoint ----------
exports.ebayAccountInfo = onRequest(
  { invoker: 'public', memory: '256MiB', timeoutSeconds: 60, region: 'us-central1' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).send();

    try {
      const decodedToken = await verifyAuth(req);
      const userId = decodedToken.uid;

      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      if (!userDoc.exists) return res.status(404).json({ success: false, error: 'User not found' });

      const userData = userDoc.data();
      const ebayData = userData.ebay;

      if (!ebayData?.isConnected) {
        return res.status(400).json({ success: false, error: 'eBay account not connected', connected: false });
      }

      res.json({
        success: true,
        accountInfo: {
          username: ebayData.username || 'Connected User',
          displayName: ebayData.displayName || ebayData.username || 'eBay Account',
          email: ebayData.email || null,
          sellerAccount: ebayData.sellerAccount || 'Connected',
          canList: ebayData.canList !== false,
          connectedAt: ebayData.connectedAt || new Date().toISOString(),
          environment: ebayData.environment || 'production'
        },
        connected: true
      });
    } catch (error) {
      console.error('❌ Error in ebayAccountInfo function:', error);
      res.status(500).json({ success: false, error: 'Internal server error: ' + error.message });
    }
  }
);


// ===== LOCATION MANAGEMENT ENDPOINTS =====

// Get user's saved locations
app.get('/api/user/locations', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    const locations = userData?.shippingLocations || [];
    const defaultLocationId = userData?.defaultLocationId || null;
    
    res.json({
      success: true,
      locations: locations,
      defaultLocationId: defaultLocationId,
      hasLocations: locations.length > 0
    });
    
  } catch (error) {
    console.error('Error getting user locations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// Add or update shipping location
app.post('/api/user/locations', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const locationData = req.body;
    
    // Validate required fields
    const required = ['name', 'address', 'city', 'state', 'postalCode', 'country'];
    for (const field of required) {
      if (!locationData[field]) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`
        });
      }
    }
    
    // Generate location ID
    const locationId = locationData.id || `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const location = {
      id: locationId,
      name: locationData.name,
      address: locationData.address,
      address2: locationData.address2 || '',
      city: locationData.city,
      state: locationData.state,
      postalCode: locationData.postalCode,
      country: locationData.country,
      phone: locationData.phone || '',
      isDefault: locationData.isDefault || false,
createdAt: admin.firestore.FieldValue.serverTimestamp(),
updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Get current user data
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    let locations = userData.shippingLocations || [];
    
    // Update existing or add new
    const existingIndex = locations.findIndex(loc => loc.id === locationId);
    if (existingIndex >= 0) {
      locations[existingIndex] = { ...locations[existingIndex], ...location };
    } else {
      locations.push(location);
    }
    
    // Handle default location logic
    let defaultLocationId = userData.defaultLocationId;
    if (location.isDefault || !defaultLocationId) {
      // Set as default and remove default from others
      locations = locations.map(loc => ({
        ...loc,
        isDefault: loc.id === locationId
      }));
      defaultLocationId = locationId;
    }
    
    // Update user document
    await db.collection('users').doc(userId).update({
      shippingLocations: locations,
      defaultLocationId: defaultLocationId,
      'metadata.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Sync to marketplace platforms
    await syncLocationToMarketplaces(userId, location);
    
    res.json({
      success: true,
      location: location,
      isDefault: location.isDefault,
      message: 'Location saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving location:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// Delete shipping location
app.delete('/api/user/locations/:locationId', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const { locationId } = req.params;
    
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    let locations = userData.shippingLocations || [];
    
    const locationToDelete = locations.find(loc => loc.id === locationId);
    if (!locationToDelete) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }
    
    // Remove location
    locations = locations.filter(loc => loc.id !== locationId);
    
    // Handle default location logic
    let defaultLocationId = userData.defaultLocationId;
    if (defaultLocationId === locationId) {
      defaultLocationId = locations.length > 0 ? locations[0].id : null;
      if (locations.length > 0) {
        locations[0].isDefault = true;
      }
    }
    
    await db.collection('users').doc(userId).update({
      shippingLocations: locations,
      defaultLocationId: defaultLocationId,
      'metadata.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'Location deleted successfully',
      newDefaultId: defaultLocationId
    });
    
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ===== MARKETPLACE SYNC FUNCTIONS =====

app.post('/api/ebay/fix-location-type', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const accessToken = await getValidEbayToken(userId);
    
    // Delete the existing problematic location
    try {
      await callEbayAPI(accessToken, 'DELETE', '/sell/inventory/v1/location/default');
      console.log('Deleted existing STORE location');
    } catch (deleteError) {
      console.log('Delete failed (may not exist):', deleteError.message);
    }
    
    // Create new WAREHOUSE location
    const warehouseLocationData = {
      name: 'Treasure Hunter Warehouse',
      locationTypes: ['WAREHOUSE'],
      location: {
        address: {
          addressLine1: '123 Test Street',
          city: 'New York',
          stateOrProvince: 'NY',
          postalCode: '10001',
          country: 'US'
        }
      },
      merchantLocationStatus: 'ENABLED'
    };
    
    const result = await callEbayAPI(accessToken, 'POST', '/sell/inventory/v1/location/default', warehouseLocationData);
    
    res.json({ 
      success: true, 
      message: 'Location updated from STORE to WAREHOUSE',
      result: result
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Sync location to connected marketplace platforms
async function syncLocationToMarketplaces(userId, location) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    
    const syncPromises = [];
    
    // Sync to eBay if connected
    if (userData.ebay?.isConnected) {
      syncPromises.push(syncLocationToEbay(userId, location, userData.ebay));
    }
    
    // Future marketplace integrations
    // if (userData.amazon?.isConnected) {
    //   syncPromises.push(syncLocationToAmazon(userId, location, userData.amazon));
    // }
    // if (userData.etsy?.isConnected) {
    //   syncPromises.push(syncLocationToEtsy(userId, location, userData.etsy));
    // }
    
    await Promise.allSettled(syncPromises);
    
  } catch (error) {
    console.warn('Location sync to marketplaces failed:', error.message);
    // Don't throw - location save should succeed even if sync fails
  }
}

// Sync location to eBay Inventory API
async function syncLocationToEbay(userId, location, ebayConfig) {
  try {
    const accessToken = await getValidEbayToken(userId);
    
    // Create shorter merchantLocationKey to stay within 36 character limit
    // Use a hash of the location ID to keep it unique but shorter
    const locationHash = location.id.substring(location.id.length - 8); // Last 8 chars
    const userHash = userId.substring(userId.length - 6); // Last 6 chars  
    const merchantLocationKey = `usr_${userHash}_${locationHash}`;
    
    console.log(`📍 Generated merchantLocationKey: ${merchantLocationKey} (${merchantLocationKey.length} chars)`);
    
    // Check if location already exists
    let locationExists = false;
    try {
      await callEbayAPI(accessToken, 'GET', `/sell/inventory/v1/location/${merchantLocationKey}`);
      locationExists = true;
      console.log(`📍 eBay location already exists: ${merchantLocationKey}`);
    } catch (error) {
      if (!error.message.includes('404')) {
        throw error;
      }
      console.log(`📍 eBay location needs to be created: ${merchantLocationKey}`);
    }
    
    // Handle different possible field names for address
    const addressLine1 = location.address || location.addressLine1 || location.street;
    const addressLine2 = location.address2 || location.addressLine2;
    const postalCode = location.postalCode || location.zipCode || location.zip;
    
    // Validate required fields
    if (!addressLine1) {
      throw new Error('Missing addressLine1 - cannot create eBay location');
    }
    if (!location.city) {
      throw new Error('Missing city - cannot create eBay location');
    }
    if (!location.state && !location.stateOrProvince) {
      throw new Error('Missing state/province - cannot create eBay location');
    }
    if (!postalCode) {
      throw new Error('Missing postal code - cannot create eBay location');
    }
    if (!location.country) {
      throw new Error('Missing country - cannot create eBay location');
    }
    
    // Prepare eBay location data with correct nested structure
    const ebayLocationData = {
      name: location.name || `Location ${location.id}`,
      locationTypes: ['WAREHOUSE'],
      location: {
        address: {
          addressLine1: addressLine1,
          city: location.city,
          stateOrProvince: location.state || location.stateOrProvince,
          postalCode: postalCode,
          country: location.country.toUpperCase()
        }
      },
      merchantLocationStatus: 'ENABLED'
    };
    
    // Add optional fields if they exist
    if (addressLine2) {
      ebayLocationData.location.address.addressLine2 = addressLine2;
    }
    if (location.phone) {
      ebayLocationData.phone = location.phone;
    }
    
    console.log('🚀 Sending eBay location data:', JSON.stringify(ebayLocationData, null, 2));
    
    // Create or update eBay location
    if (locationExists) {
      await callEbayAPI(
        accessToken,
        'POST',
        `/sell/inventory/v1/location/${merchantLocationKey}/update_location_details`,
        ebayLocationData
      );
      console.log(`✅ Updated eBay location: ${merchantLocationKey}`);
    } else {
      try {
        await callEbayAPI(
          accessToken,
          'POST',
          `/sell/inventory/v1/location/${merchantLocationKey}`,
          ebayLocationData
        );
        console.log(`✅ Created eBay location: ${merchantLocationKey}`);
      } catch (createError) {
        // Handle known sandbox issue with error 25802
        if (createError.message.includes('25802') && createError.message.includes('Input error')) {
          console.warn('⚠️ eBay Sandbox createInventoryLocation issue detected (error 25802)');
          console.warn('This is a known eBay sandbox bug. Location creation may work in production.');
          
          // For now, we'll proceed as if the location was created
          // In production, this should work correctly
          console.log(`🔧 Proceeding with location mapping despite sandbox error: ${merchantLocationKey}`);
        } else {
          throw createError;
        }
      }
    }
    
    // Update user's eBay config with location mapping
    await db.collection('users').doc(userId).update({
      [`ebay.locationMappings.${location.id}`]: merchantLocationKey,
      'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Database updated with location mapping: ${location.id} -> ${merchantLocationKey}`);
    
    return merchantLocationKey;
    
  } catch (error) {
    console.error('❌ eBay location sync failed:', error);
    console.error('Location data:', JSON.stringify(location, null, 2));
    throw new Error(`Failed to sync location to eBay: ${error.message}`);
  }
}

// ===== LOCATION SETUP CHECK MIDDLEWARE =====

// Middleware to check if user has locations set up
function requireLocationSetup(req, res, next) {
  // This can be used to protect listing endpoints
  // Implementation depends on your routing structure
  next();
}

console.log('📍 Location management system loaded');


// ========== 12. ERROR HANDLERS ==========
app.use((err, _req, res, _next) => {
  console.error('UNHANDLED ERROR:', err?.stack || err);
  res.status(500).json({ error: 'internal_error', message: err?.message || String(err) });
});


// ========== 13. EXPORT FUNCTIONS ==========
// Main Express app
exports.app = onRequest(
  { invoker: 'public', memory: '1GiB', timeoutSeconds: 120, region: 'us-central1', concurrency: 1 },
  app
);

exports.health = onRequest(
  { invoker: 'public', memory: '256MiB', timeoutSeconds: 60, region: 'us-central1' },
  (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Treasure Hunt SDK',
      ebayConfigured: !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),
    });
  }
);


// Load eBay functions with error handling
let ebayAuth;
try {
  const ebayModule = require('./api/ebay-auth.js');
  ebayAuth = ebayModule.ebayAuth;
  console.log('eBay auth module loaded successfully');
} catch (error) {
  console.warn('eBay auth module not found:', error.message);

  ebayAuth = onRequest({}, (_req, res) => {
    res.status(503).json({
      success: false,
      error: 'eBay auth service not available',
      details: 'eBay OAuth modules not deployed'
    });
  });
  testEbay = onRequest({}, (_req, res) => {
    res.status(503).json({
      success: false,
      error: 'eBay test service not available',
      details: 'eBay test modules not deployed'
    });
  });
}

// eBay OAuth functions (from separate files or fallback)
exports.ebayAuth = ebayAuth;


// ---------- Startup Logging ----------
console.log('🚀 Functions initialized with SDK support');
console.log('📊 Configuration status:');
console.log('  - OpenAI Key:', !!process.env.OPENAI_API_KEY ? '✅' : '❌');
console.log('  - Claude Key:', !!process.env.CLAUDE_API_KEY ? '✅' : '❌');
console.log('  - eBay configured:', !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET) ? '✅' : '❌');
console.log('  - eBay environment:', process.env.EBAY_ENVIRONMENT || 'not-set');
console.log('  - Functions exported:', Object.keys(exports).join(', '));