import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import CaptureSDK from './capture-sdk/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for image uploads
const upload = multer({
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });

// Middleware
app.use(cors());
app.use(express.json());

// Create a flexible upload middleware that accepts both single and multiple images
const flexibleUpload = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 3 }
  ]);

// Initialize SDK
const sdk = new CaptureSDK({
  visionProvider: 'gpt4v',
  apiKeys: {
    gpt4v: process.env.OPENAI_API_KEY
  },
  integrations: {
    ebay: {
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET
    }
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID
  }
});

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Treasure Hunter SDK API',
    version: '1.0.0'
  });
});

// Analyze item from uploaded image
app.post('/api/analyze', flexibleUpload, async (req, res) => {
    try {
      // Handle both single and multiple images from different field names
      let files = [];
      
      if (req.files) {
        if (req.files.image) {
          files = req.files.image;
        } else if (req.files.images) {
          files = req.files.images;
        }
      } else if (req.file) {
        files = [req.file];
      }
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No images provided' });
      }
  
      // Convert all images to base64
      const base64Images = files.map(file => 
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
      );
      
      console.log(`Analyzing ${files.length} image(s), total size: ${files.reduce((sum, f) => sum + f.size, 0) / 1024}KB`);
      
      // Analyze the items - SDK currently expects array of images
      const result = await sdk.analyzeItem(base64Images);
      
      // Get routing recommendations
      const routes = await sdk.getRoutes(result);
      
      res.json({
        success: true,
        analysis: result,
        routes: routes,
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

// Create a pin for an item
app.post('/api/pins', async (req, res) => {
  try {
    const { location, item, expiresIn } = req.body;
    
    if (!location || !item) {
      return res.status(400).json({ error: 'Location and item data required' });
    }
    
    const pin = await sdk.dropPin({
      location,
      item,
      expiresIn: expiresIn || 4 * 60 * 60 * 1000 // Default 4 hours
    });
    
    res.json({
      success: true,
      pin
    });
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
    
    const pins = await sdk.getNearbyPins({
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      radius: parseInt(radius)
    });
    
    res.json({
      success: true,
      pins,
      count: pins.length
    });
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
    
    const listing = await sdk.generateListing(item, platform);
    
    res.json({
      success: true,
      listing
    });
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Treasure Hunter SDK API running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log('\nAvailable endpoints:');
  console.log('  POST /api/analyze - Analyze an item from image');
  console.log('  POST /api/pins - Create a location pin');
  console.log('  GET  /api/pins/nearby - Get nearby pins');
  console.log('  POST /api/listings/generate - Generate a listing');
});

export default app;