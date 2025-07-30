// test-ebay-pricing.js
// Test script to see eBay search and pricing in action

import { estimatePrice } from './capture-sdk/utils/priceEstimate.js';
import dotenv from 'dotenv';

dotenv.config();

// Test with sample item data
const sampleItem = {
  category: 'electronics',
  brand: 'Apple',
  model: 'iPhone 12',
  condition: {
    rating: 'good',
    usableAsIs: true,
    description: 'Good condition iPhone 12 with minor scratches on back'
  },
  description: 'Apple iPhone 12 64GB smartphone in good working condition'
};

async function testEbayPricing() {
  console.log('🔍 Testing eBay pricing integration...\n');

  try {
    // Set up eBay configuration
    const ebayConfig = {
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      environment: process.env.EBAY_ENVIRONMENT || 'production'
    };

    console.log('📱 Sample item:', sampleItem.brand, sampleItem.model);
    console.log('🏷️  Condition:', sampleItem.condition.rating);
    console.log('🌐 eBay environment:', ebayConfig.environment);
    console.log('\n--- Starting eBay search ---\n');

    // Get pricing estimate using eBay data
    const pricingResult = await estimatePrice(sampleItem, {
      source: 'ebay',
      includeShipping: true,
      condition: sampleItem.condition.rating,
      ebayConfig: ebayConfig
    });

    console.log('📊 PRICING RESULTS:');
    console.log('==================');
    console.log(`💰 Suggested price: $${pricingResult.suggested}`);
    console.log(`📈 Price range: $${pricingResult.priceRange?.low} - $${pricingResult.priceRange?.high}`);
    console.log(`🎯 Confidence: ${pricingResult.confidence}`);
    console.log(`📦 Shipping cost: $${pricingResult.shippingCost || 0}`);
    console.log(`💸 eBay fees: $${pricingResult.ebayFees || 0}`);
    console.log(`💵 Net profit: $${pricingResult.netProfit || 0}`);
    console.log(`🔍 Data source: ${pricingResult.source}`);

    if (pricingResult.marketData) {
      console.log('\n📈 MARKET DATA:');
      console.log('===============');
      console.log(`🔍 Search query: "${pricingResult.marketData.searchQuery}"`);
      console.log(`📋 Active listings: ${pricingResult.marketData.activeListing}`);
      console.log(`📊 Sample size: ${pricingResult.marketData.sampleSize}`);
    }

    if (pricingResult.comparableItems && pricingResult.comparableItems.length > 0) {
      console.log('\n🔗 COMPARABLE ITEMS:');
      console.log('===================');
      pricingResult.comparableItems.forEach((item, index) => {
        console.log(`${index + 1}. $${item.price} - ${item.title.substring(0, 60)}...`);
        console.log(`   Condition: ${item.condition || 'Not specified'}`);
        console.log(`   URL: ${item.url}\n`);
      });
    }

    return pricingResult;

  } catch (error) {
    console.error('❌ Error testing eBay pricing:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('- Check your eBay API credentials in .env file');
    console.log('- Ensure your eBay keyset is activated');
    console.log('- Verify notification compliance is complete');
  }
}

// Run the test
testEbayPricing();