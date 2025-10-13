// routes/analysis.js
// Image analysis endpoints with enhanced price validation

const express = require('express');
const Busboy = require('busboy');
const router = express.Router();

const { config } = require('../config/environment');
const { db, admin, serverTimestamp } = require('../config/firebase');

// Import enhanced validation services
const priceValidator = require('../utils/price-validator');
const { categoryDetector } = require('../utils/category-detector');
const { itemSpecificsValidator } = require('../utils/item-specifics-validator');

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
 * Main image analysis endpoint (multipart form data) with enhanced price validation
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

    // Step 1: AI Analysis
    let analysis;
    try {
      console.log('[analyze] Starting AI analysis...');
      analysis = await sdk.analyzeItem(buffers, { 
        provider: 'claude', 
        apiKey: config.CLAUDE_API_KEY 
      });
      console.log('[analyze] AI analysis completed successfully');
    } catch (e) {
      console.error('[analyze] analyzeItem FAILED:', e?.stack || e);
      return res.status(500).json({ 
        phase: 'analyzeItem', 
        message: String(e.message || e) 
      });
    }

    // Step 2: Enhanced Category Detection
    let enhancedCategory = null;
    try {
      console.log('[analyze] Enhancing category detection...');
      const detectionInput = `${analysis.brand || ''} ${analysis.model || ''} ${analysis.category || ''}`;
      enhancedCategory = categoryDetector.detectCategory(detectionInput);
      
      if (enhancedCategory !== 'unknown' && enhancedCategory !== analysis.category) {
        console.log(`[analyze] Enhanced category: ${analysis.category} -> ${enhancedCategory}`);
        analysis.enhancedCategory = enhancedCategory;
      }
    } catch (e) {
      console.warn('[analyze] Category enhancement failed:', e.message);
    }

    // Step 3: Get User Data and eBay Config
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
            console.log('[analyze] Using user eBay tokens for enhanced pricing');
          }
        }
      } catch (userError) {
        console.warn('[analyze] Error fetching user data:', userError.message);
      }
    }

    // Step 4: Get Preliminary Routes (FAST - no eBay API)
    let preliminaryRoutes;
    try {
      console.log('[analyze] Getting preliminary routes (instant)...');
      preliminaryRoutes = sdk.getPreliminaryRoutes(analysis, {});
      console.log('[analyze] Preliminary routes generated successfully');
    } catch (e) {
      console.error('[analyze] getPreliminaryRoutes FAILED:', e?.stack || e);
      return res.status(500).json({
        phase: 'getPreliminaryRoutes',
        message: String(e.message || e)
      });
    }

    // Step 5: Save Preliminary Scan & Generate Scan ID
    let scanId = null;
    if (userId && analysis) {
      try {
        const preliminaryScanData = {
          analysis,
          routes: preliminaryRoutes,
          enhancedCategory,
          imageCount: buffers.length,
          createdAt: serverTimestamp(),
          status: 'preliminary', // Indicates market pricing pending
          processingStatus: 'pricing_in_progress',
          version: '2.1' // Two-phase version
        };

        const scanRef = await db.collection('users').doc(userId).collection('scans').add(preliminaryScanData);
        scanId = scanRef.id;
        console.log('[analyze] Preliminary scan saved with ID:', scanId);
      } catch (saveError) {
        console.warn('[analyze] Failed to save preliminary scan:', saveError.message);
      }
    }

    // Step 6: Return Immediate Response (FAST)
    const immediateResponse = {
      success: true,
      scanId,
      analysis,
      routes: preliminaryRoutes,

      // Enhanced data
      enhancedCategory,

      // Metadata
      imageCount: buffers.length,
      userAuthenticated: !!userId,
      ebayConnected: !!ebayConfig,
      sdkType: getSDKFunction ? 'service' : 'fallback',
      timestamp: new Date().toISOString(),

      // Status flags
      isPreliminary: true,
      pricingStatus: 'in_progress',
      message: 'Analysis complete. Market pricing in progress...'
    };

    // Send immediate response
    res.json(immediateResponse);

    // Step 7: Background Market Pricing (ASYNC - don't wait)
    if (scanId && userId) {
      console.log('[analyze] Starting background market pricing for scan:', scanId);

      // Run in background without blocking response
      processBackgroundPricing(scanId, userId, analysis, enhancedCategory, ebayConfig, buffers.length)
        .catch(error => {
          console.error('[analyze] Background pricing failed:', error);
        });
    }
  });
}));

/**
 * Background processing function for market pricing
 * Runs async after initial response is sent
 */
