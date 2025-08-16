// test-default-redirect.js
import { EbayIntegration } from '../capture-sdk/integrations/ebay/index.js';
import dotenv from 'dotenv';

dotenv.config();

// Try the default eBay pattern or out-of-band
const ebayConfig = {
  clientId: process.env.EBAY_CLIENT_ID,
  clientSecret: process.env.EBAY_CLIENT_SECRET,
  redirectUri: 'urn:ietf:wg:oauth:2.0:oob', // Out-of-band - shows code on page
  environment: 'production'
};

console.log('🔍 Testing OAuth Out-of-Band (shows code on eBay page)');
console.log(`   Client ID: ${ebayConfig.clientId?.substring(0, 15)}...`);
console.log(`   Redirect URI: ${ebayConfig.redirectUri}`);

const ebay = new EbayIntegration(ebayConfig);
const authUrl = ebay.getAuthUrl('oob-test-' + Date.now());

console.log('\n🔗 Authorization URL (Out-of-Band):');
console.log(authUrl);

console.log('\n📋 Instructions:');
console.log('1. Visit the URL above');
console.log('2. Authorize with eBay');
console.log('3. eBay will show the authorization code directly on the page');
console.log('4. Copy that code and use it with ebay.authenticate(code)');
console.log('5. This bypasses the redirect URI issue temporarily');