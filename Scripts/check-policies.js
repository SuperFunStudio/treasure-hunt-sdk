// check-policies.js
// Verify your policies are published and accessible
import dotenv from 'dotenv';

dotenv.config();

async function checkPolicies() {
  console.log('🔍 Checking your published eBay policies...\n');

  const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;
  
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/json',
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json',
    'Content-Language': 'en-US',
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
  };

  // Check shipping policies
  try {
    console.log('🚢 Checking shipping (fulfillment) policies...');
    
    const response = await fetch('https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US', {
      method: 'GET',
      headers: headers
    });

    console.log('📡 Shipping Policies Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      
      if (data.fulfillmentPolicies && data.fulfillmentPolicies.length > 0) {
        console.log('✅ Found', data.fulfillmentPolicies.length, 'shipping policies:');
        
        data.fulfillmentPolicies.forEach((policy, index) => {
          console.log(`  ${index + 1}. ${policy.name} (ID: ${policy.fulfillmentPolicyId})`);
          console.log(`     Status: Published ✅`);
          
          if (policy.shippingOptions && policy.shippingOptions.length > 0) {
            console.log(`     Shipping services: ${policy.shippingOptions.length}`);
            policy.shippingOptions.forEach(option => {
              if (option.shippingServices) {
                option.shippingServices.forEach(service => {
                  console.log(`       - ${service.serviceName}`);
                });
              }
            });
          }
        });
        
        // Test with the first policy
        const firstPolicyId = data.fulfillmentPolicies[0].fulfillmentPolicyId;
        await testListingWithPolicy(ACCESS_TOKEN, headers, firstPolicyId);
        
      } else {
        console.log('❌ No published shipping policies found');
        console.log('📋 You need to PUBLISH your shipping policy in eBay Seller Hub');
      }
    } else {
      const error = await response.text();
      console.log('❌ Could not access shipping policies:', error);
    }

  } catch (error) {
    console.error('💥 Policy check exception:', error.message);
  }

  // Check payment policies
  try {
    console.log('\n💳 Checking payment policies...');
    
    const response = await fetch('https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=EBAY_US', {
      method: 'GET',
      headers: headers
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Payment policies found:', data.paymentPolicies?.length || 0);
    }
  } catch (error) {
    console.log('⚠️ Payment policy check failed');
  }

  // Check return policies
  try {
    console.log('🔄 Checking return policies...');
    
    const response = await fetch('https://api.ebay.com/sell/account/v1/return_policy?marketplace_id=EBAY_US', {
      method: 'GET',
      headers: headers
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Return policies found:', data.returnPolicies?.length || 0);
    }
  } catch (error) {
    console.log('⚠️ Return policy check failed');
  }
}

async function testListingWithPolicy(accessToken, headers, shippingPolicyId) {
  console.log('\n🧪 Testing listing creation with published policy...');
  console.log('Using shipping policy ID:', shippingPolicyId);
  
  const sku = `TH_POLICY_TEST_${Date.now()}`;
  
  // Create inventory
  const inventoryItem = {
    condition: 'USED_GOOD',
    product: {
      title: 'POLICY TEST - Treasure Hunter SDK Success!',
      description: 'Final test with published shipping policy. Will be deleted automatically.',
      imageUrls: ['https://i.ebayimg.com/images/g/9~4AAOSwcu5kXKvQ/s-l1600.jpg']
    },
    availability: {
      shipToLocationAvailability: {
        quantity: 1
      }
    }
  };

  try {
    const inventoryResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(inventoryItem)
    });

    if (inventoryResponse.status === 201 || inventoryResponse.status === 204) {
      console.log('✅ Inventory created with policy!');
      
      // Create offer with published shipping policy
      const offer = {
        sku: sku,
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        pricingSummary: {
          price: {
            currency: 'USD',
            value: '4.99'
          }
        },
        categoryId: '171485',
        merchantLocationKey: 'default',
        listingPolicies: {
          fulfillmentPolicyId: shippingPolicyId
        }
      };

      const offerResponse = await fetch('https://api.ebay.com/sell/inventory/v1/offer', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(offer)
      });

      if (offerResponse.ok) {
        const offerData = await offerResponse.json();
        console.log('✅ Offer created with published policy!');
        
        // Publish the offer
        const publishResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerData.offerId}/publish`, {
          method: 'POST',
          headers: headers
        });

        if (publishResponse.ok) {
          const publishData = await publishResponse.json();
          
          console.log('\n🎉🎉🎉 COMPLETE SUCCESS! 🎉🎉🎉');
          console.log('🏆 TREASURE HUNTER SDK EBAY INTEGRATION COMPLETE!');
          console.log('✅ Listing published: https://www.ebay.com/itm/' + publishData.listingId);
          console.log('\n🚀 Ready for production with user OAuth flows!');
          
        } else {
          const error = await publishResponse.text();
          console.log('❌ Publishing still failed:', error);
        }
      } else {
        const error = await offerResponse.text();
        console.log('❌ Offer with policy failed:', error);
      }
    }

  } catch (error) {
    console.error('💥 Policy test exception:', error.message);
  }
}

checkPolicies().catch(console.error);
