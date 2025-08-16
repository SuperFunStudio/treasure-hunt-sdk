// quick-token-test.js
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.EBAY_ACCESS_TOKEN) {
  console.log('❌ No EBAY_ACCESS_TOKEN in .env file');
  process.exit(1);
}

console.log('🧪 Testing fresh eBay token...');
console.log(`Token: ${process.env.EBAY_ACCESS_TOKEN.substring(0, 20)}...`);

// Simple direct API test
const response = await fetch('https://api.ebay.com/sell/account/v1/fulfillment_policy', {
  headers: {
    'Authorization': `Bearer ${process.env.EBAY_ACCESS_TOKEN}`,
    'Accept': 'application/json'
  }
});

if (response.ok) {
  const data = await response.json();
  console.log('✅ Token is valid!');
  console.log(`📦 Found ${data.fulfillmentPolicies?.length || 0} fulfillment policies`);
  console.log('🚀 Your SDK should now work perfectly!');
} else {
  const error = await response.json();
  console.log('❌ Token still invalid:', error.message || response.statusText);
  console.log('🔄 Try getting a new token from eBay Developer Console');
}
