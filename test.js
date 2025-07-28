import CaptureSDK from './capture-sdk/index.js';
import dotenv from 'dotenv';

dotenv.config();

try {
  const sdk = new CaptureSDK({
    visionProvider: 'gpt4v',
    apiKeys: {
      gpt4v: process.env.OPENAI_API_KEY || 'test-key',
      claude: process.env.ANTHROPIC_API_KEY || 'test-key'
    },
    integrations: {
      ebay: {
        clientId: process.env.EBAY_CLIENT_ID || 'test-client-id',
        clientSecret: process.env.EBAY_CLIENT_SECRET || 'test-secret'
      },
      instantOffer: {
        operatorId: 'test-operator',
        warehouseAddress: {
          street: '123 Warehouse St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105'
        }
      }
    }
  });

  console.log('✅ SDK initialized successfully!');
  
  // Test that methods exist
  console.log('📦 Available methods:');
  console.log('  - analyzeItem:', typeof sdk.analyzeItem);
  console.log('  - getRoutes:', typeof sdk.getRoutes);
  console.log('  - generateListing:', typeof sdk.generateListing);
  console.log('  - dropPin:', typeof sdk.dropPin);
  console.log('  - getNearbyPins:', typeof sdk.getNearbyPins);
  
} catch (error) {
  console.error('❌ Error:', error.message);
}