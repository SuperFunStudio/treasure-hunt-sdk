// functions/routes/pins.js
// API endpoints for pin operations

const express = require('express');
const router = express.Router();
const { db, admin, serverTimestamp } = require('../config/firebase');
const pinService = require('../services/location/pinService');
const geoService = require('../services/location/geoService');
const expirationService = require('../services/location/expirationService');

/**
 * Dependencies injected from main app
 */
let verifyAuthFunction = null;

function injectDependencies(verifyAuth) {
  verifyAuthFunction = verifyAuth;
}

/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Create a new pin
 */
router.post('/api/pins', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;

    const {
      location,
      item,
      dispositionType = 'pickup',
      expiresIn,
      claimRadius = 0.5,
      price,
      notes = '',
      isPublic = true
    } = req.body;

    // Validate required fields
    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Valid location coordinates required'
      });
    }

    if (!item || !item.category) {
      return res.status(400).json({
        success: false,
        error: 'Item data with category required'
      });
    }

    // Create pin
    const pin = await pinService.createPin({
      location,
      item,
      userId,
      dispositionType,
      expiresIn,
      claimRadius,
      price,
      notes,
      isPublic
    });

    res.json({
      success: true,
      pin: pin,
      message: 'Pin created successfully'
    });

  } catch (error) {
    console.error('Create pin error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get nearby pins
 */
router.get('/api/pins/nearby', asyncHandler(async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 5,
      categories,
      minValue,
      maxValue,
      dispositionTypes,
      sortBy = 'distance',
      limit = 50,
      includeExpired = false
    } = req.query;

    // Validate coordinates
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (!geoService.validateCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates'
      });
    }

    // Parse query parameters
    const options = {
      categories: categories ? categories.split(',') : [],
      minValue: minValue ? parseFloat(minValue) : 0,
      maxValue: maxValue ? parseFloat(maxValue) : Infinity,
      dispositionTypes: dispositionTypes ? dispositionTypes.split(',') : [],
      sortBy,
      limit: parseInt(limit),
      includeExpired: includeExpired === 'true'
    };

    // Exclude current user's pins if authenticated
 options.excludeUserIds = [];

    const result = await geoService.findNearbyPins(
      { latitude, longitude },
      parseFloat(radius),
      options
    );

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Get nearby pins error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get pin by ID
 */
router.get('/api/pins/:pinId', asyncHandler(async (req, res) => {
  try {
    const { pinId } = req.params;
    
    const pin = await pinService.getPinById(pinId);
    
    if (!pin) {
      return res.status(404).json({
        success: false,
        error: 'Pin not found'
      });
    }

    // Increment view count
    pinService.incrementViews(pinId);

    res.json({
      success: true,
      pin: pin
    });

  } catch (error) {
    console.error('Get pin error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get user's pins
 */
router.get('/api/pins/user/mine', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;

    const {
      status,
      limit = 50,
      offset = 0,
      includeExpired = false
    } = req.query;

    const options = {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
      includeExpired: includeExpired === 'true'
    };

    const pins = await pinService.getPinsByUser(userId, options);

    res.json({
      success: true,
      pins: pins,
      total: pins.length
    });

  } catch (error) {
    console.error('Get user pins error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Update pin
 */
router.put('/api/pins/:pinId', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { pinId } = req.params;

    // Verify ownership
    const existingPin = await pinService.getPinById(pinId);
    if (!existingPin) {
      return res.status(404).json({
        success: false,
        error: 'Pin not found'
      });
    }

    if (existingPin.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You can only update your own pins'
      });
    }

    const allowedUpdates = ['notes', 'price', 'isPublic', 'dispositionType'];
    const updateData = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const updatedPin = await pinService.updatePin(pinId, updateData);

    res.json({
      success: true,
      pin: updatedPin,
      message: 'Pin updated successfully'
    });

  } catch (error) {
    console.error('Update pin error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Delete pin
 */
router.delete('/api/pins/:pinId', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { pinId } = req.params;

    await pinService.deletePin(pinId, userId);

    res.json({
      success: true,
      message: 'Pin deleted successfully'
    });

  } catch (error) {
    console.error('Delete pin error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Add interest to pin
 */
router.post('/api/pins/:pinId/interest', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { pinId } = req.params;

    const updatedPin = await pinService.addInterestedUser(pinId, userId);

    res.json({
      success: true,
      pin: updatedPin,
      message: 'Interest added successfully'
    });

  } catch (error) {
    console.error('Add interest error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Create claim on pin
 */
router.post('/api/pins/:pinId/claim', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { pinId } = req.params;

    const {
      type = 'interest',
      message = '',
      userLocation,
      estimatedPickupTime
    } = req.body;

    const claim = await pinService.addClaimToPin(pinId, {
      userId,
      type,
      message,
      userLocation,
      estimatedPickupTime
    });

    res.json({
      success: true,
      claim: claim,
      message: 'Claim created successfully'
    });

  } catch (error) {
    console.error('Create claim error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Update claim status (for pin owners)
 */
router.put('/api/pins/:pinId/claims/:claimId', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { pinId, claimId } = req.params;
    const { status, response } = req.body;

    // Verify pin ownership
    const pin = await pinService.getPinById(pinId);
    if (!pin) {
      return res.status(404).json({
        success: false,
        error: 'Pin not found'
      });
    }

    if (pin.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You can only manage claims on your own pins'
      });
    }

    const updatedClaim = await pinService.updateClaimStatus(pinId, claimId, status, {
      response: response
    });

    res.json({
      success: true,
      claim: updatedClaim,
      message: 'Claim status updated successfully'
    });

  } catch (error) {
    console.error('Update claim status error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Report pin
 */
router.post('/api/pins/:pinId/report', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { pinId } = req.params;
    const { reason, description } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Report reason required'
      });
    }

    await pinService.reportPin(pinId, {
      userId,
      reason,
      description
    });

    res.json({
      success: true,
      message: 'Pin reported successfully'
    });

  } catch (error) {
    console.error('Report pin error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Extend pin expiration
 */
router.post('/api/pins/:pinId/extend', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { pinId } = req.params;
    const { hours = 4 } = req.body;

    const additionalTimeMs = hours * 60 * 60 * 1000;
    
    const result = await expirationService.extendPinExpiration(pinId, additionalTimeMs, userId);

    res.json({
      success: true,
      ...result,
      message: `Pin expiration extended by ${hours} hours`
    });

  } catch (error) {
    console.error('Extend pin error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get pin statistics
 */
router.get('/api/pins/:pinId/stats', asyncHandler(async (req, res) => {
  try {
    const { pinId } = req.params;
    
    const stats = await pinService.getPinStats(pinId);

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Get pin stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get popular areas
 */
router.get('/api/pins/areas/popular', asyncHandler(async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 20,
      gridSize = 10
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (!geoService.validateCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates'
      });
    }

    const areas = await geoService.getPopularAreas(
      { latitude, longitude },
      parseFloat(radius),
      parseInt(gridSize)
    );

    res.json({
      success: true,
      areas: areas,
      total: areas.length
    });

  } catch (error) {
    console.error('Get popular areas error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Admin: Run cleanup process
 */
router.post('/api/pins/admin/cleanup', asyncHandler(async (req, res) => {
  try {
    // TODO: Add admin authentication check
    const result = await expirationService.runCleanup();

    res.json({
      success: true,
      ...result,
      message: 'Cleanup process completed'
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Admin: Get cleanup statistics
 */
router.get('/api/pins/admin/cleanup-stats', asyncHandler(async (req, res) => {
  try {
    // TODO: Add admin authentication check
    const stats = await expirationService.getCleanupStats();

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Get cleanup stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Debug: Get all pins (no geohash filtering)
 */
router.get('/api/pins/debug/all', asyncHandler(async (req, res) => {
  try {
    const {
      limit = 10
    } = req.query;

    console.log('DEBUG: Fetching all pins without geohash filtering');
    
    const snapshot = await db.collection('pins')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();

    const pins = [];
    snapshot.forEach(doc => {
      const pin = { id: doc.id, ...doc.data() };
      pins.push({
        id: pin.id,
        status: pin.status,
        geohash: pin.location?.geohash,
        coordinates: {
          lat: pin.location?.latitude,
          lng: pin.location?.longitude
        },
        category: pin.item?.category,
        createdAt: pin.createdAt?.toDate?.() || pin.createdAt,
        userId: pin.userId
      });
    });

    res.json({
      success: true,
      pins: pins,
      total: pins.length,
      debug: true
    });

  } catch (error) {
    console.error('Debug all pins error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Debug: Test geohash generation
 */
router.get('/api/pins/debug/geohash', asyncHandler(async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'lat and lng parameters required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (!geoService.validateCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates'
      });
    }

    // Generate geohashes at different precisions
    const geohashes = {};
    for (let precision = 3; precision <= 8; precision++) {
      geohashes[`precision_${precision}`] = geoService.generateGeohash(latitude, longitude, precision);
    }

    // Get neighbors for precision 6
    const precision6Hash = geohashes.precision_6;
    const neighbors = geoService.getNeighbors(precision6Hash);

    res.json({
      success: true,
      coordinates: { latitude, longitude },
      geohashes,
      neighbors: {
        center: precision6Hash,
        neighbors: neighbors
      },
      debug: true
    });

  } catch (error) {
    console.error('Debug geohash error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Debug: Test specific geohash query
 */
router.get('/api/pins/debug/geohash/:geohash', asyncHandler(async (req, res) => {
  try {
    const { geohash } = req.params;
    
    console.log(`DEBUG: Querying pins for geohash: ${geohash}`);

    const query = db.collection('pins')
      .where('location.geohash', '>=', geohash)
      .where('location.geohash', '<', geohash + '\uf8ff')
      .limit(50);

    const snapshot = await query.get();
    console.log(`DEBUG: Found ${snapshot.size} pins for geohash ${geohash}`);

    const pins = [];
    snapshot.forEach(doc => {
      const pin = { id: doc.id, ...doc.data() };
      pins.push({
        id: pin.id,
        geohash: pin.location?.geohash,
        coordinates: {
          lat: pin.location?.latitude,
          lng: pin.location?.longitude
        },
        status: pin.status,
        category: pin.item?.category
      });
    });

    res.json({
      success: true,
      geohash: geohash,
      pins: pins,
      total: pins.length,
      debug: true
    });

  } catch (error) {
    console.error('Debug geohash query error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Debug: Validate pin data
 */
router.get('/api/pins/debug/validate/:pinId', asyncHandler(async (req, res) => {
  try {
    const { pinId } = req.params;
    
    const doc = await db.collection('pins').doc(pinId).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Pin not found'
      });
    }

    const pin = { id: doc.id, ...doc.data() };
    
    // Check geohash consistency
    const storedGeohash = pin.location?.geohash;
    const recalculatedGeohash = geoService.generateGeohash(
      pin.location?.latitude, 
      pin.location?.longitude, 
      6
    );

    const isGeohashConsistent = storedGeohash === recalculatedGeohash;

    res.json({
      success: true,
      pin: {
        id: pin.id,
        status: pin.status,
        location: pin.location,
        item: pin.item,
        createdAt: pin.createdAt?.toDate?.() || pin.createdAt,
        expiresAt: pin.expiresAt?.toDate?.() || pin.expiresAt
      },
      validation: {
        geohashConsistent: isGeohashConsistent,
        storedGeohash,
        recalculatedGeohash,
        hasRequiredFields: !!(pin.location?.latitude && pin.location?.longitude && pin.item?.category),
        isActive: pin.status === 'active',
        isExpired: pin.expiresAt && pin.expiresAt.toDate() < new Date()
      },
      debug: true
    });

  } catch (error) {
    console.error('Debug validate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Search pins by polygon
 */
router.post('/api/pins/search/polygon', asyncHandler(async (req, res) => {
  try {
    const { polygon, ...options } = req.body;

    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Valid polygon with at least 3 points required'
      });
    }

    // Validate polygon points
    for (const point of polygon) {
      if (!geoService.validateCoordinates(point.latitude, point.longitude)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates in polygon'
        });
      }
    }

    const result = await geoService.findPinsInPolygon(polygon, options);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Polygon search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

module.exports = { router, injectDependencies };