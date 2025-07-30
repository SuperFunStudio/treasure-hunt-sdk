// debug-working-scope.js
// Find the exact scope that works

import dotenv from 'dotenv';
dotenv.config();

async function debugWorkingScope() {
  console.log('🔍 Finding exact working scope...\n');

  const basicAuth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  
  // Test the exact scope from the successful test
  console.log('Testing the scope that worked in direct test...');
  
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope'
    })
  });

  console.log('Response status:', response.status);
  const responseText = await response.text();
  console.log('Response:', responseText);

  if (response.ok) {
    const data = JSON.parse(responseText);
    console.log('\n✅ Token received successfully!');
    console.log('Token length:', data.access_token?.length);
    console.log('Expires in:', data.expires_in);
    
    // Test the Browse API with this token
    console.log('\n🔍 Testing Browse API with this token...');
    await testBrowseAPI(data.access_token);
  } else {
    console.log('\n❌ Token request failed');
  }
}

async function testBrowseAPI(token) {
  try {
    const searchUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
    const params = new URLSearchParams({
      q: 'iPhone 12',
      limit: '3'
    });

    const response = await fetch(`${searchUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Browse API SUCCESS! Found ${data.itemSummaries?.length || 0} items`);
      
      if (data.itemSummaries && data.itemSummaries.length > 0) {
        console.log('\n📋 Sample results:');
        data.itemSummaries.forEach((item, index) => {
          console.log(`${index + 1}. $${item.price?.value} - ${item.title?.substring(0, 60)}...`);
        });
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Browse API failed: ${response.status}`);
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.log(`💥 Browse API error: ${error.message}`);
  }
}

debugWorkingScope();