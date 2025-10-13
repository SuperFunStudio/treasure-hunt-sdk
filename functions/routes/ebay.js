// routes/ebay.js
// eBay-specific endpoints with affiliate tracking integration

const express = require('express');
const router = express.Router();
const { config } = require('../config/environment');
const { db, admin, serverTimestamp } = require('../config/firebase');

// Import services
const ebayService = require('../services/ebay/ebayService');
const tokenManager = require('../services/ebay/tokenManager');
const policyManager = require('../services/ebay/policyManager');
const CategoryRequirementsService = require('../services/ebay/categoryRequirementsService');

// Import affiliate and subscription services
const affiliateService = require('../services/affiliate/affiliateService');
const subscriptionService = require('../services/subscription/subscriptionService');

// Import utilities
const { itemSpecificsValidator } = require('../utils/item-specifics-validator');
const { categoryDetector } = require('../utils/category-detector');
const { mapCategoryToEbayId, validateCategoryMapping, getFallbackMapping } = require('../utils/ebay-category-mapper');
const { 
  buildListingXmlWithPolicies, 
  buildListingXmlInline 
} = require('../utils/xml-builder');
const { convertScanImagesToUrls } = require('../utils/firebase-storage-helper');
const { ERROR_CODES } = require('../config/constants');

// Async handler utility
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Dependencies injected from main app
let verifyAuthFunction = null;

function injectDependencies(verifyAuth) {
  verifyAuthFunction = verifyAuth;
}

// ========== WORKING CONDITION MAPPING ==========

/**
 * Get eBay numeric condition ID for Trading API
 */
function getEbayConditionId(condition) {
  const normalizedCondition = condition?.toLowerCase()?.trim();

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
    'acceptable': 3000,
    'used_acceptable': 3000,
    'used acceptable': 3000,
    'fair': 3000,
    'poor': 7000,
    'for_parts': 7000,
    'for parts': 7000,
    'broken': 7000,
    'damaged': 7000,
    'not_working': 7000,
    'not working': 7000,
    'for_parts_or_not_working': 7000,
  };

  return conditionIdMap[normalizedCondition] || 3000;
}

// ========== XML UTILITY FUNCTIONS ==========

/**
 * Validate XML structure
 */
function validateXmlStructure(xml) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check for basic XML structure
  if (!xml.includes('<AddItemRequest')) {
    validation.errors.push('Missing AddItemRequest root element');
    validation.isValid = false;
  }

  if (!xml.includes('<Item>')) {
    validation.errors.push('Missing Item element');
    validation.isValid = false;
  }

  // Check for required fields
  const requiredFields = ['Title', 'CategoryID', 'ConditionID', 'StartPrice'];
  requiredFields.forEach(field => {
    if (!xml.includes(`<${field}>`)) {
      validation.errors.push(`Missing required field: ${field}`);
      validation.isValid = false;
    }
  });

  // Check for potential issues
  if (xml.includes('<![CDATA[') && !xml.includes(']]>')) {
    validation.warnings.push('Unclosed CDATA section detected');
  }

  return validation;
}

/**
 * Sanitize XML for debug output
 */
function sanitizeXmlForDebug(xml) {
  return xml
    .replace(/<RequesterCredentials>[\s\S]*?<\/RequesterCredentials>/g, 
             '<RequesterCredentials>[REDACTED]</RequesterCredentials>')
    .replace(/eBayAuthToken>[^<]+</g, 'eBayAuthToken>[REDACTED]<');
}

// ========== QUOTA AND SUBSCRIPTION ENDPOINTS ==========

/**
 * Get user's listing quota status
 */
