// capture-sdk/map/dropPin.js
const { db } = require('../config/firebase-config.js');
const admin = require('firebase-admin'); // Needed for FieldValue
const validateCoordinates = require('../utils/locationUtils.js').validateCoordinates;

async function dropPin(pinData) {
  const {
    location,
    item,
    userId = 'anonymous',
    expiresIn = 4 * 60 * 60 * 1000, // 4 hours default
    dispositionType = 'pickup'
  } = pinData;

  if (!validateCoordinates(location.latitude, location.longitude)) {
    throw new Error('Invalid coordinates provided');
  }

  if (!item || !item.category) {
    throw new Error('Item data with category required');
  }

  try {
    const pinDoc = {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        geohash: generateGeohash(location.latitude, location.longitude)
      },
      item: {
        category: item.category,
        title: item.title || `${item.brand || ''} ${item.model || ''}`.trim() || 'Unknown Item',
        description: item.description || '',
        imageUrls: item.imageUrls || [],
        condition: item.condition || {},
        confidence: item.confidence || 0
      },
      userId,
      dispositionType,
      status: 'active',
      viewCount: 0,
      claimCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + expiresIn),
      expiresIn
    };

    const docRef = await db.collection('pins').add(pinDoc);

    console.log('Pin created with ID:', docRef.id);

    return {
      id: docRef.id,
      ...pinDoc,
      createdAt: new Date() // This will be replaced by the true server timestamp in Firestore
    };

  } catch (error) {
    console.error('Error creating pin:', error);
    throw new Error('Failed to create pin: ' + error.message);
  }
}

// Simple geohash for basic geographic queries
function generateGeohash(lat, lng, precision = 6) {
  const latBin = Math.floor((lat + 90) * Math.pow(2, precision / 2));
  const lngBin = Math.floor((lng + 180) * Math.pow(2, precision / 2));
  return `${latBin}_${lngBin}`;
}

module.exports = { dropPin };
