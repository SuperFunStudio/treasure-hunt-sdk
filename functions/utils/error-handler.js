// utils/error-handler.js
// Centralized error handling utilities

const { API_RESPONSES } = require('../config/constants');
const { config } = require('../config/environment');

/**
 * Error types for classification
 */
const ERROR_TYPES = {
  VALIDATION: 'validation_error',
  AUTHENTICATION: 'authentication_error',
  AUTHORIZATION: 'authorization_error',
  NOT_FOUND: 'not_found',
  EXTERNAL_API: 'external_api_error',
  EBAY_API: 'ebay_api_error',
  FIREBASE: 'firebase_error',
  SDK: 'sdk_error',
  RATE_LIMIT: 'rate_limit_error',
  INTERNAL: 'internal_error'
};

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, type = ERROR_TYPES.INTERNAL, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_TYPES.VALIDATION, 400, details);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, ERROR_TYPES.AUTHENTICATION, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, ERROR_TYPES.AUTHORIZATION, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, ERROR_TYPES.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

class EbayApiError extends AppError {
  constructor(message, statusCode = 500, details = null) {
    super(message, ERROR_TYPES.EBAY_API, statusCode, details);
    this.name = 'EbayApiError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message, ERROR_TYPES.RATE_LIMIT, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Parse eBay API error responses
 */
function parseEbayError(response, statusCode) {
  let errorMessage = 'eBay API error occurred';
  let errorDetails = null;
  
  try {
    if (typeof response === 'string') {
      // Handle XML responses from Trading API
      if (response.includes('<Errors>')) {
        const errorMatches = [...response.matchAll(/<Errors>[\s\S]*?<\/Errors>/g)];
        const errors = errorMatches.map(match => {
          const shortMessage = match[0].match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1];
          const errorCode = match[0].match(/<ErrorCode>(\d+)<\/ErrorCode>/)?.[1];
          const severity = match[0].match(/<SeverityCode>(\w+)<\/SeverityCode>/)?.[1];
          return { shortMessage, errorCode, severity };
        });
        
        const errorMessages = errors
          .filter(e => e.severity === 'Error')
          .map(e => e.shortMessage)
          .filter(Boolean);
        
        if (errorMessages.length > 0) {
          errorMessage = errorMessages.join('; ');
          errorDetails = errors;
        }
      }
    } else if (typeof response === 'object') {
      // Handle REST API responses
      if (response.errors && Array.isArray(response.errors)) {
        errorMessage = response.errors.map(e => e.message || e.shortMessage || e.longMessage).join('; ');
        errorDetails = response.errors;
      } else if (response.error) {
        errorMessage = response.error.message || response.error;
      }
    }
  } catch (parseError) {
    console.warn('Failed to parse eBay error:', parseError.message);
  }
  
  return new EbayApiError(errorMessage, statusCode, errorDetails);
}

/**
 * Parse Firebase error responses
 */
function parseFirebaseError(error) {
  const errorCode = error.code || 'unknown';
  const errorMessage = error.message || 'Firebase operation failed';
  
  let statusCode = 500;
  let type = ERROR_TYPES.FIREBASE;
  
  switch (errorCode) {
    case 'permission-denied':
      statusCode = 403;
      type = ERROR_TYPES.AUTHORIZATION;
      break;
    case 'not-found':
      statusCode = 404;
      type = ERROR_TYPES.NOT_FOUND;
      break;
    case 'already-exists':
      statusCode = 409;
      break;
    case 'failed-precondition':
    case 'invalid-argument':
      statusCode = 400;
      type = ERROR_TYPES.VALIDATION;
      break;
    case 'unauthenticated':
      statusCode = 401;
      type = ERROR_TYPES.AUTHENTICATION;
      break;
  }
  
  return new AppError(errorMessage, type, statusCode, { firebaseCode: errorCode });
}

/**
 * Sanitize stack trace for production
 */
function sanitizeStackTrace(stack) {
  if (config.NODE_ENV === 'production') {
    return null; // Don't expose stack traces in production
  }
  
  if (!stack) return null;
  
  // Remove sensitive paths and internal Node.js frames
  return stack
    .split('\n')
    .filter(line => !line.includes('node_modules'))
    .filter(line => !line.includes('internal/'))
    .slice(0, 10) // Limit to 10 lines
    .join('\n');
}

/**
 * Log error with proper context
 */
function logError(error, context = {}) {
  const logData = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      type: error.type || ERROR_TYPES.INTERNAL,
      statusCode: error.statusCode || 500,
      stack: sanitizeStackTrace(error.stack)
    },
    context,
    environment: config.NODE_ENV
  };
  
  // Add error details if available
  if (error.details) {
    logData.error.details = error.details;
  }
  
  // Log differently based on severity
  if (error.statusCode >= 500) {
    console.error('🚨 Server Error:', JSON.stringify(logData, null, 2));
  } else if (error.statusCode >= 400) {
    console.warn('⚠️ Client Error:', JSON.stringify(logData, null, 2));
  } else {
    console.info('ℹ️ Info:', JSON.stringify(logData, null, 2));
  }
}

/**
 * Format error response for API
 */
function formatErrorResponse(error, includeDetails = false) {
  const response = {
    success: false,
    error: error.type || ERROR_TYPES.INTERNAL,
    message: error.message || 'An error occurred',
    timestamp: new Date().toISOString()
  };
  
  // Include details in development or when explicitly requested
  if ((config.NODE_ENV !== 'production' || includeDetails) && error.details) {
    response.details = error.details;
  }
  
  // Add retry information for rate limits
  if (error.retryAfter) {
    response.retryAfter = error.retryAfter;
  }
  
  return response;
}

/**
 * Express error handling middleware
 */
function errorHandler(error, req, res, next) {
  let processedError = error;
  
  // Convert common errors to AppError instances
  if (!(error instanceof AppError)) {
    if (error.name === 'ValidationError') {
      processedError = new ValidationError(error.message, error.details);
    } else if (error.code && error.code.startsWith('auth/')) {
      processedError = new AuthenticationError(error.message);
    } else if (error.code && error.code.includes('firebase')) {
      processedError = parseFirebaseError(error);
    } else if (error.message && error.message.includes('eBay')) {
      processedError = parseEbayError(error.message, error.statusCode || 500);
    } else {
      processedError = new AppError(
        error.message || 'Internal server error',
        ERROR_TYPES.INTERNAL,
        error.statusCode || 500
      );
    }
  }
  
  // Log the error
  logError(processedError, {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.userId || 'anonymous'
  });
  
  // Send error response
  const statusCode = processedError.statusCode || 500;
  const errorResponse = formatErrorResponse(processedError);
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Async handler wrapper to catch promise rejections
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle different types of common errors
 */
function handleValidationErrors(validationResult) {
  if (!validationResult.valid) {
    throw new ValidationError(
      'Validation failed',
      { 
        errors: validationResult.errors || [validationResult.error],
        results: validationResult.results 
      }
    );
  }
}

function handleNotFound(resource, identifier) {
  throw new NotFoundError(`${resource} not found${identifier ? `: ${identifier}` : ''}`);
}

function handleUnauthorized(message) {
  throw new AuthenticationError(message);
}

function handleForbidden(message) {
  throw new AuthorizationError(message);
}

/**
 * Create error response for specific scenarios
 */
function createEbayConnectionError() {
  return new ValidationError(
    'eBay account not connected',
    { 
      needsEbayConnection: true,
      action: 'Connect your eBay account to enable this feature'
    }
  );
}

function createLocationSetupError() {
  return new ValidationError(
    'No shipping locations configured',
    {
      needsLocationSetup: true,
      action: 'Add a shipping location to your account'
    }
  );
}

function createPolicySetupError() {
  return new ValidationError(
    'eBay business policies not configured',
    {
      needsPolicySetup: true,
      action: 'Set up eBay business policies for listing creation'
    }
  );
}

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  EbayApiError,
  RateLimitError,
  
  // Error types
  ERROR_TYPES,
  
  // Parsing functions
  parseEbayError,
  parseFirebaseError,
  
  // Utility functions
  logError,
  formatErrorResponse,
  sanitizeStackTrace,
  
  // Middleware
  errorHandler,
  asyncHandler,
  
  // Helper functions
  handleValidationErrors,
  handleNotFound,
  handleUnauthorized,
  handleForbidden,
  
  // Specific error creators
  createEbayConnectionError,
  createLocationSetupError,
  createPolicySetupError
};