async function processBackgroundPricing(scanId, userId, analysis, enhancedCategory, ebayConfig, imageCount) {
  console.log(`[background-pricing] Starting for scan ${scanId}`);

  try {
    const sdk = await getSDKFunction();

    // Step 1: Get Full Routes with eBay API
    let routes;
    try {
      console.log('[background-pricing] Getting full routes with eBay API...');
      if (ebayConfig) {
        routes = await sdk.getRoutes(analysis, {}, ebayConfig);
      } else {
        routes = await sdk.getRoutes(analysis, { hasEbayAccount: false });
      }
      console.log('[background-pricing] Full routes generated');
    } catch (e) {
      console.error('[background-pricing] getRoutes FAILED:', e.message);
      // Update scan with error status
      await db.collection('users').doc(userId).collection('scans').doc(scanId).update({
        processingStatus: 'pricing_failed',
        pricingError: e.message,
        updatedAt: serverTimestamp()
      });
      return;
    }

    // Step 2: Enhanced Price Validation
    let priceValidation = null;
    try {
      console.log('[background-pricing] Starting enhanced price validation...');

      const itemData = {
        title: `${analysis.brand || ''} ${analysis.model || ''} ${analysis.category || ''}`.trim(),
        brand: analysis.brand,
        model: analysis.model,
        category: enhancedCategory || analysis.category,
        condition: analysis.condition
      };

      priceValidation = await priceValidator.validatePrice(analysis, routes, itemData);

      if (priceValidation.enhancedPricing) {
        console.log(`[background-pricing] Validation complete. Original: $${routes?.marketAnalysis?.estimatedValue?.suggested}, Enhanced: $${priceValidation.enhancedPricing.recommended}`);
      }

    } catch (e) {
      console.warn('[background-pricing] Price validation failed:', e.message);
      priceValidation = {
        isValid: false,
        confidence: 'low',
        error: e.message
      };
    }

    // Step 3: Item Specifics Validation
    let itemSpecificsValidation = null;
    try {
      if (enhancedCategory && ['furniture', 'electronics', 'footwear', 'clothing'].includes(enhancedCategory)) {
        console.log('[background-pricing] Validating item specifics...');

        const mockListingData = {
          title: `${analysis.brand || ''} ${analysis.model || ''} ${analysis.category || ''}`.trim(),
          description: analysis.condition?.description || 'Item in good condition',
          category: enhancedCategory,
          brand: analysis.brand,
          model: analysis.model,
          condition: analysis.condition,
          pricing: {
            buyItNowPrice: priceValidation?.enhancedPricing?.recommended ||
                           routes?.marketAnalysis?.estimatedValue?.suggested ||
                           25
          }
        };

        itemSpecificsValidation = itemSpecificsValidator.validateAndEnhanceListing(mockListingData);
      }
    } catch (e) {
      console.warn('[background-pricing] Item specifics validation failed:', e.message);
    }

    // Step 4: Update Scan with Complete Data
    const ebayUsed = !!(routes?.marketAnalysis?.estimatedValue?.source?.toLowerCase?.().includes('ebay'));

    const updateData = {
      routes,
      priceValidation: priceValidation ? {
        isValid: priceValidation.isValid,
        confidence: priceValidation.confidence,
        enhancedPrice: priceValidation.enhancedPricing?.recommended,
        marketConfidence: priceValidation.marketData?.confidence
      } : null,
      itemSpecificsValidation,
      marketInsights: priceValidation?.marketData ? {
        dataSource: priceValidation.marketData.dataSource,
        confidence: priceValidation.marketData.confidence,
        sampleSize: priceValidation.marketData.recommendation?.sampleSize,
        marketRange: priceValidation.marketData.recommendation?.range,
        recentSales: priceValidation.marketData.recommendation?.recentSales
      } : null,
      pricingRecommendations: priceValidation?.enhancedPricing ? {
        recommended: priceValidation.enhancedPricing.recommended,
        range: priceValidation.enhancedPricing.range,
        confidence: priceValidation.enhancedPricing.confidence,
        reasoning: priceValidation.enhancedPricing.reasoning,
        alternatives: priceValidation.enhancedPricing.alternatives
      } : null,
      ebayUsed,
      status: 'complete',
      processingStatus: 'complete',
      updatedAt: serverTimestamp()
    };

    await db.collection('users').doc(userId).collection('scans').doc(scanId).update(updateData);

    console.log(`[background-pricing] Complete for scan ${scanId}`);

  } catch (error) {
    console.error('[background-pricing] Unexpected error:', error);

    // Update with error status
    try {
      await db.collection('users').doc(userId).collection('scans').doc(scanId).update({
        processingStatus: 'error',
        processingError: error.message,
        updatedAt: serverTimestamp()
      });
    } catch (updateError) {
      console.error('[background-pricing] Failed to update error status:', updateError);
    }
  }
}

/**
 * JSON-based analysis endpoint with price validation
 */
