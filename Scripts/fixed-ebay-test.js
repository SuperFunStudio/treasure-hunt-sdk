// fixed-ebay-test.js
// Test with corrected eBay API headers
import dotenv from 'dotenv';

dotenv.config();

async function testEbayWithFixedHeaders() {
  console.log('🔧 Testing eBay API with fixed headers...');

  const CLIENT_ID = '***REMOVED***';
  const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
  
  // Use your fresh tokens from .env
  const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;
  
  if (!ACCESS_TOKEN) {
    console.error('❌ No access token in .env file');
    console.log('Add: EBAY_ACCESS_TOKEN=your_token_here');
    return;
  }

  console.log('✅ Access token found (length:', ACCESS_TOKEN.length, ')');

  // Test with minimal eBay API call first
  try {
    console.log('🧪 Testing basic API connectivity...');
    
    const response = await fetch('https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    console.log('📡 API Response Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API connectivity works!');
      console.log('Fulfillment policies found:', data.fulfillmentPolicies?.length || 0);
      
      // Now test inventory item creation with fixed headers
      await testInventoryCreation(ACCESS_TOKEN);
      
    } else {
      const error = await response.text();
      console.log('❌ API test failed:', error);
    }

  } catch (error) {
    console.error('💥 API test exception:', error.message);
  }
}

async function testInventoryCreation(accessToken) {
  console.log('\n🧪 Testing inventory item creation...');
  
  const sku = `TEST_${Date.now()}`;
  
  const inventoryItem = {
    condition: 'USED_GOOD',
    product: {
      title: 'TEST - Delete This Item - SDK Test',
      description: 'This is a test inventory item created by Treasure Hunter SDK. Please delete immediately.',
      imageUrls: ['https://i.ebayimg.com/images/g/9~4AAOSwcu5kXKvQ/s-l1600.jpg']
    },
    availability: {
      shipToLocationAvailability: {
        quantity: 1
      }
    }
  };

  try {
    const response = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      body: JSON.stringify(inventoryItem)
    });

    console.log('📡 Inventory API Status:', response.status);

    if (response.ok) {
      console.log('✅ Inventory item created successfully!');
      console.log('SKU:', sku);
      
      // Test offer creation
      await testOfferCreation(accessToken, sku);
      
    } else {
      const error = await response.text();
      console.log('❌ Inventory creation failed:', error);
    }

  } catch (error) {
    console.error('💥 Inventory creation exception:', error.message);
  }
}

async function testOfferCreation(accessToken, sku) {
  console.log('\n🧪 Testing offer creation...');
  
  const offer = {
    sku: sku,
    marketplaceId: 'EBAY_US',
    format: 'FIXED_PRICE',
    pricingSummary: {
      price: {
        currency: 'USD',
        value: '1.99'
      }
    },
    categoryId: '171485',
    merchantLocationKey: 'default'
  };

  try {
    const response = await fetch('https://api.ebay.com/sell/inventory/v1/offer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      body: JSON.stringify(offer)
    });

    console.log('📡 Offer API Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Offer created successfully!');
      console.log('Offer ID:', data.offerId);
      
      // Test publishing
      await testOfferPublishing(accessToken, data.offerId);
      
    } else {
      const error = await response.text();
      console.log('❌ Offer creation failed:', error);
    }

  } catch (error) {
    console.error('💥 Offer creation exception:', error.message);
  }
}

async function testOfferPublishing(accessToken, offerId) {
  console.log('\n🧪 Testing offer publishing...');
  
  try {
    const response = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    console.log('📡 Publish API Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('🎉 SUCCESS! Listing published!');
      console.log('Listing ID:', data.listingId);
      console.log('URL: https://www.ebay.com/itm/' + data.listingId);
      
      console.log('\n🎯 YOUR EBAY INTEGRATION IS FULLY WORKING!');
      console.log('✅ OAuth ✅ API Calls ✅ Listing Creation ✅ Publishing');
      
      // Auto-delete after 60 seconds
      console.log('\n⏳ Auto-deleting in 60 seconds...');
      setTimeout(async () => {
        try {
          await deleteTestListing(accessToken, offerId);
        } catch (e) {
          console.log('⚠️ Manual deletion needed for listing:', data.listingId);
        }
      }, 60000);
      
    } else {
      const error = await response.text();
      console.log('❌ Publishing failed:', error);
    }

  } catch (error) {
    console.error('💥 Publishing exception:', error.message);
  }
}

async function deleteTestListing(accessToken, offerId) {
  console.log('🗑️ Deleting test listing...');
  
  try {
    const response = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/withdraw`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      body: JSON.stringify({ reason: 'OTHER' })
    });

    if (response.ok) {
      console.log('✅ Test listing deleted successfully');
    } else {
      console.log('⚠️ Could not auto-delete listing');
    }
  } catch (error) {
    console.log('⚠️ Deletion error:', error.message);
  }
}

// Run the test
testEbayWithFixedHeaders().catch(console.error);