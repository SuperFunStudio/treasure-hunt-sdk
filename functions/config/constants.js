// config/constants.js
// Application constants and configuration values

// eBay webhook configuration
const EBAY_WEBHOOK = {
  VERIFICATION_TOKEN: 'treasurehunter-sdk-1753755107391-zfgw1dyhl',
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

// ========== NEW: AFFILIATE TRACKING CONFIGURATION ==========

// eBay Partner Network configuration
const AFFILIATE_CONFIG = {
  EBAY_NETWORK_ID: 9, // eBay Partner Network ID
  TRACKING_PARAMS: {
    MKEVT: '1',           // Tracking event type
    MKCID: '1',           // Channel ID  
    MKRID_US: '711-53200-19255-0', // US marketplace rotation ID
    TOOLID: '20008'       // Tool ID for custom tracking
  },
  CUSTOM_ID_MAX_LENGTH: 256,
  TRACKING_URL_BASE: 'https://www.ebay.com/itm'
};

// Commission rate configuration by subscription tier
const COMMISSION_CONFIG = {
  RATES: {
    FREE: 0.01,           // 1% of eBay Partner Network commission
    STARTER: 0.015,       // 1.5% of eBay Partner Network commission  
    PRO: 0.02             // 2% of eBay Partner Network commission
  },
  EBAY_AVERAGE_COMMISSION: 0.03 // Estimated average eBay commission rate
};

// ========== NEW: SUBSCRIPTION TIER CONFIGURATION ==========

const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free',
    monthlyListings: 25,
    monthlyFee: 0,
    commissionRate: COMMISSION_CONFIG.RATES.FREE,
    features: [
      'basic_listings',
      'standard_support',
      'ai_pricing',
      'photo_optimization'
    ],
    limits: {
      imagesPerListing: 8,
      bulkListings: false,
      advancedAnalytics: false,
      apiAccess: false
    }
  },
  
  STARTER: {
    name: 'Starter', 
    monthlyListings: 150,
    monthlyFee: 19.99,
    commissionRate: COMMISSION_CONFIG.RATES.STARTER,
    features: [
      'unlimited_edits',
      'priority_support', 
      'advanced_analytics',
      'bulk_tools',
      'market_insights'
    ],
    limits: {
      imagesPerListing: 12,
      bulkListings: true,
      advancedAnalytics: true,
      apiAccess: false
    }
  },
  
  PRO: {
    name: 'Pro',
    monthlyListings: -1, // unlimited
    monthlyFee: 49.99,
    commissionRate: COMMISSION_CONFIG.RATES.PRO,
    features: [
      'white_label',
      'api_access',
      'dedicated_support',
      'custom_integrations',
      'advanced_automation',
      'priority_processing'
    ],
    limits: {
      imagesPerListing: 12,
      bulkListings: true,
      advancedAnalytics: true,
      apiAccess: true
    }
  }
};

// ========== NEW: QUOTA & USAGE TRACKING ==========

const USAGE_LIMITS = {
  FREE_MONTHLY_LISTINGS: 25,
  MAX_IMAGES_PER_LISTING: 12,
  MAX_LISTINGS_PER_DAY: {
    FREE: 10,
    STARTER: 50,
    PRO: -1 // unlimited
  },
  RATE_LIMITS: {
    LISTINGS_PER_HOUR: {
      FREE: 5,
      STARTER: 25,
      PRO: 100
    }
  }
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
  },
  EBAY_ITEM_ID: /^\d{12}$/,
  CUSTOM_ID: /^[a-zA-Z0-9_-]+$/
};

// ========== NEW: ERROR CODES ==========

const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Subscription errors
  INVALID_SUBSCRIPTION_TIER: 'INVALID_SUBSCRIPTION_TIER',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  
  // Stripe errors
  STRIPE_NOT_CONFIGURED: 'STRIPE_NOT_CONFIGURED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  
  // eBay errors
  EBAY_TOKEN_EXPIRED: 'EBAY_TOKEN_EXPIRED',
  EBAY_API_ERROR: 'EBAY_API_ERROR',
  CATEGORY_MAPPING_FAILED: 'CATEGORY_MAPPING_FAILED',
  LISTING_CREATION_FAILED: 'LISTING_CREATION_FAILED',
  
  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
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
  
  // New exports for affiliate tracking and subscriptions
  AFFILIATE_CONFIG,
  COMMISSION_CONFIG,
  SUBSCRIPTION_TIERS,
  USAGE_LIMITS,
  ERROR_CODES
};