// test-thriftspot-auth.js
import { EbayIntegration } from './capture-sdk/integrations/ebay/index.js';
import dotenv from 'dotenv';

dotenv.config();

const ebayConfig = {
  clientId: process.env.EBAY_CLIENT_ID,
  clientSecret: process.env.EBAY_CLIENT_SECRET,
  redirectUri: 'https://thriftspot.app/auth/ebay/callback',
  environment: 'production'
};

console.log('🏭 ThriftSpot eBay Production Config:');
console.log(`   Client ID: ${ebayConfig.clientId?.substring(0, 15)}...`);
console.log(`   Redirect URI: ${ebayConfig.redirectUri}`);
console.log(`   Environment: ${ebayConfig.environment}`);

const ebay = new EbayIntegration(ebayConfig);

console.log('\n🔗 Authorization URL:');
console.log(ebay.getAuthUrl('thriftspot-' + Date.now()));

console.log('\n📋 Next Steps:');
console.log('1. Visit the URL above');
console.log('2. Authorize with your eBay account');
console.log('3. Copy the "code" from callback URL');
console.log('4. Use: await ebay.authenticate(code)');
console.log('5. Save refresh token to EBAY_REFRESH_TOKEN in .env');

// Test existing refresh token if available
if (process.env.EBAY_REFRESH_TOKEN) {
  console.log('\n🔄 Testing existing refresh token...');
  ebay.refreshToken = process.env.EBAY_REFRESH_TOKEN;
  
  ebay.refreshAccessToken()
    .then(() => console.log('✅ Existing refresh token works!'))
    .catch(err => console.log('❌ Need new refresh token:', err.message));
}