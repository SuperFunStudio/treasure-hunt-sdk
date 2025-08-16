// test-browse-api-directly.js
// Test if Browse API works with your general scope

import dotenv from 'dotenv';
dotenv.config();

async function testBrowseAPIDirectly() {
  console.log('🔍 Testing Browse API Access Directly...\n');

  try {
    // Test with the general scope you have
    console.log('1️⃣ Testing with general eBay scope...');
    await testBrowseWithScope('https://api.ebay.com/oauth/api_scope');
    
    console.log('\n2️⃣ Testing with no scope (client credentials only)...');
    await testBrowseWithScope('');
    
    console.log('\n3️⃣ Testing different scope combinations...');
    const scopesToTry = [
      'https://api.ebay.com/oauth/api_scope/buy.browse',
      'https://api.ebay.com/oauth/api_scope/buy.item.feed',
      'https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly'
    ];
    
    for (const scope of scopesToTry) {
      console.log(`\nTesting scope: ${scope.split('/').pop()}`);
      await testBrowseWithScope(scope);
    }

  } catch (error) {
    console.error('❌ Failed to test Browse API:', error.message);
  }
}

async function testBrowseWithScope(scope) {
  try {
    // Get token with specific scope
    const token = await getTokenWithScope(scope);
    
    if (!token) {
      console.log('   ❌ Could not get token for this scope');
      return;
    }
    
    console.log('   ✅ Got token, testing Browse API...');
    
    // Test Browse API search
    const searchUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
    const params = new URLSearchParams({
      q: 'iPhone 12',
      limit: '3'
    });

    const response = await fetch(`${searchUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country%3DUS%2Czip%3D94022'
      }
    });

    const responseText = await response.text();
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log(`   🎉 SUCCESS! Found ${data.itemSummaries?.length || 0} items`);
      
      if (data.itemSummaries && data.itemSummaries.length > 0) {
        const firstItem = data.itemSummaries[0];
        console.log(`   📱 Example: ${firstItem.title?.substring(0, 50)}...`);
        console.log(`   💰 Price: $${firstItem.price?.value || 'N/A'}`);
        console.log(`   🔗 URL: ${firstItem.itemWebUrl?.substring(0, 50)}...`);
        
        // This means the Browse API is working!
        return true;
      }
    } else {
      console.log(`   ❌ Failed: ${response.status}`);
      try {
        const errorData = JSON.parse(responseText);
        console.log(`   Error: ${errorData.errors?.[0]?.message || errorData.error_description || 'Unknown error'}`);
      } catch (e) {
        console.log(`   Raw error: ${responseText.substring(0, 100)}`);
      }
    }
    
  } catch (error) {
    console.log(`   💥 Error: ${error.message}`);
  }
  
  return false;
}

async function getTokenWithScope(scope) {
  const basicAuth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  
  const body = new URLSearchParams({
    grant_type: 'client_credentials'
  });
  
  if (scope) {
    body.append('scope', scope);
  }
  
  try {
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body
    });

    if (response.ok) {
      const data = await response.json();
      return data.access_token;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

// Also test the specific Browse API endpoints mentioned in the documentation
async function testSpecificEndpoints() {
  console.log('\n📋 Testing Specific Browse API Endpoints...\n');
  
  // Try with general scope first
  const token = await getTokenWithScope('https://api.ebay.com/oauth/api_scope');
  
  if (!token) {
    console.log('❌ Could not get token for testing');
    return;
  }
  
  const endpointsToTest = [
    {
      name: 'Item Summary Search',
      url: 'https://api.ebay.com/buy/browse/v1/item_summary/search?q=test&limit=1'
    },
    {
      name: 'Product Summary Search', 
      url: 'https://api.ebay.com/buy/browse/v1/product_summary/search?q=iPhone&limit=1'
    }
  ];
  
  for (const endpoint of endpointsToTest) {
    console.log(`Testing ${endpoint.name}...`);
    
    try {
      const response = await fetch(endpoint.url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ ${endpoint.name}: Working!`);
      } else {
        console.log(`   ❌ ${endpoint.name}: ${response.status}`);
      }
    } catch (error) {
      console.log(`   💥 ${endpoint.name}: ${error.message}`);
    }
  }
}

// Run the tests
testBrowseAPIDirectly().then(() => {
  testSpecificEndpoints();
});