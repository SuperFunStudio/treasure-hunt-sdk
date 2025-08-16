// functions/index.js
// Updated main Firebase Functions entry point with eBay OAuth integration

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Busboy = require('busboy');

// Load environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Firebase Admin initialization
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

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

// Load eBay functions with error handling
let ebayAuth, testEbay;
try {
  ({ ebayAuth } = require('./api/ebay-auth'));
  ({ testEbay } = require('./api/test-ebay'));
  console.log('✅ eBay modules loaded successfully');
} catch (error) {
  console.warn('⚠️ eBay modules not found:', error.message);
  // Create placeholder functions
  ebayAuth = onRequest({}, (req, res) => {
    res.status(503).json({ 
      success: false, 
      error: 'eBay auth service not available',
      details: 'eBay OAuth modules not deployed' 
    });
  });
  testEbay = onRequest({}, (req, res) => {
    res.status(503).json({ 
      success: false, 
      error: 'eBay test service not available',
      details: 'eBay test modules not deployed' 
    });
  });
}

// Log environment status
console.log('Environment check:', {
  hasOpenAI: !!process.env.OPENAI_API_KEY,
  hasClaude: !!process.env.CLAUDE_API_KEY,
  hasEbayClientId: !!process.env.EBAY_CLIENT_ID,
  hasEbaySecret: !!process.env.EBAY_CLIENT_SECRET,
  ebayEnvironment: process.env.EBAY_ENVIRONMENT || 'not-set',
});

// ---------- SDK Initialization ----------
let cachedSDK = null;
let sdkInitError = null;

async function getSDK() {
  if (cachedSDK) return cachedSDK;
  
  try {
    const CaptureSDK = require('./capture-sdk/index.js');
    
    cachedSDK = new CaptureSDK({
      visionProvider: 'gpt4v',
      apiKeys: {
        gpt4v: process.env.OPENAI_API_KEY,
        claude: process.env.CLAUDE_API_KEY
      },
      // Add eBay configuration
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
    
    // Return fallback SDK instead of null
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
    async analyzeItem(images, options = {}) {
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
        identifiers: {
          visible_text: '',
          color: 'Unknown'
        }
      };
    },
    async getRoutes(itemData, userPreferences = {}, ebayConfigOverride = null) {
      console.log('🔄 Fallback SDK: getRoutes called');
      try {
        const { routeDisposition } = await import('./capture-sdk/core/routeDisposition.js');
        return routeDisposition(itemData, userPreferences, ebayConfigOverride || this.ebayConfig);
      } catch (error) {
        console.warn('Fallback routing failed:', error.message);
        return {
          recommendedRoute: {
            type: "donation",
            priority: 1,
            estimatedReturn: 0,
            timeToMoney: "immediate",
            effort: "low",
            reason: "Fallback recommendation"
          },
          alternativeRoutes: [],
          marketAnalysis: {
            estimatedValue: { suggested: null, confidence: 'low', source: 'fallback' }
          }
        };
      }
    },
    async generateListing(itemData, route, options = {}) {
      console.log('🔄 Fallback SDK: generateListing called');
      return {
        title: `${itemData.brand !== 'Unknown' ? itemData.brand + ' ' : ''}${itemData.category}`,
        description: itemData.condition?.description || 'Item for sale - see photos for condition',
        pricing: { buyItNowPrice: route?.estimatedReturn || 25 },
        condition: itemData.condition?.rating || 'good',
        category: '171485' // Default eBay category
      };
    }
  };
}

// ---------- Express App Setup ----------
const app = express();
app.use(cors({ origin: true }));

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => 
  Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Health & Test Endpoints ----------
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
    },
    modules: {
      ebayAuth: typeof ebayAuth === 'function',
      testEbay: typeof testEbay === 'function'
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

// ---------- Diagnostic Endpoints ----------
app.options('/api/echo-raw', cors());
app.post('/api/echo-raw', (req, res) => {
  const chunks = [];
  let total = 0;

  req.on('aborted', () => {
    console.error('[echo-raw] client aborted before end');
  });

  req.on('data', (d) => { 
    chunks.push(d); 
    total += d.length; 
  });
  
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
  
  req.on('error', (e) => res.status(500).json({ 
    ok: false, 
    error: String(e) 
  }));
});

app.options('/api/analyze-echo', cors());
app.post('/api/analyze-echo', (req, res) => {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('multipart/form-data')) {
    return res.status(415).json({ 
      error: 'Content-Type must be multipart/form-data' 
    });
  }

  req.on('aborted', () => {
    console.error('[analyze-echo] client aborted before finish');
  });

  const bb = Busboy({ headers: req.headers });
  const files = [];
  req.pipe(bb);

  bb.on('file', (fieldname, file, info) => {
    const chunks = [];
    file.on('data', (d) => chunks.push(d));
    file.on('end', () => {
      files.push({
        field: fieldname,
        filename: info?.filename,
        mimetype: info?.mimetype || info?.mimeType,
        size: Buffer.concat(chunks).length
      });
    });
  });

  bb.once('error', (e) => res.status(400).json({ 
    error: 'busboy', 
    message: String(e) 
  }));
  
  bb.on('finish', () => res.json({ files }));
});

