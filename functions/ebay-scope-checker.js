#!/usr/bin/env node

// ebay-scope-checker.js
// Check what permissions your eBay token actually has

require('dotenv').config();

async function checkEbayTokenScopes() {
  console.log('🔍 Checking eBay Token Scopes and Permissions...\n');

  const {
    EBAY_ACCESS_TOKEN,
    EBAY_ENVIRONMENT = 'production'
  } = process.env;

  if (!EBAY_ACCESS_TOKEN) {
    console.error('❌ No EBAY_ACCESS_TOKEN found in environment');
    process.exit(1);
  }

  const fetch = (await import('node-fetch')).default;
  const apiUrl = EBAY_ENVIRONMENT === 'sandbox' 
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';

  console.log(`🌐 Testing against: ${apiUrl}`);
  console.log(`🔑 Token: ${EBAY_ACCESS_TOKEN.slice(0, 20)}...\n`);

  // Test different API endpoints to determine scope
  const tests = [
    {
      name: 'Browse API (Public)',
      endpoint: '/buy/browse/v1/item_summary/search?q=test&limit=1',
      scope: 'https://api.ebay.com/oauth/api_scope/buy.item.feed',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${EBAY_ACCESS_TOKEN}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    },
    {
      name: 'Account - Payment Policies',
      endpoint: '/sell/account/v1/payment_policy',
      scope: 'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      method: 'GET'
    },
    {
      name: 'Account - Fulfillment Policies',
      endpoint: '/sell/account/v1/fulfillment_policy',
      scope: 'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      method: 'GET'
    },
    {
      name: 'Account - Return Policies',
      endpoint: '/sell/account/v1/return_policy',
      scope: 'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      method: 'GET'
    },
    {
      name: 'Inventory - Read',
      endpoint: '/sell/inventory/v1/inventory_item',
      scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      method: 'GET'
    },
    {
      name: 'Inventory - Offers',
      endpoint: '/sell/inventory/v1/offer',
      scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      method: 'GET'
    },
    {
      name: 'Merchant Location',
      endpoint: '/sell/inventory/v1/location',
      scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      method: 'GET'
    }
  ];

  const results = [];
  
  for (const test of tests) {
    console.log(`🧪 Testing: ${test.name}`);
    
    try {
      const response = await fetch(`${apiUrl}${test.endpoint}`, {
        method: test.method,
        headers: {
          'Authorization': `Bearer ${EBAY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          ...test.headers
        }
      });

      const status = response.status;
      const statusText = response.statusText;
      
      let result = {
        name: test.name,
        scope: test.scope,
        status,
        statusText,
        success: false,
        message: ''
      };

      if (status === 200) {
        result.success = true;
        result.message = '✅ SUCCESS - Full access';
        console.log(`   ✅ ${status} - SUCCESS`);
      } else if (status === 401) {
        result.message = '❌ UNAUTHORIZED - Missing scope or invalid token';
        console.log(`   ❌ ${status} - UNAUTHORIZED`);
      } else if (status === 403) {
        result.message = '⚠️ FORBIDDEN - Token valid but insufficient permissions';
        console.log(`   ⚠️ ${status} - FORBIDDEN`);
      } else if (status === 404) {
        result.message = '❓ NOT FOUND - Endpoint may not exist or no data';
        console.log(`   ❓ ${status} - NOT FOUND`);
      } else {
        result.message = `❓ ${status} ${statusText}`;
        console.log(`   ❓ ${status} - ${statusText}`);
      }

      // Try to get response body for more info
      try {
        const responseText = await response.text();
        if (responseText && responseText.length < 500) {
          result.details = responseText;
        }
      } catch (e) {
        // Ignore errors reading response body
      }

      results.push(result);
      
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
      results.push({
        name: test.name,
        scope: test.scope,
        success: false,
        message: `💥 ERROR: ${error.message}`
      });
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 EBAY TOKEN SCOPE ANALYSIS');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);
  const unauthorized = results.filter(r => r.message.includes('UNAUTHORIZED'));
  const forbidden = results.filter(r => r.message.includes('FORBIDDEN'));

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Unauthorized: ${unauthorized.length}/${results.length}`);
  console.log(`⚠️ Forbidden: ${forbidden.length}/${results.length}`);

  if (successful.length > 0) {
    console.log('\n✅ WORKING SCOPES:');
    successful.forEach(r => {
      console.log(`   • ${r.name}`);
      console.log(`     Scope: ${r.scope}`);
    });
  }

  if (unauthorized.length > 0) {
    console.log('\n❌ MISSING SCOPES:');
    unauthorized.forEach(r => {
      console.log(`   • ${r.name}`);
      console.log(`     Required: ${r.scope}`);
    });
  }

  if (forbidden.length > 0) {
    console.log('\n⚠️ LIMITED ACCESS:');
    forbidden.forEach(r => {
      console.log(`   • ${r.name} - Token valid but may need seller account setup`);
    });
  }

  // Recommendations
  console.log('\n🎯 RECOMMENDATIONS:');
  
  if (unauthorized.length > 0) {
    console.log('\n1. 🔄 Get token with required scopes:');
    console.log('   Required scopes for listing creation:');
    console.log('   • https://api.ebay.com/oauth/api_scope/sell.inventory');
    console.log('   • https://api.ebay.com/oauth/api_scope/sell.inventory.readonly');
    console.log('   • https://api.ebay.com/oauth/api_scope/sell.account');
    console.log('   • https://api.ebay.com/oauth/api_scope/sell.account.readonly');
    
    console.log('\n   📝 To get proper scopes:');
    console.log('   a) Go to eBay Developer Console');
    console.log('   b) Generate User Token (not just App Token)');
    console.log('   c) Include all sell.* scopes');
    console.log('   d) Complete seller account verification if needed');
  }

  if (forbidden.length > 0) {
    console.log('\n2. 🏪 Complete eBay Seller Setup:');
    console.log('   • Verify your eBay seller account');
    console.log('   • Set up payment and return policies');
    console.log('   • Complete business verification if required');
  }

  if (successful.length === 0) {
    console.log('\n3. 🆘 Token Issues:');
    console.log('   • Token may be completely invalid');
    console.log('   • Try getting a fresh token from eBay Developer Console');
    console.log('   • Ensure you\'re using the correct environment (sandbox/production)');
  }

  console.log('\n📋 Next Steps:');
  if (successful.length < 4) {
    console.log('❌ Your token cannot create eBay listings yet.');
    console.log('🔧 Fix the scope/permission issues above first.');
  } else {
    console.log('✅ Your token should work for eBay listings!');
    console.log('🚀 Try the listing creation again.');
  }
}

// Run the scope check
checkEbayTokenScopes().catch(console.error);