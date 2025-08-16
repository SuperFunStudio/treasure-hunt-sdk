// test-ebay.js
// Run this to test your eBay integration
import dotenv from 'dotenv';
import { EbayIntegration } from '../capture-sdk/integrations/ebay/index.js';

dotenv.config();

async function testEbayIntegration() {
  console.log('🧪 Testing eBay Integration...\n');

  // Initialize eBay with your .env variables
  const ebay = new EbayIntegration({
    clientId: process.env.EBAY_CLIENT_ID,
    clientSecret: process.env.EBAY_CLIENT_SECRET,
    redirectUri: process.env.EBAY_REDIRECT_URI,
    environment: process.env.EBAY_ENVIRONMENT || 'sandbox'
  });

  // Test 1: Generate OAuth URL
  console.log('✅ Test 1: OAuth URL Generation');
  try {
    const authUrl = ebay.getAuthUrl('test-user-123');
    console.log('Auth URL generated successfully:');
    console.log(authUrl);
    console.log('\n📝 Next step: Visit this URL to authorize your app\n');
  } catch (error) {
    console.error('❌ OAuth URL generation failed:', error.message);
    return;
  }

  // Test 2: Check configuration
  console.log('✅ Test 2: Configuration Check');
  console.log('Environment:', ebay.environment);
  console.log('Client ID configured:', !!ebay.clientId);
  console.log('Client Secret configured:', !!ebay.clientSecret);
  console.log('Redirect URI:', ebay.redirectUri);
  
  // Test 3: API URL generation
  console.log('\n✅ Test 3: API URLs');
  console.log('API Base URL:', ebay.getApiUrl());
  console.log('Token URL:', ebay.getTokenUrl());

  // Test 4: Mock listing data validation
  console.log('\n✅ Test 4: Listing Data Validation');
  const mockListingData = {
    title: 'Test Item - Sony Headphones',
    description: 'Great condition headphones for testing',
    images: ['https://example.com/image1.jpg'],
    pricing: {
      buyItNowPrice: 50.00,
      acceptOffers: true,
      minimumOffer: 40.00
    },
    condition: 'good',
    category: '171485'
  };

  try {
    ebay.validateListingData(mockListingData);
    console.log('✅ Mock listing data is valid');
  } catch (error) {
    console.error('❌ Listing validation failed:', error.message);
  }

  console.log('\n🎯 Integration test complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Visit the OAuth URL above to get an authorization code');
  console.log('2. Use that code to test the authenticate() method');
  console.log('3. Set up Firebase for data persistence');
  console.log('4. Create the selling UI flow');
}

// Run the test
testEbayIntegration().catch(console.error);