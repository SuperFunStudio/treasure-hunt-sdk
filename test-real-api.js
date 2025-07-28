import CaptureSDK from './capture-sdk/index.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

async function testRealAPI() {
  try {
    // Initialize SDK with your real API key
    const sdk = new CaptureSDK({
      visionProvider: 'gpt4v',
      apiKeys: {
        gpt4v: process.env.OPENAI_API_KEY
      },
      integrations: {
        ebay: {
          clientId: process.env.EBAY_CLIENT_ID || 'pending',
          clientSecret: process.env.EBAY_CLIENT_SECRET || 'pending'
        }
      }
    });

    console.log('✅ SDK initialized with real API key!');
    
    // Test with a sample image
    // For testing, you can use a base64 encoded image or load from file
    // Here's a mock test without actual image
    console.log('\n📸 Testing item analysis...');
    
    // Mock image data for testing (replace with real image)
    const mockImageData = ['data:image/jpeg;base64,/9j/4AAQSkZJRg...']; // truncated for example
    
    try {
      // Uncomment and use with real image data
      // const result = await sdk.analyzeItem(mockImageData);
      // console.log('Analysis result:', result);
      
      console.log('⚠️  Add real image data to test analysis');
      console.log('You can use:');
      console.log('  - A base64 encoded image string');
      console.log('  - Load an image file with fs.readFile');
      
    } catch (error) {
      console.error('Analysis error:', error.message);
    }
    
    // Test other SDK methods
    console.log('\n🗺️  Testing location features...');
    
    // Test dropping a pin
    const pinData = {
      location: {
        latitude: 40.7128,
        longitude: -74.0060
      },
      item: {
        category: 'Furniture',
        title: 'Vintage Chair',
        confidence: 8
      },
      expiresIn: 4 * 60 * 60 * 1000 // 4 hours
    };
    
    const pin = await sdk.dropPin(pinData);
    console.log('Pin created:', pin);
    
    // Test getting nearby pins
    const nearbyPins = await sdk.getNearbyPins({
      latitude: 40.7128,
      longitude: -74.0060,
      radius: 5000 // 5km
    });
    console.log('Nearby pins:', nearbyPins);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Helper function to load and encode image
async function loadTestImage(filepath) {
  try {
    const imageBuffer = await fs.readFile(filepath);
    const base64 = imageBuffer.toString('base64');
    const mimeType = filepath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

// Run the test
console.log('🚀 Starting Treasure Hunter SDK test with real APIs...\n');
testRealAPI();

// Example of how to test with a real image file
// Uncomment and modify the path to test with your image
/*
(async () => {
  const imageData = await loadTestImage('./test-images/chair.jpg');
  if (imageData) {
    // Use imageData in your SDK call
  }
})();
*/