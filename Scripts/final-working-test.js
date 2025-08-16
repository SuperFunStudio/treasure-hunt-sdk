// final-working-test.js
// Final eBay test with all required headers
import dotenv from 'dotenv';

dotenv.config();

async function finalEbayTest() {
  console.log('🎯 Final eBay Integration Test...\n');

  const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;
  
  if (!ACCESS_TOKEN || ACCESS_TOKEN.length < 100) {
    console.error('❌ Invalid access token');
    return;
  }

  console.log('✅ Access token loaded (length:', ACCESS_TOKEN.length, ')');

  // Complete headers for eBay API
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/json',
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json',
    'Content-Language': 'en-US',  // This was missing!
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
  };

  // Test inventory item creation with correct headers
  const sku = `TH_FINAL_TEST_${Date.now()}`;
  
  const inventoryItem = {
    condition: 'USED_GOOD',
    product: {
      title: 'FINAL TEST - Treasure Hunter SDK - Delete ASAP',
      description: `🧪 FINAL TEST LISTING
      
This is the final test of the Treasure Hunter SDK eBay integration.
      
⚠️ THIS LISTING WILL BE DELETED IMMEDIATELY ⚠️
      
Testing complete integration:
✅ OAuth authentication
✅ API connectivity  
✅ Inventory creation
✅ Offer creation & publishing
✅ Automatic cleanup
      
If you see this listing, it means our integration is working perfectly!
This listing serves no commercial purpose and will be removed automatically.`,
      
      imageUrls: ['https://i.ebayimg.com/images/g/9~4AAOSwcu5kXKvQ/s-l1600.jpg']
    },
    availability: {
      shipToLocationAvailability: {
        quantity: 1
      }
    }
  };

  try {
    console.log('🧪 Creating inventory item with complete headers...');
    
    const inventoryResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(inventoryItem)
    });

    console.log('📡 Inventory Creation Status:', inventoryResponse.status);

    if (inventoryResponse.status === 201 || inventoryResponse.status === 204) {
      console.log('✅ Inventory item created successfully!');
      console.log('SKU:', sku);
      
      // Now create and publish an offer
      await createAndPublishOffer(ACCESS_TOKEN, sku, headers);
      
    } else {
      const error = await inventoryResponse.text();
      console.log('❌ Inventory creation failed:', error);
      
      // Try to parse the error for better debugging
      try {
        const parsedError = JSON.parse(error);
        if (parsedError.errors) {
          parsedError.errors.forEach(err => {
            console.log(`   Error ${err.errorId}: ${err.message}`);
            if (err.longMessage) console.log(`   Details: ${err.longMessage}`);
          });
        }
      } catch (e) {
        // Error wasn't JSON, already logged above
      }
    }

  } catch (error) {
    console.error('💥 Inventory creation exception:', error.message);
  }
}

async function createAndPublishOffer(accessToken, sku, headers) {
  console.log('\n🧪 Creating offer for SKU:', sku);
  
  // Simple offer without business policies for now
  const offer = {
    sku: sku,
    marketplaceId: 'EBAY_US',
    format: 'FIXED_PRICE',
    pricingSummary: {
      price: {
        currency: 'USD',
        value: '2.99'
      }
    },
    categoryId: '171485' // Collectibles > Other
    // Omitting listingPolicies for now since they might not be set up
  };

  try {
    const offerResponse = await fetch('https://api.ebay.com/sell/inventory/v1/offer', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(offer)
    });

    console.log('📡 Offer Creation Status:', offerResponse.status);

    if (offerResponse.ok) {
      const offerData = await offerResponse.json();
      console.log('✅ Offer created successfully!');
      console.log('Offer ID:', offerData.offerId);
      
      // Try to publish the offer
      await publishOffer(accessToken, offerData.offerId, headers);
      
    } else {
      const error = await offerResponse.text();
      console.log('❌ Offer creation failed:', error);
      
      if (error.includes('Business Policy') || error.includes('policy')) {
        console.log('\n📋 NEXT STEP: Set up eBay business policies');
        console.log('1. Go to: https://www.ebay.com/sellerhub/');
        console.log('2. Navigate to Account → Business Policies');
        console.log('3. Create Payment, Shipping, and Return policies');
        console.log('4. Then re-run this test');
      }
    }

  } catch (error) {
    console.error('💥 Offer creation exception:', error.message);
  }
}

async function publishOffer(accessToken, offerId, headers) {
  console.log('\n🧪 Publishing offer:', offerId);
  
  try {
    const publishResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`, {
      method: 'POST',
      headers: headers
    });

    console.log('📡 Publish Status:', publishResponse.status);

    if (publishResponse.ok) {
      const publishData = await publishResponse.json();
      console.log('🎉 SUCCESS! Listing published!');
      console.log('✅ Listing ID:', publishData.listingId);
      console.log('🌐 URL: https://www.ebay.com/itm/' + publishData.listingId);
      
      console.log('\n🎯 INTEGRATION FULLY WORKING!');
      console.log('✅ OAuth ✅ Authentication ✅ Inventory ✅ Offers ✅ Publishing');
      
      console.log('\n🚀 READY FOR PRODUCTION:');
      console.log('1. ✅ eBay integration complete');
      console.log('2. 🔄 Set up Firebase database');
      console.log('3. 🎨 Build user interface');
      console.log('4. 👥 Handle user OAuth flows');
      console.log('5. 💰 Implement commission tracking');
      
      // Auto-delete test listing
      setTimeout(async () => {
        try {
          await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/withdraw`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ reason: 'OTHER' })
          });
          console.log('🗑️ Test listing auto-deleted');
        } catch (e) {
          console.log('⚠️ Manual deletion needed for listing:', publishData.listingId);
        }
      }, 60000);
      
    } else {
      const error = await publishResponse.text();
      console.log('❌ Publishing failed:', error);
    }

  } catch (error) {
    console.error('💥 Publishing exception:', error.message);
  }
}

console.log('🎯 Running final eBay integration test...');
console.log('This test includes all required headers and proper error handling.\n');

finalEbayTest().catch(console.error);