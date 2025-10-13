// utils/auth.js
// Authentication utilities and middleware

const { admin } = require('../config/firebase');
const { AuthenticationError, AuthorizationError, ValidationError } = require('./error-handler');

/**
 * Extract and verify Firebase ID token from request
 */
async function verifyFirebaseToken(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    throw new AuthenticationError('Authorization header missing');
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Authorization header must start with "Bearer "');
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  if (!idToken) {
    throw new AuthenticationError('ID token missing from Authorization header');
  }
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.warn('Token verification failed:', error.message);
    
    if (error.code === 'auth/id-token-expired') {
      throw new AuthenticationError('ID token has expired');
    } else if (error.code === 'auth/id-token-revoked') {
      throw new AuthenticationError('ID token has been revoked');
    } else if (error.code === 'auth/argument-error') {
      throw new AuthenticationError('Invalid ID token format');
    }
    
    throw new AuthenticationError('Invalid or expired ID token');
  }
}

/**
 * Middleware to require authentication
 */
function requireAuth(req, res, next) {
  verifyFirebaseToken(req)
    .then(decodedToken => {
      req.user = decodedToken;
      req.userId = decodedToken.uid;
      next();
    })
    .catch(next);
}

/**
 * Middleware for optional authentication
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    req.userId = null;
    return next();
  }
  
  verifyFirebaseToken(req)
    .then(decodedToken => {
      req.user = decodedToken;
      req.userId = decodedToken.uid;
      next();
    })
    .catch(error => {
      // In optional auth, we log the error but don't block the request
      console.warn('Optional auth failed:', error.message);
      req.user = null;
      req.userId = null;
      next();
    });
}

/**
 * Check if user has specific custom claims
 */
function requireRole(roles) {
  if (!Array.isArray(roles)) {
    roles = [roles];
  }
  
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const userRoles = req.user.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      throw new AuthorizationError(`Requires one of the following roles: ${roles.join(', ')}`);
    }
    
    next();
  };
}

/**
 * Check if user has admin privileges
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  
  const isAdmin = req.user.admin === true || 
                  (req.user.roles && req.user.roles.includes('admin'));
  
  if (!isAdmin) {
    throw new AuthorizationError('Admin privileges required');
  }
  
  next();
}

/**
 * Check if user can access specific resource
 */
function requireResourceAccess(resourceField = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const requestedUserId = req.params[resourceField] || req.body[resourceField] || req.query[resourceField];
    const currentUserId = req.user.uid;
    
    // Allow access to own resources
    if (requestedUserId === currentUserId) {
      return next();
    }
    
    // Check if user has admin privileges
    const isAdmin = req.user.admin === true || 
                    (req.user.roles && req.user.roles.includes('admin'));
    
    if (isAdmin) {
      return next();
    }
    
    throw new AuthorizationError('Access denied: insufficient permissions for this resource');
  };
}

/**
 * Rate limiting based on user ID
 */
const userRateLimits = new Map();

function rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) { // 15 minutes
  return (req, res, next) => {
    const userId = req.userId || req.ip; // Use IP for anonymous requests
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!userRateLimits.has(userId)) {
      userRateLimits.set(userId, []);
    }
    
    const userRequests = userRateLimits.get(userId);
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      const RateLimitError = require('../capture-sdk/utils/error-handler').RateLimitError;
      const retryAfter = Math.ceil((recentRequests[0] - windowStart) / 1000);
      throw new RateLimitError('Rate limit exceeded', retryAfter);
    }
    
    recentRequests.push(now);
    userRateLimits.set(userId, recentRequests);
    
    // Set rate limit headers
    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', (maxRequests - recentRequests.length).toString());
    res.set('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
    
    next();
  };
}

/**
 * Extract user context from token
 */
function extractUserContext(decodedToken) {
  return {
    userId: decodedToken.uid,
    email: decodedToken.email,
    emailVerified: decodedToken.email_verified,
    name: decodedToken.name,
    picture: decodedToken.picture,
    roles: decodedToken.roles || [],
    isAdmin: decodedToken.admin === true || (decodedToken.roles && decodedToken.roles.includes('admin')),
    provider: decodedToken.firebase.sign_in_provider,
    authTime: decodedToken.auth_time,
    issuedAt: decodedToken.iat,
    expiresAt: decodedToken.exp
  };
}

/**
 * Validate session freshness for sensitive operations
 */
function requireFreshAuth(maxAgeMinutes = 5) {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const authTime = req.user.auth_time * 1000; // Convert to milliseconds
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
    
    if (now - authTime > maxAge) {
      throw new AuthenticationError('Recent authentication required for this operation');
    }
    
    next();
  };
}

/**
 * Check if user's email is verified
 */
function requireVerifiedEmail(req, res, next) {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  
  if (!req.user.email_verified) {
    throw new AuthorizationError('Email verification required');
  }
  
  next();
}

/**
 * Validate API key for service-to-service communication
 */
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    throw new AuthenticationError('API key required');
  }
  
  // In a real implementation, you'd validate against stored API keys
  // For now, we'll use a simple environment variable
  const validApiKey = process.env.INTERNAL_API_KEY;
  
  if (!validApiKey || apiKey !== validApiKey) {
    throw new AuthenticationError('Invalid API key');
  }
  
  req.isApiRequest = true;
  next();
}

/**
 * Generate session information
 */
function generateSessionInfo(req) {
  return {
    userId: req.userId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
    authenticated: !!req.user,
    roles: req.user?.roles || [],
    provider: req.user?.firebase?.sign_in_provider
  };
}

/**
 * Middleware to log authentication events
 */
function logAuthEvents(req, res, next) {
  if (req.user) {
    console.log('🔐 Authenticated request:', {
      userId: req.user.uid,
      email: req.user.email,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  
  next();
}

/**
 * Security headers middleware
 */
function addSecurityHeaders(req, res, next) {
  // Add security headers
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Only add HSTS in production with HTTPS
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}

/**
 * Check if user has eBay account connected
 */
function requireEbayConnection(req, res, next) {
  // This would typically check the user's database record
  // For now, we'll add it to the request context for routes to handle
  req.requiresEbayConnection = true;
  next();
}

module.exports = {
  // Core authentication functions
  verifyFirebaseToken,
  extractUserContext,
  generateSessionInfo,
  
  // Middleware functions
  requireAuth,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireResourceAccess,
  requireFreshAuth,
  requireVerifiedEmail,
  requireEbayConnection,
  validateApiKey,
  
  // Utility middleware
  rateLimit,
  logAuthEvents,
  addSecurityHeaders,
  
  // Convenience combinations
  authRequired: requireAuth,
  authOptional: optionalAuth,
  adminRequired: [requireAuth, requireAdmin],
  freshAuthRequired: (minutes = 5) => [requireAuth, requireFreshAuth(minutes)]
};