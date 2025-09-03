// utils/validators.js
// Input validation utilities

const { 
  VALIDATION_PATTERNS, 
  ANALYSIS_CONFIG, 
  EBAY_LISTING,
  LOCATION_CONFIG 
} = require('../config/constants');

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required and must be a string' };
  }
  
  if (!VALIDATION_PATTERNS.EMAIL.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true };
}

/**
 * Validate phone number format
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required and must be a string' };
  }
  
  if (!VALIDATION_PATTERNS.PHONE.test(phone)) {
    return { valid: false, error: 'Invalid phone number format' };
  }
  
  return { valid: true };
}

/**
 * Validate postal code by country
 */
function validatePostalCode(postalCode, country = 'US') {
  if (!postalCode || typeof postalCode !== 'string') {
    return { valid: false, error: 'Postal code is required and must be a string' };
  }
  
  const pattern = VALIDATION_PATTERNS.POSTAL_CODE[country.toUpperCase()];
  if (!pattern) {
    return { valid: true }; // Allow unknown countries to pass
  }
  
  if (!pattern.test(postalCode)) {
    return { valid: false, error: `Invalid postal code format for ${country}` };
  }
  
  return { valid: true };
}

/**
 * Validate shipping location data
 */
function validateShippingLocation(location) {
  const errors = [];
  
  if (!location || typeof location !== 'object') {
    return { valid: false, errors: ['Location must be an object'] };
  }
  
  // Check required fields
  LOCATION_CONFIG.REQUIRED_FIELDS.forEach(field => {
    if (!location[field] || typeof location[field] !== 'string' || !location[field].trim()) {
      errors.push(`${field} is required and must be a non-empty string`);
    }
  });
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  // Validate specific fields
  const emailValidation = validateEmail(location.email || '');
  if (location.email && !emailValidation.valid) {
    errors.push(emailValidation.error);
  }
  
  const phoneValidation = validatePhoneNumber(location.phone || '');
  if (location.phone && !phoneValidation.valid) {
    errors.push(phoneValidation.error);
  }
  
  const postalValidation = validatePostalCode(location.postalCode, location.country);
  if (!postalValidation.valid) {
    errors.push(postalValidation.error);
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate eBay listing data
 */
function validateListingData(listingData) {
  const errors = [];
  
  if (!listingData || typeof listingData !== 'object') {
    return { valid: false, errors: ['Listing data must be an object'] };
  }
  
  // Title validation
  if (!listingData.title || typeof listingData.title !== 'string') {
    errors.push('Title is required and must be a string');
  } else if (listingData.title.length > EBAY_LISTING.MAX_TITLE_LENGTH) {
    errors.push(`Title must be ${EBAY_LISTING.MAX_TITLE_LENGTH} characters or less`);
  }
  
  // Description validation
  if (!listingData.description || typeof listingData.description !== 'string') {
    errors.push('Description is required and must be a string');
  }
  
  // Price validation
  if (!listingData.pricing || typeof listingData.pricing !== 'object') {
    errors.push('Pricing information is required');
  } else {
    const price = listingData.pricing.buyItNowPrice;
    if (typeof price !== 'number' || price <= 0) {
      errors.push('Buy It Now price must be a positive number');
    } else if (price > 99999) {
      errors.push('Price cannot exceed $99,999');
    }
  }
  
  // Category validation
  if (!listingData.category || typeof listingData.category !== 'string') {
    errors.push('Category is required and must be a string');
  }
  
  // Condition validation
  if (!listingData.condition) {
    errors.push('Condition is required');
  }
  
  // Images validation
  if (listingData.images) {
    if (!Array.isArray(listingData.images)) {
      errors.push('Images must be an array');
    } else if (listingData.images.length > EBAY_LISTING.MAX_PICTURES) {
      errors.push(`Cannot have more than ${EBAY_LISTING.MAX_PICTURES} images`);
    } else {
      listingData.images.forEach((img, index) => {
        if (typeof img !== 'string' || !img.trim()) {
          errors.push(`Image ${index + 1} must be a non-empty string URL`);
        }
      });
    }
  }
  
  // Quantity validation
  if (listingData.quantity !== undefined) {
    if (!Number.isInteger(listingData.quantity) || listingData.quantity < 1) {
      errors.push('Quantity must be a positive integer');
    } else if (listingData.quantity > 10000) {
      errors.push('Quantity cannot exceed 10,000');
    }
  }
  
  // Handling time validation
  if (listingData.handlingTime !== undefined) {
    if (!Number.isInteger(listingData.handlingTime) || listingData.handlingTime < 1 || listingData.handlingTime > 30) {
      errors.push('Handling time must be between 1 and 30 days');
    }
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate image upload data
 */
function validateImageUpload(files) {
  const errors = [];
  
  if (!Array.isArray(files)) {
    return { valid: false, errors: ['Files must be provided as an array'] };
  }
  
  if (files.length === 0) {
    return { valid: false, errors: ['At least one image is required'] };
  }
  
  if (files.length > ANALYSIS_CONFIG.MAX_IMAGES) {
    errors.push(`Cannot upload more than ${ANALYSIS_CONFIG.MAX_IMAGES} images`);
  }
  
  files.forEach((file, index) => {
    if (!file || !Buffer.isBuffer(file)) {
      errors.push(`Image ${index + 1} must be a valid buffer`);
      return;
    }
    
    // Check file size (50MB limit)
    if (file.length > 50 * 1024 * 1024) {
      errors.push(`Image ${index + 1} exceeds 50MB limit`);
    }
    
    // Basic file type validation (check for common image headers)
    const header = file.slice(0, 4).toString('hex');
    const isValidImage = (
      header.startsWith('ffd8') ||  // JPEG
      header.startsWith('8950') ||  // PNG
      header.startsWith('4749') ||  // GIF
      header.startsWith('5249')     // WebP
    );
    
    if (!isValidImage) {
      errors.push(`Image ${index + 1} does not appear to be a valid image format`);
    }
  });
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate eBay category ID
 */
function validateEbayCategoryId(categoryId) {
  if (!categoryId) {
    return { valid: false, error: 'Category ID is required' };
  }
  
  const id = String(categoryId);
  if (!/^\d+$/.test(id)) {
    return { valid: false, error: 'Category ID must be numeric' };
  }
  
  const numericId = parseInt(id, 10);
  if (numericId < 1 || numericId > 999999) {
    return { valid: false, error: 'Category ID must be between 1 and 999999' };
  }
  
  return { valid: true };
}

/**
 * Validate eBay condition value
 */
function validateEbayCondition(condition) {
  if (!condition) {
    return { valid: false, error: 'Condition is required' };
  }
  
  // Handle object conditions
  let conditionValue = condition;
  if (typeof condition === 'object' && condition !== null) {
    conditionValue = condition.rating || condition.condition;
  }
  
  if (!conditionValue || typeof conditionValue !== 'string') {
    return { valid: false, error: 'Condition must be a string or object with rating/condition property' };
  }
  
  const validConditions = [
    'new', 'like_new', 'like new', 'new_other', 'new other', 
    'new_with_defects', 'new with defects', 'certified_refurbished',
    'excellent_refurbished', 'very_good_refurbished', 'good_refurbished',
    'seller_refurbished', 'refurbished', 'excellent', 'used_excellent',
    'very_good', 'used_very_good', 'good', 'used_good', 'used',
    'acceptable', 'used_acceptable', 'fair', 'poor', 'for_parts',
    'for parts', 'broken', 'damaged', 'not_working', 'not working'
  ];
  
  const normalizedCondition = conditionValue.toLowerCase().trim();
  if (!validConditions.includes(normalizedCondition)) {
    return { 
      valid: false, 
      error: `Invalid condition. Must be one of: ${validConditions.slice(0, 10).join(', ')}, etc.` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate user preferences object
 */
function validateUserPreferences(preferences) {
  const errors = [];
  
  if (!preferences || typeof preferences !== 'object') {
    return { valid: false, errors: ['Preferences must be an object'] };
  }
  
  // Validate effort preference
  if (preferences.preferredEffort !== undefined) {
    const validEfforts = ['low', 'medium', 'high'];
    if (!validEfforts.includes(preferences.preferredEffort)) {
      errors.push(`preferredEffort must be one of: ${validEfforts.join(', ')}`);
    }
  }
  
  // Validate time preference
  if (preferences.preferredTimeToMoney !== undefined) {
    const validTimes = ['immediate', 'days', 'weeks', 'months'];
    if (!validTimes.includes(preferences.preferredTimeToMoney)) {
      errors.push(`preferredTimeToMoney must be one of: ${validTimes.join(', ')}`);
    }
  }
  
  // Validate minimum return
  if (preferences.minimumReturn !== undefined) {
    if (typeof preferences.minimumReturn !== 'number' || preferences.minimumReturn < 0) {
      errors.push('minimumReturn must be a non-negative number');
    }
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Sanitize string input (remove potential XSS)
 */
function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove basic HTML
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Validate and sanitize listing title
 */
function validateAndSanitizeTitle(title) {
  if (!title || typeof title !== 'string') {
    return { valid: false, error: 'Title is required and must be a string' };
  }
  
  const sanitized = sanitizeString(title, EBAY_LISTING.MAX_TITLE_LENGTH);
  
  if (sanitized.length < 5) {
    return { valid: false, error: 'Title must be at least 5 characters long' };
  }
  
  return { valid: true, sanitized };
}

/**
 * Comprehensive validation helper
 */
function validateAll(data, validations) {
  const results = {};
  const allErrors = [];
  
  for (const [field, validator] of Object.entries(validations)) {
    try {
      const result = validator(data[field]);
      results[field] = result;
      
      if (!result.valid) {
        if (result.errors) {
          allErrors.push(...result.errors.map(e => `${field}: ${e}`));
        } else if (result.error) {
          allErrors.push(`${field}: ${result.error}`);
        }
      }
    } catch (error) {
      allErrors.push(`${field}: Validation error - ${error.message}`);
      results[field] = { valid: false, error: error.message };
    }
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    results
  };
}

module.exports = {
  validateEmail,
  validatePhoneNumber,
  validatePostalCode,
  validateShippingLocation,
  validateListingData,
  validateImageUpload,
  validateEbayCategoryId,
  validateEbayCondition,
  validateUserPreferences,
  sanitizeString,
  validateAndSanitizeTitle,
  validateAll
};