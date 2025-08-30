#!/usr/bin/env node

// ebay-token-refresh.js
// Run this from treasure-hunt-sdk/functions/ to refresh your eBay access token

require('dotenv').config();
const fs = require('fs');

async function refreshEbayToken() {
  console.log('🔄 Refreshing eBay Access Token...\n');

  const {
    EBAY_CLIENT_ID,
    EBAY_CLIENT_SECRET,
    EBAY_REFRESH_TOKEN,
    EBAY_ENVIRONMENT = 'production'
  } = process.env;

  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_REFRESH_TOKEN) {
    console.error('❌ Missing required environment variables:');
    console.error('   EBAY_CLIENT_ID:', !!EBAY_CLIENT_ID);
    console.error('   EBAY_CLIENT_SECRET:', !!EBAY_CLIENT_SECRET);
    console.error('   EBAY_REFRESH_TOKEN:', !!EBAY_REFRESH_TOKEN);
    process.exit(1);
  }

  try {
    // Import fetch
    const fetch = (await import('node-fetch')).default;
    
    const tokenUrl = EBAY_ENVIRONMENT === 'sandbox'
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

    const basicAuth = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');

    console.log(`📡 Calling eBay token endpoint: ${tokenUrl}`);
    console.log(`🔑 Using refresh token: ${EBAY_REFRESH_TOKEN.slice(0, 20)}...`);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: EBAY_REFRESH_TOKEN,
        scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account.readonly https://api.ebay.com/oauth/api_scope/sell.account'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Token refresh failed: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log('✅ Token refresh successful!');
    console.log(`📝 New access token: ${data.access_token.slice(0, 20)}...`);
    console.log(`⏰ Expires in: ${data.expires_in} seconds (${Math.round(data.expires_in / 3600)} hours)`);
    
    if (data.refresh_token) {
      console.log(`🔄 New refresh token: ${data.refresh_token.slice(0, 20)}...`);
    }

    // Update .env file
    updateEnvFile(data);

    console.log('\n🎉 Your eBay access token has been refreshed!');
    console.log('💡 Your .env file has been updated with the new token.');
    console.log('🚀 You can now try creating eBay listings again.');

  } catch (error) {
    console.error('💥 Token refresh failed:', error.message);
    process.exit(1);
  }
}

function updateEnvFile(tokenData) {
  try {
    // Read current .env file
    const envPath = '.env';
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update access token
    const newAccessToken = tokenData.access_token;
    if (envContent.includes('EBAY_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /EBAY_ACCESS_TOKEN=.*/,
        `EBAY_ACCESS_TOKEN="${newAccessToken}"`
      );
    } else {
      envContent += `\nEBAY_ACCESS_TOKEN="${newAccessToken}"`;
    }

    // Update refresh token if provided
    if (tokenData.refresh_token) {
      const newRefreshToken = tokenData.refresh_token;
      if (envContent.includes('EBAY_REFRESH_TOKEN=')) {
        envContent = envContent.replace(
          /EBAY_REFRESH_TOKEN=.*/,
          `EBAY_REFRESH_TOKEN="${newRefreshToken}"`
        );
      } else {
        envContent += `\nEBAY_REFRESH_TOKEN="${newRefreshToken}"`;
      }
    }

    // Add token expiry for reference
    const expiryTime = new Date(Date.now() + (tokenData.expires_in * 1000));
    const expiryComment = `\n# Token expires: ${expiryTime.toISOString()}`;
    
    if (envContent.includes('# Token expires:')) {
      envContent = envContent.replace(
        /# Token expires:.*/,
        expiryComment.trim()
      );
    } else {
      envContent += expiryComment;
    }

    // Write updated .env file
    fs.writeFileSync(envPath, envContent);
    console.log('📁 .env file updated successfully');

  } catch (error) {
    console.error('⚠️ Failed to update .env file:', error.message);
    console.log('\n📋 Please manually update your .env file with:');
    console.log(`EBAY_ACCESS_TOKEN="${tokenData.access_token}"`);
    if (tokenData.refresh_token) {
      console.log(`EBAY_REFRESH_TOKEN="${tokenData.refresh_token}"`);
    }
  }
}

// Test the new token
async function testNewToken() {
  console.log('\n🧪 Testing new access token...');
  
  // Reload environment variables
  delete require.cache[require.resolve('dotenv')];
  require('dotenv').config();

  try {
    const fetch = (await import('node-fetch')).default;
    
    const apiUrl = process.env.EBAY_ENVIRONMENT === 'sandbox' 
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';

    const response = await fetch(`${apiUrl}/sell/account/v1/payment_policy`, {
      headers: {
        'Authorization': `Bearer ${process.env.EBAY_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    if (response.ok) {
      console.log('✅ New token works! eBay API is accessible.');
    } else if (response.status === 401) {
      console.log('❌ New token still not working. May need to check scopes or permissions.');
    } else {
      console.log(`⚠️ eBay API returned ${response.status} - token likely works but may have limited permissions.`);
    }
  } catch (error) {
    console.log(`⚠️ Token test failed: ${error.message}`);
  }
}

// Run the refresh
refreshEbayToken()
  .then(() => testNewToken())
  .catch(console.error);