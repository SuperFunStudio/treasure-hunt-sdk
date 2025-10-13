// utils/item-specifics-validator.js
// Pre-validate eBay listings to catch missing required item specifics

const { categoryDetector } = require('./category-detector');
const { validateListingData } = require('./validators');

/**
 * eBay Item Specifics Validator
 * Validates listings before submission to prevent API failures
 */
class ItemSpecificsValidator {
  constructor() {
    this.requiredFields = {
      'furniture': [
        { field: 'numberOfItemsInSet', name: 'Number of Items in Set', defaultValue: '1' },
        { field: 'setIncludes', name: 'Set Includes', defaultValue: 'Chair' },
        { field: 'brand', name: 'Brand', defaultValue: 'Unbranded' }
      ],
      'footwear': [
        { field: 'size', name: 'US Shoe Size', defaultValue: '10' },
        { field: 'style', name: 'Style', defaultValue: 'Athletic' },
        { field: 'brand', name: 'Brand', defaultValue: 'Unbranded' }
      ],
      'electronics': [
        { field: 'type', name: 'Type', defaultValue: 'Other' },
        { field: 'brand', name: 'Brand', defaultValue: 'Unbranded' }
      ],
      'clothing': [
        { field: 'size', name: 'Size', defaultValue: 'M' },
        { field: 'brand', name: 'Brand', defaultValue: 'Unbranded' }
      ],
      'automotive': [
        { field: 'brand', name: 'Make', defaultValue: 'Generic' },
        { field: 'model', name: 'Model', defaultValue: 'See Description' },
        { field: 'year', name: 'Year', defaultValue: '2000' }
      ],
      'books': [
        { field: 'format', name: 'Format', defaultValue: 'Paperback' },
        { field: 'brand', name: 'Publisher', defaultValue: 'Independent' }
      ],
      'jewelry': [
        { field: 'type', name: 'Type', defaultValue: 'Other' },
        { field: 'material', name: 'Material', defaultValue: 'Mixed Materials' }
      ],
      'toys': [
        { field: 'ageRange', name: 'Age Range', defaultValue: '3+' },
        { field: 'brand', name: 'Brand', defaultValue: 'Unbranded' }
      ],
      'sporting goods': [
        { field: 'sport', name: 'Sport', defaultValue: 'General' },
        { field: 'brand', name: 'Brand', defaultValue: 'Unbranded' }
      ],
      'tools': [
        { field: 'type', name: 'Type', defaultValue: 'Hand Tool' },
        { field: 'brand', name: 'Brand', defaultValue: 'Unbranded' }
      ],
      'home & garden': [
        { field: 'type', name: 'Type', defaultValue: 'Home Decor' },
        { field: 'brand', name: 'Brand', defaultValue: 'Unbranded' }
      ],
      'collectibles': [
        { field: 'type', name: 'Type', defaultValue: 'Other' },
        { field: 'year', name: 'Year', defaultValue: '2000' }
      ]
    };
  }