router.get('/api/ebay/quota-status', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;

    const quotaCheck = await subscriptionService.checkListingQuota(userId);
    const rateCheck = await subscriptionService.checkRateLimit(userId);
    const subscription = await subscriptionService.getUserSubscription(userId);

    res.json({
      success: true,
      quota: quotaCheck,
      rateLimit: rateCheck,
      subscription: {
        tier: subscription.tier,
        tierConfig: subscription.tierConfig
      },
      upgradeOptions: subscription.tier === 'free' ? 
        subscriptionService.getAvailableTiers().filter(t => t.id !== 'free') : []
    });

  } catch (error) {
    console.error('Failed to get quota status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      errorType: 'QUOTA_STATUS_ERROR'
    });
  }
}));

/**
 * Get user's commission report
 */
router.get('/api/ebay/commission-report', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    
    const { startDate, endDate } = req.query;
    
    const startDateObj = startDate ? new Date(startDate) : null;
    const endDateObj = endDate ? new Date(endDate) : null;

    const report = await affiliateService.getUserCommissionReport(userId, startDateObj, endDateObj);
    const usageStats = await subscriptionService.getUsageStats(userId);

    res.json({
      success: true,
      ...report,
      usage: usageStats
    });

  } catch (error) {
    console.error('Failed to get commission report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get tracking status for a listing
 */
router.get('/api/ebay/tracking-status/:customId', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { customId } = req.params;

    const trackingStatus = await affiliateService.getTrackingStatus(customId);
    
    if (!trackingStatus) {
      return res.status(404).json({
        success: false,
        error: 'Tracking record not found'
      });
    }

    // Verify tracking belongs to user
    if (trackingStatus.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      tracking: trackingStatus
    });

  } catch (error) {
    console.error('Failed to get tracking status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get user's listing history with tracking info
 */
router.get('/api/ebay/listing-history', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    
    const { limit = 20, offset = 0, status = 'all' } = req.query;

    // Get all scans for the user
    const scansRef = db.collection('users').doc(userId).collection('scans');
    let scansQuery = scansRef.orderBy('createdAt', 'desc');
    
    if (limit) {
      scansQuery = scansQuery.limit(parseInt(limit));
    }
    
    if (offset) {
      scansQuery = scansQuery.offset(parseInt(offset));
    }

    const scansSnapshot = await scansQuery.get();
    const listings = [];

    // Get listings for each scan
    for (const scanDoc of scansSnapshot.docs) {
      const scanData = scanDoc.data();
      const listingsRef = scanDoc.ref.collection('listings');
      
      let listingsQuery = listingsRef.orderBy('createdAt', 'desc');
      
      if (status !== 'all') {
        listingsQuery = listingsQuery.where('status', '==', status);
      }

      const listingsSnapshot = await listingsQuery.get();
      
      for (const listingDoc of listingsSnapshot.docs) {
        const listingData = listingDoc.data();
        
        // Get tracking info if available
        let trackingInfo = null;
        if (listingData.customId) {
          try {
            trackingInfo = await affiliateService.getTrackingStatus(listingData.customId);
          } catch (error) {
            console.warn(`Failed to get tracking for ${listingData.customId}:`, error.message);
          }
        }

        listings.push({
          id: listingDoc.id,
          scanId: scanDoc.id,
          ...listingData,
          scanData: {
            title: scanData.title || 'Untitled Scan',
            createdAt: scanData.createdAt,
            category: scanData.category
          },
          tracking: trackingInfo
        });
      }
    }

    // Sort all listings by creation date
    listings.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    res.json({
      success: true,
      listings: listings,
      total: listings.length,
      hasMore: listings.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Failed to get listing history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Update tracking URL for existing listing
 */
router.put('/api/ebay/update-tracking/:listingId', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { listingId } = req.params;
    const { ebayItemId, scanId } = req.body;

    if (!ebayItemId || !scanId) {
      return res.status(400).json({
        success: false,
        error: 'ebayItemId and scanId are required'
      });
    }

    // Find the listing document
    const listingRef = db.collection('users').doc(userId)
      .collection('scans').doc(scanId)
      .collection('listings').doc(listingId);
    
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    const listingData = listingDoc.data();
    let customId = listingData.customId;

    // Initialize tracking if it doesn't exist
    if (!customId) {
      const userSubscription = await subscriptionService.getUserSubscription(userId);
      customId = await affiliateService.initializeTracking(
        userId,
        scanId,
        listingData,
        userSubscription.tier
      );
    }

    // Update tracking with eBay item ID
    const trackingInfo = await affiliateService.updateTrackingWithListing(
      customId,
      ebayItemId,
      listingData.price || 0
    );

    // Update the listing document
    await listingRef.update({
      customId: customId,
      trackingUrl: trackingInfo.trackingUrl,
      estimatedCommission: trackingInfo.estimatedCommission,
      updatedAt: serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Tracking updated successfully',
      tracking: {
        customId: trackingInfo.customId,
        trackingUrl: trackingInfo.trackingUrl,
        estimatedCommission: trackingInfo.estimatedCommission
      }
    });

  } catch (error) {
    console.error('Failed to update tracking:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get affiliate analytics dashboard data
 */
router.get('/api/ebay/affiliate-analytics', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    
    const { period = '30d' } = req.query;

    // Calculate date range based on period
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get commission report
    const commissionReport = await affiliateService.getUserCommissionReport(userId, startDate, new Date());
    
    // Get usage stats
    const usageStats = await subscriptionService.getUsageStats(userId);
    
    // Get subscription info
    const subscription = await subscriptionService.getUserSubscription(userId);

    // Calculate analytics
    const analytics = {
      period: period,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      
      // Commission data
      totalCommissions: commissionReport.totalCommissions || 0,
      pendingCommissions: commissionReport.pendingCommissions || 0,
      completedCommissions: commissionReport.completedCommissions || 0,
      
      // Click and conversion data
      totalClicks: commissionReport.totalClicks || 0,
      totalConversions: commissionReport.totalConversions || 0,
      conversionRate: commissionReport.totalClicks > 0 ? 
        (commissionReport.totalConversions / commissionReport.totalClicks * 100).toFixed(2) : 0,
      
      // Usage data
      listingsCreated: usageStats.monthlyListings || 0,
      quotaUsed: usageStats.quotaUsed || 0,
      quotaLimit: usageStats.quotaLimit || 0,
      quotaPercentage: usageStats.quotaLimit > 0 ? 
        (usageStats.quotaUsed / usageStats.quotaLimit * 100).toFixed(1) : 0,
      
      // Subscription info
      subscription: {
        tier: subscription.tier,
        commissionRate: affiliateService.getCommissionRate(subscription.tier),
        monthlyListings: subscription.tierConfig.monthlyListings,
        features: subscription.tierConfig.features
      },
      
      // Recent transactions
      recentTransactions: commissionReport.transactions?.slice(0, 10) || []
    };

    res.json({
      success: true,
      analytics: analytics
    });

  } catch (error) {
    console.error('Failed to get affiliate analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Test affiliate service functionality
 */
router.post('/api/ebay/test-affiliate', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    
    const { testType = 'basic' } = req.body;

    let testResults = {};

    switch (testType) {
      case 'basic':
        // Test basic affiliate service functionality
        try {
          const subscription = await subscriptionService.getUserSubscription(userId);
          const commissionRate = affiliateService.getCommissionRate(subscription.tier);
          
          testResults = {
            subscriptionCheck: 'passed',
            subscription: subscription,
            commissionRate: commissionRate,
            affiliateServiceAvailable: true
          };
        } catch (error) {
          testResults = {
            subscriptionCheck: 'failed',
            error: error.message,
            affiliateServiceAvailable: false
          };
        }
        break;

      case 'tracking':
        // Test tracking initialization
        try {
          const mockListingData = {
            title: 'Test Item',
            pricing: { buyItNowPrice: 25.00 },
            category: 'Electronics'
          };
          
          const subscription = await subscriptionService.getUserSubscription(userId);
          const customId = await affiliateService.initializeTracking(
            userId,
            'test-scan-id',
            mockListingData,
            subscription.tier
          );
          
          testResults = {
            trackingInit: 'passed',
            customId: customId,
            mockListing: mockListingData
          };
        } catch (error) {
          testResults = {
            trackingInit: 'failed',
            error: error.message
          };
        }
        break;

      case 'quota':
        // Test quota and rate limiting
        try {
          const quotaCheck = await subscriptionService.checkListingQuota(userId);
          const rateCheck = await subscriptionService.checkRateLimit(userId);
          
          testResults = {
            quotaCheck: 'passed',
            quota: quotaCheck,
            rateLimit: rateCheck
          };
        } catch (error) {
          testResults = {
            quotaCheck: 'failed',
            error: error.message
          };
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid test type. Use: basic, tracking, or quota'
        });
    }

    res.json({
      success: true,
      testType: testType,
      results: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Affiliate test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      testType: req.body.testType
    });
  }
}));

/**
 * Get available subscription tiers and upgrade options
 */
router.get('/api/ebay/subscription-tiers', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;

    const currentSubscription = await subscriptionService.getUserSubscription(userId);
    const availableTiers = subscriptionService.getAvailableTiers();
    
    // Calculate what user would get with each tier
    const tierComparison = availableTiers.map(tier => {
      const commissionRate = affiliateService.getCommissionRate(tier.id);
      
      return {
        ...tier,
        commissionRate: commissionRate,
        isCurrent: tier.id === currentSubscription.tier,
        monthlyListingIncrease: tier.monthlyListings - currentSubscription.tierConfig.monthlyListings,
        commissionIncrease: commissionRate - affiliateService.getCommissionRate(currentSubscription.tier)
      };
    });

    res.json({
      success: true,
      currentTier: currentSubscription.tier,
      tiers: tierComparison,
      canUpgrade: currentSubscription.tier !== 'premium'
    });

  } catch (error) {
    console.error('Failed to get subscription tiers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Webhook endpoint for eBay notifications (future implementation)
 */
router.post('/api/ebay/webhook', asyncHandler(async (req, res) => {
  try {
    // TODO: Implement eBay webhook handling for:
    // - Item sold notifications
    // - Price changes
    // - Listing status updates
    // - Commission tracking updates
    
    console.log('eBay webhook received:', {
      headers: req.headers,
      body: req.body
    });

    // For now, just acknowledge receipt
    res.json({
      success: true,
      message: 'Webhook received',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ========== MAIN LISTING CREATION WITH AFFILIATE TRACKING ==========

/**
 * Create eBay listing with affiliate tracking integration
 */
router.post('/api/ebay/create-listing', asyncHandler(async (req, res) => {
  try {
    console.log('Creating eBay listing with affiliate tracking...');

    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const rawListingData = req.body;
    const scanId = rawListingData.scanId;

    if (!scanId) {
      throw new Error('Missing scanId in listing data');
    }

    if (!rawListingData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing listing data',
        errorCode: ERROR_CODES.VALIDATION_ERROR
      });
    }

    // Check subscription quota and rate limits
    const quotaCheck = await subscriptionService.checkListingQuota(userId);
    if (!quotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Monthly listing limit reached (${quotaCheck.used}/${quotaCheck.limit})`,
        errorCode: ERROR_CODES.QUOTA_EXCEEDED,
        quota: quotaCheck,
        upgradeRequired: true,
        upgradeOptions: subscriptionService.getAvailableTiers().filter(t => t.monthlyListings > quotaCheck.limit)
      });
    }

    const rateCheck = await subscriptionService.checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded (${rateCheck.used}/${rateCheck.limit} per hour)`,
        errorCode: ERROR_CODES.QUOTA_EXCEEDED,
        rateLimit: rateCheck
      });
    }

    // Get user subscription for commission calculation
    const userSubscription = await subscriptionService.getUserSubscription(userId);
    console.log(`User ${userId} subscription: ${userSubscription.tier}`);

    // STEP 1: Enhanced validation and enhancement
    console.log('Step 1: Validating and enhancing listing data...');
    const validationResult = itemSpecificsValidator.validateAndEnhanceListing(rawListingData);
    
    if (!validationResult.isValid) {
      console.error('Listing validation failed:', validationResult.errors);
      return res.status(400).json({
        success: false,
        error: 'Listing validation failed',
        details: validationResult.errors,
        warnings: validationResult.warnings,
        category: {
          original: rawListingData.category,
          detected: validationResult.detectedCategory,
          resolved: validationResult.category
        }
      });
    }

    const enhancedListingData = validationResult.enhancedListingData;

    // STEP 2: User and location validation
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
    const accessToken = await tokenManager.getValidEbayToken(userId);

    // Initialize affiliate tracking before listing creation
    let customId = null;
    try {
      customId = await affiliateService.initializeTracking(
        userId, 
        scanId, 
        enhancedListingData, 
        userSubscription.tier
      );
      console.log(`Affiliate tracking initialized: ${customId}`);
    } catch (error) {
      console.warn('Failed to initialize affiliate tracking:', error.message);
      // Continue with listing creation even if tracking fails
    }

    // STEP 3: Policy management
    console.log('Step 3: Checking policy status...');
    const policies = await ebayService.fetchAllEbayPolicies(accessToken);

    let policyIds = null;
    let useBusinessPolicies = false;

    if (policies.hasCompletePolicySet) {
      console.log('Using existing business policies');
      policyIds = policies.selected;
      useBusinessPolicies = true;
      await policyManager.syncPoliciesToFirestore(userId, policies);
    } else {
      console.log('No complete policy set found, will use inline policies');
      await db.collection('users').doc(userId).update({
        'ebay.policies': admin.firestore.FieldValue.delete(),
        'ebay.hasBusinessPolicies': false
      });
    }

    // STEP 4: Enhanced category mapping
    console.log('Step 4: Enhanced category mapping...');
    const ebayConfig = {
      clientId: config.EBAY_CLIENT_ID,
      clientSecret: config.EBAY_CLIENT_SECRET,
      environment: config.EBAY_ENVIRONMENT
    };

    const categoryId = await mapCategoryToEbayId(validationResult.category, ebayConfig);
    console.log('Category mapped:', {
      input: validationResult.category,
      ebayId: categoryId,
      originalInput: rawListingData.category
    });

    // STEP 5: Category requirements
    console.log('Step 5: Fetching enhanced category requirements...');
    let categoryRequirements = null;
    
    try {
      const categoryService = new CategoryRequirementsService(db, admin);
      categoryRequirements = await categoryService.getCategoryRequirements(
        categoryId, 
        accessToken
      );
      
      console.log('Category requirements fetched:', {
        success: categoryRequirements.success,
        requiredAspects: categoryRequirements.requiredAspects?.length || 0,
        optionalAspects: categoryRequirements.optionalAspects?.length || 0,
        source: categoryRequirements.source
      });
      
    } catch (reqError) {
      console.warn('Failed to fetch category requirements:', reqError.message);
      categoryRequirements = null;
    }

    // STEP 6: Condition mapping
    let conditionKey = enhancedListingData.condition || rawListingData.condition;
    if (typeof conditionKey === 'object' && conditionKey !== null) {
      conditionKey = conditionKey.rating || conditionKey.condition || 'good';
    }
    const conditionId = getEbayConditionId(conditionKey);
    console.log('Condition mapped to ID:', conditionId, 'from input:', conditionKey);

    // STEP 7: Image URL conversion
    console.log('Step 7: Converting scan images to public URLs...');
    
    let imageUrls = [];
    
    if (enhancedListingData.scanId || scanId) {
      try {
        const actualScanId = enhancedListingData.scanId || scanId;
        const scanDoc = await db.collection('users').doc(userId).collection('scans').doc(actualScanId).get();
        
        if (!scanDoc.exists) {
          throw new Error(`Scan document not found: ${actualScanId}`);
        }
        
        const scanData = scanDoc.data();
        console.log('Scan data keys:', Object.keys(scanData));
        console.log('Image paths in scan:', scanData.imagePaths?.length || 0);
        
        imageUrls = await convertScanImagesToUrls(scanData);
        
        if (imageUrls.length === 0) {
          console.warn('No images found or converted from scan data');
          if (enhancedListingData.images && Array.isArray(enhancedListingData.images)) {
            imageUrls = enhancedListingData.images.filter(url => url && url.startsWith('http'));
            console.log('Using images from enhanced listing data:', imageUrls.length);
          }
        }
        
        console.log(`Successfully converted ${imageUrls.length} images to public URLs`);
        
      } catch (error) {
        console.error('Failed to get scan images:', error.message);
        
        if (enhancedListingData.images && Array.isArray(enhancedListingData.images)) {
          imageUrls = enhancedListingData.images.filter(url => url && url.startsWith('http'));
          console.log('Using fallback images from enhanced listing data:', imageUrls.length);
        } else {
          throw new Error('No images available for listing: ' + error.message);
        }
      }
    }
    
    if (imageUrls.length === 0) {
      throw new Error('At least one image is required for eBay listing');
    }
    
    enhancedListingData.images = imageUrls;
    console.log('Final image URLs for eBay:', imageUrls.length);

    // STEP 8: XML generation
    console.log('Step 8: Generating enhanced XML with requirements...');
    let xmlPayload;
    
    if (useBusinessPolicies && policyIds) {
      xmlPayload = buildListingXmlWithPolicies(
        enhancedListingData,
        categoryId,
        conditionId,
        defaultLocation,
        policyIds,
        accessToken,
        categoryRequirements
      );
    } else {
      xmlPayload = buildListingXmlInline(
        enhancedListingData,
        categoryId,
        conditionId,
        defaultLocation,
        accessToken,
        categoryRequirements
      );
    }

    console.log('Enhanced XML payload length:', xmlPayload.length);

    // STEP 9: Submit to eBay Trading API
    console.log('Step 9: Submitting to eBay Trading API...');
    const tradingApiResponse = await ebayService.callTradingAPI(accessToken, 'AddItem', xmlPayload);
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
        console.error('Enhanced listing data:', enhancedListingData);
        console.error('Validation result:', {
          category: validationResult.category,
          enhancements: validationResult.enhancements,
          warnings: validationResult.warnings
        });
        
        throw new Error(`Listing failed: ${errors.filter(e => e.severity === 'Error').map(e => e.shortMessage).join('; ')}`);
      }
    }

    // STEP 10: Success processing
    const itemIdMatch = tradingApiResponse.match(/<ItemID>(\d+)<\/ItemID>/);
    const listingId = itemIdMatch ? itemIdMatch[1] : null;

    if (!listingId) {
      throw new Error('Listing creation failed: No ItemID in response');
    }

    const listingUrl = `https://www.ebay.com/itm/${listingId}`;

    // Update affiliate tracking with eBay item ID
    let trackingInfo = null;
    if (customId) {
      try {
        trackingInfo = await affiliateService.updateTrackingWithListing(
          customId,
          listingId,
          enhancedListingData.pricing?.buyItNowPrice || 0
        );
        console.log(`Tracking URL generated: ${trackingInfo.trackingUrl}`);
      } catch (error) {
        console.warn('Failed to update affiliate tracking:', error.message);
      }
    }

    // Enhanced database save
    const listingData = {
      ebayItemId: listingId,
      title: enhancedListingData.title,
      price: enhancedListingData.pricing?.buyItNowPrice || 9.99,
      category: validationResult.category,
      originalCategory: rawListingData.category,
      detectedCategory: validationResult.detectedCategory,
      condition: conditionKey,
      imageUrls: imageUrls,
      enhancements: validationResult.enhancements,
      validationWarnings: validationResult.warnings,
      createdAt: serverTimestamp(),
      status: 'active',
      url: listingUrl,
      usedBusinessPolicies: useBusinessPolicies,
      sku: scanId,
      
      // New tracking fields
      customId: customId,
      trackingUrl: trackingInfo?.trackingUrl || null,
      subscriptionTier: userSubscription.tier,
      estimatedCommission: trackingInfo?.estimatedCommission || 0,
      taxonomyUsed: !!categoryRequirements?.success,
      enhancedValidation: true
    };

    await db.collection('users').doc(userId).collection('scans').doc(scanId).collection('listings').add(listingData);

    // Update user stats
    await db.runTransaction(async (t) => {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await t.get(userRef);
      
      if (userDoc.exists) {
        const currentListings = userDoc.data().stats?.totalListings || 0;
        t.update(userRef, {
          'stats.totalListings': currentListings + 1,
          'stats.lastListingDate': serverTimestamp(),
          'metadata.updatedAt': serverTimestamp()
        });
      } else {
        t.set(userRef, {
          stats: {
            totalListings: 1,
            lastListingDate: serverTimestamp(),
          },
          metadata: {
            updatedAt: serverTimestamp()
          }
        }, { merge: true });
      }
    });

    // Enhanced response with tracking and quota info
    const response = {
      success: true,
      listingId: listingId,
      url: listingUrl,
      message: 'Listing created successfully with affiliate tracking!',
      usedBusinessPolicies: useBusinessPolicies,
      conditionId: conditionId,
      categoryId: categoryId,
      imageCount: imageUrls.length,
      taxonomyApiUsed: !!categoryRequirements?.success,
      requiredAspectsFound: categoryRequirements?.requiredAspects?.length || 0,
      
      // Tracking information
      tracking: trackingInfo ? {
        customId: trackingInfo.customId,
        trackingUrl: trackingInfo.trackingUrl,
        estimatedCommission: trackingInfo.estimatedCommission,
        commissionRate: affiliateService.getCommissionRate(userSubscription.tier)
      } : null,
      
      // Updated quota information
      quota: {
        remaining: quotaCheck.remaining - 1,
        used: quotaCheck.used + 1,
        limit: quotaCheck.limit,
        resetDate: quotaCheck.resetDate,
        tier: userSubscription.tier
      },
      
      // Subscription information
      subscription: {
        tier: userSubscription.tier,
        upgradeAvailable: userSubscription.tier === 'free' && quotaCheck.remaining <= 5
      },
      
      // Enhancement details
      enhancement: {
        categoryDetection: {
          original: rawListingData.category,
          detected: validationResult.detectedCategory,
          final: validationResult.category
        },
        appliedEnhancements: Object.keys(validationResult.enhancements),
        enhancementValues: validationResult.enhancements,
        warnings: validationResult.warnings,
        validationPassed: validationResult.isValid
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Enhanced listing creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: error.message.includes('QUOTA_EXCEEDED') ? ERROR_CODES.QUOTA_EXCEEDED : 'LISTING_CREATION_FAILED',
      timestamp: new Date().toISOString(),
      enhancedValidationUsed: true
    });
  }
}));

// ========== EXISTING ENDPOINTS ==========

/**
 * Test condition mapping
 */
router.post('/api/ebay/test-condition', asyncHandler(async (req, res) => {
  try {
    const { condition } = req.body;
    
    if (!condition) {
      return res.status(400).json({ 
        success: false, 
        error: 'Condition parameter required',
        errorType: 'VALIDATION_ERROR'
      });
    }
    
    const conditionId = getEbayConditionId(condition);
    
    res.json({
      success: true,
      input: condition,
      conditionId: conditionId,
      isValid: conditionId > 0,
      timestamp: new Date().toISOString(),
      debug: {
        inputType: typeof condition,
        normalizedInput: condition?.toLowerCase()?.trim(),
        outputType: typeof conditionId
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

/**
 * Get eBay account info
 */
router.get('/api/ebay/account-info', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;

    console.log('Getting eBay account info for user:', userId);

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userData = userDoc.data();
    const ebayData = userData.ebay;

    if (!ebayData?.isConnected) {
      return res.status(400).json({ 
        success: false, 
        error: 'eBay account not connected', 
        connected: false 
      });
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
    console.error('Error getting eBay account info:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error: ' + error.message 
    });
  }
}));

/**
 * Get category requirements
 */
router.get('/api/ebay/category-requirements/:categoryId', asyncHandler(async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const response = await fetch(`https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Taxonomy API error: ${response.status}`);
    }
    
    const aspectData = await response.json();
    
    const requiredAspects = aspectData.aspects?.filter(aspect => 
      aspect.aspectConstraint?.aspectRequired === true
    ) || [];
    
    res.json({
      success: true,
      categoryId: categoryId,
      requiredAspects: requiredAspects.map(aspect => ({
        name: aspect.localizedAspectName,
        required: true,
        values: aspect.aspectValues?.map(v => v.localizedValue) || []
      })),
      totalAspects: aspectData.aspects?.length || 0
    });
    
  } catch (error) {
    console.error('Error fetching category requirements:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}));

/**
 * Debug XML generation
 */
router.post('/api/ebay/debug-xml', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const rawListingData = req.body;

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
    const accessToken = await tokenManager.getValidEbayToken(userId);

    const ebayConfig = {
      clientId: config.EBAY_CLIENT_ID,
      clientSecret: config.EBAY_CLIENT_SECRET,
      environment: config.EBAY_ENVIRONMENT
    };
    const categoryId = await mapCategoryToEbayId(rawListingData.category, ebayConfig);

    let conditionKey = rawListingData.condition;
    if (typeof conditionKey === 'object' && conditionKey !== null) {
      conditionKey = conditionKey.rating || conditionKey.condition || 'good';
    }
    const conditionId = getEbayConditionId(conditionKey);

    const policies = await ebayService.fetchAllEbayPolicies(accessToken);
    let useBusinessPolicies = false;
    let policyIds = null;

    if (policies.hasCompletePolicySet) {
      useBusinessPolicies = true;
      policyIds = policies.selected;
    }

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

    // Validate XML structure
    const xmlValidation = validateXmlStructure(xmlPayload);
    
    // Sanitize XML for response (remove sensitive tokens)
    const sanitizedXml = sanitizeXmlForDebug(xmlPayload);

    res.json({
      success: true,
      xmlPayload: sanitizedXml,
      xmlValidation: xmlValidation,
      debug: {
        categoryId: categoryId,
        conditionId: conditionId,
        conditionInput: rawListingData.condition,
        useBusinessPolicies: useBusinessPolicies,
        policyIds: policyIds,
        defaultLocation: {
          city: defaultLocation.city,
          state: defaultLocation.state,
          country: defaultLocation.country,
          postalCode: defaultLocation.postalCode
        },
        xmlLength: xmlPayload.length,
        xmlLineCount: xmlPayload.split('\n').length,
        hasImages: !!(rawListingData.images && rawListingData.images.length > 0),
        imageCount: rawListingData.images ? rawListingData.images.length : 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Debug XML endpoint error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.uid || 'unknown',
      timestamp: new Date().toISOString()
    });

    // Return appropriate error response based on error type
    if (error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: 'eBay authentication failed',
        details: 'Token validation failed or expired'
      });
    }

    if (error.message.includes('category')) {
      return res.status(400).json({
        success: false,
        error: 'Category mapping failed',
        details: error.message
      });
    }

    if (error.message.includes('condition')) {
      return res.status(400).json({
        success: false,
        error: 'Condition mapping failed',
        details: error.message
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: 'Internal server error during XML generation',
      details: config.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
}));

// ========== EXPORT ROUTER AND DEPENDENCY INJECTION ==========

module.exports = { 
  router, 
  injectDependencies 
};