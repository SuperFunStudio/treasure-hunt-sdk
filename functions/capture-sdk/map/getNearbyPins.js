// capture-sdk/map/getNearbyPins.js
const calculateDistance = require('../utils/locationUtils.js').calculateDistance;

async function getNearbyPins(location, options = {}) {
  const {
    radius = 5, // miles
    categories = [], // Filter by categories
    minValue = 0,
    maxValue = Infinity,
    includeExpired = false,
    sortBy = 'distance', // distance, value, createdAt
    limit = 50
  } = options;

  if (!location || !location.lat || !location.lng) {
    throw new Error('Valid location coordinates required');
  }

  // Get all pins from database
  let pins = await fetchPinsFromDatabase({
    center: location,
    radius: radius
  });

  // Filter pins
  pins = pins.filter(pin => {
    // Check if expired
    if (!includeExpired && new Date(pin.expiresAt) < new Date()) {
      return false;
    }

    // Check status
    if (pin.status !== 'active') {
      return false;
    }

    // Category filter
    if (categories.length > 0 && !categories.includes(pin.itemData.category)) {
      return false;
    }

    // Value filter
    const value = pin.itemData.value || 0;
    if (value < minValue || value > maxValue) {
      return false;
    }

    return true;
  });

  // Calculate distances and add to pin data
  pins = pins.map(pin => ({
    ...pin,
    distance: calculateDistance(
      location.lat,
      location.lng,
      pin.location.lat,
      pin.location.lng
    )
  }));

  // Sort pins
  pins.sort((a, b) => {
    switch (sortBy) {
      case 'distance':
        return a.distance - b.distance;
      case 'value':
        return (b.itemData.value || 0) - (a.itemData.value || 0);
      case 'createdAt':
        return new Date(b.createdAt) - new Date(a.createdAt);
      default:
        return a.distance - b.distance;
    }
  });

  // Limit results
  pins = pins.slice(0, limit);

  // Increment view counts
  await incrementViewCounts(pins.map(p => p.id));

  return {
    pins: pins.map(formatPinForDisplay),
    total: pins.length,
    center: location,
    radius: radius
  };
}

async function fetchPinsFromDatabase(query) {
  // Mock implementation - would use geospatial query
  console.log('Fetching pins with query:', query);
  
  // In production, use Firestore GeoPoint queries or PostGIS
  return [
    {
      id: 'pin_123',
      itemId: 'item_456',
      location: {
        lat: query.center.lat + 0.01,
        lng: query.center.lng + 0.01,
        address: { formatted: '456 Oak St, San Francisco, CA' }
      },
      itemData: {
        category: 'electronics',
        title: 'Working Laptop',
        condition: 'fair',
        value: 150,
        imageUrl: 'https://example.com/image.jpg'
      },
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      userId: 'user_789',
      views: 23
    }
  ];
}

function formatPinForDisplay(pin) {
  return {
    id: pin.id,
    location: {
      lat: pin.location.lat,
      lng: pin.location.lng,
      address: pin.location.address.formatted
    },
    distance: Math.round(pin.distance * 10) / 10, // Round to 0.1 miles
    item: {
      title: pin.itemData.title,
      category: pin.itemData.category,
      condition: pin.itemData.condition,
      imageUrl: pin.itemData.imageUrl,
      estimatedValue: pin.itemData.value
    },
    timeRemaining: getTimeRemaining(pin.expiresAt),
    isClaimable: pin.distance <= (pin.claimRadius || 0.5)
  };
}

function getTimeRemaining(expiresAt) {
  const now = new Date();
  const expires = new Date(expiresAt);
  const hoursRemaining = Math.floor((expires - now) / (1000 * 60 * 60));
  
  if (hoursRemaining < 1) {
    const minutesRemaining = Math.floor((expires - now) / (1000 * 60));
    return `${minutesRemaining} minutes`;
  }
  
  return `${hoursRemaining} hours`;
}

async function incrementViewCounts(pinIds) {
  // Batch update view counts
  console.log('Incrementing view counts for pins:', pinIds);
}

module.exports = { getNearbyPins };