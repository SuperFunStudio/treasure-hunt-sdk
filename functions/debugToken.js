/**
 * Debug Token Loading Script
 * This will help us see exactly what token is being loaded
 */

require('dotenv').config();

function debugTokenLoading() {
  console.log('🔍 DEBUGGING TOKEN LOADING');
  console.log('===========================\n');

  const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;
  
  console.log('📋 Environment Variable Status:');
  console.log(`   EBAY_ACCESS_TOKEN exists: ${ACCESS_TOKEN ? '✅ YES' : '❌ NO'}`);
  
  if (ACCESS_TOKEN) {
    console.log(`   Token length: ${ACCESS_TOKEN.length} characters`);
    console.log(`   Token starts with: ${ACCESS_TOKEN.substring(0, 20)}...`);
    console.log(`   Token ends with: ...${ACCESS_TOKEN.substring(ACCESS_TOKEN.length - 20)}`);
    
    // Check if it's the new token format
    const isNewToken = ACCESS_TOKEN.startsWith('v^1.1#i^1#p^3#I^3#r^0#f^0#t^H4sIAAAAAAAA');
    console.log(`   Is new refreshed token: ${isNewToken ? '✅ YES' : '❌ NO'}`);
    
    if (!isNewToken) {
      console.log('   ⚠️  This appears to be the old token!');
    }
  }

  console.log('\n📁 .env File Check:');
  console.log('   Run this command to check your .env file:');
  console.log('   head -20 .env | grep EBAY_ACCESS_TOKEN');

  console.log('\n🔧 Manual Fix Steps:');
  console.log('1. Open functions/.env in a text editor');
  console.log('2. Find the line starting with EBAY_ACCESS_TOKEN=');
  console.log('3. Replace the entire token with the new one from refresh');
  console.log('4. Save the file');
  console.log('5. Run this script again');

  // Test a simple API call to confirm token status
  testTokenDirectly(ACCESS_TOKEN);
}

async function testTokenDirectly(token) {
  console.log('\n🧪 TESTING TOKEN DIRECTLY');
  console.log('==========================');
  
  if (!token) {
    console.log('❌ No token to test');
    return;
  }

  try {
    console.log('📡 Making test API call...');
    
    const response = await fetch('https://api.ebay.com/sell/inventory/v1/inventory_item?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Language': 'en-US'
      }
    });

    console.log(`📊 Response status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Token is valid! The issue might be elsewhere.');
      const data = await response.json();
      console.log('📋 Response data:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Token is invalid. Error:', errorText);
      
      if (response.status === 401) {
        console.log('\n💡 This confirms the token is expired or invalid');
        console.log('   You need to either:');
        console.log('   1. Update your .env file with the refreshed token');
        console.log('   2. Or run the refresh script again');
      }
    }
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

// Show the exact token from your refresh for comparison
function showRefreshedToken() {
  console.log('\n🔑 REFRESHED TOKEN FROM EARLIER:');
  console.log('================================');
  console.log('The token from your refresh script was:');
  console.log('v^1.1#i^1#p^3#I^3#r^0#f^0#t^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');
  console.log('\nMake sure this EXACT token is in your .env file after EBAY_ACCESS_TOKEN=');
}

// Run all debug functions
debugTokenLoading();
showRefreshedToken();