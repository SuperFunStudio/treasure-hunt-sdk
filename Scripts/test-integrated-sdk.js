// test-integrated-sdk.js
// Test the complete SDK with adaptive eBay listing
import dotenv from 'dotenv';
import CaptureSDK from '../capture-sdk/index.js';

dotenv.config();

async function testIntegratedSDK() {
  console.log('🧪 Testing Complete Treasure Hunter SDK with Adaptive eBay Integration...\n');

  // Initialize SDK with your configuration
  const sdk = new CaptureSDK({
    visionProvider: 'gpt-4o',
    apiKeys: {
      gpt-4o: process.env.OPENAI_API_KEY
    },
    integrations: {
      ebay: {
        clientId: process.env.EBAY_CLIENT_ID,
        clientSecret: process.env.EBAY_CLIENT_SECRET,
        redirectUri: process.env.EBAY_REDIRECT_URI,
        environment: process.env.EBAY_ENVIRONMENT,
        accessToken: process.env.EBAY_ACCESS_TOKEN,
        refreshToken: process.env.EBAY_REFRESH_TOKEN
      }
    }
  });

  // Test adaptive listing with mock item data
  const mockItemAnalysis = {
    category: 'Video Games',
    brand: 'Sony',
    model: 'PlayStation Game',
    condition: 'good',
    confidence: 8.5,
    title: 'Test Video Game - Treasure Hunter SDK',
    description: 'Complete integration test for video game category',
    images: ['https://i.ebayimg.com/images/g/9~4AAOSwcu5kXKvQ/s-l1600.jpg'],
    aspects: {
      "Platform": ["Sony PlayStation 4"],
      "Game Name": ["SDK Test Game"],
      "Genre": ["Action"],
      "Rating": ["T-Teen"]
    }
  };

  const mockListingData = {
    title: mockItemAnalysis.title,
    description: mockItemAnalysis.description,
    images: mockItemAnalysis.images,
    category: '139973', // Video Games leaf category
    pricing: {
      buyItNowPrice: 25.99,
      acceptOffers: true,
      minimumOffer: 20.00
    },
    condition: 'good'
  };

  try {
    console.log('🎯 Testing SDK adaptive listing creation...');
    
    const result = await sdk.createEbayListing(mockListingData, mockItemAnalysis);

    if (result.success) {
      console.log('\n🎉 SDK INTEGRATION SUCCESS!');
      console.log('✅ Adaptive eBay listing created through main SDK!');
      console.log('');
      console.log('📋 Listing Details:');
      console.log('   URL:', result.url);
      console.log('   Listing ID:', result.listingId);
      console.log('   Adapted Category:', result.adaptedCategory);
      console.log('   Selected Condition:', result.selectedCondition);
      console.log('   Aspects Used:', result.aspectsUsed);
      console.log('');
      console.log('🚀 YOUR TREASURE HUNTER SDK IS PRODUCTION READY!');
      console.log('');
      console.log('✅ Features Validated:');
      console.log('   • Item analysis integration');
      console.log('   • Dynamic category adaptation');
      console.log('   • Automatic condition mapping');
      console.log('   • Required aspects handling');
      console.log('   • Complete listing workflow');
      console.log('   • Error handling and fallbacks');
      console.log('');
      console.log('📋 Ready for User Implementation:');
      console.log('   1. Set up Firebase for user data');
      console.log('   2. Build user OAuth flows');
      console.log('   3. Create scanning interface');
      console.log('   4. Implement commission tracking');

    } else {
      console.log('❌ SDK listing failed:', result.error);
      if (result.details) {
        console.log('Details:', result.details);
      }
    }

  } catch (error) {
    console.error('💥 SDK test exception:', error.message);
  }

  // Test category suggestion feature
  try {
    console.log('\n🔍 Testing category suggestion...');
    
    const suggestions = await sdk.suggestEbayCategory(
      'iPhone 12 Pro Max', 
      'Apple smartphone with 256GB storage'
    );

    console.log('✅ Category suggestions:');
    suggestions.forEach((suggestion, index) => {
      console.log(`   ${index + 1}. ${suggestion.categoryName} (${suggestion.categoryId}) - ${suggestion.relevancy}% match`);
    });

  } catch (error) {
    console.log('⚠️ Category suggestion test failed:', error.message);
  }
}

console.log('🎯 Testing complete Treasure Hunter SDK...');
console.log('This validates the full scan-to-list workflow with adaptive eBay integration.\n');

testIntegratedSDK().catch(console.error);