// functions/routes/location.js
// Location and geocoding endpoints

const express = require('express');
const router = express.Router();

/**
 * Reverse geocode coordinates to address
 */
router.get('/api/location/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude) || 
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates'
      });
    }

    // Use Nominatim (OpenStreetMap) for reverse geocoding
    const fetch = (await import('node-fetch')).default;
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'TreasureHunter/1.0'
      }
    });

    if (!response.ok) {
      throw new Error('Geocoding service error');
    }

    const data = await response.json();
    
    // Format the address
    const address = {
      formattedAddress: data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      street: data.address?.road || null,
      city: data.address?.city || data.address?.town || data.address?.village || null,
      state: data.address?.state || null,
      zipCode: data.address?.postcode || null,
      country: data.address?.country || null,
      neighborhood: data.address?.neighbourhood || data.address?.suburb || null
    };

    res.json({
      success: true,
      address: address,
      coordinates: {
        latitude: latitude,
        longitude: longitude
      }
    });

  } catch (error) {
    console.error('Reverse geocoding error:', error);
    
    // Fallback response with coordinates
    res.json({
      success: true,
      address: {
        formattedAddress: `Lat: ${req.query.lat}, Lng: ${req.query.lng}`,
        street: null,
        city: null,
        state: null,
        zipCode: null,
        country: null
      },
      coordinates: {
        latitude: parseFloat(req.query.lat),
        longitude: parseFloat(req.query.lng)
      },
      fallback: true
    });
  }
});

module.exports = { router };