  /**
   * Main validation function - validates and enhances listing data
   */
  validateAndEnhanceListing(listingData) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      missingFields: [],
      enhancements: {},
      category: null,
      detectedCategory: null,
      originalData: { ...listingData }
    };

    try {
      // Step 1: Basic listing data validation
      const basicValidation = validateListingData(listingData);
      if (!basicValidation.valid) {
        result.isValid = false;
        result.errors.push(...basicValidation.errors);
        return result;
      }

      // Step 2: Detect and validate category
      const categoryResult = this.validateCategory(listingData);
      result.category = categoryResult.resolvedCategory;
      result.detectedCategory = categoryResult.detectedCategory;
      
      if (categoryResult.warnings.length > 0) {
        result.warnings.push(...categoryResult.warnings);
      }

      // Step 3: Validate category-specific item specifics
      const specificsResult = this.validateCategorySpecifics(listingData, result.category);
      result.missingFields = specificsResult.missingFields;
      result.enhancements = specificsResult.enhancements;

      if (specificsResult.errors.length > 0) {
        result.errors.push(...specificsResult.errors);
      }

      if (specificsResult.warnings.length > 0) {
        result.warnings.push(...specificsResult.warnings);
      }

      // Step 4: Critical field validation with special furniture handling
      let criticalValidation;
      
      // Special handling for furniture with enhancements
      if (result.category === 'furniture' && 
          result.enhancements.numberOfItemsInSet && 
          result.enhancements.setIncludes) {
        
        // If we have furniture enhancements for the critical fields, mark as valid
        console.log('Furniture listing has required enhancements, marking as valid');
        criticalValidation = { isValid: true, errors: [] };
        
      } else {
        // Normal critical validation for other cases
        criticalValidation = this.validateCriticalFields(listingData, result.category, result.enhancements);
      }
      
      if (!criticalValidation.isValid) {
        result.isValid = false;
        result.errors.push(...criticalValidation.errors);
      }

      // Step 5: Generate enhanced listing data
      result.enhancedListingData = this.generateEnhancedListing(listingData, result.enhancements);

      console.log('Item specifics validation result:', {
        category: result.category,
        missingFields: result.missingFields.length,
        enhancements: Object.keys(result.enhancements).length,
        isValid: result.isValid
      });

      return result;

    } catch (error) {
      console.error('Error during item specifics validation:', error);
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
      return result;
    }
  }

  /**
   * Validate and resolve category
   */
  validateCategory(listingData) {
    const result = {
      resolvedCategory: null,
      detectedCategory: null,
      warnings: []
    };

    const providedCategory = listingData.category;
    
    // Always try to detect the category from title/description for better accuracy
    const detectionInput = `${listingData.title || ''} ${listingData.description || ''} ${providedCategory || ''}`;
    result.detectedCategory = categoryDetector.detectCategory(detectionInput);
    
    // If no category provided, use detected
    if (!providedCategory || providedCategory === 'unknown') {
      result.resolvedCategory = result.detectedCategory;
      
      if (result.detectedCategory === 'unknown') {
        result.warnings.push('Could not automatically detect category. Using generic category.');
        result.resolvedCategory = 'unknown';
      } else {
        result.warnings.push(`Auto-detected category: ${result.detectedCategory}`);
      }
    } else {
      // CRITICAL FIX: Use detected category for validation if it's more specific
      const providedNormalized = providedCategory.toLowerCase().trim();
      
      // If provided category isn't a standard category, use detected
      const standardCategories = Object.keys(this.requiredFields);
      if (!standardCategories.includes(providedNormalized) && result.detectedCategory !== 'unknown') {
        result.resolvedCategory = result.detectedCategory;
        result.warnings.push(
          `Using detected category "${result.detectedCategory}" instead of provided "${providedCategory}" for validation`
        );
      } else {
        result.resolvedCategory = providedNormalized;
        
        // Double-check if provided category makes sense
        if (result.detectedCategory !== 'unknown' && 
            result.detectedCategory !== result.resolvedCategory) {
          result.warnings.push(
            `Provided category "${providedCategory}" may not match item. ` +
            `Detected: "${result.detectedCategory}"`
          );
        }
      }
    }

    return result;
  }

  /**
   * Validate category-specific item specifics
   */
  validateCategorySpecifics(listingData, category) {
    const result = {
      missingFields: [],
      enhancements: {},
      errors: [],
      warnings: []
    };

    const requiredFields = this.requiredFields[category] || this.requiredFields['unknown'] || [];

    requiredFields.forEach(fieldConfig => {
      const fieldValue = listingData[fieldConfig.field];
      
      if (!fieldValue || fieldValue === 'Unknown' || fieldValue === '') {
        result.missingFields.push({
          field: fieldConfig.field,
          name: fieldConfig.name,
          required: true
        });
        
        // Generate enhancement with default value
        result.enhancements[fieldConfig.field] = this.generateDefaultValue(
          fieldConfig, 
          listingData, 
          category
        );
        
        result.warnings.push(
          `Missing required field "${fieldConfig.name}". Using default: "${result.enhancements[fieldConfig.field]}"`
        );
      }
    });

    // Category-specific validations
    this.validateCategorySpecificRules(listingData, category, result);

    return result;
  }

  /**
   * Category-specific validation rules
   */
  validateCategorySpecificRules(listingData, category, result) {
    switch (category) {
      case 'furniture':
        this.validateFurnitureSpecifics(listingData, result);
        break;
      case 'footwear':
        this.validateFootwearSpecifics(listingData, result);
        break;
      case 'electronics':
        this.validateElectronicsSpecifics(listingData, result);
        break;
      case 'clothing':
        this.validateClothingSpecifics(listingData, result);
        break;
    }
  }

  /**
   * Furniture-specific validation
   */
  validateFurnitureSpecifics(listingData, result) {
    // Validate Number of Items in Set
    const numberOfItems = listingData.numberOfItemsInSet;
    if (numberOfItems && !/^[1-9]\d*$/.test(numberOfItems)) {
      result.errors.push('Number of Items in Set must be a positive integer');
    }

    // Generate intelligent Set Includes if missing
    if (!listingData.setIncludes) {
      const setIncludes = this.generateSetIncludesFromDescription(listingData);
      result.enhancements.setIncludes = setIncludes;
    }

    // Check for IKEA-specific handling
    if (listingData.brand?.toLowerCase() === 'ikea' || 
        listingData.title?.toLowerCase().includes('ikea')) {
      if (!listingData.model && listingData.title?.includes('POÄNG')) {
        result.enhancements.model = 'POÄNG';
      }
    }
  }

  /**
   * Footwear-specific validation
   */
  validateFootwearSpecifics(listingData, result) {
    // Validate shoe size format
    const size = listingData.size;
    if (size && !/^(\d+(\.\d+)?|[1-9]\d*(\.\d+)?)$/.test(size)) {
      result.warnings.push('Shoe size should be numeric (e.g., 10, 10.5)');
    }

    // Validate style against common values
    const style = listingData.style;
    const validStyles = ['Athletic', 'Casual', 'Dress', 'Boots', 'Sandals', 'Other'];
    if (style && !validStyles.includes(style)) {
      result.warnings.push(`Unusual style "${style}". Common styles: ${validStyles.join(', ')}`);
    }
  }

  /**
   * Electronics-specific validation
   */
  validateElectronicsSpecifics(listingData, result) {
    // For headphones, validate type
    if (listingData.subcategory === 'headphones' || 
        listingData.title?.toLowerCase().includes('headphone')) {
      
      if (!listingData.type) {
        const type = this.detectHeadphoneType(listingData);
        result.enhancements.type = type;
      }

      // Check for connectivity hints
      if (!listingData.connectivity) {
        const connectivity = this.detectConnectivity(listingData);
        if (connectivity) {
          result.enhancements.connectivity = connectivity;
        }
      }
    }
  }

  /**
   * Clothing-specific validation
   */
  validateClothingSpecifics(listingData, result) {
    // Validate size format
    const size = listingData.size;
    const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    if (size && !validSizes.includes(size.toUpperCase()) && !/^\d+$/.test(size)) {
      result.warnings.push(`Unusual size "${size}". Common sizes: ${validSizes.join(', ')} or numeric`);
    }
  }

  /**
   * Validate critical fields that will cause eBay API failures
   */
  validateCriticalFields(listingData, category) {
    const errors = [];

    // Universal critical validations
    if (!listingData.title || listingData.title.length < 5) {
      errors.push('Title must be at least 5 characters long');
    }

    if (!listingData.description || listingData.description.length < 10) {
      errors.push('Description must be at least 10 characters long');
    }

    if (!listingData.pricing?.buyItNowPrice || listingData.pricing.buyItNowPrice <= 0) {
      errors.push('Valid Buy It Now price is required');
    }

    // Category-specific critical validations
    if (category === 'furniture') {
      // These are the fields that caused your original error
      if (!listingData.numberOfItemsInSet && !listingData.setIncludes) {
        errors.push('Furniture listings require "Number of Items in Set" and "Set Includes"');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Generate intelligent default values
   */
  generateDefaultValue(fieldConfig, listingData, category) {
    const field = fieldConfig.field;
    const defaultValue = fieldConfig.defaultValue;

    // Context-aware defaults
    switch (field) {
      case 'setIncludes':
        return this.generateSetIncludesFromDescription(listingData);
      case 'type':
        if (category === 'electronics') {
          return this.detectHeadphoneType(listingData);
        }
        return defaultValue;
      case 'style':
        if (category === 'footwear') {
          return this.detectShoeStyle(listingData);
        }
        return defaultValue;
      case 'connectivity':
        return this.detectConnectivity(listingData) || defaultValue;
      default:
        return defaultValue;
    }
  }

  /**
   * Generate Set Includes from item description
   */
  generateSetIncludesFromDescription(listingData) {
    const title = (listingData.title || '').toLowerCase();
    const description = (listingData.description || '').toLowerCase();
    const combined = `${title} ${description}`;

    if (combined.includes('chair')) return 'Chair';
    if (combined.includes('table')) return 'Table';
    if (combined.includes('desk')) return 'Desk';
    if (combined.includes('sofa') || combined.includes('couch')) return 'Sofa';
    if (combined.includes('bed')) return 'Bed';
    if (combined.includes('cabinet')) return 'Cabinet';
    if (combined.includes('shelf')) return 'Shelf';
    
    return 'Furniture Item';
  }

  /**
   * Detect headphone type from description
   */
  detectHeadphoneType(listingData) {
    const combined = `${listingData.title || ''} ${listingData.description || ''}`.toLowerCase();
    
    if (combined.includes('over-ear') || combined.includes('over ear')) return 'Over-Ear';
    if (combined.includes('on-ear') || combined.includes('on ear')) return 'On-Ear';
    if (combined.includes('in-ear') || combined.includes('earbud')) return 'In-Ear';
    
    return 'Over-Ear'; // Safe default for headphones
  }

  /**
   * Detect shoe style from description
   */
  detectShoeStyle(listingData) {
    const combined = `${listingData.title || ''} ${listingData.description || ''}`.toLowerCase();
    
    if (combined.includes('athletic') || combined.includes('running') || 
        combined.includes('training') || combined.includes('sneaker')) return 'Athletic';
    if (combined.includes('boot')) return 'Boots';
    if (combined.includes('sandal')) return 'Sandals';
    if (combined.includes('dress') || combined.includes('formal')) return 'Dress';
    
    return 'Athletic'; // Safe default
  }

  /**
   * Detect connectivity from description
   */
  detectConnectivity(listingData) {
    const combined = `${listingData.title || ''} ${listingData.description || ''}`.toLowerCase();
    
    if (combined.includes('wireless') || combined.includes('bluetooth')) return 'Wireless';
    if (combined.includes('wired') || combined.includes('cable')) return 'Wired';
    
    return null; // No clear indication
  }

  /**
   * Generate enhanced listing data with all improvements
   */
  generateEnhancedListing(originalData, enhancements) {
    return {
      ...originalData,
      ...enhancements
    };
  }

  /**
   * Get user-friendly validation summary
   */
  getValidationSummary(validationResult) {
    const summary = {
      status: validationResult.isValid ? 'valid' : 'invalid',
      category: validationResult.category,
      totalIssues: validationResult.errors.length + validationResult.warnings.length,
      criticalIssues: validationResult.errors.length,
      warnings: validationResult.warnings.length,
      enhancements: Object.keys(validationResult.enhancements).length,
      message: this.generateSummaryMessage(validationResult)
    };

    return summary;
  }

  /**
   * Generate human-readable summary message
   */
  generateSummaryMessage(result) {
    if (!result.isValid) {
      return `Listing has ${result.errors.length} critical issue(s) that must be fixed before submission.`;
    }

    if (result.warnings.length > 0) {
      return `Listing is valid but has ${result.warnings.length} warning(s). Enhanced with ${Object.keys(result.enhancements).length} automatic improvement(s).`;
    }

    return 'Listing is valid and ready for submission.';
  }

  /**
   * Validate specific eBay item specifics format
   */
  validateEbayItemSpecifics(itemSpecifics) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(itemSpecifics) && typeof itemSpecifics !== 'object') {
      errors.push('Item specifics must be an array or object');
      return { isValid: false, errors, warnings };
    }

    // If it's an object, convert to array format for validation
    let specificsArray = Array.isArray(itemSpecifics) ? 
      itemSpecifics : 
      Object.entries(itemSpecifics).map(([name, value]) => ({ name, value }));

    specificsArray.forEach((specific, index) => {
      if (!specific.name || typeof specific.name !== 'string') {
        errors.push(`Item specific ${index + 1}: name is required and must be a string`);
      }

      if (!specific.value || typeof specific.value !== 'string') {
        errors.push(`Item specific ${index + 1}: value is required and must be a string`);
      }

      // Check for common eBay restrictions
      if (specific.name && specific.name.length > 65) {
        errors.push(`Item specific "${specific.name}": name cannot exceed 65 characters`);
      }

      if (specific.value && specific.value.length > 65) {
        errors.push(`Item specific "${specific.name}": value cannot exceed 65 characters`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Quick validation for critical furniture fields (your specific issue)
   */
  validateFurnitureRequirements(listingData) {
    const issues = [];
    const fixes = {};

    // Check Number of Items in Set
    if (!listingData.numberOfItemsInSet) {
      issues.push('Missing "Number of Items in Set" - required for furniture');
      fixes.numberOfItemsInSet = '1';
    }

    // Check Set Includes
    if (!listingData.setIncludes) {
      issues.push('Missing "Set Includes" - required for furniture');
      fixes.setIncludes = this.generateSetIncludesFromDescription(listingData);
    }

    return {
      hasIssues: issues.length > 0,
      issues,
      fixes,
      isComplete: issues.length === 0
    };
  }

  /**
   * Test the validator with your specific failing case
   */
  testCantileverArmchair() {
    const testData = {
      title: 'IKEA POÄNG',
      description: 'Overall good condition with minor wear. Fabric shows some light soiling and possible minor pilling. Wood frame appears intact with good structural integrity. No visible tears or major damage.. Key features: cantilever bentwood frame, high back with integrated headrest, removable cushion covers, ergonomic curved design. Materials: bentwood birch veneer, polyester fabric upholstery',
      category: 'cantilever armchair with high back and headrest',
      brand: 'IKEA',
      model: 'POÄNG',
      condition: 'good',
      pricing: { buyItNowPrice: 39.00 },
      images: ['https://example.com/chair1.jpg', 'https://example.com/chair2.jpg']
    };

    console.log('Testing cantilever armchair validation:');
    const result = this.validateAndEnhanceListing(testData);
    
    console.log('Validation Result:', {
      isValid: result.isValid,
      detectedCategory: result.detectedCategory,
      resolvedCategory: result.category,
      missingFields: result.missingFields.map(f => f.name),
      enhancements: result.enhancements,
      errors: result.errors,
      warnings: result.warnings
    });

    return result;
  }
}

// Export singleton instance
const itemSpecificsValidator = new ItemSpecificsValidator();

module.exports = {
  ItemSpecificsValidator,
  itemSpecificsValidator
};