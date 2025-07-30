// test-bamboo-table.js
import { SimpleEbayAPI } from './capture-sdk/integrations/ebay/simpleAPI.js';
import dotenv from 'dotenv';

dotenv.config();

async function testBambooTable() {
  console.log('🪑 Testing Bamboo Side Table pricing...\n');

  const ebay = new SimpleEbayAPI({
    clientId: process.env.EBAY_CLIENT_ID,
    clientSecret: process.env.EBAY_CLIENT_SECRET,
    environment: 'production'
  });

  // Test the exact item from your photo
  const itemData = {
    category: 'furniture',
    brand: 'Unknown',
    model: 'Bamboo side table',
    condition: { rating: 7, usableAsIs: true },
    description: 'The side table shows some signs of wear, including scratches'
  };

  try {
    const pricing = await ebay.getPricing(itemData);
    
    console.log('📊 BAMBOO TABLE PRICING:');
    console.log('========================');
    console.log(`🔍 Search query: "${pricing.searchQuery}"`);
    console.log(`💰 Suggested price: $${pricing.suggested || 'N/A'}`);
    console.log(`🎯 Confidence: ${pricing.confidence}`);
    console.log(`📋 Sample size: ${pricing.sampleSize || 0}`);
    
    if (pricing.priceRange) {
      console.log(`📈 Price range: $${pricing.priceRange.min} - $${pricing.priceRange.max}`);
      console.log(`📊 Median: $${pricing.priceRange.median}`);
    }

    if (pricing.comparableItems && pricing.comparableItems.length > 0) {
      console.log('\n🔗 Found these comparable items:');
      pricing.comparableItems.forEach((item, index) => {
        console.log(`${index + 1}. $${item.price} - ${item.title.substring(0, 80)}...`);
      });
    }

    // Calculate realistic profit
    const shippingCost = 25; // Furniture shipping
    const ebayFees = pricing.suggested * 0.13; // 13% eBay fees
    const netProfit = pricing.suggested - ebayFees - shippingCost;
    
    console.log('\n💵 PROFIT ANALYSIS:');
    console.log('===================');
    console.log(`Sale price: $${pricing.suggested}`);
    console.log(`eBay fees: $${ebayFees.toFixed(2)}`);
    console.log(`Shipping: $${shippingCost}`);
    console.log(`Net profit: $${netProfit.toFixed(2)}`);
    
    if (netProfit > 0) {
      console.log('✅ Profitable item!');
    } else {
      console.log('❌ Not profitable after fees');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBambooTable();