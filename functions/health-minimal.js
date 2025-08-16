// functions/health-minimal.js
// Standalone minimal health function for testing deployment

const {onRequest} = require('firebase-functions/v2/https');

/**
 * Minimal health check endpoint - no dependencies, no SDK, just a simple response
 * This should definitely deploy without issues
 */
exports.health = onRequest(
  {
    cors: true,
    invoker: 'public',
    memory: '256MiB',
    timeoutSeconds: 60,
    cpu: 1
  },
  (req, res) => {
    // Immediate response - no async, no dependencies, no complexity
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    // Simple JSON response
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Incremental Test',
      components: {
        sdk: true,
        estimatePrice: true,
        tokenUtils: true,
        express: true,
        busboy: true
      }
    });
  }
);