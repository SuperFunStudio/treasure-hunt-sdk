// public/js/pin-manager.js
// Enhanced Pin Manager with Location Fallback and Stored History

class PinManager {
  constructor() {
    this.currentUser = null;
    this.userLocation = null;
    this.lastPinLocation = null; // NEW: Stored last successful pin location
    this.pins = new Map();
    this.watchId = null;
    
    // Tuned location options for better accuracy/freshness
    this.locationOptions = {
      enableHighAccuracy: true,
      timeout: 15000, // Increased timeout for better initial fix
      maximumAge: 60000 // Max 1 minute old cached position
    };
    
    // Threshold to trigger the manual override fallback UI
    this.FALLBACK_THRESHOLD_M = 200; 
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  async initialize() {
    console.log('🗺️ Initializing Pin Manager (Enhanced)...');
    try {
      if (typeof auth === 'undefined') {
         console.warn('Firebase auth object not available. Skipping auth wait.');
      } else {
        await this.waitForAuth();
      }
      
      // NEW: Load last successful pin location from storage
      this.loadLastPinLocation();

      // Start the persistent location watch
      await this.startLocationWatch();

      console.log('✅ Pin Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Pin Manager:', error);
    }
  }
  
  // ------------------------------------
  // --- New Location History Methods ---
  // ------------------------------------

  loadLastPinLocation() {
    if (!this.currentUser) return;
    try {
      const key = `lastPinLocation_${this.currentUser.uid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        this.lastPinLocation = JSON.parse(stored);
        console.log('📍 Loaded last pin location from history:', this.lastPinLocation);
      }
    } catch (e) {
      console.warn('Could not load last pin location from storage:', e);
    }
  }

  saveLastPinLocation(location) {
    if (!this.currentUser || !location) return;
    try {
      const key = `lastPinLocation_${this.currentUser.uid}`;
      // Store only necessary, lightweight data
      const dataToStore = {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(dataToStore));
      this.lastPinLocation = dataToStore;
      console.log('📍 Saved new last pin location to history.');
    } catch (e) {
      console.warn('Could not save last pin location to storage:', e);
    }
  }

  // -----------------------------
  // --- Core Location Methods ---
  // -----------------------------
  
  waitForAuth() {
    return new Promise((resolve, reject) => {
      if (typeof auth === 'undefined') {
        reject(new Error('Firebase auth not available'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Auth timeout')), 5000);
      
      const unsubscribe = auth.onAuthStateChanged((user) => {
        clearTimeout(timeout);
        unsubscribe();
        if (user) {
          this.currentUser = user;
          console.log('👤 Pin Manager: User authenticated:', user.uid);
          resolve(user);
        } else {
          reject(new Error('User not authenticated'));
        }
      });
    });
  }

  isLocationSupported() {
    return 'geolocation' in navigator && !!navigator.geolocation;
  }

  // MODIFIED: Removed the strict 1000m filter here, now it focuses on stability
  async startLocationWatch() {
    if (!this.isLocationSupported()) {
      console.warn('⚠️ Geolocation not supported');
      return null;
    }

    return new Promise((resolve) => {
      let resolved = false;
      
      // Increased timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('⚠️ Location watch timeout');
          resolve(null);
        }
      }, 15000);

      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newAccuracy = position.coords.accuracy;

          // Accept first position immediately to get started
          if (!this.userLocation) {
            clearTimeout(timeout);

            this.userLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: new Date(position.timestamp)
            };

            console.log('📍 Initial location acquired:', {
              lat: this.userLocation.latitude.toFixed(6),
              lng: this.userLocation.longitude.toFixed(6),
              accuracy: `${this.userLocation.accuracy.toFixed(2)}m`
            });

            if (!resolved) {
              resolved = true;
              resolve(this.userLocation);
            }
            return;
          }

          // For subsequent updates, only accept improvements or small degradations
          const improvement = this.userLocation.accuracy - newAccuracy;

          if (improvement > 5 || newAccuracy < 100) {
            // This is a significant improvement or already good enough
            clearTimeout(timeout);

            this.userLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: new Date(position.timestamp)
            };

            console.log('📍 Location improved:', {
              lat: this.userLocation.latitude.toFixed(6),
              lng: this.userLocation.longitude.toFixed(6),
              accuracy: `${this.userLocation.accuracy.toFixed(2)}m`,
              improvement: `${improvement.toFixed(2)}m`
            });
          } else if (newAccuracy > this.userLocation.accuracy * 2) {
            console.log(`⚠️ Location update skipped: New accuracy ${newAccuracy.toFixed(2)}m is significantly worse than previous ${this.userLocation.accuracy.toFixed(2)}m.`);
            return;
          }

          if (!resolved) {
            resolved = true;
            resolve(this.userLocation);
          }
        },
        (error) => {
          console.warn('⚠️ Location error:', error.message);
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        },
        this.locationOptions
      );
    });
  }
  
  // ADDED: Refresh location for retry button
  async refreshLocation() {
      this.cleanupWatch();
      this.userLocation = null;
      return await this.startLocationWatch();
  }

  // MODIFIED: Prioritizes fresh, then tries one-time read, then falls back to last pinned location
  async getCurrentLocation(requestPermission = false) {
    if (!this.isLocationSupported()) {
      throw new Error('Location not supported by browser');
    }

    // 1. Return fresh cached location if available
    if (this.userLocation && this.isLocationFresh()) {
      console.log('📍 Returning fresh cached location.');
      return this.userLocation;
    }
    
    // 2. Try to get a new location once
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date(position.timestamp)
                };
                
                this.userLocation = location;
                resolve(location);
            },
            (error) => {
                // 3. If one-time read fails, fallback to last successful pin location
                if (this.lastPinLocation) {
                    console.warn('⚠️ getCurrentPosition failed. Falling back to last pinned location.');
                    // Note: Accuracy is unknown for this fallback, but it's better than nothing
                    resolve({ ...this.lastPinLocation, accuracy: 1000, isFallback: true }); 
                } else {
                    reject(new Error(error.message));
                }
            },
            this.locationOptions
        );
    });
  }

  isLocationFresh() {
    if (!this.userLocation || !this.userLocation.timestamp) return false;
    const age = Date.now() - this.userLocation.timestamp.getTime();
    return age < 60000; // 1 minute
  }
  
  // ----------------------------------------
  // --- New Manual Fallback UI/Logic ---
  // ----------------------------------------

  // NEW: Prompts user when accuracy is too low
  async promptManualOverride(location, scanData, options) {
      return new Promise((resolve) => {
        const modal = this.createFallbackModal(location);
        document.body.appendChild(modal);

        modal.querySelector('#manualBtn').onclick = () => {
          document.body.removeChild(modal);
          this.showConfirmationModal(location, scanData, true) // Pass flag to allow drag
            .then(resolve)
            .catch(resolve); // Handle cancellation
        };
        
        modal.querySelector('#useAnywayBtn').onclick = () => {
          document.body.removeChild(modal);
          resolve(location); // Use the inaccurate location anyway
        };
        
        modal.querySelector('#cancelBtn').onclick = () => {
          document.body.removeChild(modal);
          resolve(null); // Cancel pin creation
        };
      });
  }

  // NEW: Creates the low-accuracy warning modal
  createFallbackModal(location) {
      const modal = document.createElement('div');
      modal.className = 'pin-manager-modal';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7); z-index: 10001;
        display: flex; align-items: center; justify-content: center; padding: 20px;
      `;

      modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 450px; text-align: center; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
          <h3 style="margin-bottom: 15px; color: #f57c00;">⚠️ Low Location Accuracy</h3>
          <p style="color: #666; margin-bottom: 20px; font-size: 15px;">
            The current location fix is only **±${Math.round(location.accuracy)}m**. This isn't precise enough for an accurate pin drop.
          </p>
          <div style="background: #fff8e1; border: 1px solid #ffe0b2; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            **Recommended Action:** Use the map to manually place the pin.
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button id="manualBtn" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
              Move Pin Manually on Map
            </button>
            <button id="useAnywayBtn" style="padding: 12px 24px; background: #e0e0e0; color: #333; border: none; border-radius: 8px; cursor: pointer;">
              Use Location Anyway
            </button>
            <button id="cancelBtn" style="padding: 10px 20px; background: none; color: #666; border: none; cursor: pointer;">
              Cancel Pin Creation
            </button>
          </div>
        </div>
      `;
      return modal;
  }
  
  // ------------------------------------------------
  // --- Pin Creation Workflow & Utility Methods ---
  // ------------------------------------------------

  // MODIFIED: Added accuracy check and location history saving
  async createPinFromScan(scanData, locationOverride, options) {
    try {
      if (!this.currentUser) {
        throw new Error('You must be signed in to create pins');
      }

      // 1. Get location
      let location;
      if (locationOverride) {
          location = locationOverride;
      } else {
        location = await this.getCurrentLocation(true);
      }
      
      if (!location || !location.latitude || !location.longitude) {
        throw new Error('Unable to get your location');
      }
      
      // 2. NEW: Check accuracy and prompt for manual override if needed
      if (location.accuracy && location.accuracy > this.FALLBACK_THRESHOLD_M && !locationOverride) {
          console.warn(`Location accuracy (${location.accuracy.toFixed(2)}m) is below threshold. Prompting user for override.`);
          
          const manualLocation = await this.promptManualOverride(location, scanData, options);
          
          if (!manualLocation) {
              throw new Error('Pin creation cancelled by user due to low accuracy.');
          }
          location = manualLocation;
      }

      // 3. Get address
      const address = await this.reverseGeocode(location.latitude, location.longitude);
      location.address = address;

      // 4. Create the pin via API
      const pin = await this.createPin(location, scanData, options);
      
      // 5. NEW: Save location history on success
      this.saveLastPinLocation(location);

      return pin;

    } catch (error) {
      console.error('❌ Pin creation failed:', error);
      if (typeof UIHelpers !== 'undefined' && error.message !== 'Pin creation cancelled by user due to low accuracy.') {
        UIHelpers.showError('Failed to create pin: ' + error.message);
      }
      throw error;
    }
  }

  // REVERSE GEOCODE (UNMODIFIED)
  async reverseGeocode(latitude, longitude) {
    try {
      const response = await apiClient.request(
        `/api/location/reverse-geocode?lat=${latitude}&lng=${longitude}`
      );
      
      if (response.success && response.address) {
        return response.address;
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
    
    // Fallback to coordinates
    return {
      formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      street: null,
      city: null,
      state: null,
      zipCode: null,
      country: null
    };
  }

  // SHOW CONFIRMATION MODAL (MODIFIED: Added allowDrag flag for manual placement)
  showConfirmationModal(location, scanData, allowDrag = false) {
      return new Promise((resolve) => {
        const hasLeaflet = typeof L !== 'undefined';
        
        const modal = document.createElement('div');
        modal.className = 'pin-manager-modal';
        modal.style.cssText = `
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); z-index: 10001;
          display: flex; align-items: center; justify-content: center; padding: 20px;
        `;

        modal.innerHTML = `
          <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 100%;">
            <h3 style="margin-bottom: 15px;">${allowDrag ? 'Manually Place Pin' : 'Confirm Pin Location'}</h3>
            
            ${hasLeaflet ? 
              '<div id="confirmMap" style="height: 250px; border-radius: 8px; margin-bottom: 15px;"></div>' :
              `<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                 <strong>Location:</strong> ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}<br>
                 <strong>Accuracy:</strong> ${location.accuracy ? `±${Math.round(location.accuracy)}m` : 'Unknown'}
               </div>`
            }
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <strong>Address:</strong><br>
              <span id="addressDisplay">${location.address?.formattedAddress || 'Loading Address...'}</span>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button id="cancelBtn" style="padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
                Cancel
              </button>
              <button id="confirmBtn" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                Confirm Pin
              </button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);

        // Initialize map if Leaflet is available
        if (hasLeaflet) {
          try {
            const map = L.map('confirmMap').setView([location.latitude, location.longitude], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            
            const marker = L.marker([location.latitude, location.longitude], { draggable: allowDrag }).addTo(map);
            
            // Reverse geocode immediately if address wasn't pre-loaded or if dragging is allowed
            if (!location.address || allowDrag) {
                this.reverseGeocode(location.latitude, location.longitude).then(newAddress => {
                    document.getElementById('addressDisplay').textContent = newAddress.formattedAddress;
                    location.address = newAddress;
                });
            }

            if (allowDrag) {
                marker.on('dragend', async (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  document.getElementById('addressDisplay').textContent = 'Updating Address...';
                  const newAddress = await this.reverseGeocode(lat, lng);
                  
                  // Update location object for the final resolve
                  location.latitude = lat;
                  location.longitude = lng;
                  location.address = newAddress;
                  location.accuracy = 0; // Assume manual placement is 0 accuracy
                  
                  document.getElementById('addressDisplay').textContent = newAddress.formattedAddress;
                });
            }
          } catch (mapError) {
            console.warn('Map initialization failed:', mapError);
          }
        }

        // Handle buttons
        modal.querySelector('#confirmBtn').onclick = () => {
          document.body.removeChild(modal);
          resolve(location);
        };
        
        modal.querySelector('#cancelBtn').onclick = () => {
          document.body.removeChild(modal);
          resolve(null);
        };
      });
  }

  // CREATE PIN (UNMODIFIED)
  async createPin(location, scanData, options = {}) {
    
    // Defensive coding: Ensure item analysis data is available
    const analysis = scanData.analysis || {};
    const itemTitle = this.generateTitle(scanData) || 'Uncategorized Item';
    // Get description safely from multiple places, defaulting to an empty string
    const itemDescription = analysis.description || analysis.title || '';
    
    const pinData = {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address
      },
      item: {
        // FIX 1: Ensure category, title, description, and brand are always safe strings
        category: String(analysis.category || scanData.category || 'item'),
        title: String(itemTitle), 
        description: String(itemDescription), 
        brand: String(analysis.brand || 'Unknown'),
        
        condition: analysis.condition || { rating: 'good' },
        estimatedValue: this.getEstimatedValue(scanData),
        confidence: analysis.confidence || 5,
        imageUrls: scanData.imageUrls || [],
        analysisData: analysis
      },
      // Merge user-provided options for dispositionType, price, radius, etc.
      dispositionType: options.dispositionType || 'pickup',
      isPublic: options.isPublic !== undefined ? options.isPublic : true,
      claimRadius: options.claimRadius || 0.5,
      
      // FIX 2: Ensure price is null if not provided, not 0 if disposition is pickup
      price: options.price === null || options.price === undefined || options.price === 0 ? null : parseFloat(options.price), 
      
      // FIX 3: Ensure notes is always a string to prevent 'substring' errors on the server
      notes: String(options.notes || ''),
      
      expiresIn: options.expiresIn || null
    };

    const response = await apiClient.request('/api/pins', {
      method: 'POST',
      body: JSON.stringify(pinData)
    });

    if (response.success) {
      console.log('✅ Pin created:', response.pin.id);
      this.pins.set(response.pin.id, response.pin);
      
      if (typeof UIHelpers !== 'undefined') {
        UIHelpers.showSuccess(`Pin created! Your ${pinData.item.category} is now available for pickup.`);
      }
      
      return response.pin;
    } else {
      throw new Error(response.error || 'Failed to create pin');
    }
  }

  // GENERATE TITLE (UNMODIFIED)
  generateTitle(scanData) {
    const analysis = scanData.analysis || scanData;
    const parts = [];
    
    if (analysis.brand && analysis.brand !== 'Unknown') {
      parts.push(analysis.brand);
    }
    
    if (analysis.model) {
      parts.push(analysis.model);
    }
    
    if (parts.length === 0) {
      const category = analysis.category || 'Item';
      parts.push(category.charAt(0).toUpperCase() + category.slice(1));
    }
    
    // Ensure the final result is truncated but valid
    return parts.join(' ').substring(0, 100);
  }

  // GET ESTIMATED VALUE (UNMODIFIED)
  getEstimatedValue(scanData) {
    const analysis = scanData.analysis || scanData;
    
    if (analysis.marketAnalysis?.estimatedValue?.suggested) {
      return analysis.marketAnalysis.estimatedValue.suggested;
    }
    
    if (analysis.resale?.priceRange?.high) {
      return analysis.resale.priceRange.high;
    }
    
    return 0;
  }

  // GET CURRENT CACHED LOCATION (UNMODIFIED)
  getCurrentCachedLocation() {
    return this.userLocation;
  }

  // GET LOCATION STATUS (MODIFIED: Logic uses the updated isValidForPinning)
  getLocationStatus() {
    return {
      supported: this.isLocationSupported(),
      available: !!this.userLocation,
      fresh: this.isLocationFresh(),
      accuracy: this.userLocation?.accuracy || null,
      accuracyRating: this.getAccuracyRating(),
      // Check if location is considered good (less than fallback threshold)
      isValidForPinning: this.userLocation && this.userLocation.accuracy <= this.FALLBACK_THRESHOLD_M, 
      coordinates: this.userLocation ? {
        lat: this.userLocation.latitude.toFixed(6),
        lng: this.userLocation.longitude.toFixed(6)
      } : null
    };
  }

  // GET ACCURACY RATING (UNMODIFIED)
  getAccuracyRating() {
    if (!this.userLocation || !this.userLocation.accuracy) return 'unknown';
    const accuracy = this.userLocation.accuracy;
    if (accuracy <= 10) return 'excellent';
    if (accuracy <= 30) return 'good';
    if (accuracy <= 100) return 'fair';
    return 'poor';
  }

  // INITIALIZE LOCATION SERVICES (UNMODIFIED)
  async initializeLocationServices() {
    return await this.startLocationWatch();
  }

  // CALCULATE DISTANCE (UNMODIFIED)
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

  // TO RADIANS (UNMODIFIED)
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
  
  // CLEANUP WATCH ONLY (NEW)
  cleanupWatch() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // COMPLETE CLEANUP (MODIFIED)
  cleanup() {
    this.cleanupWatch();
    this.pins.clear();
    this.userLocation = null;
    // this.lastPinLocation remains for history
    console.log('🧹 Pin Manager cleaned up');
  }

  // REQUEST LOCATION PERMISSION (UNMODIFIED)
  async requestLocationPermission(showPrompt = true) {
    if (!showPrompt) {
        // Rely on browser's default mechanism (getCurrentPosition) to ask for permission
        try {
            await this.getCurrentLocation(false);
            return true;
        } catch (e) {
            // Permission denied or timeout (browser-level prompt)
            return false;
        }
    }
      
    // Custom UI modal logic
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); z-index: 10000;
        display: flex; align-items: center; justify-content: center; padding: 20px;
      `;

      modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 400px; text-align: center;">
          <h3 style="margin-bottom: 15px;">📍 Location Access Needed</h3>
          <p style="color: #666; margin-bottom: 20px;">
            We need your location to create pins on the map. This helps other users find items you want to share.
          </p>
          <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="allowBtn" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
              Allow Location
            </button>
            <button id="denyBtn" style="padding: 12px 24px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 8px; cursor: pointer;">
              Cancel
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('#allowBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve(true);
      };
      
      modal.querySelector('#denyBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve(false);
      };
    });
  }
}

// Create global instance
window.pinManager = new PinManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PinManager };
}