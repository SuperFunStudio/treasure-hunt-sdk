// test-ebay-scopes.js
// Test different eBay OAuth scopes to find which ones work

import dotenv from 'dotenv';
dotenv.config();

async function testEbayScopes() {
  console.log('🔑 Testing eBay OAuth Scopes...\n');

  const basicAuth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';

  // Common eBay OAuth scopes to test
  const scopesToTest = [
    // Browse API scopes
    'https://api.ebayapis.com/oauth/api_scope/buy.item.feed',
    'https://api.ebayapis.com/oauth/api_scope/buy.browse',
    'https://api.ebayapis.com/oauth/api_scope/buy.browse.guest',
    
    // Sell API scopes
    'https://api.ebayapis.com/oauth/api_scope/sell.marketing.readonly',
    'https://api.ebayapis.com/oauth/api_scope/sell.marketing',
    'https://api.ebayapis.com/oauth/api_scope/sell.inventory.readonly',
    'https://api.ebayapis.com/oauth/api_scope/sell.inventory',
    'https://api.ebayapis.com/oauth/api_scope/sell.account.readonly',
    'https://api.ebayapis.com/oauth/api_scope/sell.account',
    'https://api.ebayapis.com/oauth/api_scope/sell.fulfillment.readonly',
    'https://api.ebayapis.com/oauth/api_scope/sell.fulfillment',
    
    // General scopes
    'https://api.ebayapis.com/oauth/api_scope',
    'https://api.ebayapis.com/oauth/api_scope/commerce.catalog.readonly'
  ];

  console.log(`Testing ${scopesToTest.length} different scopes...\n`);

  const workingScopes = [];
  const failedScopes = [];

  for (const scope of scopesToTest) {
    try {
      console.log(`🔍 Testing: ${scope.split('/').pop()}`);
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: scope
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ SUCCESS - Token length: ${data.access_token?.length || 0}`);
        workingScopes.push({
          scope,
          tokenType: data.token_type,
          expiresIn: data.expires_in
        });
      } else {
        const errorText = await response.text();
        console.log(`   ❌ FAILED - ${response.status}`);
        failedScopes.push({ scope, error: errorText });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.log(`   💥 ERROR - ${error.message}`);
      failedScopes.push({ scope, error: error.message });
    }
  }

  console.log('\n📊 RESULTS:');
  console.log('============');
  console.log(`✅ Working scopes: ${workingScopes.length}`);
  console.log(`❌ Failed scopes: ${failedScopes.length}`);

  if (workingScopes.length > 0) {
    console.log('\n🎉 WORKING SCOPES:');
    workingScopes.forEach(({ scope, tokenType, expiresIn }) => {
      const scopeName = scope.split('/').pop();
      console.log(`   ✅ ${scopeName} (${tokenType}, expires in ${expiresIn}s)`);
    });

    // Test the first working scope with a real API call
    console.log('\n🔬 Testing API call with working scope...');
    await testApiCall(workingScopes[0]);
  } else {
    console.log('\n💡 No working scopes found. This might mean:');
    console.log('   - Your eBay keyset is not fully activated');
    console.log('   - Notification compliance is not complete');
    console.log('   - Your application needs additional permissions');
  }
}

async function testApiCall(workingScope) {
  try {
    const basicAuth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
    const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';

    // Get token
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: workingScope.scope
      })
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Test Browse API search
    const searchUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
    const params = new URLSearchParams({
      q: 'iPhone 12',
      limit: '5'
    });

    const searchResponse = await fetch(`${searchUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log(`   🎯 API call successful! Found ${searchData.itemSummaries?.length || 0} items`);
      
      if (searchData.itemSummaries && searchData.itemSummaries.length > 0) {
        const firstItem = searchData.itemSummaries[0];
        console.log(`   📱 Example: ${firstItem.title} - $${firstItem.price?.value || 'N/A'}`);
      }
    } else {
      const errorText = await searchResponse.text();
      console.log(`   ❌ API call failed: ${searchResponse.status} - ${errorText}`);
    }

  } catch (error) {
    console.log(`   💥 API test error: ${error.message}`);
  }
}

testEbayScopes();