// test-auth-vs-oauth.js
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Testing Your Current eBay Token Type');
console.log('=====================================');

const token = process.env.EBAY_ACCESS_TOKEN;

if (!token) {
  console.log('❌ No token found');
  process.exit(1);
}

console.log(`Token format: ${token.substring(0, 10)}...`);

// Test Auth'n'Auth endpoint (older API)
console.log('\n🧪 Testing Auth\'n\'Auth endpoint...');
try {
  const authResponse = await fetch('https://api.ebay.com/ws/api.dll', {
    method: 'POST',
    headers: {
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-DEV-NAME': process.env.EBAY_DEV_ID || 'unknown',
      'X-EBAY-API-APP-NAME': process.env.EBAY_CLIENT_ID,
      'X-EBAY-API-CERT-NAME': process.env.EBAY_CLIENT_SECRET,
      'X-EBAY-API-CALL-NAME': 'GeteBayOfficialTime',
      'X-EBAY-API-SITEID': '0',
      'Content-Type': 'text/xml'
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
           <GeteBayOfficialTimeRequest xmlns="urn:ebay:apis:eBLBaseComponents">
             <RequesterCredentials>
               <eBayAuthToken>${token}</eBayAuthToken>
             </RequesterCredentials>
           </GeteBayOfficialTimeRequest>`
  });
  
  if (authResponse.ok) {
    console.log('✅ Auth\'n\'Auth API works with your token!');
    console.log('💡 You have an Auth\'n\'Auth app, not OAuth 2.0');
  } else {
    console.log('❌ Auth\'n\'Auth API failed');
  }
} catch (error) {
  console.log('❌ Auth\'n\'Auth test failed:', error.message);
}

// Test OAuth endpoint 
console.log('\n🧪 Testing OAuth 2.0 endpoint...');
try {
  const oauthResponse = await fetch('https://api.ebay.com/sell/account/v1/fulfillment_policy', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  
  if (oauthResponse.ok) {
    console.log('✅ OAuth 2.0 API works with your token!');
    console.log('💡 You have OAuth 2.0 access');
  } else {
    console.log('❌ OAuth 2.0 API failed');
  }
} catch (error) {
  console.log('❌ OAuth 2.0 test failed:', error.message);
}

console.log('\n📋 Next Steps:');
console.log('If Auth\'n\'Auth worked: Use Traditional Trading API');
console.log('If OAuth 2.0 worked: Continue with current setup'); 
console.log('If neither worked: Create new OAuth 2.0 app');