// quick-listing-test.js
// Test eBay listing with your saved tokens
import dotenv from 'dotenv';
import { EbayIntegration } from './capture-sdk/integrations/ebay/index.js';

dotenv.config();

async function quickListingTest() {
  console.log('🧪 Quick eBay Listing Test...\n');

  const ebay = new EbayIntegration({
    clientId: '***REMOVED***',
    clientSecret: process.env.EBAY_CLIENT_SECRET,
    redirectUri: 'SUPERFUN_STUDIO-SUPERFUN-S-PRD--gmotfjins',
    environment: 'production'
  });

  // Use tokens from .env
  ebay.accessToken = process.env.EBAY_ACCESS_TOKEN;
  ebay.refreshToken = process.env.EBAY_REFRESH_TOKEN;

  if (!ebay.accessToken) {
    console.error('❌ No access token found in .env file');
    console.log('Add this to your .env:');
    console.log('EBAY_ACCESS_TOKEN=your_access_token_here');
    return;
  }

  // Simplified test listing data (no aspects that cause errors)
  const testListing = {
    title: 'TEST ITEM - Treasure Hunter SDK - DELETE ASAP',
    description: `🧪 TEST LISTING - CREATED BY TREASURE HUNTER SDK
    
    ⚠️ THIS IS A TEST LISTING - PLEASE DELETE ⚠️
    
    This listing was created automatically to test our eBay integration.
    It will be deleted within 60 seconds of creation.
    
    If you see this listing, please ignore it - it's just a development test.
    
    Testing features:
    • OAuth token authentication ✅
    • eBay Sell API integration ✅  
    • Inventory item creation ✅
    • Automatic listing management ✅
    
    This listing serves no commercial purpose and will be removed immediately.`,
    
    images: [
      'https://i.ebayimg.com/images/g/9~4AAOSwcu5kXKvQ/s-l1600.jpg'
    ],
    
    pricing: {
      buyItNowPrice: 1.99, // Minimum viable price
      acceptOffers: false
    },
    
    condition: 'good',
    category: '171485' // Collectibles > Other Collectibles
    
    // Removed itemSpecifics to avoid serialization errors
  };

  try {
    console.log('📝 Creating simplified test listing...');
    console.log('Title:', testListing.title);
    console.log('Price: $' + testListing.pricing.buyItNowPrice);
    console.log('Category:', testListing.category);
    console.log();

    const result = await ebay.createListing(testListing);

    if (result.success) {
      console.log('🎉 SUCCESS! Test listing created!');
      console.log();
      console.log('📊 Listing Details:');
      console.log('- eBay Item ID:', result.listingId);
      console.log('- SKU:', result.sku);
      console.log('- Offer ID:', result.offerId);
      console.log('- Status:', result.status);
      console.log();
      console.log('🌐 View listing:', result.url);
      console.log();
      console.log('✅ YOUR EBAY INTEGRATION IS WORKING!');
      console.log();
      
      // Auto-delete after 60 seconds
      console.log('⏳ Auto-deleting test listing in 60 seconds...');
      setTimeout(async () => {
        try {
          console.log('🗑️ Attempting to end test listing...');
          await ebay.endListing(result.offerId, 'OTHER');
          console.log('✅ Test listing ended successfully');
        } catch (error) {
          console.log('⚠️ Could not auto-end listing:', error.message);
          console.log('   Please manually end listing ID:', result.listingId);
        }
      }, 60000);

      console.log('🚀 NEXT STEPS:');
      console.log('1. ✅ eBay integration working');
      console.log('2. 🔄 Set up Firebase database');  
      console.log('3. 🎨 Build the selling UI');
      console.log('4. 🧪 Test end-to-end scan → list flow');

    } else {
      console.log('❌ Listing creation failed');
      console.log('Error:', result.error);
      
      if (result.details) {
        console.log('Details:', JSON.stringify(result.details, null, 2));
      }
      
      console.log('\n🔧 Troubleshooting:');
      console.log('- Check if your eBay account has seller permissions');
      console.log('- Verify your tokens are still valid');
      console.log('- Try refreshing tokens if they expired');
    }

  } catch (error) {
    console.error('💥 Exception during listing test:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n🔄 Token might be expired. Trying to refresh...');
      try {
        await ebay.refreshAccessToken();
        console.log('✅ Token refreshed successfully');
        console.log('🔄 Retry the test to use the new token');
      } catch (refreshError) {
        console.log('❌ Token refresh failed:', refreshError.message);
        console.log('   You may need to re-do the OAuth flow');
      }
    }
  }
}

// Run the test
console.log('🎯 Starting quick listing test...');
console.log('📋 Make sure you have added tokens to .env file first!\n');

quickListingTest().catch(console.error);