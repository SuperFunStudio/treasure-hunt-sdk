// debug-ebay-auth.js
// Debug eBay API authentication to see what's going wrong

import dotenv from 'dotenv';
dotenv.config();

async function debugEbayAuth() {
  console.log('🔧 Debugging eBay Authentication...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('=========================');
  console.log('EBAY_CLIENT_ID:', process.env.EBAY_CLIENT_ID ? 'Set ✅' : 'Missing ❌');
  console.log('EBAY_CLIENT_SECRET:', process.env.EBAY_CLIENT_SECRET ? 'Set ✅' : 'Missing ❌');
  console.log('EBAY_ENVIRONMENT:', process.env.EBAY_ENVIRONMENT);
  
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    console.log('\n❌ Missing eBay credentials in .env file');
    console.log('Add these to your .env:');
    console.log('EBAY_CLIENT_ID=your_app_id_here');
    console.log('EBAY_CLIENT_SECRET=your_cert_id_here');
    return;
  }

  console.log('\n🔑 Credential lengths:');
  console.log('Client ID length:', process.env.EBAY_CLIENT_ID.length);
  console.log('Client Secret length:', process.env.EBAY_CLIENT_SECRET.length);

  // Test basic auth encoding
  const credentials = `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`;
  const basicAuth = Buffer.from(credentials).toString('base64');
  console.log('Basic Auth Header length:', basicAuth.length);

  // Determine correct token endpoint
  const isProduction = process.env.EBAY_ENVIRONMENT === 'production';
  const tokenUrl = isProduction 
    ? 'https://api.ebay.com/identity/v1/oauth2/token'
    : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
  
  console.log('\n🌐 Token endpoint:', tokenUrl);

  // Test token request with detailed error info
  try {
    console.log('\n🔄 Making token request...');
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebayapis.com/oauth/api_scope'
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('\n✅ Token request successful!');
      console.log('Access token length:', data.access_token?.length || 0);
      console.log('Token type:', data.token_type);
      console.log('Expires in:', data.expires_in, 'seconds');
    } else {
      console.log('\n❌ Token request failed');
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', errorData);
        
        // Common error explanations
        if (response.status === 400) {
          console.log('\n💡 Common causes of 400 errors:');
          console.log('- Invalid Client ID or Client Secret');
          console.log('- Wrong credentials for environment (sandbox vs production)');
          console.log('- Keyset not activated yet');
          console.log('- Need to complete eBay notification compliance first');
        }
      } catch (e) {
        console.log('Could not parse error response as JSON');
      }
    }

  } catch (error) {
    console.error('\n💥 Network error:', error.message);
  }
}

// Also test a simpler approach - just verify credentials format
function validateCredentialFormat() {
  console.log('\n🔍 Validating credential format...');
  
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (clientId) {
    // eBay App IDs typically look like: AppName-UserName-ENV-abc123def456
    const hasCorrectFormat = clientId.includes('-') && clientId.length > 20;
    console.log('Client ID format check:', hasCorrectFormat ? '✅' : '❌');
    console.log('Client ID pattern:', clientId.replace(/[a-f0-9]/gi, 'X'));
  }

  if (clientSecret) {
    // eBay Cert IDs are typically long hex strings
    const hasCorrectLength = clientSecret.length >= 32;
    console.log('Client Secret length check:', hasCorrectLength ? '✅' : '❌');
  }
}

// Run the debugging
debugEbayAuth().then(() => {
  validateCredentialFormat();
});