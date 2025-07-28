
// capture-sdk/index.js
// Main SDK entry point
import { analyzeItem } from './core/analyzeItem.js';
import { routeDisposition } from './core/routeDisposition.js';
import { generateListing } from './core/generateListing.js';
import { EbayIntegration } from './integrations/ebay/index.js';
import { InstantOfferIntegration } from './integrations/instantOffer/index.js';
import { dropPin, getNearbyPins, claimPin } from './map/index.js';

export default class CaptureSDK {
  constructor(config = {}) {
    this.config = {
      visionProvider: config.visionProvider || 'gpt4v',
      apiKeys: config.apiKeys || {},
      integrations: config.integrations || {},
      database: config.database || 'firestore',
      ...config
    };

    // Initialize integrations
    this.ebay = config.integrations.ebay 
      ? new EbayIntegration(config.integrations.ebay)
      : null;
      
    this.instantOffer = config.integrations.instantOffer
      ? new InstantOfferIntegration(config.integrations.instantOffer)
      : null;
  }

  // Core analysis
  async analyzeItem(images, options = {}) {
    return await analyzeItem(images, {
      ...options,
      visionProvider: this.config.visionProvider,
      apiKey: this.config.apiKeys[this.config.visionProvider]
    });
  }

  // Get disposition routes
  async getRoutes(itemData, userPreferences = {}) {
    return await routeDisposition(itemData, userPreferences);
  }

  // Generate marketplace listing
  async generateListing(itemData, route, options = {}) {
    return generateListing(itemData, route, options);
  }

  // Create eBay listing
  async createEbayListing(listingData) {
    if (!this.ebay) {
      throw new Error('eBay integration not configured');
    }
    return await this.ebay.createListing(listingData);
  }

  // Create instant offer
  async createInstantOffer(itemData, userInfo) {
    if (!this.instantOffer) {
      throw new Error('Instant offer integration not configured');
    }
    return await this.instantOffer.createInstantOffer(itemData, userInfo);
  }

  // Location/map features
  async dropPin(pinData, options = {}) {
    return await dropPin(pinData, options);
  }

  async getNearbyPins(location, options = {}) {
    return await getNearbyPins(location, options);
  }

  async claimPin(pinId, claimData) {
    return await claimPin(pinId, claimData);
  }

  // Utility methods
  validateConfiguration() {
    const required = ['visionProvider'];
    const missing = required.filter(key => !this.config[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    if (!this.config.apiKeys[this.config.visionProvider]) {
      throw new Error(`API key required for ${this.config.visionProvider}`);
    }

    return true;
  }
}

// Export individual modules for advanced usage
export {
  analyzeItem,
  routeDisposition,
  generateListing,
  EbayIntegration,
  InstantOfferIntegration,
  dropPin,
  getNearbyPins,
  claimPin
};