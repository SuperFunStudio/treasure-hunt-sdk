  // utils/cors.js
  // CORS configuration and middleware

  const cors = require('cors');
  const { config } = require('../config/environment');

  /**
   * Environment-specific allowed origins
   */
  function getAllowedOrigins() {
    const baseOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:8080',
      'https://localhost:3000',
      'https://localhost:3001',
      'https://localhost:5173',
      'https://localhost:8080'
    ];

    // Add production origins
    const productionOrigins = [
      'https://treasurehunt.app',
      'https://www.treasurehunt.app',
      'https://app.treasurehunt.com',
      'https://treasurehunt-sdk.web.app',
      'https://treasurehunt-sdk.firebaseapp.com'
    ];

    if (config.NODE_ENV === 'production') {
      return [...productionOrigins];
    }

    // Development - allow both local and production for testing
    return [...baseOrigins, ...productionOrigins];
  }

  /**
   * Standard CORS configuration
   */
  const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = getAllowedOrigins();
      
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-HTTP-Method-Override',
      'Accept',
      'Cache-Control',
      'X-EBAY-API-CALL-NAME',
      'X-EBAY-API-COMPATIBILITY-LEVEL',
      'X-EBAY-API-SITEID'
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Total-Count',
      'X-Page-Count'
    ],
    optionsSuccessStatus: 200, // For legacy browser support
    maxAge: 86400 // Cache preflight requests for 24 hours
  };

  /**
   * Permissive CORS for development
   */
  const developmentCorsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-HTTP-Method-Override',
      'Accept',
      'Cache-Control',
      'X-EBAY-API-CALL-NAME',
      'X-EBAY-API-COMPATIBILITY-LEVEL',
      'X-EBAY-API-SITEID'
    ],
    optionsSuccessStatus: 200
  };

  /**
   * Restrictive CORS for sensitive endpoints
   */
  const restrictiveCorsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = getAllowedOrigins().filter(origin => 
        origin.includes('treasurehunt') && origin.startsWith('https')
      );
      
      if (!origin && config.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('Restrictive CORS blocked origin:', origin);
        callback(new Error('Not allowed by restrictive CORS'), false);
      }
    },
    credentials: true,
    methods: ['POST', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization'
    ],
    optionsSuccessStatus: 200
  };

  /**
   * Public CORS for read-only endpoints
   */
  const publicCorsOptions = {
    origin: '*',
    credentials: false,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Cache-Control'
    ],
    optionsSuccessStatus: 200,
    maxAge: 3600 // Cache for 1 hour
  };

  /**
   * eBay webhook CORS (very specific)
   */
  const ebayWebhookCorsOptions = {
    origin: function (origin, callback) {
      // eBay webhooks come from specific domains
      const ebayOrigins = [
        'https://api.ebay.com',
        'https://api.sandbox.ebay.com',
        'https://developer.ebay.com'
      ];
      
      if (!origin || ebayOrigins.some(allowed => origin.includes(allowed.replace('https://', '')))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by eBay webhook CORS'), false);
      }
    },
    credentials: false,
    methods: ['POST'],
    allowedHeaders: [
      'Content-Type',
      'X-EBAY-SIGNATURE'
    ],
    optionsSuccessStatus: 200
  };

  /**
   * Get CORS middleware based on endpoint type
   */
  function getCorsMiddleware(type = 'standard') {
    const options = {
      standard: corsOptions,
      development: developmentCorsOptions,
      restrictive: restrictiveCorsOptions,
      public: publicCorsOptions,
      ebay: ebayWebhookCorsOptions
    };

    const selectedOptions = options[type] || corsOptions;
    
    // Use development settings in development mode unless restrictive is explicitly requested
    if (config.NODE_ENV === 'development' && type !== 'restrictive' && type !== 'ebay') {
      return cors(developmentCorsOptions);
    }
    
    return cors(selectedOptions);
  }

  /**
   * Manual CORS headers for specific use cases
   */
  function setCorsHeaders(res, options = {}) {
    const {
      origin = '*',
      methods = 'GET, POST, PUT, DELETE, OPTIONS',
      headers = 'Content-Type, Authorization, X-Requested-With',
      credentials = true,
      maxAge = 86400
    } = options;

    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', methods);
    res.set('Access-Control-Allow-Headers', headers);
    res.set('Access-Control-Max-Age', maxAge.toString());
    
    if (credentials) {
      res.set('Access-Control-Allow-Credentials', 'true');
    }
  }

  /**
   * Pre-flight OPTIONS handler
   */
  function handlePreflightRequest(req, res, next) {
    if (req.method === 'OPTIONS') {
      setCorsHeaders(res, {
        origin: req.headers.origin || '*',
        methods: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        headers: req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
      });
      
      return res.status(200).end();
    }
    
    next();
  }

  /**
   * Validate origin against allowed list
   */
  function isOriginAllowed(origin, allowedOrigins = null) {
    if (!origin) return true; // Allow requests without origin
    
    const allowed = allowedOrigins || getAllowedOrigins();
    return allowed.includes(origin);
  }

  /**
   * Security-enhanced CORS for authentication endpoints
   */
  function getAuthCorsMiddleware() {
    return cors({
      origin: function (origin, callback) {
        // More strict checking for auth endpoints
        const allowedOrigins = getAllowedOrigins();
        
        if (config.NODE_ENV === 'development') {
          // Allow localhost in development
          if (!origin || origin.includes('localhost') || allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
        } else {
          // Production - only allow HTTPS origins
          if (origin && origin.startsWith('https://') && allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
        }
        
        console.warn('Auth CORS blocked origin:', origin);
        callback(new Error('Not allowed by auth CORS policy'), false);
      },
      credentials: true,
      methods: ['POST', 'GET', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With'
      ],
      optionsSuccessStatus: 200,
      maxAge: 300 // Short cache for auth endpoints
    });
  }

  /**
   * CORS configuration for file uploads
   */
  function getUploadCorsMiddleware() {
    return cors({
      origin: function (origin, callback) {
        const allowedOrigins = getAllowedOrigins();
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by upload CORS'), false);
        }
      },
      credentials: true,
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Cache-Control'
      ],
      optionsSuccessStatus: 200,
      maxAge: 600 // 10 minute cache for upload preflight
    });
  }

  /**
   * Log CORS requests for debugging
   */
  function logCorsRequests(req, res, next) {
    if (config.NODE_ENV === 'development') {
      const origin = req.headers.origin;
      const method = req.method;
      
      if (origin) {
        console.log(`🌍 CORS request: ${method} from ${origin} to ${req.path}`);
      }
    }
    
    next();
  }

  module.exports = {
    // Main middleware functions
    getCorsMiddleware,
    getAuthCorsMiddleware,
    getUploadCorsMiddleware,
    
    // Options objects
    corsOptions,
    developmentCorsOptions,
    restrictiveCorsOptions,
    publicCorsOptions,
    ebayWebhookCorsOptions,
    
    // Utility functions
    setCorsHeaders,
    handlePreflightRequest,
    isOriginAllowed,
    getAllowedOrigins,
    logCorsRequests,
    
    // Default exports for quick use
    standard: cors(corsOptions),
    development: cors(developmentCorsOptions),
    restrictive: cors(restrictiveCorsOptions),
    public: cors(publicCorsOptions)
  };