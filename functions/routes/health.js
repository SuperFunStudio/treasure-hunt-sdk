// routes/health.js
// Health check and diagnostic routes

const express = require('express');
const router = express.Router();

const { config, getEnvironmentStatus } = require('../config/environment');

/**
 * Get SDK instance (imported from main app)
 */
let getSDKFunction = null;
let sdkInitError = null;

// Function to inject SDK getter from main app
function injectSDKGetter(getSDKFunc, error) {
  getSDKFunction = getSDKFunc;
  sdkInitError = error;
}

/**
 * Basic health check endpoint
 */
router.get('/health', async (_req, res) => {
  let sdk = null;
  if (getSDKFunction) {
    try {
      sdk = await getSDKFunction();
    } catch (error) {
      console.warn('SDK not available in health check:', error.message);
    }
  }

  const ebayConfigured = !!(config.EBAY_CLIENT_ID && config.EBAY_CLIENT_SECRET);

  res.json({
    status: 'ok',
    service: 'Treasure Hunt SDK API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    sdk: {
      available: !!sdk,
      type: sdkInitError ? 'fallback' : 'real',
      ebayConfigured,
      error: sdkInitError
    },
    environment: getEnvironmentStatus()
  });
});

/**
 * API test endpoint
 */
router.get('/api/test', (_req, res) => {
  res.json({
    message: 'API is working',
    timestamp: new Date().toISOString(),
    ebayConfigured: !!(config.EBAY_CLIENT_ID && config.EBAY_CLIENT_SECRET),
    environment: config.NODE_ENV || 'development'
  });
});

/**
 * Detailed status endpoint
 */
router.get('/api/status', async (_req, res) => {
  const status = {
    service: 'Treasure Hunt SDK',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: getEnvironmentStatus(),
    services: {
      sdk: {
        available: !!getSDKFunction,
        error: sdkInitError
      },
      ebay: {
        configured: !!(config.EBAY_CLIENT_ID && config.EBAY_CLIENT_SECRET),
        environment: config.EBAY_ENVIRONMENT
      },
      ai: {
        openai: !!config.OPENAI_API_KEY,
        claude: !!config.CLAUDE_API_KEY
      }
    }
  };

  res.json(status);
});

module.exports = { router, injectSDKGetter };