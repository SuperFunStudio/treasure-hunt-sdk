// functions/index.js
// Main entry point - fully modular with route separation

// ========== 1. IMPORTS ==========
const express = require('express');
const cors = require('cors');

// Import configuration modules
const { config, getEnvironmentStatus } = require('./config/environment');
const { EBAY_LISTING } = require('./config/constants');
const { 
  onRequest, 
  admin, 
  db, 
  getAppConfig,
  getHealthConfig,
  logStartup 
} = require('./config/firebase');

// Import route modules
const { router: healthRoutes, injectSDKGetter } = require('./routes/health');
const { router: analysisRoutes, injectDependencies: injectAnalysisDeps } = require('./routes/analysis');
const { router: ebayRoutes, injectDependencies: injectEbayDeps } = require('./routes/ebay');

// Import existing modules (keeping category mapper for now)
const { initializeDatabase } = require('./ebay-category-mapper');

// ========== 2. FIREBASE INITIALIZATION ==========
initializeDatabase(db, admin);
console.log('Category mapper initialized with database access');

logStartup();
console.log('Environment check:', getEnvironmentStatus());

// ========== 3. UTILITY FUNCTIONS ==========
const corsHandler = cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// ========== 4. EXPRESS APP SETUP ==========
const app = express();
app.use(corsHandler);
app.use(express.json({ limit: '50mb' }));

// ========== 5. SDK INITIALIZATION ==========
let cachedSDK = null;
let sdkInitError = null;

async function getSDK() {
  if (cachedSDK) return cachedSDK;
  try {
    const CaptureSDK = require('./capture-sdk/index.js');
    cachedSDK = new CaptureSDK({
      visionProvider: 'claude',
      apiKeys: {
        gpt4v: config.OPENAI_API_KEY,
        claude: config.CLAUDE_API_KEY
      },
      ebay: {
        clientId: config.EBAY_CLIENT_ID,
        clientSecret: config.EBAY_CLIENT_SECRET,
        environment: config.EBAY_ENVIRONMENT,
        redirectUri: config.EBAY_REDIRECT_URI
      }
    });
    console.log('SDK initialized with eBay configuration');
    return cachedSDK;
  } catch (error) {
    console.error('SDK initialization failed:', error);
    sdkInitError = error.message;
    console.log('Using fallback SDK');
    return createFallbackSDK();
  }
}

function createFallbackSDK() {
  const ebayConfig = {
    clientId: config.EBAY_CLIENT_ID,
    clientSecret: config.EBAY_CLIENT_SECRET,
    environment: config.EBAY_ENVIRONMENT,
  };

  return {
    ebayConfig: ebayConfig.clientId && ebayConfig.clientSecret ? ebayConfig : null,
    async analyzeItem(_images, _options = {}) {
      console.log('Fallback SDK: analyzeItem called');
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
      console.log('Fallback SDK: getRoutes called');
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
      console.log('Fallback SDK: generateListing called');
      return {
        title: `${itemData.brand !== 'Unknown' ? itemData.brand + ' ' : ''}${itemData.category}`,
        description: itemData.condition?.description || 'Item for sale - see photos for condition',
        pricing: { buyItNowPrice: route?.estimatedReturn || 25 },
        condition: itemData.condition?.rating || 'good',
        category: EBAY_LISTING.FALLBACK_CATEGORY_ID
      };
    }
  };
}

// ========== 6. AUTHENTICATION MIDDLEWARE ==========
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header missing or invalid');
  }
  const idToken = authHeader.split('Bearer ')[1];
  return await admin.auth().verifyIdToken(idToken);
}

// ========== 7. INJECT DEPENDENCIES INTO ROUTES ==========
// Inject SDK getter into health routes
injectSDKGetter(getSDK, sdkInitError);

// Inject dependencies into analysis routes
injectAnalysisDeps(getSDK, verifyAuth);

// Inject dependencies into eBay routes
injectEbayDeps(verifyAuth);

// ========== 8. REGISTER ROUTES ==========
app.use('/', healthRoutes);    // /health, /api/test, /api/status
app.use('/', analysisRoutes);  // /api/analyze, /api/analyze-json
app.use('/', ebayRoutes);      // /api/ebay/*

// ========== 9. DIAGNOSTIC ENDPOINTS ==========
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

// ========== 10. ERROR HANDLERS ==========
app.use((err, _req, res, _next) => {
  console.error('UNHANDLED ERROR:', err?.stack || err);
  res.status(500).json({ 
    error: 'internal_error', 
    message: err?.message || String(err) 
  });
});

// ========== 11. EXPORT FUNCTIONS ==========
// Main Express app
exports.app = onRequest(getAppConfig(), app);

exports.health = onRequest(getHealthConfig(), (_req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Treasure Hunt SDK',
    ebayConfigured: !!(config.EBAY_CLIENT_ID && config.EBAY_CLIENT_SECRET),
  });
});

// eBay auth function (existing module)
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
}

exports.ebayAuth = ebayAuth;

console.log('Functions initialized with modular services and routes');
console.log('Exports:', Object.keys(exports).join(', '));

// Architecture Summary:
// - Configuration: /config/*.js
// - Services: /services/ebay/*.js 
// - Utilities: /utils/*.js
// - Routes: /routes/*.js
// - Main file: ~150 lines (was 3000+)