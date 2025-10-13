// functions/models/PinModel.js
// Pin data model with validation and status management

const { db, admin, serverTimestamp } = require('../config/firebase');

// EXPANDED INTERNAL CATEGORIES LIST
const INTERNAL_CATEGORIES = [
  'electronics', 'furniture', 'clothing', 'tools', 'books', 'toys', 'jewelry',
  'automotive', 'sporting goods', 'home & garden', 'collectibles', 'other'
];

class PinModel {
  constructor() {
    this.collection = 'pins';
    this.GEOHASH_PRECISION = 6; // Standardized precision to match geoService
  }

  /**
   * Helper: Maps a specific category string to one of the broad INTERNAL_CATEGORIES.
   */
  static mapToInternalCategory(specificCategory) {
    if (!specificCategory) return 'other';

    const term = specificCategory.toLowerCase();

    if (INTERNAL_CATEGORIES.includes(term)) {
      return term; // Already a valid internal category
    }
    
    // --- Mapping Logic ---
    if (term.includes('headphones') || term.includes('speaker') || term.includes('console') || term.includes('tablet') || term.includes('phone') || term.includes('computer')) {
      return 'electronics';
    }
    if (term.includes('table') || term.includes('chair') || term.includes('sofa') || term.includes('desk') || term.includes('cabinet') || term.includes('armchair')) {
      return 'furniture';
    }
    if (term.includes('dress') || term.includes('shirt') || term.includes('pants') || term.includes('shoe') || term.includes('jacket')) {
      return 'clothing';
    }
    if (term.includes('wrench') || term.includes('drill') || term.includes('saw') || term.includes('hammer') || term.includes('gardening')) {
      return 'tools';
    }
    if (term.includes('car') || term.includes('truck') || term.includes('sedan') || term.includes('suv') || term.includes('motorcycle') || term.includes('vehicle')) {
      return 'automotive';
    }
    if (term.includes('plant') || term.includes('pot') || term.includes('hose') || term.includes('patio') || term.includes('rug') || term.includes('lamp')) {
      return 'home & garden';
    }
    if (term.includes('comic') || term.includes('figurine') || term.includes('card') || term.includes('vintage') || term.includes('antique')) {
      return 'collectibles';
    }

    // Default to 'other' or the broadest common term if no match is found
    return 'other'; 
  }

