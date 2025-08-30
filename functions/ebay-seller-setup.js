#!/usr/bin/env node

// ebay-seller-setup.js
// Help set up required eBay seller policies

require('dotenv').config();

async function setupEbaySeller() {
  console.log('🏪 eBay Seller Account Setup Helper\n');

  const {
    EBAY_ACCESS_TOKEN,
    EBAY_ENVIRONMENT = 'production'
  } = process.env;

  if (!EBAY_ACCESS_TOKEN) {
    console.error('❌ No EBAY_ACCESS_TOKEN found');
    process.exit(1);
  }

  const fetch = (await import('node-fetch')).default;
  const apiUrl = EBAY_ENVIRONMENT === 'sandbox' 
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';

  console.log(`🌐 Working with: ${apiUrl}\n`);

  // Step 1: Check seller account status
  console.log('📋 Step 1: Checking seller account status...');
  await checkSellerStatus(fetch, apiUrl, EBAY_ACCESS_TOKEN);

  // Step 2: Create required policies
  console.log('\n📋 Step 2: Setting up required seller policies...');
  await setupPolicies(fetch, apiUrl, EBAY_ACCESS_TOKEN);

  // Step 3: Test listing creation capability
  console.log('\n📋 Step 3: Testing listing creation capability...');
  await testListingCapability(fetch, apiUrl, EBAY_ACCESS_TOKEN);
}

async function checkSellerStatus(fetch, apiUrl, token) {
  try {
    // Check seller privileges
    const response = await fetch(`${apiUrl}/sell/account/v1/privilege`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Seller privileges obtained');
      
      if (data.sellingLimit) {
        console.log(`💰 Selling limit: $${data.sellingLimit.amount} ${data.sellingLimit.currency}`);
      }
      
      if (data.sellerRegistrationCompleted !== undefined) {
        console.log(`📝 Registration complete: ${data.sellerRegistrationCompleted}`);
      }
    } else {
      console.log(`⚠️ Seller privileges check: ${response.status} ${response.statusText}`);
      
      if (response.status === 400) {
        console.log('💡 This might mean you need to complete seller registration on eBay.com');
      }
    }
  } catch (error) {
    console.log(`❌ Error checking seller status: ${error.message}`);
  }
}

