#!/usr/bin/env node

// Manual Token eBay Policy Fix
// Use this when refresh tokens are expired - requires manually getting a fresh token

const https = require('https');

const CONFIG = {
  // You'll need to manually get a fresh token and paste it here
  ACCESS_TOKEN: process.env.EBAY_ACCESS_TOKEN || '',
  FULFILLMENT_POLICY_ID: '380523954022',
  PAYMENT_POLICY_ID: '380524190022',
  RETURN_POLICY_ID: '380524198022'
};

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null,
            rawBody: data
          };
          resolve(result);
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data, rawBody: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function getCurrentPolicy() {
  console.log('📥 Getting current fulfillment policy...');
  
  const options = {
    hostname: 'api.ebay.com',
    path: `/sell/account/v1/fulfillment_policy/${CONFIG.FULFILLMENT_POLICY_ID}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CONFIG.ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = await makeRequest(options);
  
  if (response.statusCode === 401) {
    console.error('❌ Token is invalid or expired');
    console.log('\n🔑 To get a fresh token:');
    console.log('1. Go to: https://developer.ebay.com/my/keys');
    console.log('2. Click "Get a User Token" for your app');
    console.log('3. Complete the OAuth flow');
    console.log('4. Copy the access token and set it as EBAY_ACCESS_TOKEN environment variable');
    console.log('\nExample: EBAY_ACCESS_TOKEN="v^1.1#..." node manual-fix.js');
    return null;
  }
  
  if (response.statusCode !== 200) {
    console.error('❌ Failed to get policy:', response.statusCode, response.body);
    return null;
  }
  
  console.log('✅ Policy retrieved successfully');
  return response.body;
}

async function analyzeAndFixPolicy(policy) {
  console.log('\n📊 Current Policy Analysis:');
  console.log('Policy Name:', policy.name);
  console.log('Marketplace:', policy.marketplaceId);
  console.log('Handling Time:', policy.handlingTime?.value, policy.handlingTime?.unit);
  
  // Analyze shipping options
  if (!policy.shippingOptions || policy.shippingOptions.length === 0) {
    console.log('❌ ERROR: No shipping options found!');
    return false;
  }
  
  console.log('\n🚢 Current Shipping Services:');
  const services = [];
  policy.shippingOptions[0].shippingServices?.forEach((service, i) => {
    console.log(`   ${i + 1}. ${service.shippingCarrierCode} - ${service.shippingServiceCode}`);
    services.push(service.shippingServiceCode);
  });
  
  // Check for problematic services
  const problematicServices = ['USPSMedia', 'FedExSmartPost', 'US_UPSSurePost'];
  const hasProblems = services.some(s => problematicServices.includes(s));
  
  if (hasProblems) {
    console.log('\n⚠️  Found deprecated services that may cause 25007 errors:');
    services.filter(s => problematicServices.includes(s)).forEach(s => {
      console.log(`   - ${s} (deprecated)`);
    });
    console.log('\n🔧 Applying fix...');
    return await applyFix(policy);
  } else {
    console.log('\n✅ No obviously deprecated services found');
    console.log('🔧 Will still try adding reliable shipping services...');
    return await applyFix(policy);
  }
}

async function applyFix(originalPolicy) {
  console.log('🔧 Updating fulfillment policy with reliable shipping services...');
  
  // Create clean policy with modern USPS services
  const updatedPolicy = {
    name: originalPolicy.name,
    description: originalPolicy.description,
    marketplaceId: originalPolicy.marketplaceId,
    handlingTime: originalPolicy.handlingTime,
    localPickup: originalPolicy.localPickup || false,
    freightShipping: originalPolicy.freightShipping || false,
    globalShipping: originalPolicy.globalShipping || false,
    pickupDropOff: originalPolicy.pickupDropOff || false,
    
    // Replace shipping options with reliable services
    shippingOptions: [
      {
        optionType: 'DOMESTIC',
        costType: 'CALCULATED',
        shippingServices: [
          {
            sortOrder: 1,
            shippingCarrierCode: 'USPS',
            shippingServiceCode: 'USPSGround',
            freeShipping: false,
            buyerResponsibleForShipping: false,
            buyerResponsibleForPickup: false
          },
          {
            sortOrder: 2,
            shippingCarrierCode: 'USPS',
            shippingServiceCode: 'USPSPriority',
            freeShipping: false,
            buyerResponsibleForShipping: false,
            buyerResponsibleForPickup: false
          }
        ]
      }
    ]
  };
  
  // Update the policy
  const options = {
    hostname: 'api.ebay.com',
    path: `/sell/account/v1/fulfillment_policy/${CONFIG.FULFILLMENT_POLICY_ID}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CONFIG.ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = await makeRequest(options, updatedPolicy);
  
  if (response.statusCode !== 200) {
    console.error('❌ Failed to update policy:', response.statusCode, response.body);
    return false;
  }
  
  console.log('✅ Policy updated successfully!');
  console.log('\n📦 New shipping services:');
  console.log('   1. USPS Ground (reliable for most items)');
  console.log('   2. USPS Priority (faster option)');
  
  return true;
}

async function quickVerification() {
  console.log('\n🧪 Quick verification test...');
  
  try {
    const testSKU = `VERIFY_${Date.now()}`;
    
    // Try to create a simple inventory item
    const testItem = {
      sku: testSKU,
      product: {
        title: 'Policy Verification Test',
        description: 'Test item to verify fulfillment policy',
        imageUrls: ['https://i.ebayimg.com/images/g/1~4AAOSwKQdkXnGH/s-l300.jpg']
      },
      condition: 'NEW',
      availability: {
        shipToLocationAvailability: { quantity: 1 }
      }
    };
    
    const inventoryOptions = {
      hostname: 'api.ebay.com',
      path: `/sell/inventory/v1/inventory_item/${testSKU}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CONFIG.ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Language': 'en-US'
      }
    };
    
    const inventoryResponse = await makeRequest(inventoryOptions, testItem);
    
    if (inventoryResponse.statusCode !== 200 && inventoryResponse.statusCode !== 204) {
      console.log('❌ Inventory test failed:', inventoryResponse.statusCode);
      return false;
    }
    
    console.log('✅ Inventory creation test passed');
    
    // Try to create an offer (this is where 25007 would happen)
    const testOffer = {
      sku: testSKU,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      availableQuantity: 1,
      categoryId: '66743',
      listingDescription: 'Policy verification test',
      pricingSummary: { price: { value: '1.00', currency: 'USD' } },
      fulfillmentPolicyId: CONFIG.FULFILLMENT_POLICY_ID,
      paymentPolicyId: CONFIG.PAYMENT_POLICY_ID,
      returnPolicyId: CONFIG.RETURN_POLICY_ID
    };
    
    const offerOptions = {
      hostname: 'api.ebay.com',
      path: '/sell/inventory/v1/offer',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Language': 'en-US'
      }
    };
    
    const offerResponse = await makeRequest(offerOptions, testOffer);
    
    // Clean up inventory regardless of offer result
    const cleanupOptions = {
      hostname: 'api.ebay.com',
      path: `/sell/inventory/v1/inventory_item/${testSKU}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${CONFIG.ACCESS_TOKEN}` }
    };
    await makeRequest(cleanupOptions);
    
    if (offerResponse.statusCode === 201) {
      console.log('✅ Offer creation test passed!');
      
      // Clean up the offer too
      const offerId = offerResponse.body.offerId;
      const deleteOfferOptions = {
        hostname: 'api.ebay.com',
        path: `/sell/inventory/v1/offer/${offerId}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${CONFIG.ACCESS_TOKEN}` }
      };
      await makeRequest(deleteOfferOptions);
      
      return true;
    } else {
      console.log('❌ Offer creation failed:', offerResponse.statusCode);
      if (offerResponse.body && offerResponse.body.errors) {
        offerResponse.body.errors.forEach(error => {
          console.log(`   Error ${error.errorId}: ${error.message}`);
        });
      }
      return false;
    }
    
  } catch (error) {
    console.error('💥 Verification error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 eBay Policy Fix Tool (Manual Token Mode)\n');
  
  if (!CONFIG.ACCESS_TOKEN) {
    console.error('❌ No access token provided!');
    console.log('\n🔑 To get a fresh token:');
    console.log('1. Go to: https://developer.ebay.com/my/keys');
    console.log('2. Click "Get a User Token" for your app');
    console.log('3. Complete the OAuth flow');
    console.log('4. Run: EBAY_ACCESS_TOKEN="your_token" node manual-fix.js');
    process.exit(1);
  }
  
  try {
    // Step 1: Get current policy
    const policy = await getCurrentPolicy();
    if (!policy) {
      process.exit(1);
    }
    
    // Step 2: Analyze and fix
    const fixSuccess = await analyzeAndFixPolicy(policy);
    if (!fixSuccess) {
      console.error('❌ Policy fix failed');
      process.exit(1);
    }
    
    // Step 3: Verify the fix
    const verifySuccess = await quickVerification();
    
    if (verifySuccess) {
      console.log('\n🎉 SUCCESS! Your eBay fulfillment policy is now working!');
      console.log('The 25007 error should be resolved. Try creating your listing again.');
    } else {
      console.log('\n⚠️  Policy was updated but verification failed.');
      console.log('The 25007 error may still occur. Manual review recommended.');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}