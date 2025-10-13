// functions/services/location/geoService.js
// Geospatial operations and geohash-based pin queries

const { db } = require('../../config/firebase');

class GeoService {
  constructor() {
    this.collection = 'pins';
    this.GEOHASH_PRECISION = 6; // Standardized precision
  }

  /**
   * Generate geohash for coordinates (standardized precision)
   */
  generateGeohash(latitude, longitude, precision = this.GEOHASH_PRECISION) {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    
    let lat = latitude;
    let lng = longitude;
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    
    let geohash = '';
    let bit = 0;
    let ch = 0;
    let even = true;
    
    while (geohash.length < precision) {
      if (even) {
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
          latRange[1] = mid;
        }
      }
      
      even = !even;
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
   * Get bounding box for a geohash
   */
  geohashBounds(geohash) {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let even = true;
    
    for (let i = 0; i < geohash.length; i++) {
      const char = geohash[i];
      const charIndex = base32.indexOf(char);
      
      for (let bit = 4; bit >= 0; bit--) {
        if (even) {
          const mid = (lngRange[0] + lngRange[1]) / 2;
          if (charIndex & (1 << bit)) {
            lngRange[0] = mid;
          } else {
            lngRange[1] = mid;
          }
        } else {
          const mid = (latRange[0] + latRange[1]) / 2;
          if (charIndex & (1 << bit)) {
            latRange[0] = mid;
          } else {
            latRange[1] = mid;
          }
        }
        even = !even;
      }
    }
    
    return {
      south: latRange[0],
      north: latRange[1],
      west: lngRange[0],
      east: lngRange[1]
    };
  }

  /**
   * Get neighboring geohashes for a given geohash
   */
  getNeighbors(geohash) {
    const neighbors = [];
    const precision = geohash.length;
    
    // Calculate bounds
    const bounds = this.geohashBounds(geohash);
    const latDelta = (bounds.north - bounds.south);
    const lngDelta = (bounds.east - bounds.west);
    
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    
    // Generate all 8 neighboring geohashes plus center for comprehensive coverage
    for (let latOffset = -1; latOffset <= 1; latOffset++) {
      for (let lngOffset = -1; lngOffset <= 1; lngOffset++) {
        const neighborLat = centerLat + (latOffset * latDelta);
        const neighborLng = centerLng + (lngOffset * lngDelta);
        
        // Ensure coordinates are valid
        if (neighborLat >= -90 && neighborLat <= 90 && 
            neighborLng >= -180 && neighborLng <= 180) {
          const neighborGeohash = this.generateGeohash(neighborLat, neighborLng, precision);
          if (!neighbors.includes(neighborGeohash)) {
            neighbors.push(neighborGeohash);
          }
        }
      }
    }
    
    return neighbors;
  }

  /**
   * Calculate distance between two points in miles
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(latitude, longitude) {
    return !isNaN(latitude) && !isNaN(longitude) &&
           latitude >= -90 && latitude <= 90 &&
           longitude >= -180 && longitude <= 180;
  }

  /**
   * Find nearby pins using geohash queries
   */
  async findNearbyPins(center, radiusMiles, options = {}) {
    console.log(`Finding pins within ${radiusMiles} miles of`, JSON.stringify(center));
    
    const {
      categories = [],
      minValue = 0,
      maxValue = Infinity,
      dispositionTypes = [],
      sortBy = 'distance',
      limit = 50,
      includeExpired = false,
      excludeUserIds = []
    } = options;

    try {
      // Use standardized precision
      const precision = this.GEOHASH_PRECISION;
      const centerGeohash = this.generateGeohash(center.latitude, center.longitude, precision);
      
      const pins = [];
      const seenPins = new Set();
      
      // Query center geohash and neighbors
      const geohashesToQuery = [centerGeohash, ...this.getNeighbors(centerGeohash)];
      
      console.log(`Querying ${geohashesToQuery.length} geohash regions with precision ${precision}`);
      console.log('Center geohash:', centerGeohash);
      console.log('Geohashes to query:', geohashesToQuery);
      
      for (const geohash of geohashesToQuery) {
        try {
          const queryPins = await this.queryPinsByGeohash(geohash, {
            categories,
            minValue,
            maxValue,
            dispositionTypes,
            includeExpired,
            excludeUserIds
          });
          
          console.log(`Geohash ${geohash} returned ${queryPins.length} pins`);
          
          for (const pin of queryPins) {
            if (!seenPins.has(pin.id)) {
              seenPins.add(pin.id);
              
              // Calculate actual distance
              const distance = this.calculateDistance(
                center.latitude, center.longitude,
                pin.location.latitude, pin.location.longitude
              );
              
              console.log(`Pin ${pin.id} distance: ${distance.toFixed(2)} miles`);
              
              // Filter by actual radius
              if (distance <= radiusMiles) {
                pin.distance = distance;
                pins.push(pin);
              }
            }
          }
        } catch (error) {
          console.error(`Error querying pins by geohash ${geohash}:`, error);
          // Continue with other geohashes
        }
      }
      
      console.log(`Found ${pins.length} pins within ${radiusMiles} miles`);
      
      // Sort pins
      this.sortPins(pins, sortBy, center);
      
      // Apply limit
      const limitedPins = pins.slice(0, limit);
      
      // Update view counts for returned pins (fire and forget)
      if (limitedPins.length > 0) {
        this.incrementViewCounts(limitedPins.map(pin => pin.id));
      }
      
      return {
        pins: limitedPins,
        total: pins.length,
        center: center,
        radius: radiusMiles,
        debug: {
          centerGeohash,
          geohashesToQuery,
          totalFound: pins.length
        }
      };
      
    } catch (error) {
      console.error('Error finding nearby pins:', error);
      throw error;
    }
  }

  /**
   * Query pins by geohash with filters
   */
  async queryPinsByGeohash(geohash, options = {}) {
    const {
      categories = [],
      minValue = 0,
      maxValue = Infinity,
      dispositionTypes = [],
      includeExpired = false,
      excludeUserIds = []
    } = options;

    console.log(`Querying pins for geohash: ${geohash} with options:`, options);

    let query = db.collection(this.collection)
      .where('location.geohash', '>=', geohash)
      .where('location.geohash', '<', geohash + '\uf8ff')
      .limit(100);

    const snapshot = await query.get();
    console.log(`Raw query returned ${snapshot.size} documents for geohash ${geohash}`);

    const pins = [];
    const filterStats = {
      total: snapshot.size,
      passedStatus: 0,
      passedUser: 0,
      passedCategory: 0,
      passedDisposition: 0,
      passedValue: 0,
      final: 0
    };

    snapshot.forEach(doc => {
      const pin = { id: doc.id, ...doc.data() };

      console.log(`Processing pin ${pin.id}:`, {
        status: pin.status,
        geohash: pin.location?.geohash,
        category: pin.item?.category,
        userId: pin.userId
      });

      // Apply filters with detailed tracking
      if (!includeExpired && (pin.status === 'expired' || pin.status !== 'active')) {
        console.log(`❌ Filtered out pin ${pin.id}: status=${pin.status} (need status='active')`);
        return;
      }
      filterStats.passedStatus++;

      if (excludeUserIds.length > 0 && excludeUserIds.includes(pin.userId)) {
        console.log(`❌ Filtered out pin ${pin.id}: excluded user`);
        return;
      }
      filterStats.passedUser++;

      if (categories.length > 0 && !categories.includes(pin.item?.category)) {
        console.log(`❌ Filtered out pin ${pin.id}: category='${pin.item?.category}' not in [${categories.join(', ')}]`);
        return;
      }
      filterStats.passedCategory++;

      if (dispositionTypes.length > 0 && !dispositionTypes.includes(pin.dispositionType)) {
        console.log(`❌ Filtered out pin ${pin.id}: dispositionType='${pin.dispositionType}' not in [${dispositionTypes.join(', ')}]`);
        return;
      }
      filterStats.passedDisposition++;

      if (pin.item?.estimatedValue !== undefined) {
        const value = pin.item.estimatedValue;
        if (value < minValue || value > maxValue) {
          console.log(`❌ Filtered out pin ${pin.id}: value=${value} not in range [${minValue}, ${maxValue}]`);
          return;
        }
      }
      filterStats.passedValue++;

      console.log(`✅ Pin ${pin.id} passed all filters`);
      pins.push(pin);
      filterStats.final++;
    });

    console.log(`📊 Filter stats for geohash ${geohash}:`, filterStats);
    console.log(`Returning ${pins.length} filtered pins for geohash ${geohash}`);
    return pins;
  }

  /**
   * Sort pins by specified criteria
   */
  sortPins(pins, sortBy, center) {
    switch (sortBy) {
      case 'distance':
        pins.sort((a, b) => a.distance - b.distance);
        break;
      case 'newest':
        pins.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return bTime - aTime;
        });
        break;
      case 'value':
        pins.sort((a, b) => (b.item?.estimatedValue || 0) - (a.item?.estimatedValue || 0));
        break;
      case 'interest':
        pins.sort((a, b) => (b.interested?.length || 0) - (a.interested?.length || 0));
        break;
      default:
        // Default to distance
        pins.sort((a, b) => a.distance - b.distance);
    }
  }

  /**
   * Increment view counts for pins (fire and forget)
   */
  async incrementViewCounts(pinIds) {
    try {
      if (pinIds.length === 0) return;
      
      const batch = db.batch();
      
      for (const pinId of pinIds) {
        const pinRef = db.collection(this.collection).doc(pinId);
        batch.update(pinRef, {
          views: db.admin.firestore.FieldValue.increment(1)
        });
      }
      
      await batch.commit();
      console.log(`View counts incremented for ${pinIds.length} pins`);
      
    } catch (error) {
      console.error('Error incrementing view counts:', error);
      // Don't throw error for view counting failures
    }
  }

  /**
   * Find pins within a polygon
   */
  async findPinsInPolygon(polygon, options = {}) {
    // For now, use a bounding box approach
    // In production, you might want to use more sophisticated polygon queries
    
    const bounds = this.getPolygonBounds(polygon);
    const center = {
      latitude: (bounds.north + bounds.south) / 2,
      longitude: (bounds.east + bounds.west) / 2
    };
    
    // Calculate approximate radius
    const radius = Math.max(
      this.calculateDistance(bounds.south, bounds.west, bounds.north, bounds.east) / 2,
      5 // Minimum 5 mile radius
    );
    
    const result = await this.findNearbyPins(center, radius, options);
    
    // Filter pins to only those actually within polygon
    result.pins = result.pins.filter(pin => 
      this.isPointInPolygon(pin.location, polygon)
    );
    
    return result;
  }

  /**
   * Get bounding box for polygon
   */
  getPolygonBounds(polygon) {
    let north = -90, south = 90, east = -180, west = 180;
    
    for (const point of polygon) {
      north = Math.max(north, point.latitude);
      south = Math.min(south, point.latitude);
      east = Math.max(east, point.longitude);
      west = Math.min(west, point.longitude);
    }
    
    return { north, south, east, west };
  }

  /**
   * Check if point is within polygon (ray casting algorithm)
   */
  isPointInPolygon(point, polygon) {
    let inside = false;
    const x = point.longitude;
    const y = point.latitude;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].longitude;
      const yi = polygon[i].latitude;
      const xj = polygon[j].longitude;
      const yj = polygon[j].latitude;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  /**
   * Get popular areas based on pin density
   */
  async getPopularAreas(center, radius, gridSize = 10) {
    try {
      const result = await this.findNearbyPins(center, radius, {
        limit: 1000,
        includeExpired: true
      });
      
      const grid = this.createGrid(center, radius, gridSize);
      const areas = [];
      
      for (const cell of grid) {
        const pinsInCell = result.pins.filter(pin => 
          this.isPointInBounds(pin.location, cell.bounds)
        );
        
        if (pinsInCell.length > 0) {
          areas.push({
            center: cell.center,
            bounds: cell.bounds,
            pinCount: pinsInCell.length,
            activeCount: pinsInCell.filter(pin => pin.status === 'active').length,
            categories: [...new Set(pinsInCell.map(pin => pin.item?.category).filter(Boolean))]
          });
        }
      }
      
      // Sort by pin count
      areas.sort((a, b) => b.pinCount - a.pinCount);
      
      return areas;
      
    } catch (error) {
      console.error('Error getting popular areas:', error);
      throw error;
    }
  }

  /**
   * Create grid cells for area analysis
   */
  createGrid(center, radius, gridSize) {
    const grid = [];
    const cellSize = (radius * 2) / gridSize;
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const cellCenter = {
          latitude: center.latitude + (i - gridSize/2) * (cellSize / 69), // Rough miles to degrees
          longitude: center.longitude + (j - gridSize/2) * (cellSize / 54.6) // Rough miles to degrees at 40°N
        };
        
        const halfCell = cellSize / 2;
        grid.push({
          center: cellCenter,
          bounds: {
            north: cellCenter.latitude + halfCell / 69,
            south: cellCenter.latitude - halfCell / 69,
            east: cellCenter.longitude + halfCell / 54.6,
            west: cellCenter.longitude - halfCell / 54.6
          }
        });
      }
    }
    
    return grid;
  }

  /**
   * Check if point is within bounds
   */
  isPointInBounds(point, bounds) {
    return point.latitude >= bounds.south &&
           point.latitude <= bounds.north &&
           point.longitude >= bounds.west &&
           point.longitude <= bounds.east;
  }
}

module.exports = new GeoService();