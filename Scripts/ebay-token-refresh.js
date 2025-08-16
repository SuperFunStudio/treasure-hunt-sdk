// ebay-token-refresh.js
// Helper script to get new eBay OAuth tokens
import dotenv from 'dotenv';
dotenv.config();

class EbayTokenHelper {
  constructor() {
    this.clientId = process.env.EBAY_CLIENT_ID;
    this.clientSecret = process.env.EBAY_CLIENT_SECRET;
    this.redirectUri = process.env.EBAY_REDIRECT_URI;
    this.environment = process.env.EBAY_ENVIRONMENT || 'sandbox';
  }

  // Step 1: Generate authorization URL
  getAuthUrl() {
    const baseUrl = this.environment === 'sandbox' 
      ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
      : 'https://auth.ebay.com/oauth2/authorize';

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly https://api.ebay.com/oauth/api_scope/sell.marketing https://api.ebay.com/oauth/api_scope/sell.inventory.readonly https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account.readonly https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.analytics.readonly'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  // Step 2: Exchange authorization code for tokens
  async exchangeCodeForTokens(authCode) {
    const tokenUrl = this.environment === 'sandbox'
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: this.redirectUri
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      console.log('🎉 New tokens obtained successfully!');
      console.log('\n📋 Update your .env file with these values:');
      console.log(`EBAY_ACCESS_TOKEN=${data.access_token}`);
      console.log(`EBAY_REFRESH_TOKEN=${data.refresh_token}`);
      console.log(`\n⏰ Access token expires in: ${data.expires_in} seconds (${Math.floor(data.expires_in / 3600)} hours)`);
      console.log(`⏰ Refresh token expires in: ${data.refresh_token_expires_in} seconds (${Math.floor(data.refresh_token_expires_in / (3600 * 24))} days)`);

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        refreshTokenExpiresIn: data.refresh_token_expires_in
      };

    } catch (error) {
      console.error('❌ Token exchange failed:', error.message);
      throw error;
    }
  }

  // Step 3: Test the new tokens
  async testTokens(accessToken) {
    const apiUrl = this.environment === 'sandbox'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';

    try {
      const response = await fetch(`${apiUrl}/sell/account/v1/fulfillment_policy`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('✅ Token test successful! Your tokens are working.');
        return true;
      } else {
        const error = await response.json();
        console.log('❌ Token test failed:', error);
        return false;
      }
    } catch (error) {
      console.error('❌ Token test error:', error.message);
      return false;
    }
  }
}

// Usage instructions
async function main() {
  console.log('🔐 eBay Token Refresh Helper');
  console.log('============================\n');

  const helper = new EbayTokenHelper();

  console.log('Step 1: Visit this URL to authorize your application:');
  console.log('👉', helper.getAuthUrl());
  console.log('\nStep 2: After authorization, you\'ll be redirected to your redirect URI with a "code" parameter.');
  console.log('Step 3: Copy that code and use it with: node ebay-token-refresh.js YOUR_CODE_HERE\n');

  // If an authorization code was provided as command line argument
  const authCode = process.argv[2];
  if (authCode) {
    console.log('🔄 Processing authorization code...\n');
    try {
      const tokens = await helper.exchangeCodeForTokens(authCode);
      
      // Test the new access token
      await helper.testTokens(tokens.accessToken);
      
    } catch (error) {
      console.error('💥 Failed to process authorization code:', error.message);
    }
  } else {
    console.log('💡 To exchange an authorization code for tokens, run:');
    console.log('   node ebay-token-refresh.js YOUR_AUTHORIZATION_CODE');
  }
}

main().catch(console.error);