// ---------- Main Analysis Endpoint (Multipart) ----------
app.options('/api/analyze', cors());
app.post('/api/analyze', asyncHandler(async (req, res) => {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('multipart/form-data')) {
    return res.status(415).json({ 
      phase: 'upload', 
      message: 'Content-Type must be multipart/form-data' 
    });
  }

  // User authentication
  let userId = null;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      userId = decodedToken.uid;
      console.log('[analyze] Authenticated user:', userId);
    } else {
      console.log('[analyze] No authentication provided - using anonymous analysis');
    }
  } catch (authError) {
    console.warn('[analyze] Auth verification failed:', authError.message);
    // Continue with anonymous analysis
  }

  req.on('aborted', () => {
    console.error('[analyze] client aborted before finish');
  });

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
    return res.status(400).json({ 
      phase: 'upload', 
      message: String(e) 
    });
  });

  bb.on('finish', async () => {
    if (buffers.length === 0) {
      return res.status(400).json({ 
        phase: 'upload', 
        message: 'No images provided.' 
      });
    }

    let sdk;
    try { 
      sdk = await getSDK(); 
    } catch (e) {
      console.error('[analyze] getSDK FAILED:', e);
      return res.status(500).json({ 
        phase: 'getSDK', 
        message: String(e.message || e) 
      });
    }

    // Analyze the item
    let analysis;
    try {
      analysis = await sdk.analyzeItem(buffers, { 
        provider: 'claude', 
        apiKey: process.env.CLAUDE_API_KEY 
      });
      console.log('[analyze] analyzeItem OK');
    } catch (e) {
      console.error('[analyze] analyzeItem FAILED:', e?.stack || e);
      return res.status(500).json({ 
        phase: 'analyzeItem', 
        message: String(e.message || e) 
      });
    }

    // Get user's eBay configuration if authenticated
    let userData = null;
    let ebayConfig = null;
    
    if (userId) {
      try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        userData = userDoc.data();
        
        if (userData?.ebay?.isConnected && userData?.ebay?.accessToken) {
          // Check if token is expired
          const now = new Date();
          const expiresAt = userData.ebay.expiresAt?.toDate();
          
          if (expiresAt && now < expiresAt) {
            // Token is valid, use it for real eBay pricing
            ebayConfig = {
              clientId: process.env.EBAY_CLIENT_ID,
              clientSecret: process.env.EBAY_CLIENT_SECRET,
              environment: process.env.EBAY_ENVIRONMENT || 'production',
              accessToken: userData.ebay.accessToken
            };
            console.log('[analyze] Using user eBay tokens for real pricing');
          } else {
            console.log('[analyze] User eBay token expired, using fallback pricing');
          }
        } else {
          console.log('[analyze] User has no eBay connection, using fallback pricing');
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
      return res.status(500).json({ 
        phase: 'getRoutes', 
        message: String(e.message || e) 
      });
    }

    // Determine if eBay API was actually used
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
        
        await admin.firestore()
          .collection('users')
          .doc(userId)
          .collection('scans')
          .add(scanData);
          
        console.log('[analyze] Scan saved to user history');
      } catch (saveError) {
        console.warn('[analyze] Failed to save scan:', saveError.message);
        // Don't fail the request if saving fails
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

// ---------- JSON Analysis Endpoints ----------
// Add JSON parser AFTER multipart routes
app.use(express.json({ limit: '50mb' }));

app.post('/api/analyze-json-echo', (req, res) => {
  try {
    const { images } = req.body || {};
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ 
        phase: 'upload', 
        message: 'images[] required' 
      });
    }
    
    const sizes = images.map((s, i) => {
      const b64 = typeof s === 'string' && s.startsWith('data:') ? s.split(',')[1] : s;
      const bytes = Buffer.byteLength(b64 || '', 'base64');
      return { index: i, bytes };
    });
    
    res.json({ 
      ok: true, 
      count: images.length, 
      sizes 
    });
  } catch (e) {
    res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    });
  }
});

