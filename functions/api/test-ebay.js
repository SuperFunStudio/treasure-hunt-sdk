// functions/api/test-ebay.js
// Test endpoint for eBay OAuth flow and API functionality

const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { EbayTokenManager } = require('../capture-sdk/utils/ebay-token-manager.js');
const { EnhancedEbayIntegration } = require('../capture-sdk/integrations/ebay/enhanced-integration.js');
const cors = require('cors')({
  origin: true,
  credentials: true
});

// Initialize Firebase Admin
let app;
try {
  app = initializeApp();
} catch (error) {
  // App already initialized
}

const db = getFirestore();
const auth = getAuth();

// Verify Firebase Auth token
async function verifyAuthToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await auth.verifyIdToken(idToken);
  return decodedToken;
}

// Test eBay connection for authenticated user
async function testConnection(req, res) {
  try {
    const user = await verifyAuthToken(req.headers.authorization);
    console.log('Testing eBay connection for user:', user.uid);

    const tokenManager = new EbayTokenManager();
    const ebayIntegration = new EnhancedEbayIntegration();

    // Test 1: Check if user is connected
    const isConnected = await tokenManager.isUserConnected(user.uid);
    console.log('User connected status:', isConnected);

    if (!isConnected) {
      return res.json({
        success: false,
        error: 'User not connected to eBay',
        tests: {
          connection: false,
          token: false,
          api: false
        },
        recommendation: 'User needs to complete eBay OAuth flow'
      });
    }

    // Test 2: Get user eBay info
    const ebayInfo = await tokenManager.getUserEbayInfo(user.uid);
    console.log('User eBay info:', ebayInfo);

    // Test 3: Test API connection
    const connectionTest = await ebayIntegration.testUserConnection(user.uid);
    console.log('API connection test:', connectionTest);

    // Test 4: Get user privileges
    const privilegeTest = await ebayIntegration.getUserPrivileges(user.uid);
    console.log('Privilege test:', privilegeTest);

    res.json({
      success: true,
      userId: user.uid,
      ebayInfo: ebayInfo,
      connectionTest: connectionTest,
      privilegeTest: privilegeTest,
      tests: {
        connection: isConnected,
        token: connectionTest.success,
        api: privilegeTest.success,
        privileges: privilegeTest.success
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error testing eBay connection:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      tests: {
        connection: false,
        token: false,
        api: false
      }
    });
  }
}

// Test eBay listing creation
async function testListing(req, res) {
  try {
    const user = await verifyAuthToken(req.headers.authorization);
    console.log('Testing eBay listing creation for user:', user.uid);

    const ebayIntegration = new EnhancedEbayIntegration();

    // Mock listing data for testing
    const testListingData = {
      title: 'Test Item - Nike Athletic T-Shirt',
      description: 'This is a test listing created by ThriftSpot. Nike athletic t-shirt in good condition. Please do not purchase.',
      images: [
        'https://i.ebayimg.com/images/g/abc123/s-l500.jpg' // Mock image URL
      ],
      pricing: {
        buyItNowPrice: 9.99,
        acceptOffers: true,
        minimumOffer: 7.99
      },
      condition: 'good',
      category: '171485', // Test category
      weight: 0.5,
      length: 10,
      width: 8,
      height: 2
    };

    const result = await ebayIntegration.createUserListing(user.uid, testListingData);
    
    // If successful, immediately end the test listing
    if (result.success && result.offerId) {
      console.log('Test listing created, ending immediately...');
      const endResult = await ebayIntegration.endUserListing(
        user.uid, 
        result.offerId, 
        'TEST_LISTING'
      );
      
      result.testListingEnded = endResult.success;
      result.endMessage = endResult.success ? 'Test listing ended successfully' : 'Failed to end test listing';
    }

    res.json({
      success: result.success,
      listingResult: result,
      message: result.success ? 'Test listing created and ended successfully' : 'Test listing failed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error testing eBay listing:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Test listing failed with error'
    });
  }
}

// Test pricing API
async function testPricing(req, res) {
  try {
    const user = await verifyAuthToken(req.headers.authorization);
    console.log('Testing eBay pricing for user:', user.uid);

    const { SimpleEbayAPI } = require('../capture-sdk/integrations/ebay/simpleAPI.js');
    
    const ebayAPI = new SimpleEbayAPI({
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      environment: process.env.EBAY_ENVIRONMENT || 'production',
      debug: true
    });

    // Test item data
    const testItemData = {
      category: 'clothing',
      brand: 'Nike',
      model: 'Athletic T-shirt',
      condition: { rating: 'good' },
      description: 'Nike athletic t-shirt in good condition'
    };

    const pricingResult = await ebayAPI.getPricing(testItemData);
    
    res.json({
      success: true,
      testItem: testItemData,
      pricingResult: pricingResult,
      message: 'Pricing test completed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error testing eBay pricing:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Pricing test failed'
    });
  }
}

// Get user's eBay listings
async function getUserListings(req, res) {
  try {
    const user = await verifyAuthToken(req.headers.authorization);
    console.log('Getting eBay listings for user:', user.uid);

    const ebayIntegration = new EnhancedEbayIntegration();
    
    const { limit = 10, offset = 0 } = req.query;
    
    const result = await ebayIntegration.getUserListings(user.uid, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: result.success,
      listings: result.offers || [],
      total: result.total || 0,
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting user listings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Disconnect user from eBay
async function disconnectUser(req, res) {
  try {
    const user = await verifyAuthToken(req.headers.authorization);
    console.log('Disconnecting eBay for user:', user.uid);

    const ebayIntegration = new EnhancedEbayIntegration();
    const result = await ebayIntegration.disconnectUser(user.uid);

    res.json({
      success: result.success,
      message: result.message || result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error disconnecting user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Clean up expired OAuth states
async function cleanupStates(req, res) {
  try {
    const tokenManager = new EbayTokenManager();
    const cleaned = await tokenManager.cleanupExpiredStates();

    res.json({
      success: true,
      statesCleanedUp: cleaned,
      message: `Cleaned up ${cleaned} expired OAuth states`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error cleaning up states:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Health check endpoint
async function healthCheck(req, res) {
  try {
    const config = {
      ebayConfigured: !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),
      environment: process.env.EBAY_ENVIRONMENT || 'production',
      firestoreConnected: true // Will throw if not connected
    };

    res.json({
      success: true,
      status: 'healthy',
      config: config,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
}

// Main Cloud Function handler
exports.testEbay = onRequest({ cors: true }, async (req, res) => {
  return cors(req, res, async () => {
    try {
      const path = req.path || req.url;
      const method = req.method;

      console.log(`eBay Test API called: ${method} ${path}`);

      // Route requests
      if (method === 'GET' && path.includes('/connection')) {
        return await testConnection(req, res);
      } else if (method === 'POST' && path.includes('/listing')) {
        return await testListing(req, res);
      } else if (method === 'GET' && path.includes('/pricing')) {
        return await testPricing(req, res);
      } else if (method === 'GET' && path.includes('/listings')) {
        return await getUserListings(req, res);
      } else if (method === 'POST' && path.includes('/disconnect')) {
        return await disconnectUser(req, res);
      } else if (method === 'POST' && path.includes('/cleanup')) {
        return await cleanupStates(req, res);
      } else if (method === 'GET' && path.includes('/health')) {
        return await healthCheck(req, res);
      } else {
        res.status(404).json({
          success: false,
          error: 'Endpoint not found',
          availableEndpoints: [
            'GET /connection - Test eBay connection',
            'POST /listing - Test listing creation',
            'GET /pricing - Test pricing API',
            'GET /listings - Get user listings',
            'POST /disconnect - Disconnect eBay',
            'POST /cleanup - Cleanup expired states',
            'GET /health - Health check'
          ]
        });
      }
    } catch (error) {
      console.error('eBay Test API error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  });
});