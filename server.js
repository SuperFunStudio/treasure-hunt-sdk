import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import CaptureSDK from './functions/capture-sdk/index.js';
import { estimatePrice } from './functions/capture-sdk/utils/priceEstimate.js';
import { getValidUserEbayToken } from './functions/capture-sdk/utils/ebayTokenUtils.js';
import admin from 'firebase-admin';
import fs from 'fs';
const serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'));

dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID
});
const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup for image uploads
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});
const flexibleUpload = upload.fields([{ name: 'image', maxCount: 3 }]);

// --- Initialize SDK before routes! ---
const sdk = new CaptureSDK({
  visionProvider: 'claude',
  apiKeys: {
    'claude': process.env.CLAUDE_API_KEY
  },
  integrations: {
    ebay: {
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      redirectUri: process.env.EBAY_REDIRECT_URI
    }
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID
  }
});

app.use(cors());
app.use(express.json());

// --- eBay OAuth Success Handler ---
// Save tokens to Firestore under /users/{uid}/ebay
app.get('/success', async (req, res) => {
    const code = req.query.code;
    const uid = req.query.state || req.query.uid || 'demo-user';
  
    // ADD THIS LINE:
    console.log(`[${new Date().toISOString()}] /success called with code:`, code, 'uid:', uid);
  
    if (!code) return res.status(400).send('Missing code parameter from eBay');
  
    try {
      const ebay = sdk.ebay;
      const tokens = await ebay.authenticate(code);
      const expires_at = Date.now() + (tokens.expires_in * 1000);
  
      // ADD THIS LINE:
      console.log(`Writing tokens to Firestore for user: ${uid}`);
  
      await db.collection('users').doc(uid).set({ ebay: { ...tokens, expires_at } }, { merge: true });
  
      // ADD THIS LINE:
      console.log(`Write successful for user: ${uid}`);
  
      res.json({
        success: true,
        message: "eBay authentication successful!",
        tokens: {
          ...tokens,
          access_token: tokens.access_token?.slice(0, 8) + '...',
          refresh_token: tokens.refresh_token?.slice(0, 8) + '...'
        }
      });
    } catch (err) {
      // ADD THIS LINE:
      console.error('eBay token exchange failed:', err);
      res.status(500).send('eBay token exchange failed: ' + err.message);
    }
  });

// --- Get valid eBay user token ---
app.post('/api/ebay/token', async (req, res) => {
  const uid = req.body.uid || 'demo-user'; // Real app: get from auth/session!

  try {
    // Lookup user in Firestore
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) throw new Error('User not found');
    const user = { id: uid, ...userSnap.data() };

    // Save function for DB
    const updateUserTokens = async (userId, newTokens) => {
      await db.collection('users').doc(userId).set({ ebay: newTokens }, { merge: true });
    };

    const token = await getValidUserEbayToken(user, process.env, updateUserTokens);
    res.json({ success: true, access_token: token.slice(0, 12) + '...' });
  } catch (err) {
    res.status(401).json({ error: 'eBay token refresh failed', message: err.message });
  }
});

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Treasure Hunter SDK API',
    version: '1.0.0'
  });
});

// --- Pricing API ---
app.post('/api/pricing', async (req, res) => {
  try {
    const { itemData, options = {} } = req.body;
    if (!itemData) return res.status(400).json({ error: 'Item data is required' });

    const ebayConfig = {
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      environment: process.env.EBAY_ENVIRONMENT || 'production'
    };
    const pricing = await estimatePrice(itemData, { ...options, ebayConfig });
    res.json(pricing);

  } catch (error) {
    console.error('Pricing API error:', error);
    res.status(500).json({
      error: 'Pricing analysis failed',
      message: error.message
    });
  }
});

// --- Image Analysis API ---
app.post('/api/analyze', flexibleUpload, async (req, res) => {
  try {
    let files = [];
    if (req.files && req.files.image) files = req.files.image;
    else if (req.files && req.files.images) files = req.files.images;
    else if (req.file) files = [req.file];
    if (!files || files.length === 0) return res.status(400).json({ error: 'No images provided' });

    const base64Images = files.map(file =>
      `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
    );
    const result = await sdk.analyzeItem(base64Images);
    const routes = await sdk.getRoutes(result);

    res.json({
      success: true,
      analysis: result,
      routes,
      imageCount: files.length
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze item',
      message: error.message
    });
  }
});

// --- Pin creation ---
app.post('/api/pins', async (req, res) => {
  try {
    const { location, item, expiresIn } = req.body;
    if (!location || !item) return res.status(400).json({ error: 'Location and item data required' });

    const pin = await sdk.dropPin({
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

// --- Get nearby pins ---
app.get('/api/pins/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Latitude and longitude required' });

    const pins = await sdk.getNearbyPins({
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

// --- Generate listing for an item ---
app.post('/api/listings/generate', async (req, res) => {
  try {
    const { item, platform = 'ebay' } = req.body;
    if (!item) return res.status(400).json({ error: 'Item data required' });

    const listing = await sdk.generateListing(item, platform);
    res.json({ success: true, listing });
  } catch (error) {
    console.error('Listing generation error:', error);
    res.status(500).json({
      error: 'Failed to generate listing',
      message: error.message
    });
  }
});

// --- Error handling middleware ---
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Treasure Hunter SDK API running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log('\nAvailable endpoints:');
  console.log('  GET  /success - eBay OAuth callback');
  console.log('  POST /api/analyze - Analyze an item from image');
  console.log('  POST /api/pins - Create a location pin');
  console.log('  GET  /api/pins/nearby - Get nearby pins');
  console.log('  POST /api/listings/generate - Generate a listing');
  console.log('  POST /api/ebay/token - Get/refresh user eBay access token');
});

export default app;