app.post('/api/analyze-json', asyncHandler(async (req, res) => {
  try {
    const { images, uid, saveToFirestore } = req.body || {};
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ 
        phase: 'upload', 
        message: 'images[] (base64 or data URLs) required' 
      });
    }

    const toBuffer = (s) => {
      if (typeof s !== 'string') throw new Error('image must be string');
      const b64 = s.startsWith('data:') ? s.split(',')[1] : s;
      return Buffer.from(b64, 'base64');
    };
    const buffers = images.map(toBuffer);

    // Dry-run short-circuit
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
        uid: uid,
        saveToFirestore: saveToFirestore,
      });
    } catch (e) {
      return res.status(500).json({ 
        phase: 'analyzeItem', 
        message: String(e.message || e) 
      });
    }

    let routes;
    try {
      routes = await sdk.getRoutes(result, { hasEbayAccount: true });
    } catch (e) {
      return res.status(500).json({ 
        phase: 'getRoutes', 
        message: String(e.message || e) 
      });
    }

    res.json({ 
      success: true, 
      analysis: result, 
      routes, 
      imageCount: buffers.length,
      sdkType: sdkInitError ? 'fallback' : 'real'
    });
  } catch (e) {
    res.status(500).json({ 
      phase: 'analyze-json', 
      message: String(e.message || e) 
    });
  }
}));

// ADD THESE ROUTES TO YOUR functions/index.js 
// Insert around line 400, BEFORE the error handler

// eBay OAuth Proxy Routes
app.post('/api/ebay/auth-url', asyncHandler(async (req, res) => {
  try {
    console.log('🔗 Proxying eBay auth-url request');
    
    // Verify user authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization required' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { redirectUri } = req.body;
    
    if (!redirectUri) {
      return res.status(400).json({
        success: false,
        error: 'Redirect URI is required'
      });
    }

    // Generate eBay OAuth URL using your existing eBay integration
    try {
      const { EbayIntegration } = require('./capture-sdk/integrations/ebay/index.js');
      
      const ebayIntegration = new EbayIntegration({
        clientId: process.env.EBAY_CLIENT_ID,
        clientSecret: process.env.EBAY_CLIENT_SECRET,
        environment: process.env.EBAY_ENVIRONMENT || 'production',
        redirectUri: redirectUri
      });

      const state = `user_${userId}_${Date.now()}`;
      const authUrl = ebayIntegration.getAuthUrl(state);

      console.log('✅ Generated eBay OAuth URL for user:', userId);

      res.json({
        success: true,
        authUrl: authUrl,
        state: state
      });

    } catch (ebayError) {
      console.error('❌ eBay integration error:', ebayError);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize eBay integration: ' + ebayError.message
      });
    }

  } catch (error) {
    console.error('❌ eBay auth-url proxy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate eBay auth URL: ' + error.message
    });
  }
}));

