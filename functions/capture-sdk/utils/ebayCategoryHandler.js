// functions/capture-sdk/utils/ebayCategoryHandler.js
// Dynamic eBay category and condition handler for the SDK

 class EbayCategoryHandler {
    constructor(ebayIntegration) {
      this.ebay = ebayIntegration;
      
      // Cache to avoid repeated API calls
      this.categoryCache = new Map();
      this.conditionCache = new Map();
      this.leafCategoryCache = new Map();
    }
  
    // Map numeric condition IDs to text enums
    getConditionEnum(numericId) {
  const id = String(numericId);

  // Broad, Inventory-compatible mapping
  const map = {
    '1000': 'NEW',                      // New
    '1500': 'NEW_OTHER',                // New (other)
    '1750': 'NEW_WITH_DEFECTS',         // New with defects
    '2000': 'CERTIFIED_REFURBISHED',    // Certified refurbished
    '2500': 'SELLER_REFURBISHED',       // Seller refurbished
    '2750': 'LIKE_NEW',                 // Like New

    // All the various "used" granular IDs collapse to USED for Inventory API
    '2990': 'USED', // “pre-owned excellent” (collapse)
    '3000': 'USED', // Used
    '3010': 'USED', // “pre-owned fair” (collapse)
    '4000': 'USED', // Used (very good)
    '5000': 'USED', // Used (good)
    '6000': 'USED', // Used (acceptable)

    '7000': 'FOR_PARTS_OR_NOT_WORKING'  // For parts or not working
  };

  return map[id] || 'USED';
}

    // Get valid conditions for any category
    async getValidConditions(categoryId) {
      if (this.conditionCache.has(categoryId)) {
        return this.conditionCache.get(categoryId);
      }
  
      try {
        const response = await this.ebay.apiCall('GET', 
          `/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=categoryIds:{${categoryId}}`
        );
  
        if (response.itemConditionPolicies && response.itemConditionPolicies.length > 0) {
          const policy = response.itemConditionPolicies[0];
          
          const validConditions = policy.itemConditions.map(condition => ({
            numericId: condition.conditionId,
            textEnum: this.getConditionEnum(condition.conditionId),
            description: condition.conditionDescription
          }));
  
          this.conditionCache.set(categoryId, validConditions);
          return validConditions;
        }
      } catch (error) {
        console.warn(`Could not get conditions for category ${categoryId}:`, error.message);
      }
  
      // Fallback conditions that work in most categories
      return [
        { numericId: '1500', textEnum: 'NEW_OTHER', description: 'Open box' },
        { numericId: '3000', textEnum: 'USED_EXCELLENT', description: 'Used' }
      ];
    }
  
    // Get required aspects for any category
    async getRequiredAspects(categoryId) {
      if (this.categoryCache.has(categoryId)) {
        return this.categoryCache.get(categoryId);
      }
  
      try {
        const response = await this.ebay.apiCall('GET',
          `/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`
        );
  
        const requiredAspects = {};
        const recommendedAspects = {};
  
        if (response.aspects) {
          response.aspects.forEach(aspect => {
            const aspectName = aspect.localizedAspectName;
            
            if (aspect.aspectConstraint?.aspectRequired) {
              if (aspect.aspectValues && aspect.aspectValues.length > 0) {
                requiredAspects[aspectName] = [aspect.aspectValues[0].localizedValue];
              } else {
                requiredAspects[aspectName] = ["Not Specified"];
              }
            } else if (aspect.aspectUsage === 'RECOMMENDED') {
              if (aspect.aspectValues && aspect.aspectValues.length > 0) {
                recommendedAspects[aspectName] = [aspect.aspectValues[0].localizedValue];
              }
            }
          });
        }
  
        const aspectData = { required: requiredAspects, recommended: recommendedAspects };
        this.categoryCache.set(categoryId, aspectData);
        return aspectData;
        
      } catch (error) {
        console.warn(`Could not get aspects for category ${categoryId}:`, error.message);
      }
  
      // Fallback aspects that work for most categories
      return {
        required: {
          "Brand": ["Generic"],
          "Type": ["Other"]
        },
        recommended: {}
      };
    }
  
    // Find appropriate leaf category for broad categories
    async findLeafCategory(broadCategoryId, itemData = {}) {
      if (this.leafCategoryCache.has(broadCategoryId)) {
        return this.leafCategoryCache.get(broadCategoryId);
      }
  
      // Known working leaf categories for common broad categories
      const leafCategoryMap = {
        // Electronics
        '11450': '175672', // Cell Phones & Smartphones
        '293': '139973',   // Video Games
        
        // Collectibles  
        '171485': '11233', // Music CDs (often works better)
        
        // Books & Media
        '267': '267',      // Books (already leaf)
        
        // Toys
        '220': '220',      // Toys & Hobbies (try as is)
        
        // Home & Garden
        '11700': '20518'   // Kitchen gadgets
      };
  
      const leafCategory = leafCategoryMap[broadCategoryId] || broadCategoryId;
      this.leafCategoryCache.set(broadCategoryId, leafCategory);
      
      return leafCategory;
    }
  
    // Select best condition based on item analysis and category
    selectBestCondition(validConditions, itemAnalysis = {}) {
      const preferredOrder = [
        'USED_VERY_GOOD',
        'USED_GOOD', 
        'USED_EXCELLENT',
        'NEW_OTHER',
        'NEW',
        'LIKE_NEW',
        'PRE_OWNED_EXCELLENT'
      ];
  
      // If item analysis suggests specific condition, try to match it
      if (itemAnalysis.condition) {
        const analysisCondition = itemAnalysis.condition.toLowerCase();
        
        if (analysisCondition.includes('new')) {
          return validConditions.find(c => c.textEnum.includes('NEW')) || validConditions[0];
        }
        if (analysisCondition.includes('excellent')) {
          return validConditions.find(c => c.textEnum.includes('EXCELLENT')) || validConditions[0];
        }
        if (analysisCondition.includes('good')) {
          return validConditions.find(c => c.textEnum.includes('GOOD')) || validConditions[0];
        }
      }
  
      // Default: find first available condition in preferred order
      for (const preferred of preferredOrder) {
        const match = validConditions.find(c => c.textEnum === preferred);
        if (match) return match;
      }
  
      // Fallback to first available condition
      return validConditions[0];
    }
  
    // Generate comprehensive aspects based on item analysis
    generateAspects(requiredAspects, recommendedAspects, itemAnalysis = {}) {
      const aspects = {
        // Start with required aspects
        ...requiredAspects,
        ...recommendedAspects
      };
  
      // Add common aspects that prevent errors
      const commonAspects = {
        "Brand": [itemAnalysis.brand || "Generic"],
        "Type": ["Other"],
        "Storage Capacity": ["Not Applicable"],
        "Screen Size": ["Not Applicable"], 
        "Material": ["Mixed Materials"],
        "Country/Region of Manufacture": ["United States"],
        "Color": ["Multi-Color"],
        "Size": ["One Size"],
        "Model": [itemAnalysis.model || "Unknown"],
        "Connectivity": ["Not Applicable"],
        "Features": ["Standard"],
        "Condition": ["See Description"]
      };
  
      // Merge common aspects, but don't override existing ones
      Object.keys(commonAspects).forEach(key => {
        if (!aspects[key]) {
          aspects[key] = commonAspects[key];
        }
      });
  
      // Override with specific item analysis data
      if (itemAnalysis.aspects) {
        Object.assign(aspects, itemAnalysis.aspects);
      }
  
      return aspects;
    }
  
    // Create listing with dynamic category adaptation
    async createAdaptiveListing(listingData, itemAnalysis = {}) {
      try {
        // Step 1: Find appropriate leaf category
        const leafCategoryId = await this.findLeafCategory(listingData.category, itemAnalysis);
        
        // Step 2: Get valid conditions and aspects for this category
        const [validConditions, aspectData] = await Promise.all([
          this.getValidConditions(leafCategoryId),
          this.getRequiredAspects(leafCategoryId)
        ]);
  
        // Step 3: Select best condition
        const selectedCondition = this.selectBestCondition(validConditions, itemAnalysis);
  
        // Step 4: Generate comprehensive aspects
        const aspects = this.generateAspects(
          aspectData.required, 
          aspectData.recommended, 
          itemAnalysis
        );
  
        // Step 5: Create adapted listing data
        const adaptedListingData = {
          ...listingData,
          category: leafCategoryId, // Use leaf category
          condition: selectedCondition.textEnum, // Use correct text enum
          itemSpecifics: aspects,
          
          // Add package details for shipping
          packageWeightAndSize: {
            weight: { value: itemAnalysis.weight || 1.0, unit: "POUND" },
            dimensions: {
              length: itemAnalysis.length || 10.0,
              width: itemAnalysis.width || 8.0, 
              height: itemAnalysis.height || 6.0,
              unit: "INCH"
            }
          }
        };
  
        // Step 6: Create listing with adapted data
        const result = await this.ebay.createListing(adaptedListingData);
  
        if (result.success) {
          return {
            ...result,
            adaptedCategory: leafCategoryId,
            selectedCondition: selectedCondition.textEnum,
            aspectsUsed: Object.keys(aspects).length
          };
        }
  
        return result;
  
      } catch (error) {
        return {
          success: false,
          error: error.message,
          details: error
        };
      }
    }
  
    // Validate if a category is a leaf category
    async isLeafCategory(categoryId) {
      try {
        const response = await this.ebay.apiCall('GET',
          `/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=${categoryId}`
        );
        
        // If it has children, it's not a leaf
        return !response.childCategoryTreeNodes || response.childCategoryTreeNodes.length === 0;
        
      } catch (error) {
        // Assume it's a leaf if we can't check
        return true;
      }
    }
  
    // Get category suggestions for item classification
    async suggestCategory(itemTitle, itemDescription = '') {
      try {
        const searchText = `${itemTitle} ${itemDescription}`.substring(0, 100);
        
        const response = await this.ebay.apiCall('GET',
          `/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(searchText)}`
        );
        
        if (response.categorySuggestions && response.categorySuggestions.length > 0) {
          return response.categorySuggestions.map(suggestion => ({
            categoryId: suggestion.category.categoryId,
            categoryName: suggestion.category.categoryName,
            relevancy: suggestion.relevancy
          }));
        }
        
      } catch (error) {
        console.warn('Category suggestion failed:', error.message);
      }
  
      // Fallback categories that usually work
      return [
        { categoryId: '11233', categoryName: 'Music CDs', relevancy: '50.0' },
        { categoryId: '139973', categoryName: 'Video Games', relevancy: '40.0' }
      ];
    }
  }

  module.exports = { EbayCategoryHandler };
