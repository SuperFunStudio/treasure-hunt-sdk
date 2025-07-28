// capture-sdk/map/dropPin.js
import { generatePinId, validateCoordinates } from '../utils/locationUtils.js';

export async function dropPin(pinData, options = {}) {
  const {
    expirationHours = 4,
    visibility = 'public',
    notifyNearby = true,
    maxClaimDistance = 0.5 // miles
  } = options;

  // Validate input
  if (!validateCoordinates(pinData.location)) {
    throw new Error('Invalid location coordinates');
  }

  if (!pinData.itemId || !pinData.itemData) {
    throw new Error('Item data is required for pin creation');
  }

  const pin = {
    id: generatePinId(),
    itemId: pinData.itemId,
    userId: pinData.userId,
    location: {
      lat: pinData.location.lat,
      lng: pinData.location.lng,
      accuracy: pinData.location.accuracy || 10, // meters
      address: await reverseGeocode(pinData.location) // Get human-readable address
    },
    itemData: {
      category: pinData.itemData.category,
      title: pinData.itemData.title || generateItemTitle(pinData.itemData),
      description: pinData.itemData.description,
      condition: pinData.itemData.condition.rating,
      imageUrl: pinData.itemData.imageUrl, // Primary image
      value: pinData.itemData.resale?.priceRange?.high || 0
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString(),
    visibility: visibility,
    status: 'active',
    claimRadius: maxClaimDistance,
    claims: [],
    views: 0,
    metadata: {
      weather: await getCurrentWeather(pinData.location), // Helps with item condition
      nearbyLandmarks: await getNearbyLandmarks(pinData.location)
    }
  };

  // Save to database (Firestore or similar)
  await savePinToDatabase(pin);

  // Notify nearby users if enabled
  if (notifyNearby) {
    await notifyNearbyUsers(pin);
  }

  // Log for analytics
  await logPinCreation(pin);

  return {
    success: true,
    pinId: pin.id,
    expiresAt: pin.expiresAt,
    shareUrl: generateShareUrl(pin.id),
    location: pin.location
  };
}

async function reverseGeocode(location) {
  // Mock implementation - would use Google Maps or similar
  return {
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    formatted: '123 Main St, San Francisco, CA 94105'
  };
}

async function getCurrentWeather(location) {
  // Mock - would use weather API
  return {
    condition: 'clear',
    temperature: 72,
    humidity: 65
  };
}

async function getNearbyLandmarks(location) {
  // Mock - would use places API
  return [
    { name: 'Starbucks', distance: 0.1, type: 'coffee' },
    { name: 'Target', distance: 0.3, type: 'retail' }
  ];
}

function generateItemTitle(itemData) {
  const parts = [];
  if (itemData.brand) parts.push(itemData.brand);
  if (itemData.model) parts.push(itemData.model);
  parts.push(itemData.category);
  return parts.join(' ').substring(0, 50);
}

async function savePinToDatabase(pin) {
  // Firestore implementation
  console.log('Saving pin to database:', pin);
  // await db.collection('pins').doc(pin.id).set(pin);
}

async function notifyNearbyUsers(pin) {
  // Find users within notification radius
  const notificationRadius = 2; // miles
  console.log(`Notifying users within ${notificationRadius} miles of pin ${pin.id}`);
  
  // Implementation would query user locations and send push notifications
}

async function logPinCreation(pin) {
  // Analytics logging
  console.log('Pin created:', {
    category: pin.itemData.category,
    value: pin.itemData.value,
    location: pin.location.city
  });
}

function generateShareUrl(pinId) {
  return `https://treasurehunt.app/pin/${pinId}`;
}