app.post('/api/ebay/callback', asyncHandler(async (req, res) => {
  try {
    console.log('🔄 Proxying eBay callback request');
    
    // Verify user authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization required' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Authorization code required' });
    }

    // Verify state parameter contains user ID
    if (!state || !state.includes(`user_${userId}`)) {
      return res.status(400).json({ success: false, error: 'Invalid state parameter' });
    }

    // Exchange code for tokens
    try {
      const { EbayIntegration } = require('./capture-sdk/integrations/ebay/index.js');
      
      const ebayIntegration = new EbayIntegration({
        clientId: process.env.EBAY_CLIENT_ID,
        clientSecret: process.env.EBAY_CLIENT_SECRET,
        environment: process.env.EBAY_ENVIRONMENT || 'production',
        redirectUri: process.env.EBAY_REDIRECT_URI || `${req.headers.origin}/ebay-callback.html`
      });

      const tokenData = await ebayIntegration.authenticate(code);
      
      // Get user info from eBay (optional)
      let sellerAccount = 'Connected';
      try {
        // Could add a method to get seller info here if needed
        sellerAccount = 'eBay Seller Account';
      } catch (infoError) {
        console.warn('⚠️ Could not fetch seller account info:', infoError.message);
      }

      // Store tokens in Firestore
      const userRef = admin.firestore().collection('users').doc(userId);
      await userRef.update({
        'ebay.isConnected': true,
        'ebay.accessToken': tokenData.accessToken,
        'ebay.refreshToken': tokenData.refreshToken,
        'ebay.expiresAt': admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + (tokenData.expiresIn * 1000))
        ),
        'ebay.sellerAccount': sellerAccount,
        'ebay.connectedAt': admin.firestore.FieldValue.serverTimestamp(),
        'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ eBay OAuth successful for user:', userId);

      res.json({
        success: true,
        message: 'eBay account connected successfully',
        sellerAccount: sellerAccount
      });

    } catch (ebayError) {
      console.error('❌ eBay authentication error:', ebayError);
      res.status(500).json({
        success: false,
        error: 'eBay authentication failed: ' + ebayError.message
      });
    }

  } catch (error) {
    console.error('❌ eBay callback proxy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process eBay callback: ' + error.message
    });
  }
}));

// ---------- Error Handlers ----------
app.use((err, _req, res, _next) => {
  console.error('UNHANDLED ERROR:', err?.stack || err);
  res.status(500).json({ 
    error: 'internal_error', 
    message: err?.message || String(err) 
  });
});

// ---------- eBay Notifications Webhook ----------
exports.ebayNotifications = onRequest(
  { 
    invoker: 'public', 
    memory: '256MiB', 
    timeoutSeconds: 60, 
    region: 'us-central1' 
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-eBay-Signature');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
      const challengeCode = req.query.challenge_code;
      if (!challengeCode) {
        return res.status(400).json({ 
          error: 'Missing challenge_code parameter' 
        });
      }
      
      try {
        const hash = crypto.createHash('sha256');
        hash.update(challengeCode);
        hash.update(VERIFICATION_TOKEN);
        hash.update(ENDPOINT_URL);
        const responseHash = hash.digest('hex');
        return res.status(200).json({ 
          challengeResponse: responseHash 
        });
      } catch (e) {
        console.error('Challenge verification failed:', e);
        return res.status(500).json({ 
          error: 'Challenge verification failed' 
        });
      }
    }

    if (req.method === 'POST') {
      try {
        const notification = req.body;
        console.log('Received eBay notification:', notification?.notification?.notificationId);
        
        res.status(200).json({ 
          status: 'received', 
          timestamp: new Date().toISOString() 
        });
        
        if (notification?.notification) {
          db.collection('ebay_notifications').add({
            notificationId: notification.notification.notificationId || 'unknown',
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            data: notification,
          }).catch(err => console.error('Failed to store notification:', err));
        }
      } catch (e) {
        console.error('Error processing notification:', e);
        return res.status(500).json({ 
          error: 'Processing failed' 
        });
      }
    } else {
      return res.status(405).json({ 
        error: 'Method not allowed' 
      });
    }
  }
);

// ---------- Export Functions ----------
// Main Express app
exports.app = onRequest(
  { 
    invoker: 'public', 
    memory: '1GiB', 
    timeoutSeconds: 120, 
    region: 'us-central1', 
    concurrency: 1 
  },
  app
);

// Dedicated health endpoint
exports.health = onRequest(
  { 
    invoker: 'public', 
    memory: '256MiB', 
    timeoutSeconds: 60, 
    region: 'us-central1' 
  },
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

// eBay OAuth functions (from separate files)
exports.ebayAuth = ebayAuth;
exports.testEbay = testEbay;

// ---------- Startup Logging ----------
console.log('🚀 Functions initialized with SDK support');
console.log('📊 Configuration status:');
console.log('  - OpenAI Key:', !!process.env.OPENAI_API_KEY ? '✅' : '❌');
console.log('  - Claude Key:', !!process.env.CLAUDE_API_KEY ? '✅' : '❌');
console.log('  - eBay configured:', !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET) ? '✅' : '❌');
console.log('  - eBay environment:', process.env.EBAY_ENVIRONMENT || 'not-set');
console.log('  - eBay Auth module:', typeof ebayAuth === 'function' ? '✅' : '❌');
console.log('  - eBay Test module:', typeof testEbay === 'function' ? '✅' : '❌');