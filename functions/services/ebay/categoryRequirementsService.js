// services/ebay/categoryRequirementsService.js
// Complete enhanced service for fetching and managing eBay category requirements

class CategoryRequirementsService {
  constructor(db = null, admin = null) {
    this.db = db;
    this.admin = admin;
    this.cache = new Map();
    this.apiBaseUrl = 'https://api.ebay.com/commerce/taxonomy/v1';
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Fetch category requirements from eBay Taxonomy API with retry logic
   */
  async fetchCategoryRequirements(categoryId, accessToken = null) {
    console.log(`Fetching requirements for category: ${categoryId}`);

    let currentToken = accessToken;
  let triedAppToken = false;
  

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const fetch = (await import('node-fetch')).default;
        const url = `${this.apiBaseUrl}/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`;
        
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };

        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(url, { headers });

         // If 403 and we haven't tried app token yet, try app token
      if (response.status === 403 && !triedAppToken) {
        console.log('User token got 403, trying app token for taxonomy...');
        try {
          const tokenManager = require('./tokenManager');
          currentToken = await tokenManager.getAppToken();
          triedAppToken = true;
          continue; // Retry with app token
        } catch (appTokenError) {
          console.warn('App token also failed:', appTokenError.message);
          return this.getFallbackRequirements(categoryId);
        }
      }

        if (!response.ok) {
          if (attempt === this.maxRetries) {
            console.warn(`eBay API failed after ${this.maxRetries} attempts: ${response.status}`);
            return this.getFallbackRequirements(categoryId);
          }
          
          await this.delay(this.retryDelay * attempt);
          continue;
        }

        const data = await response.json();
        
        if (!this.validateApiResponse(data)) {
          console.warn('Invalid API response structure, using fallback');
          return this.getFallbackRequirements(categoryId);
        }

        const requirements = this.parseApiResponse(categoryId, data);
        await this.cacheRequirements(categoryId, requirements);
        
        return requirements;

      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          console.warn('All API attempts failed, using fallback requirements');
          return this.getFallbackRequirements(categoryId);
        }
        
