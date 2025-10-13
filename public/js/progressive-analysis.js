/**
 * Progressive Analysis Helper
 * Handles two-phase analysis with real-time updates
 */

class ProgressiveAnalysis {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.authToken = options.authToken || null;
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.pollInterval = options.pollInterval || 2000; // Poll every 2 seconds
    this.maxPolls = options.maxPolls || 30; // Max 60 seconds of polling

    this.currentScanId = null;
    this.pollCount = 0;
    this.pollTimer = null;
  }

  /**
   * Start analysis with images
   * Returns immediate results and continues polling for final pricing
   */
  async analyzeImages(imageFiles) {
    try {
      // Phase 1: Upload and get immediate AI analysis
      this.onProgress({
        phase: 'uploading',
        message: 'Uploading images...',
        progress: 10
      });

      const formData = new FormData();
      for (let i = 0; i < imageFiles.length; i++) {
        formData.append('images', imageFiles[i]);
      }

      const response = await fetch(`${this.baseUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const immediateResult = await response.json();

      // Phase 2: Show preliminary results
      this.onProgress({
        phase: 'preliminary',
        message: 'Analysis complete! Getting market pricing...',
        progress: 50,
        data: immediateResult
      });

      // Store scan ID for polling
      this.currentScanId = immediateResult.scanId;

      // Start polling for final pricing
      if (this.currentScanId) {
        this.startPolling();
      } else {
        // No scan ID - return preliminary results as final
        this.onComplete(immediateResult);
      }

      return immediateResult;

    } catch (error) {
      console.error('Analysis failed:', error);
      this.onError({
        phase: 'analysis',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Start polling for pricing completion
   */
  startPolling() {
    this.pollCount = 0;
    this.pollForUpdates();
  }

  /**
   * Poll for updates
   */
  async pollForUpdates() {
    if (this.pollCount >= this.maxPolls) {
      console.warn('Max polling attempts reached');
      this.onError({
        phase: 'polling',
        error: 'Pricing took too long - please refresh'
      });
      return;
    }

    this.pollCount++;

    try {
      const response = await fetch(
        `${this.baseUrl}/api/analyze/${this.currentScanId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const statusData = await response.json();

      // Update progress
      const progress = Math.min(50 + (this.pollCount / this.maxPolls) * 50, 95);
      this.onProgress({
        phase: 'pricing',
        message: 'Analyzing market prices...',
        progress,
        status: statusData.status
      });

      // Check if complete
      if (statusData.isComplete) {
        this.onProgress({
          phase: 'complete',
          message: 'Market analysis complete!',
          progress: 100
        });

        this.onComplete(statusData.data);
        return;
      }

      // Check for errors
      if (statusData.hasError) {
        this.onError({
          phase: 'pricing',
          error: statusData.error || 'Pricing analysis failed'
        });
        return;
      }

      // Continue polling
      this.pollTimer = setTimeout(() => this.pollForUpdates(), this.pollInterval);

    } catch (error) {
      console.error('Polling failed:', error);

      // Retry on network errors
      if (this.pollCount < this.maxPolls) {
        this.pollTimer = setTimeout(() => this.pollForUpdates(), this.pollInterval);
      } else {
        this.onError({
          phase: 'polling',
          error: error.message
        });
      }
    }
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Get full scan data by ID
   */
  async getScanData(scanId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/analyze/${scanId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch scan: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Failed to get scan data:', error);
      throw error;
    }
  }
}

// Example usage:
/*
const analyzer = new ProgressiveAnalysis({
  baseUrl: 'https://your-api.com',
  authToken: await firebase.auth().currentUser.getIdToken(),

  onProgress: (update) => {
    console.log(`Phase: ${update.phase}, Progress: ${update.progress}%`);

    if (update.phase === 'preliminary') {
      // Show preliminary results immediately
      displayAnalysisResults(update.data.analysis);
      displayPreliminaryPricing(update.data.routes);
    }
  },

  onComplete: (finalData) => {
    console.log('Final pricing complete!');
    displayFinalPricing(finalData.routes);
    displayMarketInsights(finalData.marketInsights);
  },

  onError: (error) => {
    console.error('Error:', error);
    showErrorMessage(error.error);
  }
});

// Start analysis
const fileInput = document.getElementById('imageInput');
await analyzer.analyzeImages(fileInput.files);
*/

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.ProgressiveAnalysis = ProgressiveAnalysis;
}
