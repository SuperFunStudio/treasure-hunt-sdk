require('dotenv').config();

async function testEbayConnection() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  
  console.log('Testing eBay connection...');
  console.log('Client ID present:', !!clientId);
  console.log('Client Secret present:', !!clientSecret);
  
  // Test token generation
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
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
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ eBay token obtained successfully!');
      console.log('Token expires in:', data.expires_in, 'seconds');
      
      // Test a simple search
      const searchResponse = await fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?q=iPhone&limit=1', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      });
      
      if (searchResponse.ok) {
        console.log('✅ eBay search API working!');
      } else {
        console.log('❌ Search failed:', searchResponse.status);
      }
    } else {
      const error = await response.text();
      console.log('❌ Token generation failed:', error);
    }
  } catch (error) {
    console.error('Connection error:', error);
  }
}

testEbayConnection();