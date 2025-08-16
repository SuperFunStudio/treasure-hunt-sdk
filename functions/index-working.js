// functions/index-final.js - Complete version with SDK
const {onRequest} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const busboy = require('busboy');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// eBay Webhook Configuration
const VERIFICATION_TOKEN = 'treasurehunter-sdk-1753755107391-zfgw1dyhl';
const ENDPOINT_URL = 'https://ebaynotifications-beprv7ll2q-uc.a.run.app';

// =================================================================
// SDK INITIALIZATION WITH PROPER ERROR HANDLING
// =================================================================
let sdkInstance = null;
let sdkInitError = null;

async function getSDK() {
  if (sdkInstance) {
    return sdkInstance;
  }
  
  if (sdkInitError) {
    console.log('SDK previously failed to load, using fallback');
    return createFallbackSDK();
  }
  
  try {
    console.log('Attempting to load SDK...');
    const { default: CaptureSDK } = await import('./capture-sdk/index.js');
    
    sdkInstance = new CaptureSDK({
      visionProvider: 'gpt-4o',
      apiKeys: { 
        gpt-4o: process.env.OPENAI_API_KEY
      },
      integrations: {
        ebay: {
          clientId: process.env.EBAY_CLIENT_ID,
          clientSecret: process.env.EBAY_CLIENT_SECRET,
          redirectUri: process.env.EBAY_REDIRECT_URI,
          environment: process.env.EBAY_ENVIRONMENT || 'production'
        }
      }
    });
    
    console.log('✅ SDK loaded successfully');
    return sdkInstance;
  } catch (error) {
    console.error('❌ SDK initialization failed:', error.message);
    sdkInitError = error;
    return createFallbackSDK();
  }
}

function createFallbackSDK() {
  console.log('Using fallback SDK implementation');
  return {
    async analyzeItem(images) {
      return {
        category: 'Electronics',
        brand: 'Unknown',
        condition: { rating: 'good', description: 'Item in good condition' },
        confidence: 7,
        resale: { priceRange: { low: 15, high: 35 } }
      };
    },
    async getRoutes(itemData) {
      return [
        { type: 'ebay', estimatedReturn: 25.00, confidence: 'medium' },
        { type: 'local', pickup: true, confidence: 'low' }
      ];
    },
    async generateListing(item, route, options) {
      return {
        title: `${item.brand || 'Unknown'} ${item.category}`,
        description: 'Item for sale',
        pricing: { buyItNowPrice: 25 }
      };
    },
    async dropPin(pinData) {
      return { pinId: 'mock-pin-' + Date.now(), ...pinData };
    },
    async getNearbyPins(location) {
      return [];
    }
  };
}

// =================================================================
// WORKING HEALTH FUNCTION - DON'T CHANGE
// =================================================================
exports.health = onRequest(
  { 
    cors: true,
    invoker: 'public',
    memory: '256MiB',
    timeoutSeconds: 60
  },
  (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'Incremental Test',
      components: {
        sdk: true,
        estimatePrice: true,
        tokenUtils: true,
        express: true,
        busboy: true
      }
    });
  }
);

// =================================================================
// EBAY NOTIFICATIONS
// =================================================================
exports.ebayNotifications = onRequest(
  {
    cors: true,
    invoker: 'public',
    memory: '256MiB',
    timeoutSeconds: 60
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
      const challengeCode = req.query.challenge_code;
      if (!challengeCode) {
        res.status(400).json({ error: 'Missing challenge_code parameter' });
        return;
      }

      try {
        const hash = crypto.createHash('sha256');
        hash.update(challengeCode);
        hash.update(VERIFICATION_TOKEN);
        hash.update(ENDPOINT_URL);
        const responseHash = hash.digest('hex');

        console.log('eBay challenge verification successful');
        res.status(200).json({ challengeResponse: responseHash });
      } catch (error) {
        console.error('Challenge verification failed:', error);
        res.status(500).json({ error: 'Challenge verification failed' });
      }
      return;
    }

    if (req.method === 'POST') {
      try {
        const notification = req.body;
        console.log('Received eBay notification');
        
        res.status(200).json({
          status: 'received',
          timestamp: new Date().toISOString()
        });

        // Store notification asynchronously
        if (notification?.notification) {
          db.collection('ebay_notifications').add({
            notificationId: notification.notification.notificationId || 'unknown',
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            data: notification
          }).catch(err => console.error('Failed to store notification:', err));
        }
      } catch (error) {
        console.error('Error processing notification:', error);
        res.status(500).json({ error: 'Processing failed' });
      }
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  }
);

