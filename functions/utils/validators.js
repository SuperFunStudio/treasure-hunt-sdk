// utils/validators.js
// Basic listing data validation utilities

/**
 * Validate basic listing data structure and required fields
 */
function validateListingData(listingData) {
  const result = {
    valid: true,
    errors: [],
    warnings: []
  };

  if (!listingData || typeof listingData !== 'object') {
    result.valid = false;
    result.errors.push('Listing data must be an object');
    return result;
  }

  // Validate title
  if (!listingData.title || typeof listingData.title !== 'string') {
    result.valid = false;
    result.errors.push('Title is required and must be a string');
  } else if (listingData.title.length < 5) {
    result.valid = false;
    result.errors.push('Title must be at least 5 characters long');
  } else if (listingData.title.length > 80) {
    result.warnings.push('Title exceeds recommended 80 character limit for eBay');
  }

  // Validate description
  if (!listingData.description || typeof listingData.description !== 'string') {
    result.valid = false;
    result.errors.push('Description is required and must be a string');
  } else if (listingData.description.length < 10) {
    result.valid = false;
    result.errors.push('Description must be at least 10 characters long');
  }

  // Validate pricing
  if (!listingData.pricing || typeof listingData.pricing !== 'object') {
    result.valid = false;
    result.errors.push('Pricing information is required');
  } else {
    if (!listingData.pricing.buyItNowPrice || 
        typeof listingData.pricing.buyItNowPrice !== 'number' ||
        listingData.pricing.buyItNowPrice <= 0) {
      result.valid = false;
      result.errors.push('Valid Buy It Now price is required');
    } else if (listingData.pricing.buyItNowPrice < 0.99) {
      result.warnings.push('Price below $0.99 may not be allowed on eBay');
    } else if (listingData.pricing.buyItNowPrice > 100000) {
      result.warnings.push('Very high price - verify accuracy');
    }
  }

  // Validate condition
  if (!listingData.condition) {
    result.warnings.push('Condition not specified');
  } else {
    const validConditions = [
      'new', 'like new', 'excellent', 'very good', 'good', 
      'acceptable', 'fair', 'poor', 'for parts', 'refurbished'
    ];
    
    const conditionString = typeof listingData.condition === 'object' 
      ? (listingData.condition.rating || listingData.condition.condition)
      : listingData.condition;

    if (conditionString && 
        !validConditions.includes(conditionString.toLowerCase().trim())) {
      result.warnings.push(`Unusual condition: ${conditionString}`);
    }
  }

  // Validate category
  if (!listingData.category || listingData.category === 'unknown') {
    result.warnings.push('Category not specified or unknown');
  }

  // Validate brand
  if (!listingData.brand || listingData.brand === 'Unknown') {
    result.warnings.push('Brand not specified - may affect searchability');
  }

  // Validate images
  if (!listingData.images || !Array.isArray(listingData.images)) {
    result.warnings.push('No images provided');
  } else if (listingData.images.length === 0) {
    result.warnings.push('No images provided');
  } else if (listingData.images.length > 12) {
    result.warnings.push('More than 12 images - eBay limit is 12');
  }

  // Validate quantity
  if (listingData.quantity !== undefined) {
    if (!Number.isInteger(listingData.quantity) || listingData.quantity < 1) {
      result.valid = false;
      result.errors.push('Quantity must be a positive integer');
    } else if (listingData.quantity > 100) {
      result.warnings.push('High quantity - verify availability');
    }
  }

  // Validate handling time
  if (listingData.handlingTime !== undefined) {
    if (!Number.isInteger(listingData.handlingTime) || 
        listingData.handlingTime < 1 || 
        listingData.handlingTime > 30) {
      result.warnings.push('Handling time should be between 1-30 days');
    }
  }

  return result;
}

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 */
function validatePhone(phone) {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate URL format
 */
function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate price format and range
 */
function validatePrice(price) {
  const result = {
    valid: true,
    errors: [],
    warnings: []
  };

  if (typeof price !== 'number' || isNaN(price)) {
    result.valid = false;
    result.errors.push('Price must be a valid number');
    return result;
  }

  if (price < 0) {
    result.valid = false;
    result.errors.push('Price cannot be negative');
  } else if (price === 0) {
    result.valid = false;
    result.errors.push('Price must be greater than 0');
  } else if (price < 0.99) {
    result.warnings.push('Price below $0.99 may not be accepted by eBay');
  } else if (price > 100000) {
    result.warnings.push('Very high price - please verify accuracy');
  }

  // Check for too many decimal places
  const decimalPlaces = (price.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    result.warnings.push('Price should not have more than 2 decimal places');
  }

  return result;
}

/**
 * Validate condition string or object
 */
function validateCondition(condition) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    normalized: null
  };

  if (!condition) {
    result.warnings.push('No condition specified');
    result.normalized = 'unknown';
    return result;
  }

  let conditionString;
  if (typeof condition === 'object') {
    conditionString = condition.rating || condition.condition;
    if (!conditionString) {
      result.valid = false;
      result.errors.push('Condition object must have rating or condition field');
      return result;
    }
  } else {
    conditionString = condition;
  }

  if (typeof conditionString !== 'string') {
    result.valid = false;
    result.errors.push('Condition must be a string');
    return result;
  }

  const normalized = conditionString.toLowerCase().trim();
  result.normalized = normalized;

  const validConditions = [
    'new', 'like new', 'excellent', 'very good', 'good',
    'acceptable', 'fair', 'poor', 'for parts', 'not working',
    'refurbished', 'used'
  ];

  if (!validConditions.some(valid => normalized.includes(valid))) {
    result.warnings.push(`Unusual condition: ${conditionString}`);
  }

  return result;
}

