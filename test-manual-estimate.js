// test-manual-estimate.js
import { estimatePrice } from './capture-sdk/utils/priceEstimate.js';

const testItem = {
  category: 'furniture',
  brand: 'Unknown',
  model: 'Industrial-style table',
  condition: {
    rating: 7,
    description: 'The table has minor scratches on the surface',
    usableAsIs: true
  }
};

console.log('Testing manual estimate...');

try {
  const result = await estimatePrice(testItem, {
    source: 'manual',
    condition: 'good'
  });
  
  console.log('Manual estimate result:', result);
} catch (error) {
  console.error('Test failed:', error.message);
}