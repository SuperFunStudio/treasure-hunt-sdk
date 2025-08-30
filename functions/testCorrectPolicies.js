/**
 * Executable Policy Test Script
 * Tests the correct policy IDs from your eBay dashboard
 */

require('dotenv').config();

const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;

// Correct policy IDs from your eBay dashboard
const POLICY_IDS = {
  fulfillmentPolicyId: "380523954022",  // Default Shipping Policy (confirmed working)
  paymentPolicyId: "380525759022",      // eBay Managed Payments (from your dashboard)
  returnPolicyId: "380525758022"        // 30 days money back (from your dashboard)
};

async function testPolicyIds() {
  console.log('Starting policy ID test...');
  
  if (!ACCESS_TOKEN) {
    console.log('Error: No access token found in .env file');
    return;
  }
  
  console.log(`Token found (${ACCESS_TOKEN.length} characters)`);
  console.log('Testing policy IDs:');
  console.log(`  Fulfillment: ${POLICY_IDS.fulfillmentPolicyId}`);
  console.log(`  Payment: ${POLICY_IDS.paymentPolicyId}`);
  console.log(`  Return: ${POLICY_IDS.returnPolicyId}`);
  
  const testSku = `TEST_POLICY_${Date.now()}`;
  
  try {
    // Step 1: Create test inventory item
    console.log('\nStep 1: Creating test inventory item...');
    
    const inventoryItem = {
      product: {
        title: "Policy Test Item - Delete Me",
        description: "Test item to verify policy IDs work",
        aspects: {},
        brand: "Test Brand",
        mpn: "TEST123"
      },
      condition: "NEW",
      packageWeightAndSize: {
        dimensions: {
          height: 5,
          length: 5,
          width: 5,
          unit: "INCH"
        },
        weight: {
          value: 1,
          unit: "POUND"
        }
      }
    };
    
    const inventoryResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${testSku}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Language': 'en-US',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      body: JSON.stringify(inventoryItem)
    });
    
    if (!inventoryResponse.ok) {
      const error = await inventoryResponse.text();
      console.log('Failed to create inventory item:', error);
      return;
    }
    
    console.log('✅ Inventory item created successfully');
    
    // Step 2: Create offer with policy IDs
    console.log('\nStep 2: Creating offer with policy IDs...');
    
    const offerData = {
      sku: testSku,
      marketplaceId: "EBAY_US",
      format: "FIXED_PRICE",
      availableQuantity: 1,
      pricingSummary: {
        price: {
          value: "9.99",
          currency: "USD"
        }
      },
      fulfillmentPolicyId: POLICY_IDS.fulfillmentPolicyId,
      paymentPolicyId: POLICY_IDS.paymentPolicyId,
      returnPolicyId: POLICY_IDS.returnPolicyId,
      categoryId: "159048", // Test category
      listingDescription: "Test listing to verify policy IDs"
    };
    
    const offerResponse = await fetch('https://api.ebay.com/sell/inventory/v1/offer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Language': 'en-US',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      body: JSON.stringify(offerData)
    });
    
    if (!offerResponse.ok) {
      const error = await offerResponse.text();
      console.log('❌ Offer creation failed:', error);
      
      // Try to identify which policy is wrong
      try {
        const errorData = JSON.parse(error);
        if (errorData.errors) {
          errorData.errors.forEach(err => {
            console.log(`Error: ${err.message}`);
            if (err.message.toLowerCase().includes('fulfillment')) {
              console.log('  → Issue with fulfillment policy ID');
            }
            if (err.message.toLowerCase().includes('payment')) {
              console.log('  → Issue with payment policy ID');
            }
            if (err.message.toLowerCase().includes('return')) {
              console.log('  → Issue with return policy ID');
            }
          });
        }
      } catch (parseError) {
        console.log('Could not parse error details');
      }
      
      return;
    }
    
    const offerResult = await offerResponse.json();
    console.log('✅ Test offer created successfully!');
    console.log(`Offer ID: ${offerResult.offerId}`);
    console.log('\n🎉 All policy IDs are working correctly!');
    
    // Cleanup
    console.log('\nStep 3: Cleaning up test data...');
    try {
      await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerResult.offerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      });
      console.log('✅ Test offer deleted');
    } catch (cleanupError) {
      console.log('⚠️ Could not delete test offer (manual cleanup needed)');
    }
    
    console.log('\n📋 SUMMARY:');
    console.log('These policy IDs work correctly:');
    console.log(`  fulfillmentPolicyId: "${POLICY_IDS.fulfillmentPolicyId}"`);
    console.log(`  paymentPolicyId: "${POLICY_IDS.paymentPolicyId}"`);
    console.log(`  returnPolicyId: "${POLICY_IDS.returnPolicyId}"`);
    console.log('\nUse these in your main listing function to fix the error.');
    
  } catch (error) {
    console.log('Test failed with error:', error.message);
  }
}

// Run the test
testPolicyIds();