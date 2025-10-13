// capture-sdk/pins/index.js (New unified SDK interface)
const apiClient = require('../api/client');

class PinSDK {
  async createPin(pinData) {
    return apiClient.post('/api/pins', pinData);
  }

  async getNearbyPins(location, options = {}) {
    const params = new URLSearchParams({
      lat: location.latitude,
      lng: location.longitude,
      radius: options.radius || 5,
      ...options
    });
    return apiClient.get(`/api/pins/nearby?${params}`);
  }

  async claimPin(pinId, claimData) {
    return apiClient.post(`/api/pins/${pinId}/claim`, claimData);
  }
}

module.exports = new PinSDK();