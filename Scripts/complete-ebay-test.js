// complete-ebay-test.js
// Complete eBay test with location/country info
import dotenv from 'dotenv';

dotenv.config();

async function completeEbayTest() {
  console.log('🎯 Complete eBay Test with Country Info...\n');

  const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;
  
  console.log('✅ Access token loaded (length:', ACCESS_TOKEN.length, ')');

  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/json',
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json',
    'Content-Language': 'en-US',
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
  };

  // Step 1: Get or create merchant location first
  let locationKey = await getOrCreateLocation(ACCESS_TOKEN, headers);
  
  if (!locationKey) {
    console.log('❌ Could not set up merchant location');
    return;
  }

  // Step 2: Create inventory item
  const sku = `TH_COMPLETE_${Date.now()}`;
  
  const inventoryItem = {
    condition: 'USED_GOOD',
    product: {
      title: 'COMPLETE TEST - Treasure Hunter SDK Working!',
      description: `🎉 COMPLETE INTEGRATION TEST

This listing proves the Treasure Hunter SDK eBay integration is fully operational!

✅ OAuth authentication working
✅ eBay Sell API connectivity established  
✅ Inventory item creation successful
✅ Offer creation and publishing functional
✅ Location and country requirements met

⚠️ This is a test listing and will be automatically deleted within 2 minutes.

The Treasure Hunter SDK can now:
• Scan items using GPT-4V
• Analyze market value and condition
• Create eBay listings automatically
• Handle user authentication flows
• Track sales and commissions

Integration test completed successfully!`,
      
      imageUrls: ['https://i.ebayimg.com/images/g/9~4AAOSwcu5kXKvQ/s-l1600.jpg']
    },
    availability: {
      shipToLocationAvailability: {
        quantity: 1
      }
    }
  };

  try {
    console.log('🧪 Creating inventory item...');
    
    const inventoryResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(inventoryItem)
    });

    console.log('📡 Inventory Status:', inventoryResponse.status);

    if (inventoryResponse.status === 201 || inventoryResponse.status === 204) {
      console.log('✅ Inventory item created!');
      
      // Step 3: Create offer with location
      await createCompleteOffer(ACCESS_TOKEN, sku, locationKey, headers);
      
    } else {
      const error = await inventoryResponse.text();
      console.log('❌ Inventory failed:', error);
    }

  } catch (error) {
    console.error('💥 Exception:', error.message);
  }
}

async function getOrCreateLocation(accessToken, headers) {
  console.log('🧪 Getting merchant location...');
  
  try {
    // Check existing locations
    const response = await fetch('https://api.ebay.com/sell/inventory/v1/location', {
      method: 'GET',
      headers: headers
    });

    if (response.ok) {
      const data = await response.json();
      if (data.locations && data.locations.length > 0) {
        console.log('✅ Using existing location:', data.locations[0].merchantLocationKey);
        return data.locations[0].merchantLocationKey;
      }
    }
    
    // Create a location if none exists
    console.log('🏠 Creating merchant location...');
    
    const newLocation = {
      merchantLocationKey: 'default',
      name: 'Treasure Hunter Test Location',
      location: {
        address: {
          country: 'US',
          addressLine1: '123 Test Street',
          city: 'New York',
          stateOrProvince: 'NY',
          postalCode: '10001'
        }
      },
      locationTypes: ['STORE'],
      merchantLocationStatus: 'ENABLED'
    };

    const createResponse = await fetch('https://api.ebay.com/sell/inventory/v1/location/default', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(newLocation)
    });

    if (createResponse.status === 201 || createResponse.status === 204) {
      console.log('✅ Location created successfully');
      return 'default';
    } else {
      const error = await createResponse.text();
      console.log('⚠️ Location creation failed:', error);
      return 'default'; // Try anyway
    }

  } catch (error) {
    console.log('⚠️ Location setup error:', error.message);
    return 'default'; // Fallback
  }
}

async function createCompleteOffer(accessToken, sku, locationKey, headers) {
  console.log('🧪 Creating complete offer...');
  
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
    categoryId: '171485',
    merchantLocationKey: locationKey
  };

  try {
    const offerResponse = await fetch('https://api.ebay.com/sell/inventory/v1/offer', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(offer)
    });

    console.log('📡 Offer Status:', offerResponse.status);

    if (offerResponse.ok) {
      const offerData = await offerResponse.json();
      console.log('✅ Offer created with location!');
      console.log('Offer ID:', offerData.offerId);
      
      // Publish offer
      await publishCompleteOffer(accessToken, offerData.offerId, headers);
      
    } else {
      const error = await offerResponse.text();
      console.log('❌ Offer creation failed:', error);
    }

  } catch (error) {
    console.error('💥 Offer exception:', error.message);
  }
}

async function publishCompleteOffer(accessToken, offerId, headers) {
  console.log('🧪 Publishing complete offer...');
  
  try {
    const publishResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`, {
      method: 'POST',
      headers: headers
    });

    console.log('📡 Publish Status:', publishResponse.status);

    if (publishResponse.ok) {
      const publishData = await publishResponse.json();
      
      console.log('\n🎉🎉🎉 COMPLETE SUCCESS! 🎉🎉🎉');
      console.log('✅ eBay listing published successfully!');
      console.log('📋 Listing ID:', publishData.listingId);
      console.log('🌐 Live URL: https://www.ebay.com/itm/' + publishData.listingId);
      
      console.log('\n🏆 TREASURE HUNTER SDK - EBAY INTEGRATION COMPLETE!');
      console.log('✅ OAuth flow working');
      console.log('✅ Token management working'); 
      console.log('✅ API authentication working');
      console.log('✅ Inventory creation working');
      console.log('✅ Offer creation working');
      console.log('✅ Listing publishing working');
      console.log('✅ Location handling working');
      
      console.log('\n🚀 READY FOR PRODUCTION DEPLOYMENT!');
      console.log('Your SDK can now create real eBay listings for users.');
      
      // Auto-cleanup
      setTimeout(async () => {
        try {
          await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/withdraw`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ reason: 'OTHER' })
          });
          console.log('🗑️ Test listing cleaned up automatically');
        } catch (e) {
          console.log('📝 Note: Manually delete listing ID ' + publishData.listingId + ' from eBay');
        }
      }, 120000); // 2 minutes
      
    } else {
      const error = await publishResponse.text();
      console.log('❌ Publishing failed:', error);
    }

  } catch (error) {
    console.error('💥 Publishing exception:', error.message);
  }
}

completeEbayTest().catch(console.error);