async function setupPolicies(fetch, apiUrl, token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
  };
 

  // 1. Create Payment Policy
  console.log('\n💳 Creating payment policy...');
  try {
    const paymentPolicy = {
      name: 'Default Payment Policy',
      description: 'Default payment policy for listings',
      marketplaceId: 'EBAY_US',
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      paymentMethods: [{
        brands: ['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS', 'DISCOVER'],
        paymentMethodType: 'CREDIT_CARD'
      }]
    };

    const paymentResponse = await fetch(`${apiUrl}/sell/account/v1/payment_policy`, {
      method: 'POST',
      headers,
      body: JSON.stringify(paymentPolicy)
    });

    if (paymentResponse.ok) {
      const paymentData = await paymentResponse.json();
      console.log(`✅ Payment policy created: ${paymentData.paymentPolicyId}`);
    } else {
      const errorText = await paymentResponse.text();
      console.log(`❌ Payment policy failed: ${paymentResponse.status}`);
      console.log(`   Details: ${errorText.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`❌ Payment policy error: ${error.message}`);
  }

  // 2. Create Fulfillment Policy  
  console.log('\n📦 Creating fulfillment (shipping) policy...');
  try {
    const fulfillmentPolicy = {
      name: 'Default Shipping Policy',
      description: 'Default shipping policy for listings',
      marketplaceId: 'EBAY_US',
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      handlingTime: { value: 1, unit: 'DAY' },
      shippingOptions: [{
        optionType: 'DOMESTIC',
        costType: 'FLAT_RATE',
        shippingServices: [{
          serviceName: 'USPSGround',
          freeShipping: false,
          shippingCost: { value: '5.99', currency: 'USD' }
        }]
      }],
      globalShipping: false
    };

    const fulfillmentResponse = await fetch(`${apiUrl}/sell/account/v1/fulfillment_policy`, {
      method: 'POST',
      headers,
      body: JSON.stringify(fulfillmentPolicy)
    });

    if (fulfillmentResponse.ok) {
      const fulfillmentData = await fulfillmentResponse.json();
      console.log(`✅ Fulfillment policy created: ${fulfillmentData.fulfillmentPolicyId}`);
    } else {
      const errorText = await fulfillmentResponse.text();
      console.log(`❌ Fulfillment policy failed: ${fulfillmentResponse.status}`);
      console.log(`   Details: ${errorText.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`❌ Fulfillment policy error: ${error.message}`);
  }

  // 3. Create Return Policy
  console.log('\n🔄 Creating return policy...');
  try {
    const returnPolicy = {
      name: 'Default Return Policy',
      description: 'Default return policy for listings',
      marketplaceId: 'EBAY_US',
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      returnsAccepted: true,
      returnPeriod: { value: 30, unit: 'DAY' },
      refundMethod: 'MONEY_BACK',
      returnShippingCostPayer: 'BUYER'
    };

    const returnResponse = await fetch(`${apiUrl}/sell/account/v1/return_policy`, {
      method: 'POST',
      headers,
      body: JSON.stringify(returnPolicy)
    });

    if (returnResponse.ok) {
      const returnData = await returnResponse.json();
      console.log(`✅ Return policy created: ${returnData.returnPolicyId}`);
    } else {
      const errorText = await returnResponse.text();
      console.log(`❌ Return policy failed: ${returnResponse.status}`);
      console.log(`   Details: ${errorText.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`❌ Return policy error: ${error.message}`);
  }
}

async function testListingCapability(fetch, apiUrl, token) {
  try {
    // Test if we can now access policies
    console.log('🧪 Testing policy access...');
    
    const tests = [
      { name: 'Payment Policies', endpoint: '/sell/account/v1/payment_policy' },
      { name: 'Fulfillment Policies', endpoint: '/sell/account/v1/fulfillment_policy' },
      { name: 'Return Policies', endpoint: '/sell/account/v1/return_policy' }
    ];

    let allWorking = true;

    for (const test of tests) {
      const response = await fetch(`${apiUrl}${test.endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      });

      if (response.ok) {
        console.log(`✅ ${test.name}: Accessible`);
      } else {
        console.log(`❌ ${test.name}: ${response.status} ${response.statusText}`);
        allWorking = false;
      }
    }

    if (allWorking) {
      console.log('\n🎉 SUCCESS! Your seller account should now be able to create listings.');
      console.log('🚀 Try running your frontend listing creation again.');
    } else {
      console.log('\n⚠️ Some policies still not accessible. You may need to:');
      console.log('1. Complete seller verification on eBay.com');
      console.log('2. Set up seller account manually through eBay Seller Hub');
      console.log('3. Ensure your eBay account is in good standing');
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

// Manual setup instructions
function showManualInstructions() {
  console.log('\n📖 MANUAL SETUP INSTRUCTIONS:');
  console.log('If the automated setup fails, you can set up policies manually:');
  console.log('');
  console.log('1. 🌐 Go to eBay Seller Hub: https://www.ebay.com/sh/ovw');
  console.log('2. 📋 Navigate to Account > Business Policies');
  console.log('3. ➕ Create the following policies:');
  console.log('   • Payment Policy (accept credit cards)');
  console.log('   • Shipping Policy (flat rate or calculated)'); 
  console.log('   • Return Policy (30-day returns recommended)');
  console.log('4. ✅ Make sure all policies are set as default');
  console.log('');
  console.log('📞 If you still have issues:');
  console.log('   • Contact eBay Seller Support');
  console.log('   • Verify your seller account is in good standing');
  console.log('   • Ensure you\'ve completed any required verifications');
}

// Run setup
setupEbaySeller()
  .then(() => {
    console.log('\n📚 Additional Help:');
    showManualInstructions();
  })
  .catch(console.error);