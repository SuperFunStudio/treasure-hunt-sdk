// config/endpoints.js
// Centralized endpoint configuration and validation

const { config } = require('./environment');

/**
 * Centralized API endpoint configuration
 */
const ENDPOINTS = {
  // Firebase Functions URLs (choose one based on your deployment)
  FUNCTIONS: {
    // Option 1: Cloud Functions (original)
    CLOUD_FUNCTIONS: 'https://us-central1-treasurehunter-sdk.cloudfunctions.net',
    
    // Option 2: Cloud Run (current/recommended)
    CLOUD_RUN: 'https://app-beprv7ll2q-uc.a.run.app',
    
    // Option 3: Local development
    LOCAL: 'http://localhost:5001/treasurehunter-sdk/us-central1'
  },
  
  // eBay OAuth endpoints (aligned with backend routes)
  EBAY: {
    AUTH_URL: '/api/ebay/auth-url',
    OAUTH_CALLBACK: '/api/ebay/oauth-callback', 
    ACCOUNT_INFO: '/api/ebay/account-info',
    CREATE_LISTING: '/api/ebay/create-listing',
    DISCONNECT: '/api/ebay/disconnect'
  },
  
  // Analysis endpoints
  ANALYSIS: {
    ANALYZE_IMAGES: '/api/analyze',
    ANALYZE_JSON: '/api/analyze-json'
  },
  
  // Health/utility endpoints
  HEALTH: {
    STATUS: '/api/status',
    TEST: '/api/test',
    HEALTH: '/health'
  }
};

/**
 * Get the current API base URL based on environment
 */
function getApiBaseUrl() {
  // Check environment-specific overrides first
  if (config.API_BASE_URL) {
    return config.API_BASE_URL;
  }
  
  // Environment-based defaults
  if (config.NODE_ENV === 'development') {
    return ENDPOINTS.FUNCTIONS.LOCAL;
  }
  
  // Default to Cloud Run for production
  return ENDPOINTS.FUNCTIONS.CLOUD_RUN;
}

/**
 * Build complete endpoint URLs
 */
function getEndpointUrls() {
  const baseUrl = getApiBaseUrl();
  
  return {
    base: baseUrl,
    ebay: {
      authUrl: `${baseUrl}${ENDPOINTS.EBAY.AUTH_URL}`,
      oauthCallback: `${baseUrl}${ENDPOINTS.EBAY.OAUTH_CALLBACK}`,
      accountInfo: `${baseUrl}${ENDPOINTS.EBAY.ACCOUNT_INFO}`,
      createListing: `${baseUrl}${ENDPOINTS.EBAY.CREATE_LISTING}`,
      disconnect: `${baseUrl}${ENDPOINTS.EBAY.DISCONNECT}`
    },
    analysis: {
      analyzeImages: `${baseUrl}${ENDPOINTS.ANALYSIS.ANALYZE_IMAGES}`,
      analyzeJson: `${baseUrl}${ENDPOINTS.ANALYSIS.ANALYZE_JSON}`
    },
    health: {
      status: `${baseUrl}${ENDPOINTS.HEALTH.STATUS}`,
      test: `${baseUrl}${ENDPOINTS.HEALTH.TEST}`,
      health: `${baseUrl}${ENDPOINTS.HEALTH.HEALTH}`
    }
  };
}

/**
 * Validate endpoint configuration
 */
