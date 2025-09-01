// routes/ebay.js
// eBay-specific endpoints

const express = require('express');
const router = express.Router();

const { config } = require('../config/environment');
const { db, admin, serverTimestamp } = require('../config/firebase');

// Import services
const ebayService = require('../services/ebay/ebayService');
const tokenManager = require('../services/ebay/tokenManager');
const policyManager = require('../services/ebay/policyManager');

// Import utilities
const { mapConditionToEbayId, validateCategoryMapping, getFallbackMapping } = require('../ebay-category-mapper');
const { 
  mapConditionToEbay, 
  isValidEbayCondition, 
  formatConditionForEbay, 
  getEbayConditionId 
} = require('../utils/condition-mapper');
const { 
  buildListingXmlWithPolicies, 
  buildListingXmlInline 
} = require('../utils/xml-builder');

/**
 * Dependencies injected from main app
 */
let verifyAuthFunction = null;

function injectDependencies(verifyAuth) {
  verifyAuthFunction = verifyAuth;
}

/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Create eBay listing
 */
router.post('/api/ebay/create-listing', asyncHandler(async (req, res) => {
  try {
    console.log('Creating eBay listing with modular services...');

    const decodedToken = await verifyAuthFunction(req);
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
    
    // Use token manager service
    const accessToken = await tokenManager.getValidEbayToken(userId);

    console.log('Checking policy status...');
    // Use eBay service for policy management
    const policies = await ebayService.fetchAllEbayPolicies(accessToken);

    let policyIds = null;
    let useBusinessPolicies = false;

    if (policies.hasCompletePolicySet) {
      console.log('Using existing business policies');
      policyIds = policies.selected;
      useBusinessPolicies = true;
      // Use policy manager service
      await policyManager.syncPoliciesToFirestore(userId, policies);
    } else {
      console.log('No complete policy set found, will use inline policies');
      await db.collection('users').doc(userId).update({
        'ebay.policies': admin.firestore.FieldValue.delete(),
        'ebay.hasBusinessPolicies': false
      });
    }

    const ebayConfig = {
      clientId: config.EBAY_CLIENT_ID,
      clientSecret: config.EBAY_CLIENT_SECRET,
      environment: config.EBAY_ENVIRONMENT
    };
    const categoryId = await mapCategoryToEbayId(rawListingData.category, ebayConfig);
    console.log('Category mapped:', categoryId);

    let conditionKey = rawListingData.condition;
    if (typeof conditionKey === 'object' && conditionKey !== null) {
      conditionKey = conditionKey.rating || conditionKey.condition || 'good';
    }
    // Use condition mapper utility
    const conditionId = getEbayConditionId(conditionKey);
    console.log('Condition mapped to ID:', conditionId);

    let xmlPayload;
    if (useBusinessPolicies && policyIds) {
      // Use XML builder utility
      xmlPayload = buildListingXmlWithPolicies(
        rawListingData,
        categoryId,
        conditionId,
        defaultLocation,
        policyIds,
        accessToken
      );
    } else {
      // Use XML builder utility
      xmlPayload = buildListingXmlInline(
        rawListingData,
        categoryId,
        conditionId,
        defaultLocation,
        accessToken
      );
    }

    // Use eBay service for Trading API call
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
        throw new Error(`Listing failed: ${errors.filter(e => e.severity === 'Error').map(e => e.shortMessage).join('; ')}`);
      }
    }

    const itemIdMatch = tradingApiResponse.match(/<ItemID>(\d+)<\/ItemID>/);
    const listingId = itemIdMatch ? itemIdMatch[1] : null;

    if (!listingId) {
      throw new Error('Listing creation failed: No ItemID in response');
    }

    const listingUrl = `https://www.ebay.com/itm/${listingId}`;

    // Save to database
    await db.collection('users').doc(userId).collection('scans').doc(scanId).collection('listings').add({
      ebayItemId: listingId,
      title: rawListingData.title,
      price: rawListingData.pricing?.buyItNowPrice || 9.99,
      category: rawListingData.category,
      condition: conditionKey,
      createdAt: serverTimestamp(),
      status: 'active',
      url: listingUrl,
      usedBusinessPolicies: useBusinessPolicies
    });

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

    res.json({
      success: true,
      listingId: listingId,
      url: listingUrl,
      message: 'Listing created successfully!',
      usedBusinessPolicies: useBusinessPolicies,
      sku: scanId 
    });

  } catch (error) {
    console.error('Listing creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

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
    
    // Use condition mapper utilities
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
 * Get eBay policy status
 */
router.get('/api/ebay/sync-policies', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    
    console.log('Starting eBay policy synchronization for user:', userId);
    
    const accessToken = await tokenManager.getValidEbayToken(userId);
    
    // Fetch all existing policies from eBay
    const policies = await ebayService.fetchAllEbayPolicies(accessToken);
    
    // Update Firestore with the current state
    const syncResult = await policyManager.syncPoliciesToFirestore(userId, policies);
    
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
    console.error('Policy sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Ensure complete policy set
 */
router.post('/api/ebay/ensure-policies', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    
    console.log('Ensuring complete policy set for user:', userId);
    
    const policies = await policyManager.ensureUserEbayPolicies(userId);
    
    res.json({
      success: true,
      message: 'Policies ready',
      policies: policies
    });
    
  } catch (error) {
    console.error('Policy creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

module.exports = { router, injectDependencies };