/**
 * Validate shipping location data
 */
function validateShippingLocation(location) {
  const result = {
    valid: true,
    errors: [],
    warnings: []
  };

  if (!location || typeof location !== 'object') {
    result.valid = false;
    result.errors.push('Location must be an object');
    return result;
  }

  // Required fields
  const requiredFields = ['name', 'address', 'city', 'state', 'postalCode', 'country'];
  
  for (const field of requiredFields) {
    if (!location[field] || typeof location[field] !== 'string' || !location[field].trim()) {
      result.valid = false;
      result.errors.push(`${field} is required`);
    }
  }

  // Validate postal code format by country
  if (location.country && location.postalCode) {
    const isValidPostal = validatePostalCode(location.postalCode, location.country);
    if (!isValidPostal) {
      result.warnings.push('Postal code format may be invalid for selected country');
    }
  }

  // Validate phone if provided
  if (location.phone && !validatePhone(location.phone)) {
    result.warnings.push('Phone number format appears invalid');
  }

  return result;
}

/**
 * Validate postal code format by country
 */
function validatePostalCode(postalCode, country) {
  const patterns = {
    'US': /^\d{5}(-\d{4})?$/,
    'CA': /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/,
    'GB': /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
    'AU': /^\d{4}$/,
    'DE': /^\d{5}$/,
    'FR': /^\d{5}$/,
    'IT': /^\d{5}$/,
    'ES': /^\d{5}$/
  };

  const pattern = patterns[country.toUpperCase()];
  if (!pattern) {
    // For unknown countries, just check that it's not empty and has reasonable length
    return postalCode && postalCode.length >= 3 && postalCode.length <= 10;
  }

  return pattern.test(postalCode.trim());
}

/**
 * Sanitize string input
 */
function sanitizeString(input, maxLength = null) {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input
    .replace(/[<>]/g, '') // Remove potential HTML brackets
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
  }

  return sanitized;
}

/**
 * Validate and sanitize listing data
 */
function validateAndSanitizeListingData(listingData) {
  const sanitized = { ...listingData };
  const validation = validateListingData(listingData);

  // Sanitize text fields
  if (sanitized.title) {
    sanitized.title = sanitizeString(sanitized.title, 80);
  }

  if (sanitized.description) {
    sanitized.description = sanitizeString(sanitized.description, 5000);
  }

  if (sanitized.brand) {
    sanitized.brand = sanitizeString(sanitized.brand, 50);
  }

  if (sanitized.model) {
    sanitized.model = sanitizeString(sanitized.model, 50);
  }

  // Ensure numeric fields are properly formatted
  if (sanitized.pricing && sanitized.pricing.buyItNowPrice) {
    sanitized.pricing.buyItNowPrice = Math.round(sanitized.pricing.buyItNowPrice * 100) / 100;
  }

  if (sanitized.quantity) {
    sanitized.quantity = Math.max(1, Math.floor(sanitized.quantity));
  }

  if (sanitized.handlingTime) {
    sanitized.handlingTime = Math.max(1, Math.min(30, Math.floor(sanitized.handlingTime)));
  }

  return {
    sanitized,
    validation
  };
}

/**
 * Batch validate multiple items
 */
function batchValidateListings(listings) {
  const results = {
    valid: [],
    invalid: [],
    warnings: [],
    summary: {
      total: listings.length,
      validCount: 0,
      invalidCount: 0,
      warningCount: 0
    }
  };

  listings.forEach((listing, index) => {
    const validation = validateListingData(listing);
    
    if (validation.valid) {
      results.valid.push({ index, listing, validation });
      results.summary.validCount++;
    } else {
      results.invalid.push({ index, listing, validation });
      results.summary.invalidCount++;
    }

    if (validation.warnings.length > 0) {
      results.warnings.push({ index, listing, warnings: validation.warnings });
      results.summary.warningCount++;
    }
  });

  return results;
}

module.exports = {
  validateListingData,
  validateEmail,
  validatePhone,
  validateUrl,
  validatePrice,
  validateCondition,
  validateShippingLocation,
  validatePostalCode,
  sanitizeString,
  validateAndSanitizeListingData,
  batchValidateListings
};