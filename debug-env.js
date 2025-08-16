// debug-env.js
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Environment Variables Debug:');
console.log('===============================');

console.log('EBAY_CLIENT_ID:', process.env.EBAY_CLIENT_ID ? `${process.env.EBAY_CLIENT_ID.substring(0, 15)}...` : 'MISSING');
console.log('EBAY_CLIENT_SECRET:', process.env.EBAY_CLIENT_SECRET ? 'SET' : 'MISSING');
console.log('EBAY_ACCESS_TOKEN:', process.env.EBAY_ACCESS_TOKEN ? `${process.env.EBAY_ACCESS_TOKEN.substring(0, 20)}...` : 'MISSING');
console.log('EBAY_ENVIRONMENT:', process.env.EBAY_ENVIRONMENT || 'NOT SET');

console.log('\n📋 Your .env file should contain:');
console.log('EBAY_CLIENT_ID=SUPERFUN-S-PRD-53649ae1c-641d3320');
console.log('EBAY_CLIENT_SECRET=your_secret_here');
console.log('EBAY_ACCESS_TOKEN=your_token_from_ebay_signin');
console.log('EBAY_ENVIRONMENT=production');

console.log('\n🔧 SDK Config Test:');
const ebayConfig = {
  clientId: process.env.EBAY_CLIENT_ID,
  clientSecret: process.env.EBAY_CLIENT_SECRET,
  accessToken: process.env.EBAY_ACCESS_TOKEN,
  environment: 'production'
};

console.log('Config passed to SDK:', {
  clientId: ebayConfig.clientId ? 'SET' : 'MISSING',
  clientSecret: ebayConfig.clientSecret ? 'SET' : 'MISSING', 
  accessToken: ebayConfig.accessToken ? 'SET' : 'MISSING',
  environment: ebayConfig.environment
});

console.log('\n💡 If EBAY_ACCESS_TOKEN shows MISSING:');
console.log('1. Go to https://developer.ebay.com/my/keys');
console.log('2. Click "Sign in to Production" (blue button)');
console.log('3. Login with your eBay account');
console.log('4. Copy the User Token eBay shows you');
console.log('5. Add it to .env as: EBAY_ACCESS_TOKEN=your_token');