router.post('/api/analyze-json', asyncHandler(async (req, res) => {
  try {
    const { images, uid, saveToFirestore, validatePricing = true } = req.body || {};
    
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

    // AI Analysis
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

    // Get Routes
    let routes;
    try {
      routes = await sdk.getRoutes(result, { hasEbayAccount: true });
    } catch (e) {
      return res.status(500).json({ 
        phase: 'getRoutes', 
        message: String(e.message || e) 
      });
    }

    // Enhanced Price Validation (if requested)
    let priceValidation = null;
    if (validatePricing) {
      try {
        const itemData = {
          title: `${result.brand || ''} ${result.model || ''} ${result.category || ''}`.trim(),
          brand: result.brand,
          model: result.model,
          category: result.category,
          condition: result.condition
        };

        priceValidation = await priceValidator.validatePrice(result, routes, itemData);
      } catch (e) {
        console.warn('Price validation failed in JSON endpoint:', e.message);
      }
    }

    res.json({
      success: true,
      analysis: result,
      routes,
      priceValidation,
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

/**
 * Price validation test endpoint
 */
router.post('/api/test-price-validation', asyncHandler(async (req, res) => {
  try {
    const { title, brand, category, condition, estimatedPrice } = req.body;
    
    if (!title || !estimatedPrice) {
      return res.status(400).json({
        success: false,
        error: 'title and estimatedPrice are required'
      });
    }

    console.log('Testing price validation for:', { title, brand, category, condition, estimatedPrice });
    
    const validation = await priceValidator.quickValidatePrice(
      title, 
      brand, 
      category, 
      condition, 
      estimatedPrice
    );

    res.json({
      success: true,
      validation: validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Price validation test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Market data lookup endpoint
 */
router.post('/api/market-data', asyncHandler(async (req, res) => {
  try {
    const marketDataService = require('../services/ebay/marketDataService');
    const { keywords, brand, condition, categoryId } = req.body;
    
    if (!keywords) {
      return res.status(400).json({
        success: false,
        error: 'keywords parameter is required'
      });
    }

    const searchParams = {
      keywords,
      brand,
      condition: condition || 'Used',
      categoryId,
      maxResults: 30
    };

    const marketData = await marketDataService.searchSoldListings(searchParams);
    
    res.json({
      success: true,
      marketData: marketData,
      searchParams: searchParams,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Market data lookup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get scan status endpoint - for polling pricing completion
 */
router.get('/api/analyze/:scanId/status', asyncHandler(async (req, res) => {
  const { scanId } = req.params;

  if (!scanId) {
    return res.status(400).json({
      success: false,
      error: 'scanId parameter required'
    });
  }

  // Verify authentication
  let userId = null;
  try {
    const decodedToken = await verifyAuthFunction(req);
    userId = decodedToken.uid;
  } catch (_authError) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    const scanDoc = await db.collection('users').doc(userId).collection('scans').doc(scanId).get();

    if (!scanDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Scan not found'
      });
    }

    const scanData = scanDoc.data();

    res.json({
      success: true,
      scanId,
      status: scanData.processingStatus || 'unknown',
      isPreliminary: scanData.status === 'preliminary',
      isComplete: scanData.processingStatus === 'complete',
      hasError: scanData.processingStatus === 'error' || scanData.processingStatus === 'pricing_failed',
      data: {
        analysis: scanData.analysis,
        routes: scanData.routes,
        priceValidation: scanData.priceValidation,
        marketInsights: scanData.marketInsights,
        pricingRecommendations: scanData.pricingRecommendations,
        itemSpecificsValidation: scanData.itemSpecificsValidation,
        enhancedCategory: scanData.enhancedCategory,
        ebayUsed: scanData.ebayUsed
      },
      error: scanData.processingError || scanData.pricingError || null,
      timestamps: {
        created: scanData.createdAt,
        updated: scanData.updatedAt
      }
    });

  } catch (error) {
    console.error('Error fetching scan status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get full scan data endpoint - returns complete scan with all pricing
 */
router.get('/api/analyze/:scanId', asyncHandler(async (req, res) => {
  const { scanId } = req.params;

  if (!scanId) {
    return res.status(400).json({
      success: false,
      error: 'scanId parameter required'
    });
  }

  // Verify authentication
  let userId = null;
  try {
    const decodedToken = await verifyAuthFunction(req);
    userId = decodedToken.uid;
  } catch (_authError) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    const scanDoc = await db.collection('users').doc(userId).collection('scans').doc(scanId).get();

    if (!scanDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Scan not found'
      });
    }

    const scanData = scanDoc.data();

    res.json({
      success: true,
      scanId,
      ...scanData,
      isPreliminary: scanData.status === 'preliminary',
      isComplete: scanData.processingStatus === 'complete'
    });

  } catch (error) {
    console.error('Error fetching scan:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

module.exports = { router, injectDependencies };