async function validateEndpoints() {
  const urls = getEndpointUrls();
  const results = {
    baseUrl: urls.base,
    endpoints: {},
    errors: [],
    timestamp: new Date().toISOString()
  };
  
  // Test basic connectivity
  try {
    const response = await fetch(urls.health.health, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    results.endpoints.health = {
      status: response.status,
      ok: response.ok,
      reachable: true
    };
    
    if (response.ok) {
      const data = await response.json();
      results.endpoints.health.data = data;
    }
  } catch (error) {
    results.endpoints.health = {
      status: null,
      ok: false,
      reachable: false,
      error: error.message
    };
    results.errors.push(`Health endpoint unreachable: ${error.message}`);
  }
  
  // Test status endpoint
  try {
    const response = await fetch(urls.health.status, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    results.endpoints.status = {
      status: response.status,
      ok: response.ok,
      reachable: true
    };
  } catch (error) {
    results.endpoints.status = {
      status: null,
      ok: false,
      reachable: false,
      error: error.message
    };
    results.errors.push(`Status endpoint unreachable: ${error.message}`);
  }
  
  return results;
}

/**
 * Frontend configuration object for client-side use
 */
function getFrontendConfig() {
  const urls = getEndpointUrls();
  
  return {
    // API Configuration
    API_BASE_URL: urls.base,
    
    // eBay endpoints
    EBAY_AUTH_URL_ENDPOINT: urls.ebay.authUrl,
    EBAY_OAUTH_CALLBACK_ENDPOINT: urls.ebay.oauthCallback,
    EBAY_ACCOUNT_INFO_ENDPOINT: urls.ebay.accountInfo,
    EBAY_CREATE_LISTING_ENDPOINT: urls.ebay.createListing,
    
    // Analysis endpoints  
    ANALYZE_IMAGES_ENDPOINT: urls.analysis.analyzeImages,
    
    // Health endpoints
    HEALTH_ENDPOINT: urls.health.health,
    STATUS_ENDPOINT: urls.health.status,
    
    // Environment info
    ENVIRONMENT: config.NODE_ENV || 'production',
    EBAY_ENVIRONMENT: config.EBAY_ENVIRONMENT || 'production',
    
    // Feature flags
    FEATURES: {
      EBAY_OAUTH_ENABLED: !!(config.EBAY_CLIENT_ID && config.EBAY_CLIENT_SECRET),
      ANALYSIS_ENABLED: !!(config.CLAUDE_API_KEY || config.OPENAI_API_KEY),
      DEBUG_MODE: config.NODE_ENV === 'development'
    }
  };
}

/**
 * Generate frontend configuration script
 * Use this to inject config into HTML pages
 */
function generateFrontendConfigScript() {
  const config = getFrontendConfig();
  
  return `
    <!-- Generated Frontend Configuration -->
    <script>
      window.APP_CONFIG = ${JSON.stringify(config, null, 2)};
      console.log('App configuration loaded:', window.APP_CONFIG);
    </script>
  `;
}

/**
 * Express middleware to add endpoint info to responses
 */
function endpointInfoMiddleware(req, res, next) {
  // Add endpoint information to response headers for debugging
  const urls = getEndpointUrls();
  
  res.set('X-API-Base-URL', urls.base);
  res.set('X-Request-Endpoint', req.originalUrl || req.url);
  res.set('X-Environment', config.NODE_ENV || 'production');
  
  // Add endpoint info to locals for use in error handlers
  res.locals.endpointInfo = {
    baseUrl: urls.base,
    requestedEndpoint: req.originalUrl || req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  };
  
  next();
}

/**
 * Debug endpoint for configuration testing
 */
function createDebugEndpoint() {
  return async (req, res) => {
    try {
      const urls = getEndpointUrls();
      const validation = await validateEndpoints();
      const frontendConfig = getFrontendConfig();
      
      res.json({
        success: true,
        message: 'Endpoint configuration debug info',
        data: {
          endpoints: urls,
          validation: validation,
          frontendConfig: frontendConfig,
          environment: {
            NODE_ENV: config.NODE_ENV,
            EBAY_ENVIRONMENT: config.EBAY_ENVIRONMENT,
            hasEbayCredentials: !!(config.EBAY_CLIENT_ID && config.EBAY_CLIENT_SECRET),
            hasAICredentials: !!(config.CLAUDE_API_KEY || config.OPENAI_API_KEY)
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate debug info',
        details: error.message
      });
    }
  };
}

module.exports = {
  ENDPOINTS,
  getApiBaseUrl,
  getEndpointUrls,
  validateEndpoints,
  getFrontendConfig,
  generateFrontendConfigScript,
  endpointInfoMiddleware,
  createDebugEndpoint
};