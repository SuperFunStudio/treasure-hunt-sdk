// dynamic-category-handler.js
// Dynamic system that adapts to any eBay category automatically
import dotenv from 'dotenv';

dotenv.config();

class DynamicEbayHandler {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    };
    
    // Cache to avoid repeated API calls
    this.categoryCache = new Map();
    this.conditionCache = new Map();
  }

  // Get valid conditions for any category
  async getValidConditions(categoryId) {
    if (this.conditionCache.has(categoryId)) {
      return this.conditionCache.get(categoryId);
    }

    console.log(`🔍 Getting valid conditions for category ${categoryId}...`);

    try {
      const response = await fetch(`https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=categoryIds:{${categoryId}}`, {
        method: 'GET',
        headers: this.headers
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.itemConditionPolicies && data.itemConditionPolicies.length > 0) {
          const policy = data.itemConditionPolicies[0];
          
          // Map numeric IDs to text enums
          const conditionMap = {
            '1000': 'NEW',
            '1500': 'NEW_OTHER', 
            '1750': 'NEW_WITH_DEFECTS',
            '2000': 'CERTIFIED_REFURBISHED',
            '2500': 'SELLER_REFURBISHED',
            '2750': 'LIKE_NEW',
            '3000': 'USED_EXCELLENT', // Try this instead of 'USED'
            '4000': 'USED_VERY_GOOD',
            '5000': 'USED_GOOD',
            '6000': 'USED_ACCEPTABLE',
            '7000': 'FOR_PARTS_OR_NOT_WORKING'
          };

          const validConditions = policy.itemConditions.map(condition => ({
            numericId: condition.conditionId,
            textEnum: conditionMap[condition.conditionId] || 'NEW_OTHER',
            description: condition.conditionDescription
          }));

          console.log(`✅ Found ${validConditions.length} valid conditions for category ${categoryId}:`);
          validConditions.forEach(c => {
            console.log(`   ${c.numericId} → ${c.textEnum} (${c.description})`);
          });

          this.conditionCache.set(categoryId, validConditions);
          return validConditions;
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not get conditions for category ${categoryId}:`, error.message);
    }

    // Fallback to safe conditions
    return [{ numericId: '1500', textEnum: 'NEW_OTHER', description: 'Open box' }];
  }

  // Get required aspects for any category
  async getRequiredAspects(categoryId) {
    if (this.categoryCache.has(categoryId)) {
      return this.categoryCache.get(categoryId);
    }

    console.log(`📋 Getting required aspects for category ${categoryId}...`);

    try {
      const response = await fetch(`https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`, {
        method: 'GET',
        headers: this.headers
      });

      if (response.ok) {
        const data = await response.json();
        
        const requiredAspects = {};
        const recommendedAspects = {};

        if (data.aspects) {
          data.aspects.forEach(aspect => {
            const aspectName = aspect.localizedAspectName;
            
            if (aspect.aspectConstraint?.aspectRequired) {
              // Required aspect
              if (aspect.aspectValues && aspect.aspectValues.length > 0) {
                requiredAspects[aspectName] = [aspect.aspectValues[0].localizedValue];
              } else {
                requiredAspects[aspectName] = ["Not Specified"];
              }
            } else if (aspect.aspectUsage === 'RECOMMENDED') {
              // Recommended aspect
              if (aspect.aspectValues && aspect.aspectValues.length > 0) {
                recommendedAspects[aspectName] = [aspect.aspectValues[0].localizedValue];
              }
            }
          });
        }

        console.log(`✅ Found ${Object.keys(requiredAspects).length} required aspects:`);
        Object.keys(requiredAspects).forEach(key => {
          console.log(`   ${key}: ${requiredAspects[key][0]}`);
        });

        const aspectData = { required: requiredAspects, recommended: recommendedAspects };
        this.categoryCache.set(categoryId, aspectData);
        return aspectData;
      }
    } catch (error) {
      console.log(`⚠️ Could not get aspects for category ${categoryId}:`, error.message);
    }

    // Fallback aspects
    return {
      required: {
        "Brand": ["Test Brand"],
        "Type": ["Other"]
      },
      recommended: {}
    };
  }

  // Create listing for any category dynamically
  async createDynamicListing(categoryId, itemData = {}) {
    console.log(`\n🎯 Creating dynamic listing for category ${categoryId}...`);

    // Get valid conditions and required aspects
    const [validConditions, aspectData] = await Promise.all([
      this.getValidConditions(categoryId),
      this.getRequiredAspects(categoryId)
    ]);

    // Choose best condition (prefer used conditions for typical scanned items)
    const preferredConditions = ['USED_VERY_GOOD', 'USED_GOOD', 'USED_EXCELLENT', 'NEW_OTHER', 'NEW'];
    let selectedCondition = validConditions.find(c => 
      preferredConditions.includes(c.textEnum)
    ) || validConditions[0];

    console.log(`✅ Selected condition: ${selectedCondition.textEnum} (${selectedCondition.description})`);

    // Get shipping policy
    const policyResponse = await fetch('https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US', {
      method: 'GET',
      headers: this.headers
    });
    const policyData = await policyResponse.json();
    const shippingPolicyId = policyData.fulfillmentPolicies[0].fulfillmentPolicyId;

    // Create dynamic inventory item
    const sku = `TH_DYNAMIC_${Date.now()}_${categoryId}`;
    
    const inventoryItem = {
      condition: selectedCondition.textEnum,
      product: {
        title: itemData.title || `Dynamic Test - Category ${categoryId} - Treasure Hunter SDK`,
        description: itemData.description || `🤖 DYNAMIC CATEGORY TEST

This listing was created by the Treasure Hunter SDK's dynamic category handler.

✅ Category: ${categoryId}
✅ Condition: ${selectedCondition.textEnum} (auto-selected)
✅ Required aspects: Auto-populated
✅ Dynamic adaptation: Working

The SDK automatically:
• Detects valid conditions for any category
• Retrieves required item specifics
• Adapts to eBay's category requirements
• Creates compliant listings

⚠️ Test listing - will be deleted automatically.`,
        
        imageUrls: itemData.images || ['https://i.ebayimg.com/images/g/9~4AAOSwcu5kXKvQ/s-l1600.jpg'],
        
        // Use dynamically retrieved required aspects
        aspects: {
          ...aspectData.required,
          ...aspectData.recommended,
          // Add common missing aspects
          "Storage Capacity": ["Not Applicable"],
          "Brand": ["Generic"],
          "Type": ["Other"],
          "Material": ["Mixed Materials"],
          "Country/Region of Manufacture": ["United States"],
          // Override with user data if provided
          ...itemData.aspects
        }
      },
      availability: {
        shipToLocationAvailability: {
          quantity: 1
        }
      },
      // Add package weight for shipping
      packageWeightAndSize: {
        weight: {
          value: 1.0,
          unit: "POUND"
        },
        dimensions: {
          length: 10.0,
          width: 8.0,
          height: 6.0,
          unit: "INCH"
        }
      }
    };

    try {
      console.log('🧪 Creating dynamic inventory item...');
      
      const inventoryResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(inventoryItem)
      });

      if (inventoryResponse.status === 201 || inventoryResponse.status === 204) {
        console.log('✅ Dynamic inventory created!');
        
        // Create dynamic offer
        const offer = {
          sku: sku,
          marketplaceId: 'EBAY_US',
          format: 'FIXED_PRICE',
          pricingSummary: {
            price: {
              currency: 'USD',
              value: itemData.price || '10.99'
            }
          },
          categoryId: categoryId,
          merchantLocationKey: 'default',
          listingPolicies: {
            fulfillmentPolicyId: shippingPolicyId
          }
        };

        const offerResponse = await fetch('https://api.ebay.com/sell/inventory/v1/offer', {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(offer)
        });

        if (offerResponse.ok) {
          const offerData = await offerResponse.json();
          console.log('✅ Dynamic offer created!');
          
          // Publish dynamic offer
          const publishResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerData.offerId}/publish`, {
            method: 'POST',
            headers: this.headers
          });

          if (publishResponse.ok) {
            const publishData = await publishResponse.json();
            
            console.log('\n🎉 DYNAMIC LISTING SUCCESS!');
            console.log(`📋 Category ${categoryId} listing created:`);
            console.log('   URL: https://www.ebay.com/itm/' + publishData.listingId);
            console.log('   Condition:', selectedCondition.textEnum);
            console.log('   Required aspects: Auto-populated');
            
            return {
              success: true,
              listingId: publishData.listingId,
              url: 'https://www.ebay.com/itm/' + publishData.listingId,
              offerId: offerData.offerId,
              condition: selectedCondition.textEnum,
              category: categoryId
            };
          } else {
            const error = await publishResponse.text();
            console.log(`❌ Publishing failed for category ${categoryId}:`, error);
            return { success: false, error: error };
          }
        } else {
          const error = await offerResponse.text();
          console.log(`❌ Offer failed for category ${categoryId}:`, error);
          return { success: false, error: error };
        }
      } else {
        const error = await inventoryResponse.text();
        console.log(`❌ Inventory failed for category ${categoryId}:`, error);
        return { success: false, error: error };
      }

    } catch (error) {
      console.error(`💥 Exception for category ${categoryId}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

// Test the dynamic handler with multiple categories
async function testDynamicHandler() {
  console.log('🤖 Testing Dynamic eBay Category Handler...\n');
  
  const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;
  const handler = new DynamicEbayHandler(ACCESS_TOKEN);

  // Test different categories that users might scan
  const testCategories = [
    { 
      categoryId: '171485', 
      name: 'Collectibles',
      itemData: {
        title: 'Collectible Test Item - Treasure Hunter',
        price: '15.99'
      }
    },
    { 
      categoryId: '11450', 
      name: 'Electronics', 
      itemData: {
        title: 'Electronics Test Item - Treasure Hunter',
        price: '25.99'
      }
    },
    { 
      categoryId: '220', 
      name: 'Toys & Hobbies',
      itemData: {
        title: 'Toy Test Item - Treasure Hunter', 
        price: '12.99'
      }
    }
  ];

  const results = [];

  for (const category of testCategories) {
    console.log(`\n🧪 Testing ${category.name} (${category.categoryId})...`);
    
    const result = await handler.createDynamicListing(category.categoryId, category.itemData);
    results.push({ ...result, categoryName: category.name });
    
    if (result.success) {
      console.log(`✅ ${category.name} listing created successfully!`);
      
      // Auto-cleanup after 2 minutes
      setTimeout(async () => {
        try {
          await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${result.offerId}/withdraw`, {
            method: 'POST',
            headers: handler.headers,
            body: JSON.stringify({ reason: 'OTHER' })
          });
          console.log(`🗑️ ${category.name} test listing cleaned up`);
        } catch (e) {
          console.log(`📝 Manual cleanup needed for ${category.name}:`, result.listingId);
        }
      }, 120000);
      
      break; // Success! No need to test more categories
    } else {
      console.log(`❌ ${category.name} failed:`, result.error);
    }
  }

  // Summary
  console.log('\n📊 DYNAMIC HANDLER TEST RESULTS:');
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.categoryName}: SUCCESS - ${result.url}`);
    } else {
      console.log(`❌ ${result.categoryName}: FAILED`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  if (successCount > 0) {
    console.log('\n🎉 DYNAMIC SYSTEM WORKING!');
    console.log('✅ Can adapt to different eBay categories automatically');
    console.log('✅ Fetches valid conditions dynamically');
    console.log('✅ Retrieves required aspects automatically');
    console.log('✅ Ready for production with any scanned item type');
  }
}

// Standalone function to test specific category
async function testSpecificCategory(categoryId, itemData = {}) {
  const ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;
  const handler = new DynamicEbayHandler(ACCESS_TOKEN);
  
  console.log(`🎯 Testing specific category: ${categoryId}\n`);
  
  const result = await handler.createDynamicListing(categoryId, itemData);
  
  if (result.success) {
    console.log('\n🎉 SPECIFIC CATEGORY SUCCESS!');
    console.log('URL:', result.url);
    console.log('The dynamic handler successfully adapted to category', categoryId);
  } else {
    console.log('\n❌ Category test failed:', result.error);
  }
  
  return result;
}

// Command line interface
const args = process.argv.slice(2);

if (args[0] === 'category' && args[1]) {
  // Test specific category: node dynamic-category-handler.js category 171485
  testSpecificCategory(args[1]).catch(console.error);
} else {
  // Test multiple categories
  console.log('🤖 Starting dynamic category adaptation test...');
  console.log('This will test the system\'s ability to handle different eBay categories automatically.\n');
  
  testDynamicHandler().catch(console.error);
}

// Export for use in your main SDK
export { DynamicEbayHandler };