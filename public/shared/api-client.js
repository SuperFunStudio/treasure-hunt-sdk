// shared/api-client.js
// Centralized API client for backend communication

// Use the correct backend URL that's working
const API_BASE_URL = 'https://app-beprv7ll2q-uc.a.run.app';

class APIClient {
    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    async getAuthToken() {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('User not authenticated');
        return await user.getIdToken();
    }

    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
        
        // Get auth token for authenticated requests
        let headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Add auth header if user is authenticated
        try {
            const token = await this.getAuthToken();
            headers['Authorization'] = `Bearer ${token}`;
        } catch (error) {
            // Continue without auth for public endpoints
            console.log('No auth token available, continuing without authentication');
        }

        const requestOptions = {
            ...options,
            headers
        };

        console.log(`API Request: ${options.method || 'GET'} ${url}`);

        try {
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error ${response.status}:`, errorText);
                
                // Parse error response if it's JSON
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (parseError) {
                    errorData = { error: errorText };
                }
                
                // Create a structured error
                const apiError = new Error(`API Error ${response.status}: ${errorData.error || errorText}`);
                apiError.status = response.status;
                apiError.response = errorData;
                throw apiError;
            }

            const data = await response.json();
            console.log(`API Response: ${response.status}`, data);
            return data;
            
        } catch (error) {
            // Handle network errors and other fetch failures
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to server');
            }
            throw error;
        }
    }

    // eBay specific methods with better error handling
    async getEbayAccountInfo() {
        try {
            return await this.request('/api/ebay/account-info');
        } catch (error) {
            console.log('eBay account info error:', error.message);
            
            // Handle specific error cases
            if (error.status === 400) {
                // Parse the error response to get more details
                if (error.response && error.response.connected === false) {
                    throw new Error('not connected');
                }
                throw new Error('eBay account not connected');
            } else if (error.status === 404) {
                throw new Error('not connected');
            } else if (error.status === 401) {
                throw new Error('Authentication required');
            } else if (error.status >= 500) {
                throw new Error('Server error - please try again later');
            } else {
                throw new Error('not connected');
            }
        }
    }

    async createEbayListing(listingData) {
        try {
            return await this.request('/api/ebay/create-listing', {
                method: 'POST',
                body: JSON.stringify(listingData)
            });
        } catch (error) {
            console.error('eBay listing creation error:', error);
            
            if (error.status === 400) {
                throw new Error(`Listing validation error: ${error.response?.error || error.message}`);
            } else if (error.status === 401) {
                throw new Error('Authentication required - please sign in again');
            } else if (error.status === 403) {
                throw new Error('eBay account not properly connected or lacks permissions');
            } else if (error.status === 404) {
                throw new Error('eBay listing service not available');
            } else {
                throw new Error(`Failed to create listing: ${error.message}`);
            }
        }
    }

    // Analysis methods
    async analyzeImages(images, options = {}) {
        try {
            return await this.request('/api/analyze-json', {
                method: 'POST',
                body: JSON.stringify({
                    images,
                    uid: firebase.auth().currentUser?.uid,
                    saveToFirestore: true,
                    ...options
                })
            });
        } catch (error) {
            console.error('Image analysis error:', error);
            
            if (error.status === 400) {
                throw new Error('Invalid image data provided');
            } else if (error.status === 413) {
                throw new Error('Images too large - please use smaller images');
            } else if (error.status >= 500) {
                throw new Error('Analysis service temporarily unavailable');
            } else {
                throw new Error(`Analysis failed: ${error.message}`);
            }
        }
    }


// Pin-specific methods
async createPin(pinData) {
  return this.request('/api/pins', {
    method: 'POST',
    body: JSON.stringify(pinData)
  });
}

async getNearbyPins(location, options = {}) {
  const params = new URLSearchParams({
    lat: location.latitude,
    lng: location.longitude,
    radius: options.radius || 5,
    ...options
  });
  return this.request(`/api/pins/nearby?${params}`);
}

async claimPin(pinId, claimData) {
  return this.request(`/api/pins/${pinId}/claim`, {
    method: 'POST',
    body: JSON.stringify(claimData)
  });
}

    // Health check with fallback
    async healthCheck() {
        try {
            return await this.request('/health');
        } catch (error) {
            console.warn('Health check failed:', error.message);
            // Return a fallback health status
            return {
                status: 'unknown',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Test endpoint with better error handling
    async testConnection() {
        try {
            return await this.request('/api/test');
        } catch (error) {
            console.warn('Test connection failed:', error.message);
            throw new Error(`Backend connection test failed: ${error.message}`);
        }
    }

    // Utility method to check if backend is available
    async isBackendAvailable() {
        try {
            await this.healthCheck();
            return true;
        } catch (error) {
            console.warn('Backend availability check failed:', error.message);
            return false;
        }
    }

// Enhanced request with automatic retries for failed requests
async performRequestWithRetry(endpoint, options = {}, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt} for ${endpoint}`);
        // Wait before retry: 1s, 2s, 3s
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
      
      return await this.request(endpoint, options);
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      console.warn(`Request attempt ${attempt + 1} failed:`, error.message);
    }
  }
  
  throw lastError;
}


    // Method to get backend status for debugging
    async getBackendStatus() {
        const status = {
            baseUrl: this.baseUrl,
            timestamp: new Date().toISOString(),
            services: {}
        };

        // Test each endpoint
        const endpoints = [
            { name: 'health', path: '/health' },
            { name: 'test', path: '/api/test' },
            { name: 'ebay-account', path: '/api/ebay/account-info' }
        ];

        for (const endpoint of endpoints) {
            try {
                await this.request(endpoint.path);
                status.services[endpoint.name] = { available: true };
            } catch (error) {
                status.services[endpoint.name] = { 
                    available: false, 
                    error: error.message,
                    status: error.status || 'unknown'
                };
            }
        }

        return status;
    }
}

// Export singleton instance
window.apiClient = new APIClient();