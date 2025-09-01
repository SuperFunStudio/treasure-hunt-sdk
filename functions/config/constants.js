// config/constants.js
// Application constants and configuration values

// eBay webhook configuration
const EBAY_WEBHOOK = {
  VERIFICATION_TOKEN: '***REMOVED***',
  ENDPOINT_URL: 'https://ebaynotifications-beprv7ll2q-uc.a.run.app',
};

// Internal categories for classification
const INTERNAL_CATEGORIES = [
  'electronics', 
  'furniture', 
  'clothing', 
  'footwear', 
  'tools',
  'books', 
  'automotive', 
  'toys', 
  'sporting goods', 
  'jewelry',
  'home & garden', 
  'collectibles'
];

// Category mapping keywords for better matching
const CATEGORY_KEYWORDS = {
  'electronics': ['electronic', 'computer', 'phone', 'tablet', 'camera', 'audio', 'video', 'gadget'],
  'furniture': ['furniture', 'chair', 'table', 'desk', 'sofa', 'cabinet', 'shelf', 'storage'],
  'clothing': ['clothing', 'shirt', 'dress', 'pants', 'jacket', 'sweater', 'apparel', 'fashion'],
  'footwear': ['shoes', 'boots', 'sneakers', 'sandals', 'footwear', 'athletic shoes'],
  'tools': ['tools', 'hardware', 'wrench', 'drill', 'saw', 'equipment', 'construction'],
  'books': ['books', 'magazines', 'literature', 'textbook', 'novel', 'manual'],
  'automotive': ['automotive', 'car', 'vehicle', 'parts', 'accessories', 'motorcycle'],
  'toys': ['toys', 'games', 'dolls', 'action figures', 'puzzles', 'educational'],
  'sporting goods': ['sports', 'athletic', 'fitness', 'outdoor', 'exercise', 'recreation'],
  'jewelry': ['jewelry', 'watches', 'rings', 'necklaces', 'earrings', 'bracelets'],
  'home & garden': ['home', 'garden', 'kitchen', 'bathroom', 'decor', 'appliances', 'yard'],
  'collectibles': ['collectibles', 'antiques', 'vintage', 'memorabilia', 'coins', 'stamps']
};

// Firebase Functions configuration
const FUNCTION_CONFIG = {
  DEFAULT_OPTIONS: {
    maxInstances: 10,
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 540
  },
  
  APP_OPTIONS: {
    invoker: 'public', 
    memory: '1GiB', 
    timeoutSeconds: 120, 
    region: 'us-central1', 
    concurrency: 1
  },
  
  HEALTH_OPTIONS: {
    invoker: 'public', 
    memory: '256MiB', 
    timeoutSeconds: 60, 
    region: 'us-central1'
  }
};

// API Response formats
const API_RESPONSES = {
  SUCCESS: 'success',
  ERROR: 'error',
  VALIDATION_ERROR: 'validation_error',
  AUTHENTICATION_ERROR: 'authentication_error',
  NOT_FOUND: 'not_found',
  INTERNAL_ERROR: 'internal_error'
};

// Analysis configuration
const ANALYSIS_CONFIG = {
  MAX_IMAGES: 12,
  SUPPORTED_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],
  DEFAULT_PROVIDER: 'claude',
  FALLBACK_PROVIDER: 'openai'
};

// eBay listing configuration
const EBAY_LISTING = {
  MAX_TITLE_LENGTH: 80,
  DEFAULT_LISTING_DURATION: 'GTC',
  DEFAULT_LISTING_TYPE: 'FixedPriceItem',
  DEFAULT_QUANTITY: 1,
  DEFAULT_HANDLING_TIME: 1,
  MAX_PICTURES: 12,
  DEFAULT_SHIPPING_COST: 9.99,
  FALLBACK_CATEGORY_ID: '171485' // Generic category
};

// User location configuration
const LOCATION_CONFIG = {
  DEFAULT_COUNTRY: 'US',
  REQUIRED_FIELDS: ['name', 'address', 'city', 'state', 'postalCode', 'country'],
  MAX_LOCATIONS_PER_USER: 5
};

// Future marketplace configurations
const MARKETPLACE_CONFIG = {
  EBAY: {
    name: 'eBay',
    enabled: true,
    commission_rate: 0.10 // 10%
  },
  FACEBOOK: {
    name: 'Facebook Marketplace',
    enabled: false, // Future feature
    commission_rate: 0.05
  },
  ETSY: {
    name: 'Etsy',
    enabled: false, // Future feature
    commission_rate: 0.06
  }
};

// Validation patterns
const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]{10,}$/,
  POSTAL_CODE: {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
    UK: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/
  }
};

module.exports = {
  EBAY_WEBHOOK,
  INTERNAL_CATEGORIES,
  CATEGORY_KEYWORDS,
  FUNCTION_CONFIG,
  API_RESPONSES,
  ANALYSIS_CONFIG,
  EBAY_LISTING,
  LOCATION_CONFIG,
  MARKETPLACE_CONFIG,
  VALIDATION_PATTERNS,
};