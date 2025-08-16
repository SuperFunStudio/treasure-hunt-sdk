// functions/capture-sdk/utils/locationUtils.js
function calculateDistance(lat1, lng1, lat2, lng2) {
    // Haversine formula for distance calculation
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }
  
  function toRad(deg) {
    return deg * (Math.PI / 180);
  }
  
  function validateCoordinates(location) {
    if (!location || typeof location !== 'object') {
      return false;
    }
    
    const { lat, lng } = location;
    
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return false;
    }
    
    // Valid latitude: -90 to 90
    // Valid longitude: -180 to 180
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }
  
  function generatePinId() {
    return `pin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  function getBoundingBox(center, radiusMiles) {
    // Calculate bounding box for efficient geo queries
    const lat = center.lat;
    const lng = center.lng;
    
    // Rough approximation
    const latDelta = radiusMiles / 69; // ~69 miles per degree latitude
    const lngDelta = radiusMiles / (69 * Math.cos(toRad(lat)));
    
    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta
    };
  }
  
  module.exports = { calculateDistance, validateCoordinates };