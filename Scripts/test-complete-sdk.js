// test-complete-sdk.js
import CaptureSDK from '../capture-sdk/index.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🎯 Testing Complete Treasure Hunter SDK with Fixed eBay Auth...');

const sdk = new CaptureSDK({
  visionProvider: 'gpt-4o',
  apiKeys: {
    gpt-4o: process.env.OPENAI_API_KEY || 'test-key',
    claude: process.env.ANTHROPIC_API_KEY || 'test-key'
  },
  integrations: {
    ebay: {
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      accessToken: process.env.EBAY_ACCESS_TOKEN, // Using the working token
      environment: 'production'
    },
    instantOffer: {
      operatorId: 'thriftspot-operator',
      warehouseAddress: {
        street: '123 ThriftSpot Warehouse',
        city: 'Brooklyn',
        state: 'NY',
        zip: '11201'
      }
    }
  }
});

console.log('✅ SDK initialized successfully!');
console.log('🔄 Testing eBay authentication...');

// Test eBay connection
if (sdk.ebay && sdk.ebay.isAuthenticated()) {
  console.log('✅ eBay authentication confirmed!');
  
  // Test a simple eBay API call
  sdk.ebay.apiCall('GET', '/sell/account/v1/fulfillment_policy')
    .then(response => {
      console.log('✅ eBay API working!');
      console.log(`📦 Found ${response.fulfillmentPolicies?.length || 0} fulfillment policies`);
      
      // Test category suggestion
      return sdk.ebay.suggestCategory('vintage denim jacket');
    })
    .then(categoryId => {
      console.log('✅ Category suggestion working!');
      console.log(`🏷️  Suggested category: ${categoryId}`);
      
      console.log('\n🎉 Your complete SDK is ready!');
      console.log('💡 You can now run your original test-integrated-sdk.js');
    })
    .catch(error => {
      console.error('❌ eBay API test failed:', error.message);
    });
    
} else {
  console.log('❌ eBay not authenticated - check your EBAY_ACCESS_TOKEN');
}

console.log('\n📋 Available SDK methods:');
console.log('  - analyzeItem:', typeof sdk.analyzeItem);
console.log('  - getRoutes:', typeof sdk.getRoutes);
console.log('  - generateListing:', typeof sdk.generateListing);
console.log('  - createEbayListing:', typeof sdk.createEbayListing);
console.log('  - dropPin:', typeof sdk.dropPin);
console.log('  - getNearbyPins:', typeof sdk.getNearbyPins);