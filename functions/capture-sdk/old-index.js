// functions/index.js
const {onRequest} = require('firebase-functions/v2/https');
const {setGlobalOptions} = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const functions = require('firebase-functions');
const busboy = require('busboy');

// Load environment variables first
dotenv.config();

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Mock SDK for now since ES modules don't work well in Firebase Functions
// TODO: Convert capture-sdk to CommonJS or use dynamic imports
const mockSDK = {
  async analyzeItem(images) {
    console.log('Mock analyzeItem called with', images.length, 'images');
    return {
      category: 'Electronics',
      brand: 'Unknown',
      condition: 'Good',
      confidence: 8,
      estimatedValue: 25.00
    };
  },
  async getRoutes(itemData) {
    console.log('Mock getRoutes called');
    return [
      { type: 'ebay', netProfit: 20.00, confidence: 'high' },
      { type: 'local', pickup: true, confidence: 'medium' }
    ];
  },
  async generateListing(item, platform) {
    console.log('Mock generateListing called');
    return {
      title: `${item.brand} ${item.category}`,
      description: 'Test listing description',
      price: item.estimatedValue
    };
  },
  async dropPin(pinData) {
    console.log('Mock dropPin called');
    return { pinId: 'mock-pin-123', ...pinData };
  },
  async getNearbyPins(location) {
    console.log('Mock getNearbyPins called');
    return [];
  }
};

// Get configuration from Firebase Functions config OR fallback to .env
const config = functions.config();

console.log('🔧 Configuration Debug:');
console.log('OpenAI Key source:', config.openai?.api_key ? 'Firebase Config' : 'Local .env');
console.log('OpenAI Key present:', !!(config.openai?.api_key || process.env.OPENAI_API_KEY));

// Global options for all functions
setGlobalOptions({maxInstances: 10});

// eBay Webhook Configuration
const VERIFICATION_TOKEN = 'treasurehunter-sdk-1753755107391-zfgw1dyhl';
const ENDPOINT_URL = 'https://ebaynotifications-beprv7ll2q-uc.a.run.app';

/**
 * eBay Marketplace Account Deletion Notification Handler
 */
exports.ebayNotifications = onRequest(
  {
    cors: true,
    invoker: 'public'
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-eBay-Signature');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method === 'GET') {
      return handleChallengeVerification(req, res);
    }

    if (req.method === 'POST') {
      return handleAccountDeletionNotification(req, res);
    }

    res.status(405).json({ error: 'Method not allowed' });
  }
);

function handleChallengeVerification(req, res) {
  const challengeCode = req.query.challenge_code;
  if (!challengeCode) {
    console.error('Missing challenge_code parameter');
    res.status(400).json({ error: 'Missing challenge_code parameter' });
    return;
  }

  try {
    const hash = crypto.createHash('sha256');
    hash.update(challengeCode);
    hash.update(VERIFICATION_TOKEN);
    hash.update(ENDPOINT_URL);
    const responseHash = hash.digest('hex');

    console.log('eBay challenge verification successful:', {
      challengeCode: challengeCode,
      responseHashPreview: responseHash.substring(0, 10) + '...',
      timestamp: new Date().toISOString()
    });

    res.set('Content-Type', 'application/json');
    res.status(200).json({
      challengeResponse: responseHash
    });

  } catch (error) {
    console.error('Challenge verification failed:', error);
    res.status(500).json({ error: 'Challenge verification failed' });
  }
}

