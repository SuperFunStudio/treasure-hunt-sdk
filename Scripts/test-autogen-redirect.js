// Updated test with eBay's auto-generated redirect URI
import { EbayIntegration } from '../capture-sdk/integrations/ebay/index.js';
import dotenv from 'dotenv';

dotenv.config();

const ebayConfig = {
  clientId: process.env.EBAY_CLIENT_ID,
  clientSecret: process.env.EBAY_CLIENT_SECRET,
  // Use eBay's auto-generated redirect URI
  redirectUri: 'https://signin.ebay.com/ws/eBayISAPI.dll?SignIn&runame=SUPERFUN_STUDIO-SUPERFUN-S-PRD--gmotfjins&SessID=<SESSION_ID>',
  environment: 'production'
};

console.log('🔧 Using eBay Auto-Generated Redirect URI:');
console.log(`   Client ID: ${ebayConfig.clientId?.substring(0, 15)}...`);
console.log(`   Redirect URI: ${ebayConfig.redirectUri}`);

const ebay = new EbayIntegration(ebayConfig);
const authUrl = ebay.getAuthUrl('autogen-test-' + Date.now());

console.log('\n🔗 Authorization URL with Auto-Generated Redirect:');
console.log(authUrl);

console.log('\n📋 Next Steps:');
console.log('1. Visit the URL above');
console.log('2. This should now work with eBay\'s auto-generated redirect');
console.log('3. Complete the authorization flow');
console.log('4. You should get redirected to eBay\'s signin page with a code');
console.log('5. Extract the code and use ebay.authenticate(code)');