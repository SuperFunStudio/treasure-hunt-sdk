// config/environment.js
// Environment variables and configuration management

const dotenv = require('dotenv');

// Load environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Environment configuration
const config = {
  // Node environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // API Keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  
  // eBay Configuration
  EBAY_CLIENT_ID: process.env.EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET: process.env.EBAY_CLIENT_SECRET,
  EBAY_ENVIRONMENT: process.env.EBAY_ENVIRONMENT || 'production',
  EBAY_REDIRECT_URI: process.env.EBAY_REDIRECT_URI,
  EBAY_REDIRECT_RU_NAME: process.env.EBAY_REDIRECT_RU_NAME,
  
  // ========== NEW: Google Maps Configuration ==========
  GOOGLE_MAPS_API_KEY: process.env.GMAPS_API,

  
  // ========== NEW: eBay Partner Network Configuration ==========
  EBAY_CAMPAIGN_ID: process.env.EBAY_CAMPAIGN_ID, // Your EPN Campaign ID (10-digit number)
  EBAY_CUSTOM_ID_PREFIX: process.env.EBAY_CUSTOM_ID_PREFIX || 'thriftspot', // Prefix for tracking IDs
  
  // ========== NEW: Stripe Configuration for Subscriptions ==========
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  
  // Stripe Price IDs for subscription tiers (set these in Stripe dashboard)
  STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER, // Monthly $19.99 price ID
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO,         // Monthly $49.99 price ID
  

  // Firebase Configuration
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  
  // Future integrations
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  
  // Application settings
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || '50mb',
  DEFAULT_TIMEOUT: parseInt(process.env.DEFAULT_TIMEOUT) || 120,
  DEFAULT_MEMORY: process.env.DEFAULT_MEMORY || '1GiB',

 
  // ========== NEW: Rate Limiting & Security ==========
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // JWT Settings for additional security
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-jwt-secret-change-in-production',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
};

// Validation helper
const validateRequiredEnvVars = (requiredVars) => {
  const missing = requiredVars.filter(varName => !config[varName]);
  if (missing.length > 0) {
    console.warn('Missing required environment variables:', missing);
  }
  return missing;
};

// Environment status helper
const getEnvironmentStatus = () => {
  const status = {
    // Existing checks
    hasOpenAI: !!config.OPENAI_API_KEY,
    hasClaude: !!config.CLAUDE_API_KEY,
    hasEbayClientId: !!config.EBAY_CLIENT_ID,
    hasEbaySecret: !!config.EBAY_CLIENT_SECRET,
    ebayEnvironment: config.EBAY_ENVIRONMENT,
    nodeEnv: config.NODE_ENV,
    
    // New affiliate tracking checks
    hasEbayCampaignId: !!config.EBAY_CAMPAIGN_ID,
    affiliateTrackingEnabled: config.ENABLE_AFFILIATE_TRACKING,
    
    // Stripe/subscription checks
    hasStripeSecret: !!config.STRIPE_SECRET_KEY,
    hasStripePublishable: !!config.STRIPE_PUBLISHABLE_KEY,
    hasStripeWebhook: !!config.STRIPE_WEBHOOK_SECRET,
    subscriptionsEnabled: config.ENABLE_SUBSCRIPTIONS,
    
    // Feature status
    commissionReportingEnabled: config.ENABLE_COMMISSION_REPORTING,
    
    // Configuration completeness
    isProductionReady: !!(
      config.EBAY_CLIENT_ID && 
      config.EBAY_CLIENT_SECRET && 
      config.EBAY_CAMPAIGN_ID &&
      config.STRIPE_SECRET_KEY &&
      config.FIREBASE_PROJECT_ID
    )
  };
  
  return status;
};


// ========== NEW: Environment Validation for Affiliate Features ==========
const validateAffiliateConfig = () => {
  const errors = [];
  
  if (config.ENABLE_AFFILIATE_TRACKING && !config.EBAY_CAMPAIGN_ID) {
    errors.push('EBAY_CAMPAIGN_ID is required when affiliate tracking is enabled');
  }
  
  if (config.ENABLE_SUBSCRIPTIONS && !config.STRIPE_SECRET_KEY) {
    errors.push('STRIPE_SECRET_KEY is required when subscriptions are enabled');
  }
  
  if (config.EBAY_CAMPAIGN_ID && !/^\d{10}$/.test(config.EBAY_CAMPAIGN_ID)) {
    errors.push('EBAY_CAMPAIGN_ID must be a 10-digit number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// ========== NEW: Get Stripe Configuration ==========
const getStripeConfig = () => {
  return {
    secretKey: config.STRIPE_SECRET_KEY,
    publishableKey: config.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: config.STRIPE_WEBHOOK_SECRET,
    prices: {
      starter: config.STRIPE_PRICE_STARTER,
      pro: config.STRIPE_PRICE_PRO
    }
  };
};

// ========== NEW: Get eBay Partner Network Configuration ==========
const getEPNConfig = () => {
  return {
    campaignId: config.EBAY_CAMPAIGN_ID,
    customIdPrefix: config.EBAY_CUSTOM_ID_PREFIX,
    enabled: config.ENABLE_AFFILIATE_TRACKING,
    baseUrl: config.APP_BASE_URL
  };
};

module.exports = {
  config,
  validateRequiredEnvVars,
  getEnvironmentStatus,
  validateAffiliateConfig,
  getStripeConfig,
  getEPNConfig,
};