async function handleAccountDeletionNotification(req, res) {
  try {
    const notification = req.body;
    const notificationId = notification.notification?.notificationId || 'unknown';

    res.status(200).json({
      status: 'received',
      timestamp: new Date().toISOString(),
      notificationId: notificationId
    });

    const notificationData = notification.notification?.data || null;

    if (notificationData) {
      console.log('Received eBay account deletion notification:', {
        notificationId: notificationId,
        username: notificationData.username || 'unknown',
        userId: notificationData.userId || 'unknown',
        eventDate: notification.notification.eventDate || 'unknown',
        publishDate: notification.notification.publishDate || 'unknown',
        publishAttemptCount: notification.notification.publishAttemptCount || 0
      });
      await processAccountDeletion(notificationData);
    }
    await storeNotificationForAudit(notification);

  } catch (error) {
    console.error('Error processing eBay notification:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
}

async function processAccountDeletion(userData) {
  const username = userData.username || 'unknown';
  const userId = userData.userId || 'unknown';

  console.log('Processing account deletion for eBay user: ' + username + ' (' + userId + ')');

  try {
    const batch = db.batch();

    // Delete user profile if stored
    const userRef = db.collection('users').where('ebayUserId', '==', userId);
    const userSnapshot = await userRef.get();
    userSnapshot.docs.forEach(doc => {
      console.log('Deleting user document: ' + doc.id);
      batch.delete(doc.ref);
    });

    // Delete user's items/listings
    const itemsRef = db.collection('items').where('ebayUserId', '==', userId);
    const itemsSnapshot = await itemsRef.get();
    itemsSnapshot.docs.forEach(doc => {
      console.log('Deleting item document: ' + doc.id);
      batch.delete(doc.ref);
    });

    // Delete user's pins/locations if they're tied to eBay user
    const pinsRef = db.collection('pins').where('ebayUserId', '==', userId);
    const pinsSnapshot = await pinsRef.get();
    pinsSnapshot.docs.forEach(doc => {
      console.log('Deleting pin document: ' + doc.id);
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log('Successfully deleted all data for eBay user ' + userId);

  } catch (error) {
    console.error('Error deleting data for user ' + userId + ':', error);
    await db.collection('deletion_errors').add({
      userId: userId,
      username: username,
      error: error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false
    });
  }
}

async function storeNotificationForAudit(notification) {
  try {
    const notificationObj = notification.notification || {};
    await db.collection('ebay_deletion_notifications').add({
      notificationId: notificationObj.notificationId || 'unknown',
      eventDate: notificationObj.eventDate || null,
      publishDate: notificationObj.publishDate || null,
      userData: notificationObj.data || null,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processed'
    });
  } catch (error) {
    console.error('Error storing notification for audit:', error);
  }
}

/**
 * Health check endpoint
 */
exports.health = onRequest(
  {
    cors: true,
    invoker: 'public'
  },
  (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Treasure Hunt SDK - Functions',
      version: '1.0.0',
      config: {
        verificationToken: 'configured',
        endpointUrl: ENDPOINT_URL
      }
    });
  }
);

/**
 * Test endpoint for development
 */
exports.testEbayEndpoint = onRequest(
  {
    cors: true,
    invoker: 'public'
  },
  (req, res) => {
    res.status(200).json({
      message: 'eBay notification endpoint is ready',
      verificationToken: 'configured',
      endpointUrl: ENDPOINT_URL,
      timestamp: new Date().toISOString()
    });
  }
);

//
// Express App for API endpoints
//

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Treasure Hunter SDK API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// eBay OAuth Success Handler
app.get('/success', async (req, res) => {
  const code = req.query.code;
  const uid = req.query.state || req.query.uid || 'demo-user';
  
  if (!code) {
    return res.status(400).send('Missing code parameter from eBay');
  }

  try {
    // TODO: Implement real eBay token exchange
    console.log('Mock eBay authentication for user:', uid);
    
    res.json({
      success: true,
      message: "eBay authentication successful (mock)!",
      uid: uid
    });
  } catch (err) {
    console.error('eBay token exchange failed:', err);
    res.status(500).send('eBay token exchange failed: ' + err.message);
  }
});

// Image Analysis API (Multiple Images with Busboy)
app.post('/api/analyze', async (req, res) => {
  try {
    console.log('Request received, content-type:', req.get('content-type'));
    
    const files = [];
    const bb = busboy({ headers: req.headers });
    
    bb.on('file', (name, file, info) => {
      console.log('File received:', info.filename, info.mimeType);
      const chunks = [];
      
      file.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      file.on('end', () => {
        const buffer = Buffer.concat(chunks);
        files.push({
          buffer,
          mimetype: info.mimeType,
          originalname: info.filename
        });
      });
    });
    
    bb.on('finish', async () => {
      try {
        if (files.length === 0) {
          return res.status(400).json({ error: 'No images provided' });
        }
        
        // Limit to 3 files as per SDK specification
        const limitedFiles = files.slice(0, 3);
        console.log('Processing', limitedFiles.length, 'files');
        
        const base64Images = limitedFiles.map(file =>
          `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
        );
        
        // Use mock SDK for now
        const result = await mockSDK.analyzeItem(base64Images);
        const routes = await mockSDK.getRoutes(result);

        res.json({
          success: true,
          analysis: result,
          routes,
          imageCount: limitedFiles.length,
          note: 'Using mock SDK - replace with real implementation'
        });
        
      } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({
          error: 'Failed to analyze item',
          message: error.message
        });
      }
    });
    
    bb.end(req.body);
    
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({
      error: 'Request processing failed',
      message: error.message
    });
  }
});

// Pricing API
app.post('/api/pricing', async (req, res) => {
  try {
    const { itemData, options = {} } = req.body;
    if (!itemData) {
      return res.status(400).json({ error: 'Item data is required' });
    }

    // Mock pricing response
    const pricing = {
      estimatedValue: 25.00,
      confidence: 'medium',
      marketData: {
        recentSales: [],
        averagePrice: 25.00
      }
    };
    
    res.json(pricing);

  } catch (error) {
    console.error('Pricing API error:', error);
    res.status(500).json({
      error: 'Pricing analysis failed',
      message: error.message
    });
  }
});

// Pin creation
app.post('/api/pins', async (req, res) => {
  try {
    const { location, item, expiresIn } = req.body;
    if (!location || !item) {
      return res.status(400).json({ error: 'Location and item data required' });
    }

    const pin = await mockSDK.dropPin({
      location,
      item,
      expiresIn: expiresIn || 4 * 60 * 60 * 1000 // 4 hours default
    });

    res.json({ success: true, pin });
  } catch (error) {
    console.error('Pin creation error:', error);
    res.status(500).json({
      error: 'Failed to create pin',
      message: error.message
    });
  }
});

// Get nearby pins
app.get('/api/pins/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const pins = await mockSDK.getNearbyPins({
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      radius: parseInt(radius)
    });

    res.json({ success: true, pins, count: pins.length });
  } catch (error) {
    console.error('Get pins error:', error);
    res.status(500).json({
      error: 'Failed to get nearby pins',
      message: error.message
    });
  }
});

// Generate listing for an item
app.post('/api/listings/generate', async (req, res) => {
  try {
    const { item, platform = 'ebay' } = req.body;
    if (!item) {
      return res.status(400).json({ error: 'Item data required' });
    }

    const listing = await mockSDK.generateListing(item, platform);
    res.json({ success: true, listing });
  } catch (error) {
    console.error('Listing generation error:', error);
    res.status(500).json({
      error: 'Failed to generate listing',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

exports.app = onRequest({ 
  cors: true,
  invoker: 'public',
  memory: '512MiB',
  timeoutSeconds: 120
}, app);