/**
 * Simple Policy Test - Debug version
 */

console.log('Starting simple policy test...');

// Load environment variables
require('dotenv').config();

// Test if we can load the validator
console.log('Attempting to load validator...');
try {
  const { validateEbayPolicies } = require('./capture-sdk/utils/ebayPolicyValidator');
  console.log('✅ Validator loaded successfully');
  
  // Get token
  const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;
  
  if (!ACCESS_TOKEN) {
    console.log('❌ No access token found');
    process.exit(1);
  }
  
  console.log(`✅ Token found (${ACCESS_TOKEN.length} characters)`);
  
  // Test the validator
  console.log('🚀 Testing policy validation...');
  
  validateEbayPolicies(ACCESS_TOKEN, 'EBAY_US')
    .then(results => {
      console.log('✅ Validation completed!');
      console.log('Results:', JSON.stringify(results, null, 2));
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
    });
    
} catch (error) {
  console.error('❌ Failed to load validator:', error.message);
  console.error('Current directory:', process.cwd());
  console.error('Trying to load from: ./capture-sdk/utils/ebayPolicyValidator');
  
  // Try alternative paths
  console.log('\nTrying alternative paths...');
  
  const paths = [
    './utils/ebayPolicyValidator',
    './capture-sdk/utils/ebayPolicyValidator.js',
    './utils/ebayPolicyValidator.js'
  ];
  
  for (const path of paths) {
    try {
      require(path);
      console.log(`✅ Found validator at: ${path}`);
      break;
    } catch (e) {
      console.log(`❌ Not found at: ${path}`);
    }
  }
}