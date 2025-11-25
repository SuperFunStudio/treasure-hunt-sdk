// functions/index.js
// Main entry point - fully modular with route separation and affiliate tracking

// ========== 1. IMPORTS ==========
const express = require('express');
const { onSchedule } = require('firebase-functions/v2/scheduler');

// Import configuration modules
const { config, getEnvironmentStatus, validateAffiliateConfig } = require('./config/environment');
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
const { router: pinsRoutes, injectDependencies: injectPinsDeps } = require('./routes/pins');
const { router: locationRoutes } = require('./routes/location');
const { router: tokensRoutes, injectDependencies: injectTokensDeps } = require('./routes/tokens');
const { router: stripeWebhookRoutes, injectDependencies: injectStripeWebhookDeps } = require('./routes/stripe-webhooks');
const { router: purchasesRoutes, injectDependencies: injectPurchasesDeps } = require('./routes/purchases');



// Import new services for affiliate tracking and subscriptions
const affiliateService = require('./services/affiliate/affiliateService');
const subscriptionService = require('./services/subscription/subscriptionService');
const subscriptionRoutes = require('./routes/subscription');

// Import existing modules (keeping category mapper for now)
const { initializeDatabase } = require('./utils/ebay-category-mapper');

// ========== 2. FIREBASE INITIALIZATION ==========
initializeDatabase(db, admin);
console.log('Category mapper initialized with database access');

logStartup();

// ========== 2.5 STRIPE INITIALIZATION ==========
let stripe = null;
try {
  const stripeLib = require('stripe');
  const stripeKey = config.STRIPE_SECRET_KEY;

  if (stripeKey) {
    stripe = stripeLib(stripeKey);
    console.log('✅ Stripe initialized successfully');
  } else {
    console.warn('⚠️  Stripe not initialized - STRIPE_SECRET_KEY not configured');
  }
} catch (error) {
  console.error('❌ Failed to initialize Stripe:', error.message);
}

// ========== 3. ENHANCED STARTUP VALIDATION ==========
const envStatus = getEnvironmentStatus();
const affiliateValidation = validateAffiliateConfig();

console.log('=== ENVIRONMENT STATUS ===');
console.log('Environment check:', envStatus);
console.log('Production ready:', envStatus.isProductionReady);

console.log('=== AFFILIATE CONFIGURATION ===');
if (!affiliateValidation.isValid) {
  console.warn('⚠️  AFFILIATE CONFIGURATION ISSUES:');
  affiliateValidation.errors.forEach(error => console.warn(`  - ${error}`));
} else {
  console.log('✅ Affiliate configuration valid');
}

// Validate affiliate service configuration
try {
  const affiliateConfigCheck = affiliateService.validateConfiguration();
  if (!affiliateConfigCheck.isValid) {
    console.warn('⚠️  AFFILIATE SERVICE ISSUES:');
    affiliateConfigCheck.errors.forEach(error => console.warn(`  - ${error}`));
  } else {
    console.log('✅ Affiliate tracking service configured correctly');
  }
} catch (error) {
  console.warn('⚠️  Affiliate service validation failed:', error.message);
}

console.log('=== FEATURE STATUS ===');
console.log('Affiliate Tracking:', envStatus.affiliateTrackingEnabled ? '✅ Enabled' : '❌ Disabled');
console.log('Subscriptions:', envStatus.subscriptionsEnabled ? '✅ Enabled' : '❌ Disabled');
console.log('Commission Reporting:', envStatus.commissionReportingEnabled ? '✅ Enabled' : '❌ Disabled');

// ========== 4. UTILITY FUNCTIONS ==========
const { getCorsMiddleware, logCorsRequests } = require('./utils/cors');
const corsHandler = getCorsMiddleware('development'); // Use development for testing

// ========== 5. EXPRESS APP SETUP ==========
const app = express();
app.use(corsHandler);
app.use(logCorsRequests);

// Special handling for Stripe webhooks (raw body needed) - MUST come before express.json
app.use('/api/subscription/webhook', express.raw({type: 'application/json'}));

app.use(express.json({ limit: '50mb' }));

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

// ========== 7. AUTHENTICATION MIDDLEWARE ==========
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header missing or invalid');
  }
  const idToken = authHeader.split('Bearer ')[1];
  return await admin.auth().verifyIdToken(idToken);
}

// ========== 8. INJECT DEPENDENCIES INTO ROUTES ==========
// Inject SDK getter into health routes
injectSDKGetter(getSDK, sdkInitError);

// Inject dependencies into analysis routes
injectAnalysisDeps(getSDK, verifyAuth);

// Inject dependencies into eBay routes
injectEbayDeps(verifyAuth);

//Inject pin dependenceies
injectPinsDeps(verifyAuth);

// Inject dependencies into token routes
injectTokensDeps({ db, admin, stripe });

