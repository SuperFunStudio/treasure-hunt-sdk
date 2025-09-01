// routes/analysis.js
// Image analysis endpoints

const express = require('express');
const Busboy = require('busboy');
const router = express.Router();

const { config } = require('../config/environment');
const { db, admin, serverTimestamp } = require('../config/firebase');

/**
 * Dependencies injected from main app
 */
let getSDKFunction = null;
let verifyAuthFunction = null;

function injectDependencies(getSDK, verifyAuth) {
  getSDKFunction = getSDK;
  verifyAuthFunction = verifyAuth;
}

/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Main image analysis endpoint (multipart form data)
 */
router.post('/api/analyze', asyncHandler(async (req, res) => {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('multipart/form-data')) {
    return res.status(415).json({ 
      phase: 'upload', 
      message: 'Content-Type must be multipart/form-data' 
    });
  }

  let userId = null;
  try {
    const decodedToken = await verifyAuthFunction(req);
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
      return res.status(400).json({ 
        phase: 'upload', 
        message: 'No images provided.' 
      });
    }

    let sdk;
    try { 
      sdk = await getSDKFunction(); 
    } catch (e) {
      console.error('[analyze] getSDK FAILED:', e);
      return res.status(500).json({ 
        phase: 'getSDK', 
        message: String(e.message || e) 
      });
    }

    let analysis;
    try {
      analysis = await sdk.analyzeItem(buffers, { 
        provider: 'claude', 
        apiKey: config.CLAUDE_API_KEY 
      });
      console.log('[analyze] analyzeItem OK');
    } catch (e) {
      console.error('[analyze] analyzeItem FAILED:', e?.stack || e);
      return res.status(500).json({ 
        phase: 'analyzeItem', 
        message: String(e.message || e) 
      });
    }

    let userData = null;
    let ebayConfig = null;

    if (userId) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        userData = userDoc.data();
        if (userData?.ebay?.isConnected && userData?.ebay?.accessToken) {
          const now = new Date();
          const expiresAt = userData.ebay.expiresAt?.toDate();
          if (expiresAt && now < expiresAt) {
            ebayConfig = {
              clientId: config.EBAY_CLIENT_ID,
              clientSecret: config.EBAY_CLIENT_SECRET,
              environment: config.EBAY_ENVIRONMENT,
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
      return res.status(500).json({ 
        phase: 'getRoutes', 
        message: String(e.message || e) 
      });
    }

    const ebayUsed = !!(routes?.marketAnalysis?.estimatedValue?.source?.toLowerCase?.().includes('ebay'));

    if (userId && analysis) {
      try {
        const scanData = {
          analysis,
          routes,
          imageCount: buffers.length,
          ebayUsed,
          createdAt: serverTimestamp(),
          status: 'analyzed'
        };
        await db.collection('users').doc(userId).collection('scans').add(scanData);
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
      sdkType: getSDKFunction ? 'service' : 'fallback'
    });
  });
}));

/**
 * JSON-based analysis endpoint (for programmatic access)
 */
router.post('/api/analyze-json', asyncHandler(async (req, res) => {
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

    if (req.query.dry === '1') {
      return res.json({
        success: true,
        dryRun: true,
        imageCount: buffers.length,
        totalBytes: buffers.reduce((a, b) => a + b.length, 0),
      });
    }

    const sdk = await getSDKFunction();

    let result;
    try {
      result = await sdk.analyzeItem(buffers, {
        provider: 'claude',
        apiKey: config.CLAUDE_API_KEY,
        uid,
        saveToFirestore
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
      sdkType: 'service'
    });
  } catch (e) {
    res.status(500).json({ 
      phase: 'analyze-json', 
      message: String(e.message || e) 
    });
  }
}));

module.exports = { router, injectDependencies };