        await this.delay(this.retryDelay * attempt);
      }
    }
  }

  /**
   * Parse eBay API response into standardized format
   */
  parseApiResponse(categoryId, data) {
    const requiredAspects = data.aspects
      ?.filter(aspect => aspect.aspectConstraint?.aspectRequired === true)
      ?.map(aspect => ({
        name: aspect.localizedAspectName,
        required: true,
        values: aspect.aspectValues?.map(v => v.localizedValue) || []
      })) || [];

    const optionalAspects = data.aspects
      ?.filter(aspect => aspect.aspectConstraint?.aspectRequired !== true)
      ?.map(aspect => ({
        name: aspect.localizedAspectName,
        required: false,
        values: aspect.aspectValues?.map(v => v.localizedValue) || []
      })) || [];

    return {
      success: true,
      categoryId: categoryId,
      requiredAspects: requiredAspects,
      optionalAspects: optionalAspects,
      totalAspects: data.aspects?.length || 0,
      lastUpdated: new Date(),
      source: 'ebay_api'
    };
  }

  /**
   * Get category requirements with intelligent fallbacks
   */
  async getCategoryRequirements(categoryInput, accessToken = null) {
    try {
      const categoryId = this.resolveCategoryId(categoryInput);
      
      const cached = await this.getCachedRequirements(categoryId);
      if (cached && !this.isCacheStale(cached)) {
        return cached;
      }

      return await this.fetchCategoryRequirements(categoryId, accessToken);

    } catch (error) {
      console.error('Error getting category requirements:', error);
      return this.getFallbackRequirements(categoryInput);
    }
  }

  /**
   * Resolve category input to eBay category ID
   */
  resolveCategoryId(categoryInput) {
    if (/^\d+$/.test(categoryInput)) {
      return categoryInput;
    }

    const categoryMapping = {
      'electronics': '41859',
      'headphones': '41859',
      'footwear': '57972',
      'shoes': '57972', 
      'clothing': '11450',
      'furniture': '20081',
      'automotive': '6030',
      'toys': '220',
      'sporting goods': '888',
      'jewelry': '281',
      'books': '267',
      'collectibles': '1',
      'home & garden': '11700'
    };

    return categoryMapping[categoryInput?.toLowerCase()] || '99';
  }

  /**
   * Get fallback requirements for when API fails
   */
  getFallbackRequirements(categoryInput) {
    const categoryKey = typeof categoryInput === 'string' ? 
      categoryInput.toLowerCase() : 
      this.getCategoryFromId(categoryInput);

    const fallbackData = {
      footwear: {
        requiredAspects: [
          { name: 'US Shoe Size', required: true, values: ['6', '7', '8', '9', '10', '11', '12', '13'] },
          { name: 'Brand', required: true, values: [] },
          { name: 'Style', required: true, values: ['Athletic', 'Casual', 'Dress', 'Boots', 'Sandals'] },
          { name: 'Width', required: false, values: ['Medium (D, M)', 'Wide (C, D, W)', 'Extra Wide (E+, WW+)'] }
        ]
      },
      electronics: {
        requiredAspects: [
          { name: 'Type', required: true, values: ['Over-Ear', 'On-Ear', 'In-Ear', 'Other'] },
          { name: 'Brand', required: true, values: [] },
          { name: 'Connectivity', required: false, values: ['Wired', 'Wireless', 'Wired & Wireless'] }
        ]
      },
      clothing: {
        requiredAspects: [
          { name: 'Size', required: true, values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
          { name: 'Brand', required: true, values: [] },
          { name: 'Gender', required: false, values: ['Men', 'Women', 'Unisex'] }
        ]
      },
      furniture: {
        requiredAspects: [
          { name: 'Number of Items in Set', required: true, values: ['1', '2', '3', '4', '5+'] },
          { name: 'Set Includes', required: true, values: [] },
          { name: 'Brand', required: true, values: [] },
          { name: 'Material', required: false, values: ['Wood', 'Metal', 'Fabric', 'Leather', 'Plastic'] }
        ]
      }
    };

    const categoryData = fallbackData[categoryKey] || {
      requiredAspects: [
        { name: 'Brand', required: true, values: [] },
        { name: 'Type', required: true, values: [] }
      ]
    };

    return {
      success: false,
      fallback: true,
      categoryId: this.resolveCategoryId(categoryInput),
      ...categoryData,
      lastUpdated: new Date(),
      source: 'fallback'
    };
  }

  /**
   * Cache requirements in Firestore
   */
  async cacheRequirements(categoryId, requirements) {
    try {
      if (!this.db || !this.admin) return;

      await this.db
        .collection('system')
        .doc('category_requirements')
        .collection('categories')
        .doc(categoryId)
        .set({
          ...requirements,
          lastUpdated: this.admin.firestore.FieldValue.serverTimestamp()
        });

      console.log(`Cached requirements for category ${categoryId}`);
    } catch (error) {
      console.warn('Failed to cache requirements:', error.message);
    }
  }

  /**
   * Get cached requirements from Firestore
   */
  async getCachedRequirements(categoryId) {
    try {
      if (!this.db) return null;

      const doc = await this.db
        .collection('system')
        .doc('category_requirements')
        .collection('categories')
        .doc(categoryId)
        .get();

      if (!doc.exists) return null;

      const data = doc.data();
      return {
        ...data,
        lastUpdated: data.lastUpdated?.toDate() || new Date()
      };

    } catch (error) {
      console.warn('Failed to get cached requirements:', error.message);
      return null;
    }
  }

  /**
   * Check if cached data is stale (older than 7 days)
   */
  isCacheStale(cachedData) {
    if (!cachedData?.lastUpdated) return true;
    
    const staleThreshold = 7 * 24 * 60 * 60 * 1000;
    const age = Date.now() - cachedData.lastUpdated.getTime();
    
    return age > staleThreshold;
  }

  /**
   * Validate eBay API response structure
   */
  validateApiResponse(response) {
    return response && 
           typeof response === 'object' && 
           Array.isArray(response.aspects);
  }

  /**
   * Validate required fields against requirements
   */
  validateRequiredFields(listingData, requirements) {
    if (!requirements?.requiredAspects) {
      return { isValid: true, missingFields: [] };
    }

    const missingFields = [];
    
    requirements.requiredAspects.forEach(aspect => {
      const fieldName = this.mapAspectToField(aspect.name);
      
      if (!listingData[fieldName] || listingData[fieldName] === 'Unknown') {
        missingFields.push(aspect.name);
      }
    });

    return {
      isValid: missingFields.length === 0,
      missingFields: missingFields,
      totalRequired: requirements.requiredAspects.length
    };
  }

  /**
   * Map eBay aspect names to listing data fields
   */
  mapAspectToField(aspectName) {
    const fieldMapping = {
      'Type': 'type',
      'Brand': 'brand',
      'Model': 'model',
      'US Shoe Size': 'size',
      'Style': 'style',
      'Width': 'width',
      'Size': 'size',
      'Material': 'material',
      'Color': 'color',
      'Connectivity': 'connectivity',
      'Gender': 'gender',
      'Number of Items in Set': 'numberOfItemsInSet',
      'Set Includes': 'setIncludes',
      'Condition': 'condition'
    };

    return fieldMapping[aspectName] || aspectName.toLowerCase().replace(/\s+/g, '');
  }

  /**
   * Get category name from eBay category ID
   */
  getCategoryFromId(categoryId) {
    const idMapping = {
      '41859': 'electronics',
      '57972': 'footwear',
      '11450': 'clothing',
      '20081': 'furniture',
      '6030': 'automotive',
      '220': 'toys',
      '888': 'sporting goods',
      '281': 'jewelry',
      '267': 'books',
      '1': 'collectibles',
      '11700': 'home & garden'
    };

    return idMapping[categoryId] || 'unknown';
  }

  /**
   * Generate intelligent defaults for missing required fields
   */
  generateIntelligentDefaults(listingData, requirements) {
    const defaults = {};
    
    if (!requirements?.requiredAspects) return defaults;

    requirements.requiredAspects.forEach(aspect => {
      const fieldName = this.mapAspectToField(aspect.name);
      
      if (!listingData[fieldName] || listingData[fieldName] === 'Unknown') {
        defaults[fieldName] = this.getDefaultValue(aspect, listingData);
      }
    });

    return defaults;
  }

  /**
   * Get intelligent default value for a missing aspect
   */
  getDefaultValue(aspect, listingData) {
    const aspectName = aspect.name;
    const category = listingData.category?.toLowerCase();
    
    switch (aspectName) {
      case 'Type':
        if (category === 'electronics' || listingData.subcategory === 'headphones') {
          return 'Over-Ear';
        }
        return 'Other';
        
      case 'Style':
        if (category === 'footwear') {
          return 'Athletic';
        }
        return 'Other';
        
      case 'US Shoe Size':
        return '10';
        
      case 'Size':
        if (category === 'clothing') {
          return 'M';
        }
        return 'One Size';
        
      case 'Width':
        return 'Medium (D, M)';
        
      case 'Number of Items in Set':
        return '1';
        
      case 'Set Includes':
        if (category === 'furniture') {
          return listingData.subcategory || 'Item';
        }
        return 'Item';
        
      case 'Brand':
        return 'Unbranded';
        
      case 'Connectivity':
        return 'Wired';
        
      case 'Gender':
        return 'Unisex';
        
      case 'Material':
        if (category === 'furniture') {
          return 'Mixed Materials';
        }
        return 'Other';
        
      default:
        if (aspect.values && aspect.values.length > 0) {
          return aspect.values[0];
        }
        return 'Other';
    }
  }

  /**
   * Utility function to add delay for retry logic
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate test data for different categories (for testing)
   */
  generateTestData(category) {
    const testData = {
      footwear: {
        title: 'Test Athletic Shoes',
        description: 'Test description for shoes',
        brand: 'Nike',
        model: 'Air Max',
        category: 'footwear',
        size: '10',
        width: 'Medium (D, M)',
        style: 'Athletic',
        images: ['https://example.com/shoe1.jpg']
      },
      electronics: {
        title: 'Test Headphones',
        description: 'Test wireless headphones',
        brand: 'Sony',
        model: 'WH-1000XM4',
        category: 'electronics',
        subcategory: 'headphones',
        type: 'Over-Ear',
        connectivity: 'Wireless',
        images: ['https://example.com/headphones1.jpg']
      },
      clothing: {
        title: 'Test T-Shirt',
        description: 'Comfortable cotton t-shirt',
        brand: 'Generic',
        category: 'clothing',
        size: 'L',
        material: 'Cotton',
        gender: 'Unisex',
        images: ['https://example.com/shirt1.jpg']
      },
      furniture: {
        title: 'Test Chair',
        description: 'Comfortable office chair',
        brand: 'IKEA',
        category: 'furniture',
        numberOfItemsInSet: '1',
        setIncludes: 'Chair',
        material: 'Fabric',
        images: ['https://example.com/chair1.jpg']
      }
    };

    return testData[category] || {
      title: 'Test Item',
      description: 'Test description',
      brand: 'Generic',
      category: category || 'unknown',
      images: ['https://example.com/item1.jpg']
    };
  }

  /**
   * Generate mock eBay API response for testing
   */
  generateMockApiResponse(categoryId) {
    const category = this.getCategoryFromId(categoryId);
    
    const mockResponses = {
      electronics: {
        aspects: [
          {
            localizedAspectName: 'Type',
            aspectConstraint: { aspectRequired: true },
            aspectValues: [
              { localizedValue: 'Over-Ear' },
              { localizedValue: 'On-Ear' },
              { localizedValue: 'In-Ear' }
            ]
          },
          {
            localizedAspectName: 'Brand',
            aspectConstraint: { aspectRequired: true },
            aspectValues: []
          },
          {
            localizedAspectName: 'Connectivity',
            aspectConstraint: { aspectRequired: false },
            aspectValues: [
              { localizedValue: 'Wired' },
              { localizedValue: 'Wireless' }
            ]
          }
        ]
      },
      footwear: {
        aspects: [
          {
            localizedAspectName: 'US Shoe Size',
            aspectConstraint: { aspectRequired: true },
            aspectValues: [
              { localizedValue: '6' },
              { localizedValue: '7' },
              { localizedValue: '8' },
              { localizedValue: '9' },
              { localizedValue: '10' },
              { localizedValue: '11' },
              { localizedValue: '12' }
            ]
          },
          {
            localizedAspectName: 'Brand',
            aspectConstraint: { aspectRequired: true },
            aspectValues: []
          },
          {
            localizedAspectName: 'Style',
            aspectConstraint: { aspectRequired: true },
            aspectValues: [
              { localizedValue: 'Athletic' },
              { localizedValue: 'Casual' },
              { localizedValue: 'Dress' },
              { localizedValue: 'Boots' }
            ]
          }
        ]
      }
    };

    return mockResponses[category] || {
      aspects: [
        {
          localizedAspectName: 'Brand',
          aspectConstraint: { aspectRequired: true },
          aspectValues: []
        }
      ]
    };
  }
}

module.exports = CategoryRequirementsService;