// Inject dependencies into Stripe webhook routes
injectStripeWebhookDeps({ db, admin, stripe });

// Inject dependencies into purchases routes
injectPurchasesDeps({ db, admin, stripe, verifyAuth });


// ========== 9. REGISTER ROUTES ==========
console.log('Registering routes...');

app.use('/', healthRoutes);    // /health, /api/test, /api/status
app.use('/', analysisRoutes);  // /api/analyze, /api/analyze-json
app.use('/', ebayRoutes);      // /api/ebay/* (now with affiliate tracking)
app.use('/', pinsRoutes);      // /api/pins/*
app.use('/', locationRoutes);  // /api/location/*
app.use('/api/tokens', tokensRoutes);  // /api/tokens/* (token system)
app.use('/api/stripe', stripeWebhookRoutes);  // /api/stripe/webhook
app.use('/api/purchases', purchasesRoutes);  // /api/purchases/* (listing purchases)

app.use('/', subscriptionRoutes); // NEW: Subscription management

console.log('Core routes registered (including token system)');

// Add eBay Auth routes to main app
try {
  app.post('/api/ebay/auth/auth-url', async (req, res) => {
    try {
      const { generateAuthUrl } = require('./api/ebay-auth.js');
      await generateAuthUrl(req, res);
    } catch (error) {
      console.error('Auth URL error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Add this GET handler for eBay's OAuth redirect
  app.get('/api/ebay/auth/callback', (req, res) => {
    const { code, state, expires_in } = req.query;
    
    console.log('eBay OAuth callback received:', { 
      hasCode: !!code, 
      hasState: !!state, 
      code: code ? code.substring(0, 20) + '...' : 'missing',
      allParams: Object.keys(req.query)
    });
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>eBay Connection - Treasure Hunter</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
          <h2>Connecting to eBay...</h2>
          <p>Please wait while we complete your eBay connection.</p>
        </div>
        
        <script>
          const code = ${JSON.stringify(code)};
          const state = ${JSON.stringify(state)} || 'temp_state_' + Date.now();
          
          console.log('Callback parameters:', { 
            code: code ? 'present' : 'missing', 
            state: state ? 'present' : 'generated' 
          });
          
          if (code) {
            // Proceed even without state for testing
            const params = new URLSearchParams({
              code: code,
              state: state
            });
            window.location.href = '/ebay-oauth-callback.html?' + params.toString();
          } else {
            console.error('Missing code parameter');
            document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h2>Error</h2><p>Missing authorization code. Please try connecting again.</p></div>';
          }
        </script>
      </body>
      </html>
    `);
  });

  app.post('/api/ebay/auth/callback', async (req, res) => {
    try {
      const { handleCallback } = require('./api/ebay-auth.js');
      await handleCallback(req, res);
    } catch (error) {
      console.error('Callback error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  console.log('eBay auth routes added to main app');
} catch (error) {
  console.warn('Could not load eBay auth routes:', error.message);
}

// ========== 10. DIAGNOSTIC ENDPOINTS ==========
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

// ========== 11. ROOT ROUTE ==========
app.get('/', (req, res) => {
  res.json({
    service: 'Treasure Hunt SDK API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    architecture: 'modular',
    features: {
      affiliateTracking: envStatus.affiliateTrackingEnabled,
      subscriptions: envStatus.subscriptionsEnabled,
      commissionReporting: envStatus.commissionReportingEnabled
    },
    endpoints: [
      'GET /health - Health check',
      'GET /api/test - API test', 
      'GET /api/status - Detailed status',
      'POST /api/analyze - Image analysis',
      'POST /api/ebay/create-listing - Create eBay listing (with tracking)',
      'GET /api/ebay/account-info - eBay account info',
      'GET /api/ebay/quota-status - Check listing quotas',
      'GET /api/subscription/status - Subscription status',
      'POST /api/subscription/create-checkout - Upgrade subscription',
       // Add these new pin endpoints
      'POST /api/pins - Create pin',
      'GET /api/pins/nearby - Find nearby pins',
      'GET /api/pins/:id - Get pin details',
      'GET /api/pins/user/mine - Get user pins',
      'POST /api/pins/:id/interest - Show interest',
      'POST /api/pins/:id/claim - Claim pin',
      'PUT /api/pins/:id - Update pin',
      'DELETE /api/pins/:id - Delete pin',
      'GET /api/location/reverse-geocode - Reverse geocode coordinates'
    ]
  });
});

// ========== 12. ENHANCED ERROR HANDLING ==========
// Enhanced error handling for subscription/quota errors
app.use((error, req, res, next) => {
  console.error('Enhanced error handler:', error);
  
  // Handle specific error types
  if (error.message.includes('QUOTA_EXCEEDED')) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit or quota exceeded',
      errorCode: 'QUOTA_EXCEEDED',
      message: 'Please upgrade your subscription or wait for quota reset'
    });
  }
  
  if (error.message.includes('SUBSCRIPTION_REQUIRED')) {
    return res.status(402).json({
      success: false,
      error: 'Subscription required',
      errorCode: 'SUBSCRIPTION_REQUIRED',
      message: 'This feature requires a paid subscription'
    });
  }

  // Continue to existing error handler
  next(error);
});

// Original error handler
app.use((err, _req, res, _next) => {
  console.error('UNHANDLED ERROR:', err?.stack || err);
  res.status(500).json({ 
    error: 'internal_error', 
    message: err?.message || String(err) 
  });
});

// 404 handler
app.use((req, res) => {
  // We remove the old static list and return a dynamic one from the root endpoint
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    errorCode: 'NOT_FOUND',
    message: 'Please see the root endpoint (/) for a list of available endpoints.'
  });
});

// ========== 13. SCHEDULED FUNCTIONS ==========

/**
 * Commission Report Processing
 * Scheduled function to process eBay Partner Network commission reports
 */
const processCommissionReports = onRequest(getAppConfig(), async (req, res) => {
  try {
    console.log('Processing commission reports...');
    
    // Placeholder for eBay Partner Network API integration
    // This would fetch and process commission data from EPN
    
    res.json({
      success: true,
      message: 'Commission report processing completed',
      processed: 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Commission processing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Subscription Analytics
 * Generate subscription and usage analytics
 */
const generateAnalytics = onRequest(getAppConfig(), async (req, res) => {
  try {
    console.log('Generating analytics...');
    
    // Get subscription distribution
    const usersSnapshot = await db.collection('users').get();
    const subscriptionStats = {
      total: 0,
      free: 0,
      starter: 0,
      pro: 0
    };
    
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      const tier = userData.subscription?.tier || 'free';
      subscriptionStats.total++;
      subscriptionStats[tier] = (subscriptionStats[tier] || 0) + 1;
    });
    
    // Get commission stats
    const commissionsSnapshot = await db.collection('commissions').get();
    const totalCommissions = commissionsSnapshot.docs.reduce((sum, doc) => {
      return sum + (doc.data().ourCommission || 0);
    }, 0);
    
    res.json({
      success: true,
      analytics: {
        subscriptions: subscriptionStats,
        commissions: {
          total: totalCommissions,
          count: commissionsSnapshot.size
        },
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Analytics generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== 14. EXPORT FUNCTIONS ==========
console.log('Exporting Cloud Functions...');

// Main Express app
exports.app = onRequest(getAppConfig(), app);

// Health check (standalone)
exports.health = onRequest(getHealthConfig(), (_req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Treasure Hunt SDK',
    ebayConfigured: !!(config.EBAY_CLIENT_ID && config.EBAY_CLIENT_SECRET),
    affiliateConfigured: !!(config.EBAY_CAMPAIGN_ID),
    features: {
      affiliateTracking: envStatus.affiliateTrackingEnabled,
      subscriptions: envStatus.subscriptionsEnabled
    }
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

// NEW: Scheduled functions
exports.processCommissionReports = processCommissionReports;
exports.generateAnalytics = generateAnalytics;

exports.pinCleanup = onSchedule('every 1 hours', async (event) => {
  console.log('Running scheduled pin cleanup...');
  
  try {
    const expirationService = require('./services/location/expirationService');
    const result = await expirationService.runCleanup();
    
    console.log('Pin cleanup completed:', result);
    return result;
    
  } catch (error) {
    console.error('Pin cleanup failed:', error);
    throw error;
  }
});

exports.pinNotifications = onSchedule('every 30 minutes', async (event) => {
  console.log('Checking for pins requiring expiration notifications...');
  
  try {
    const expirationService = require('./services/location/expirationService');
    const notificationsSent = await expirationService.sendExpirationNotifications();
    
    console.log(`Sent ${notificationsSent} expiration notifications`);
    return { notificationsSent };
    
  } catch (error) {
    console.error('Notification check failed:', error);
    throw error;
  }
});


// ========== 15. STARTUP SUMMARY ==========
console.log('=== STARTUP COMPLETE ===');
console.log('✅ Express app configured');
console.log('✅ Routes registered');
console.log('✅ Error handling configured');
console.log('✅ Cloud Functions exported');

if (envStatus.isProductionReady) {
  console.log('🚀 Application ready for production');
} else {
  console.log('⚠️  Additional configuration needed for production');
}

console.log('=== EXPORTS ===');
console.log('Functions:', Object.keys(exports).join(', '));
console.log('===============');

// Architecture Summary:
// - Configuration: /config/*.js
// - Services: /services/{affiliate,subscription,ebay}/*.js 
// - Utilities: /utils/*.js
// - Routes: /routes/*.js
// - Enhanced with affiliate tracking and subscription management