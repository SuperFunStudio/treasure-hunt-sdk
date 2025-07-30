// capture-sdk/map/dropPin.js
import { db } from '../config/firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { validateCoordinates } from '../utils/locationUtils.js';

export async function dropPin(pinData) {
  const {
    location,
    item,
    userId = 'anonymous',
    expiresIn = 4 * 60 * 60 * 1000, // 4 hours default
    dispositionType = 'pickup'
  } = pinData;

  // Validate location
  if (!validateCoordinates(location.latitude, location.longitude)) {
    throw new Error('Invalid coordinates provided');
  }

  // Validate item data
  if (!item || !item.category) {
    throw new Error('Item data with category required');
  }

  try {
    // Create pin document
    const pinDoc = {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        geohash: generateGeohash(location.latitude, location.longitude)
      },
      item: {
        category: item.category,
        title: item.title || `${item.brand} ${item.model}`.trim() || 'Unknown Item',
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
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + expiresIn),
      expiresIn
    };

    // Add to Firestore
    const docRef = await addDoc(collection(db, 'pins'), pinDoc);
    
    console.log('Pin created with ID:', docRef.id);

    return {
      id: docRef.id,
      ...pinDoc,
      createdAt: new Date() // Return current date for immediate use
    };

  } catch (error) {
    console.error('Error creating pin:', error);
    throw new Error('Failed to create pin: ' + error.message);
  }
}

// Simple geohash for basic geographic queries
function generateGeohash(lat, lng, precision = 6) {
  // This is a simplified version - for production, use a proper geohash library
  const latBin = Math.floor((lat + 90) * Math.pow(2, precision / 2));
  const lngBin = Math.floor((lng + 180) * Math.pow(2, precision / 2));
  return `${latBin}_${lngBin}`;
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