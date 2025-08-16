// fixed-sdk-test.js
import CaptureSDK from '../capture-sdk/index.js';
import dotenv from 'dotenv';

dotenv.config();

// Make sure we have the access token
if (!process.env.EBAY_ACCESS_TOKEN) {
  console.log('❌ EBAY_ACCESS_TOKEN not found in .env file');
  console.log('📋 Get one from: https://developer.ebay.com/my/keys');
  console.log('   Click "Sign in to Production" and copy the token');
  process.exit(1);
}

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
      accessToken: process.env.EBAY_ACCESS_TOKEN, // This is the key addition
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

console.log('✅ SDK initialized with access token');

// Test eBay integration
if (sdk.ebay) {
  console.log('🔄 Testing eBay integration...');
  console.log('   Access token:', sdk.ebay.accessToken ? 'SET' : 'MISSING');
  console.log('   Is authenticated:', sdk.ebay.isAuthenticated());
  
  // Test API call directly
  console.log('🔄 Testing eBay API call...');
  
  sdk.ebay.apiCall('GET', '/sell/account/v1/fulfillment_policy')
    .then(response => {
      console.log('🎉 eBay API working!');
      console.log(`📦 Found ${response.fulfillmentPolicies?.length || 0} fulfillment policies`);
      
      console.log('\n✅ Authentication completely fixed!');
      console.log('🚀 Your original SDK should now work!');
      console.log('💡 Try running: node test-integrated-sdk.js');
    })
    .catch(error => {
      console.error('❌ eBay API test failed:', error.message);
      
      if (error.message.includes('invalid or expired')) {
        console.log('\n🔧 Fix: Get a fresh token from eBay Developer Console');
        console.log('   Go to https://developer.ebay.com/my/keys');
        console.log('   Click "Sign in to Production" again');
      }
    });
} else {
  console.log('❌ eBay integration not initialized');
}