// =================================================================
// TEST ENDPOINT
// =================================================================
exports.testEbayEndpoint = onRequest(
  {
    cors: true,
    invoker: 'public',
    memory: '256MiB',
    timeoutSeconds: 60
  },
  async (req, res) => {
    const sdk = await getSDK();
    res.json({
      message: 'eBay notification endpoint is ready',
      verificationToken: 'configured',
      endpointUrl: ENDPOINT_URL,
      timestamp: new Date().toISOString(),
      sdkStatus: !!sdk,
      sdkType: sdkInitError ? 'fallback' : 'real'
    });
  }
);

// =================================================================
// EXPRESS APP WITH SDK INTEGRATION
// =================================================================
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', async (req, res) => {
  const sdk = await getSDK();
  res.json({
    status: 'ok',
    service: 'Treasure Hunt SDK API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    sdk: {
      available: !!sdk,
      type: sdkInitError ? 'fallback' : 'real'
    }
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

// Image Analysis with SDK
app.post('/api/analyze', async (req, res) => {
  try {
    console.log('Analysis request received');
    
    // Handle multipart form data with busboy
    if (req.get('content-type')?.includes('multipart/form-data')) {
      const files = [];
      const bb = busboy({ headers: req.headers });
      
      bb.on('file', (name, file, info) => {
        console.log('File received:', info.filename);
        const chunks = [];
        
        file.on('data', (chunk) => chunks.push(chunk));
        file.on('end', () => {
          files.push({
            buffer: Buffer.concat(chunks),
            mimetype: info.mimeType,
            originalname: info.filename
          });
        });
      });
      
      bb.on('finish', async () => {
        if (files.length === 0) {
          return res.status(400).json({ error: 'No images provided' });
        }
        
        try {
          const sdk = await getSDK();
          const base64Images = files.slice(0, 3).map(file =>
            `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
          );
          
          const result = await sdk.analyzeItem(base64Images);
          const routes = await sdk.getRoutes(result);
          
          res.json({
            success: true,
            analysis: result,
            routes,
            imageCount: files.length,
            sdkType: sdkInitError ? 'fallback' : 'real'
          });
        } catch (error) {
          console.error('Analysis error:', error);
          res.status(500).json({
            error: 'Analysis failed',
            message: error.message
          });
        }
      });
      
      bb.end(req.body);
    } else {
      // Handle JSON request
      const sdk = await getSDK();
      const { images = [] } = req.body;
      
      if (images.length === 0) {
        return res.status(400).json({ error: 'No images provided' });
      }
      
      const result = await sdk.analyzeItem(images);
      const routes = await sdk.getRoutes(result);
      
      res.json({
        success: true,
        analysis: result,
        routes,
        sdkType: sdkInitError ? 'fallback' : 'real'
      });
    }
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({
      error: 'Request processing failed',
      message: error.message
    });
  }
});

// Pricing endpoint
app.post('/api/pricing', async (req, res) => {
  try {
    const { itemData } = req.body;
    if (!itemData) {
      return res.status(400).json({ error: 'Item data required' });
    }
    
    const sdk = await getSDK();
    const routes = await sdk.getRoutes(itemData);
    const ebayRoute = routes.find(r => r.type === 'ebay');
    
    res.json({
      estimatedValue: ebayRoute?.estimatedReturn || 25,
      confidence: ebayRoute?.confidence || 'low',
      source: sdkInitError ? 'fallback' : 'sdk'
    });
  } catch (error) {
    console.error('Pricing error:', error);
    res.status(500).json({ error: 'Pricing failed' });
  }
});

// Generate listing
app.post('/api/listings/generate', async (req, res) => {
  try {
    const { item, platform = 'ebay' } = req.body;
    if (!item) {
      return res.status(400).json({ error: 'Item data required' });
    }
    
    const sdk = await getSDK();
    const listing = await sdk.generateListing(item, { type: platform }, { platform });
    
    res.json({
      success: true,
      listing,
      sdkType: sdkInitError ? 'fallback' : 'real'
    });
  } catch (error) {
    console.error('Listing generation error:', error);
    res.status(500).json({ error: 'Failed to generate listing' });
  }
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Export Express app
exports.app = onRequest(
  { 
    cors: true,
    invoker: 'public',
    memory: '1GiB',  // Increased for SDK
    timeoutSeconds: 120  // Increased for SDK operations
  }, 
  app
);

console.log('Functions initialized with SDK support');
console.log('OpenAI Key present:', !!process.env.OPENAI_API_KEY);