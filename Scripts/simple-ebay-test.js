// simple-ebay-test.js
// Test eBay API without business policies
import dotenv from 'dotenv';

dotenv.config();

async function simpleEbayTest() {
  console.log('🧪 Simple eBay API Test (No Business Policies Required)...\n');

  const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;
  
  if (!ACCESS_TOKEN) {
    console.error('❌ No access token found');
    return;
  }

  console.log('✅ Access token loaded (length:', ACCESS_TOKEN.length, ')');

  // Test 1: Get user account info (basic API call)
  try {
    console.log('\n🧪 Test 1: Getting account info...');
    
    const response = await fetch('https://api.ebay.com/sell/account/v1/privilege', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    console.log('📡 Account API Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Account API works!');
      console.log('Seller privileges:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.log('❌ Account API failed:', error);
    }

  } catch (error) {
    console.error('💥 Account test exception:', error.message);
  }

  // Test 2: Check seller status
  try {
    console.log('\n🧪 Test 2: Checking seller status...');
    
    const response = await fetch('https://api.ebay.com/sell/account/v1/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    console.log('📡 User API Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ User API works!');
      console.log('User info:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.log('❌ User API failed:', error);
    }

  } catch (error) {
    console.error('💥 User test exception:', error.message);
  }

  // Test 3: Try a simple inventory call without policies
  try {
    console.log('\n🧪 Test 3: Testing basic inventory access...');
    
    const response = await fetch('https://api.ebay.com/sell/inventory/v1/inventory_item?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    console.log('📡 Inventory API Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Inventory API works!');
      console.log('Existing inventory items:', data.inventoryItems?.length || 0);
      
      // If inventory API works, try creating simple item
      await testSimpleItemCreation(ACCESS_TOKEN);
      
    } else {
      const error = await response.text();
      console.log('❌ Inventory API failed:', error);
      
      if (error.includes('Business Policy')) {
        console.log('\n🔧 SOLUTION NEEDED:');
        console.log('Your eBay account needs to be set up as a business seller.');
        console.log('This is required for the advanced Sell API.');
      }
    }

  } catch (error) {
    console.error('💥 Inventory test exception:', error.message);
  }
}

async function testSimpleItemCreation(accessToken) {
  console.log('\n🧪 Test 4: Creating simple inventory item...');
  
  const sku = `SIMPLE_TEST_${Date.now()}`;
  
  // Ultra-simple inventory item without business policies
  const simpleItem = {
    condition: 'USED_GOOD',
    product: {
      title: 'Simple Test Item - Delete Me',
      description: 'Basic test item for API validation.',
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
      body: JSON.stringify(simpleItem)
    });

    console.log('📡 Simple Item Creation Status:', response.status);

    if (response.ok) {
      console.log('✅ Simple inventory item created!');
      console.log('SKU:', sku);
      
      console.log('\n🎉 SUCCESS! Your eBay integration is working!');
      console.log('✅ OAuth authentication works');
      console.log('✅ API connectivity works');
      console.log('✅ Inventory creation works');
      
      console.log('\n📋 Next Steps:');
      console.log('1. Set up your eBay account as a business seller');
      console.log('2. Configure payment, shipping, and return policies');
      console.log('3. Then you can create full listings with offers');
      
    } else {
      const error = await response.text();
      console.log('❌ Simple item creation failed:', error);
      
      if (error.includes('Business Policy') || error.includes('not eligible')) {
        console.log('\n🔧 ACCOUNT SETUP REQUIRED:');
        console.log('Your eBay account needs business seller setup.');
        console.log('Visit: https://www.ebay.com/sellerhub/');
        console.log('Complete the business seller registration.');
      }
    }

  } catch (error) {
    console.error('💥 Simple item creation exception:', error.message);
  }
}

console.log('🎯 Testing eBay API with simplified approach...');
console.log('This avoids business policy requirements for initial testing.\n');

simpleEbayTest().catch(console.error);