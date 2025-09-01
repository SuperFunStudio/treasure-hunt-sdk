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
  
  // Firebase Configuration
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  
  // Future integrations
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  
  // Application settings
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || '50mb',
  DEFAULT_TIMEOUT: parseInt(process.env.DEFAULT_TIMEOUT) || 120,
  DEFAULT_MEMORY: process.env.DEFAULT_MEMORY || '1GiB',
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
  return {
    hasOpenAI: !!config.OPENAI_API_KEY,
    hasClaude: !!config.CLAUDE_API_KEY,
    hasEbayClientId: !!config.EBAY_CLIENT_ID,
    hasEbaySecret: !!config.EBAY_CLIENT_SECRET,
    ebayEnvironment: config.EBAY_ENVIRONMENT,
    nodeEnv: config.NODE_ENV,
  };
};

module.exports = {
  config,
  validateRequiredEnvVars,
  getEnvironmentStatus,
};