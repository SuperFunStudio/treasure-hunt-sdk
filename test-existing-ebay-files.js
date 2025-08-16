// test-existing-ebay-files.js - Test your current eBay integration files
import fs from 'fs';

console.log('🔍 Testing Your Existing eBay Files');
console.log('===================================\n');

// Test 1: Check if we can import your SimpleEbayAPI
console.log('1. Testing simpleAPI.js import...');
try {
  // Dynamic import since you're using ES modules
  const { SimpleEbayAPI } = await import('./capture-sdk/integrations/ebay/simpleAPI.js');
  console.log('✅ SimpleEbayAPI imported successfully');
  
  // Test instantiation
  const api = new SimpleEbayAPI({
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    environment: 'production'
  });
  console.log('✅ SimpleEbayAPI instantiated successfully');
  
  // Test if it has the right methods
  const hasGetPricing = typeof api.getPricing === 'function';
  const hasSearchItems = typeof api.searchItems === 'function';
  const hasGetToken = typeof api.getToken === 'function';
  
  console.log('✅ Required methods present:', { hasGetPricing, hasSearchItems, hasGetToken });
  
} catch (error) {
  console.log('❌ SimpleEbayAPI import failed:', error.message);
}

// Test 2: Check your index.js file
console.log('\n2. Testing index.js import...');
try {
  // Check if EbayCategoryHandler exists first
  const categoryHandlerPath = './capture-sdk/utils/ebayCategoryHandler.js';
  if (!fs.existsSync(categoryHandlerPath)) {
    console.log('⚠️ EbayCategoryHandler.js missing - this might cause index.js to fail');
    
    // Try to import anyway, it might have fallback logic
    try {
      const { EbayIntegration } = await import('./capture-sdk/integrations/ebay/index.js');
      console.log('✅ EbayIntegration imported successfully (despite missing categoryHandler)');
    } catch (indexError) {
      console.log('❌ EbayIntegration import failed:', indexError.message);
      console.log('💡 This is likely due to missing EbayCategoryHandler dependency');
    }
  } else {
    const { EbayIntegration } = await import('./capture-sdk/integrations/ebay/index.js');
    console.log('✅ EbayIntegration imported successfully');
  }
} catch (error) {
  console.log('❌ EbayIntegration import failed:', error.message);
}

// Test 3: Check your searchAPI.js file
console.log('\n3. Testing searchAPI.js import...');
try {
  const { EbaySearchAPI } = await import('./capture-sdk/integrations/ebay/searchAPI.js');
  console.log('✅ EbaySearchAPI imported successfully');
} catch (error) {
  console.log('❌ EbaySearchAPI import failed:', error.message);
}

// Test 4: Simulate the exact item data from your logs
console.log('\n4. Testing with your actual item data...');
const testItemData = {
  category: "clothing",
  brand: "Unknown", 
  model: "Unknown",
  condition: {
    rating: "good",
    numeric_rating: 7,
    description: "Overall good condition with minor signs of wear. No visible stains or tears."
  }
};

try {
  const { SimpleEbayAPI } = await import('./capture-sdk/integrations/ebay/simpleAPI.js');
  
  // This will fail because we don't have real credentials, but we can see if the logic works
  const api = new SimpleEbayAPI({
    clientId: 'dummy_client_id',
    clientSecret: 'dummy_client_secret', 
    environment: 'production'
  });
  
  console.log('Test item data:', JSON.stringify(testItemData, null, 2));
  
  // This will fail at the API call stage, but we can see the search query generation
  try {
    await api.getPricing(testItemData);
  } catch (error) {
    if (error.message.includes('Missing eBay credentials')) {
      console.log('✅ getPricing method works (failed as expected due to dummy credentials)');
    } else {
      console.log('❌ Unexpected error in getPricing:', error.message);
    }
  }
  
} catch (error) {
  console.log('❌ Could not test getPricing:', error.message);
}

// Test 5: Check your current Firebase integration
console.log('\n5. Testing Firebase health endpoint...');
try {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch('https://app-beprv7ll2q-uc.a.run.app/health');
  const data = await response.json();
  
  console.log('Health endpoint response:');
  console.log('- SDK Available:', data.sdk?.available);
  console.log('- eBay Configured:', data.sdk?.ebayConfigured);
  console.log('- Environment:', data.environment);
  
  if (data.sdk?.ebayConfigured) {
    console.log('✅ eBay is configured in Firebase Functions');
  } else {
    console.log('❌ eBay not configured in Firebase Functions');
  }
  
} catch (error) {
  console.log('❌ Health endpoint test failed:', error.message);
}

console.log('\n=== DIAGNOSIS ===');
console.log('Based on the tests above:');
console.log('');
console.log('If your files import successfully but you still get "enhanced_manual":');
console.log('🔍 The issue is that your MAIN PRICING LOGIC is not calling these eBay functions');
console.log('');
console.log('Likely fixes:');
console.log('1. Your Firebase Functions code needs to actually USE the SimpleEbayAPI');
console.log('2. The pricing logic is falling back to manual before trying eBay');  
console.log('3. There might be a try/catch block that silently catches eBay errors');
console.log('');
console.log('Next steps:');
console.log('1. Check your main Functions code (index.js or app.js)');
console.log('2. Look for where pricing/market analysis happens');
console.log('3. Ensure it calls your eBay integration instead of the manual fallback');