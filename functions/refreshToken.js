/**
 * Token Refresh & Extraction Script
 * This will help you get a fresh access token
 */

require('dotenv').config();

// Check if you have refresh token or other credentials
const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.EBAY_REFRESH_TOKEN;

async function refreshAccessToken() {
  console.log('🔄 Attempting to refresh eBay access token...');
  console.log('================================================\n');

  // Check what credentials we have
  console.log('📋 Available credentials:');
  console.log(`   EBAY_CLIENT_ID: ${CLIENT_ID ? '✅ Found' : '❌ Missing'}`);
  console.log(`   EBAY_CLIENT_SECRET: ${CLIENT_SECRET ? '✅ Found' : '❌ Missing'}`);
  console.log(`   EBAY_REFRESH_TOKEN: ${REFRESH_TOKEN ? '✅ Found' : '❌ Missing'}`);
  console.log('');

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('❌ Missing required credentials for token refresh');
    console.log('\n🔧 What you need to do:');
    console.log('1. Add EBAY_CLIENT_ID to your .env file');
    console.log('2. Add EBAY_CLIENT_SECRET to your .env file');
    console.log('3. Get these from: https://developer.ebay.com/my/keys');
    return;
  }

  if (!REFRESH_TOKEN) {
    console.log('❌ No refresh token found');
    console.log('\n🔧 Alternative solutions:');
    console.log('1. Check your Firebase function logs for a working token');
    console.log('2. Use the eBay Developer Console to generate a new token');
    console.log('3. Re-authenticate your app to get a fresh token');
    
    // Show how to get token from Firebase logs
    console.log('\n💡 Extract token from Firebase logs:');
    console.log('1. Look at your Firebase function logs where listings work');
    console.log('2. Find the "Authorization: Bearer ..." headers');
    console.log('3. Copy the token after "Bearer "');
    console.log('4. Update your .env file with the new token');
    
    return;
  }

  // Try to refresh the token
  try {
    console.log('🔄 Refreshing access token...');
    
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN,
        scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account'
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Token refreshed successfully!');
      console.log(`🔑 New access token: ${data.access_token.substring(0, 50)}...`);
      console.log(`⏰ Expires in: ${data.expires_in} seconds (${Math.round(data.expires_in / 3600)} hours)`);
      
      console.log('\n📝 Update your .env file with:');
      console.log(`EBAY_ACCESS_TOKEN=${data.access_token}`);
      
      if (data.refresh_token) {
        console.log(`EBAY_REFRESH_TOKEN=${data.refresh_token}`);
      }
      
      return data.access_token;
    } else {
      const errorText = await response.text();
      console.log('❌ Token refresh failed:', errorText);
    }
    
  } catch (error) {
    console.log('❌ Error during token refresh:', error.message);
  }
}

// Alternative: Show how to extract token from your working Firebase function
function showTokenExtractionSteps() {
  console.log('\n🔍 HOW TO GET TOKEN FROM YOUR WORKING APP:');
  console.log('==========================================');
  console.log('Since your treasurehunter-sdk.web.app is working, you can extract the token:');
  console.log('');
  console.log('Method 1 - From Firebase Logs:');
  console.log('1. Run: firebase functions:log');
  console.log('2. Look for successful eBay API calls');
  console.log('3. Find lines with "Authorization: Bearer ..." in the logs');
  console.log('4. Copy the token after "Bearer "');
  console.log('');
  console.log('Method 2 - From Your App Code:');
  console.log('1. Add console.log to your working function where you call eBay API');
  console.log('2. Log the access token being used');
  console.log('3. Check Firebase logs for the token');
  console.log('');
  console.log('Method 3 - Add Debug Endpoint:');
  console.log('1. Create a temporary Firebase function that returns the current token');
  console.log('2. Call it from your app to get the working token');
  console.log('3. Use that token for policy validation');
}

// Run the refresh attempt
refreshAccessToken().then(() => {
  showTokenExtractionSteps();
});