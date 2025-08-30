/**
 * eBay Account Verification Script
 * This will check which account your token belongs to and what permissions it has
 */

require('dotenv').config();

const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;

async function verifyEbayAccount() {
  console.log('🔍 Verifying eBay Account & Token Details');
  console.log('==========================================\n');

  if (!ACCESS_TOKEN) {
    console.log('❌ No EBAY_ACCESS_TOKEN found in .env file!');
    return;
  }

  // Test different endpoints to see what works
  const tests = [
    {
      name: 'User Account Info',
      endpoint: 'https://api.ebay.com/sell/account/v1/privilege',
      description: 'Gets your account privileges and seller status'
    },
    {
      name: 'Seller Status',
      endpoint: 'https://api.ebay.com/sell/account/v1/program',
      description: 'Shows if you are enrolled in selling programs'
    },
    {
      name: 'Account Settings',
      endpoint: 'https://api.ebay.com/sell/account/v1/privilege',
      description: 'Basic account information'
    }
  ];

  for (const test of tests) {
    console.log(`🧪 Testing: ${test.name}`);
    console.log(`📡 Endpoint: ${test.endpoint}`);
    
    try {
      const response = await fetch(test.endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      });

      console.log(`📊 Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Success! Response:', JSON.stringify(data, null, 2));
      } else {
        const errorText = await response.text();
        console.log('❌ Error Response:', errorText);
      }
      
    } catch (error) {
      console.log('❌ Network Error:', error.message);
    }
    
    console.log(''); // Add spacing
  }

  // Also test a simple inventory call to see if that works
  console.log('🧪 Testing: Inventory Access');
  console.log('📡 Endpoint: https://api.ebay.com/sell/inventory/v1/inventory_item?limit=1');
  
  try {
    const response = await fetch('https://api.ebay.com/sell/inventory/v1/inventory_item?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Language': 'en-US'
      }
    });

    console.log(`📊 Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Inventory API works! You have access to:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Inventory Error:', errorText);
    }
    
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }

  console.log('\n🔧 TROUBLESHOOTING STEPS:');
  console.log('==========================');
  console.log('1. Check if your token has "https://api.ebay.com/oauth/api_scope/sell.account" scope');
  console.log('2. Verify the token is for production eBay (not sandbox)');
  console.log('3. Make sure the token belongs to the same account as your web app');
  console.log('4. Check if the token has expired (they typically last 2 hours)');
  console.log('\n💡 Token Info:');
  console.log(`   Length: ${ACCESS_TOKEN.length} characters`);
  console.log(`   Starts with: ${ACCESS_TOKEN.substring(0, 10)}...`);
  console.log(`   Environment: ${ACCESS_TOKEN.includes('sandbox') ? 'Sandbox' : 'Production (probably)'}`);
}

// Additional function to decode JWT token if it's a JWT
function analyzeToken(token) {
  console.log('\n🔍 TOKEN ANALYSIS:');
  console.log('==================');
  
  if (token.includes('.')) {
    // Might be a JWT token
    console.log('🎯 Token appears to be JWT format');
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        console.log('📋 JWT Header:', JSON.stringify(header, null, 2));
        console.log('📋 JWT Payload:', JSON.stringify(payload, null, 2));
        
        if (payload.exp) {
          const expiry = new Date(payload.exp * 1000);
          console.log(`⏰ Token expires: ${expiry.toLocaleString()}`);
          console.log(`⏰ Expired? ${expiry < new Date() ? '❌ YES' : '✅ NO'}`);
        }
      }
    } catch (e) {
      console.log('❌ Could not decode as JWT:', e.message);
    }
  } else {
    console.log('🎯 Token appears to be simple access token format');
  }
}

// Run the verification
verifyEbayAccount();
analyzeToken(ACCESS_TOKEN);