  /**
   * Create a new pin document
   */
  static createPinData(data) {
    const {
      location,
      item,
      userId,
      dispositionType = 'pickup',
      expiresIn = 4 * 60 * 60 * 1000, // 4 hours default
      claimRadius = 0.5, // 0.5 miles default
      price = null,
      notes = '',
      isPublic = true
    } = data;
    
    // Validate and map category early
    const specificCategory = item.analysisData?.category || item.category;
    const broadCategory = PinModel.mapToInternalCategory(specificCategory);

    // Validate required fields
    if (!location || !location.latitude || !location.longitude) {
      throw new Error('Valid location coordinates required');
    }

    if (!item || !broadCategory) { // Check against the mapped broad category
      throw new Error('Item data with category required');
    }

    if (!userId) {
      throw new Error('User ID required');
    }

    // Validate coordinates
    if (Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
      throw new Error('Invalid coordinate values');
    }

    // Calculate expiration based on item category and value
    const smartExpiresIn = PinModel.calculateSmartExpiration(item, broadCategory, expiresIn);
    const expiresAt = new Date(Date.now() + smartExpiresIn);

    return {
      // Location data with geohash for efficient queries
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        geohash: PinModel.generateGeohash(location.latitude, location.longitude, 6), // Standardized precision
        geopoint: new admin.firestore.GeoPoint(location.latitude, location.longitude),
        address: location.address || null,
        city: location.city || null,
        state: location.state || null,
        zipCode: location.zipCode || null
      },

      // Item information
      item: {
        id: item.id || null,
        category: broadCategory, // <-- Use the broad, mapped category for filtering
        title: item.title || PinModel.generateTitle(item),
        description: item.description || '',
        brand: item.brand || 'Unknown',
        model: item.model || '',
        condition: PinModel.normalizeCondition(item.condition),
        estimatedValue: item.estimatedValue || 0,
        confidence: Math.min(Math.max(item.confidence || 0, 0), 10), // 0-10 range
        imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls.slice(0, 5) : [], // Max 5 images
        analysisData: item.analysisData || null
      },

      // Pin metadata
      userId,
      dispositionType, // 'pickup', 'donation', 'sale', 'trade'
      price: dispositionType === 'sale' ? Math.max(price || 0, 0) : null,
      notes: notes.substring(0, 500), // Limit notes length
      isPublic,
      claimRadius: Math.min(Math.max(claimRadius, 0.1), 5), // 0.1 to 5 miles

      // Status tracking
      status: 'active', // active, claimed, expired, removed
      views: 0,
      interested: [], // Array of user IDs who marked interest
      claims: [], // Array of claim objects

      // Timestamps
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      expiresIn: smartExpiresIn,

      // Moderation
      reportedBy: [],
      isReported: false,
      moderationStatus: 'approved' // approved, pending, removed
    };
  }

  /**
   * Calculate smart expiration based on item characteristics
   */
  static calculateSmartExpiration(item, broadCategory, defaultExpiresIn) {
    let expiresIn = defaultExpiresIn;
    
    // Base expiration by category (in milliseconds)
    const categoryExpiration = {
      'electronics': 6 * 60 * 60 * 1000,    // 6 hours
      'furniture': 24 * 60 * 60 * 1000,     // 24 hours
      'clothing': 8 * 60 * 60 * 1000,       // 8 hours
      'tools': 12 * 60 * 60 * 1000,         // 12 hours
      'books': 4 * 60 * 60 * 1000,          // 4 hours
      'toys': 6 * 60 * 60 * 1000,           // 6 hours
      'jewelry': 8 * 60 * 60 * 1000,        // 8 hours
      'automotive': 48 * 60 * 60 * 1000,    // 48 hours
      'sporting goods': 12 * 60 * 60 * 1000, // 12 hours
      'home & garden': 18 * 60 * 60 * 1000, // 18 hours
      'collectibles': 72 * 60 * 60 * 1000,  // 72 hours
      'other': 12 * 60 * 60 * 1000
    };

    expiresIn = categoryExpiration[broadCategory] || defaultExpiresIn;

    // Extend for higher value items
    if (item.estimatedValue > 100) {
      expiresIn *= 1.5;
    } else if (item.estimatedValue > 50) {
      expiresIn *= 1.2;
    }

    // Reduce for poor condition items
    if (item.condition && item.condition.rating === 'poor') {
      expiresIn *= 0.7;
    }

    // Extend for high confidence analysis
    if (item.confidence >= 8) {
      expiresIn *= 1.1;
    }

    // Cap maximum expiration at 7 days
    const maxExpiration = 7 * 24 * 60 * 60 * 1000;
    return Math.min(expiresIn, maxExpiration);
  }

  /**
   * Generate a title from item data
   */
  static generateTitle(item) {
    const parts = [];
    
    if (item.brand && item.brand !== 'Unknown') {
      parts.push(item.brand);
    }
    
    if (item.model) {
      parts.push(item.model);
    }
    
    if (parts.length === 0) {
      parts.push(item.category.charAt(0).toUpperCase() + item.category.slice(1));
    }

    return parts.join(' ').substring(0, 100); // Limit title length
  }

  /**
   * Normalize condition data
   */
  static normalizeCondition(condition) {
    if (!condition) {
      return { rating: 'unknown', description: '', issues: [] };
    }

    if (typeof condition === 'string') {
      return { rating: condition, description: '', issues: [] };
    }

    return {
      rating: condition.rating || 'unknown',
      description: (condition.description || '').substring(0, 200),
      issues: Array.isArray(condition.issues) ? condition.issues.slice(0, 5) : [],
      usableAsIs: condition.usableAsIs || false
    };
  }

  /**
   * Generate geohash for location indexing (standardized with geoService)
   */
  static generateGeohash(lat, lng, precision = 6) {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let geohash = '';
    let isEven = true;
    let bit = 0;
    let ch = 0;

    while (geohash.length < precision) {
      if (isEven) {
        const mid = (lngRange[0] + lngRange[1]) / 2;
        if (lng >= mid) {
          ch |= (1 << (4 - bit));
          lngRange[0] = mid;
        } else {
          lngRange[1] = mid;
        }
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (lat >= mid) {
          ch |= (1 << (4 - bit));
          latRange[0] = mid;
        } else {
          lngRange[1] = mid;
        }
      }

      isEven = !isEven;
      bit++;

      if (bit === 5) {
        geohash += base32[ch];
        bit = 0;
        ch = 0;
      }
    }

    return geohash;
  }

  /**
   * Validate pin data before save
   */
  static validatePinData(pinData) {
    const errors = [];

    // Required fields validation
    if (!pinData.location || !pinData.location.geopoint) {
      errors.push('Location with geopoint required');
    }

    if (!pinData.item || !pinData.item.category) {
      errors.push('Item with category required');
    }

    if (!pinData.userId) {
      errors.push('User ID required');
    }

    // Data type validation
    if (pinData.item && typeof pinData.item.estimatedValue !== 'number') {
      errors.push('Item estimated value must be a number');
    }

    if (pinData.claimRadius && (typeof pinData.claimRadius !== 'number' || pinData.claimRadius <= 0)) {
      errors.push('Claim radius must be a positive number');
    }

    // Business logic validation
    if (pinData.expiresAt && pinData.expiresAt.toDate() <= new Date()) {
      errors.push('Expiration date must be in the future');
    }

    if (pinData.dispositionType === 'sale' && (!pinData.price || pinData.price <= 0)) {
      errors.push('Sale items must have a positive price');
    }

    // Geohash validation
    if (!pinData.location.geohash || pinData.location.geohash.length !== 6) {
      errors.push('Valid geohash required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create claim object
   */
  static createClaim(claimData) {
    const {
      userId,
      type = 'interest', // interest, pickup_request, pickup_confirmed
      message = '',
      userLocation = null,
      estimatedPickupTime = null
    } = claimData;

    return {
      id: `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      message: message.substring(0, 300),
      userLocation,
      estimatedPickupTime,
      createdAt: serverTimestamp(),
      status: 'pending' // pending, accepted, rejected, completed
    };
  }

  /**
   * Update pin status based on claims
   */
  static updatePinStatus(pin) {
    const now = new Date();
    
    // Check if expired
    if (pin.expiresAt && pin.expiresAt.toDate() <= now) {
      pin.status = 'expired';
      return pin;
    }

    // Check claims
    const activeClaims = pin.claims.filter(claim => 
      claim.status === 'accepted' || claim.type === 'pickup_confirmed'
    );

    if (activeClaims.length > 0) {
      pin.status = 'claimed';
    }

    return pin;
  }
}

module.exports = PinModel;