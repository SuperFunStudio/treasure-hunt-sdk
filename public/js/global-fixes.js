// js/global-fixes.js
// Global fixes for upload flow, location handling, and error recovery

// Global state management
window.TreasureHunterGlobals = {
    uploadInProgress: false,
    analysisInProgress: false,
    lastUploadAttempt: null,
    debugMode: false
};

// Enhanced file input handler that prevents multiple triggers
function createRobustFileHandler(fileInput, uploadCircle, handleFileSelection) {
    let processingFiles = false;
    let lastFileCount = 0;
    let lastFileNames = [];

    const wrappedHandler = async function(event) {
        // Prevent multiple simultaneous uploads
        if (processingFiles) {
            console.log('Upload already in progress, ignoring new upload');
            return;
        }

        const files = Array.from(event.target.files);
        
        // Check if this is the same upload (prevents duplicate processing)
        const currentFileNames = files.map(f => `${f.name}_${f.size}_${f.lastModified}`);
        const isDuplicate = lastFileCount === files.length && 
                           currentFileNames.every((name, idx) => name === lastFileNames[idx]);

        if (isDuplicate && Date.now() - window.TreasureHunterGlobals.lastUploadAttempt < 2000) {
            console.log('Duplicate upload detected, ignoring');
            return;
        }

        // Update tracking variables
        processingFiles = true;
        lastFileCount = files.length;
        lastFileNames = currentFileNames;
        window.TreasureHunterGlobals.lastUploadAttempt = Date.now();
        window.TreasureHunterGlobals.uploadInProgress = true;

        try {
            await handleFileSelection(event);
        } catch (error) {
            console.error('File handling error:', error);
        } finally {
            // Reset processing state after a delay
            setTimeout(() => {
                processingFiles = false;
                window.TreasureHunterGlobals.uploadInProgress = false;
            }, 1000);
        }
    };

    // Remove any existing listeners
    if (fileInput._robustHandler) {
        fileInput.removeEventListener('change', fileInput._robustHandler);
    }

    // Add the robust handler
    fileInput.addEventListener('change', wrappedHandler);
    fileInput._robustHandler = wrappedHandler;

    // Also handle click on upload circle
    if (uploadCircle && uploadCircle._robustClickHandler) {
        uploadCircle.removeEventListener('click', uploadCircle._robustClickHandler);
    }

    const clickHandler = () => {
        if (!processingFiles && !window.TreasureHunterGlobals.uploadInProgress) {
            fileInput.click();
        } else {
            console.log('Upload in progress, click ignored');
        }
    };

    if (uploadCircle) {
        uploadCircle.addEventListener('click', clickHandler);
        uploadCircle._robustClickHandler = clickHandler;
    }

    return wrappedHandler;
}

// Enhanced location error handling with user-friendly messages
function createLocationErrorHandler() {
    const errorMessages = {
        PERMISSION_DENIED: {
            title: 'Location Access Denied',
            message: 'Location access was denied. To create pins, please:',
            solutions: [
                'Click the location icon in your browser\'s address bar',
                'Select "Allow" for location access',
                'Refresh the page and try again'
            ],
            showRetry: true
        },
        POSITION_UNAVAILABLE: {
            title: 'Location Unavailable',
            message: 'Your location could not be determined. This might be because:',
            solutions: [
                'You\'re in an area with poor GPS signal',
                'Location services are disabled on your device',
                'Try moving to an area with better signal'
            ],
            showRetry: true
        },
        TIMEOUT: {
            title: 'Location Request Timeout',
            message: 'Location request took too long. This can happen when:',
            solutions: [
                'GPS signal is weak',
                'Location services are slow to respond',
                'Try again or move to a better location'
            ],
            showRetry: true
        },
        NOT_SUPPORTED: {
            title: 'Location Not Supported',
            message: 'Your browser doesn\'t support location services.',
            solutions: [
                'Use a modern browser like Chrome, Firefox, or Safari',
                'Make sure you\'re not in private/incognito mode',
                'Try a different device'
            ],
            showRetry: false
        }
    };

    return function handleLocationError(error, callback) {
        let errorType = 'POSITION_UNAVAILABLE';
        
        if (error.code === 1) errorType = 'PERMISSION_DENIED';
        else if (error.code === 2) errorType = 'POSITION_UNAVAILABLE';
        else if (error.code === 3) errorType = 'TIMEOUT';
        else if (error.message && error.message.includes('not supported')) errorType = 'NOT_SUPPORTED';

        const errorInfo = errorMessages[errorType];
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
        `;

        const solutionsList = errorInfo.solutions.map(sol => `<li>${sol}</li>`).join('');
        const retryButton = errorInfo.showRetry ? 
            `<button onclick="retryLocationAccess()" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; margin-right: 10px;">
                Try Again
            </button>` : '';

        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📍</div>
                    <h3>${errorInfo.title}</h3>
                </div>
                <p style="margin-bottom: 15px;">${errorInfo.message}</p>
                <ul style="margin: 15px 0; padding-left: 20px; line-height: 1.6;">
                    ${solutionsList}
                </ul>
                <div style="text-align: center; margin-top: 25px;">
                    ${retryButton}
                    <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" 
                        style="padding: 12px 24px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 8px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Set up retry function
        window.retryLocationAccess = async function() {
            modal.remove();
            if (callback) {
                try {
                    await callback();
                } catch (retryError) {
                    console.error('Retry failed:', retryError);
                    handleLocationError(retryError, callback);
                }
            }
        };

        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (document.body.contains(modal)) {
                modal.remove();
            }
        }, 30000);
    };
}

// Robust API client with better error handling and retries
function enhanceApiClient() {
    if (!window.apiClient) {
        console.warn('API client not found, creating fallback');
        return;
    }

    const originalRequest = window.apiClient.request;
    let requestQueue = new Map();

    window.apiClient.request = async function(endpoint, options = {}) {
        const requestKey = `${options.method || 'GET'}_${endpoint}`;
        
        // Prevent duplicate requests
        if (requestQueue.has(requestKey)) {
            console.log(`Duplicate request detected for ${requestKey}, using existing promise`);
            return await requestQueue.get(requestKey);
        }

        const requestPromise = performRequestWithRetry.call(this, endpoint, options);
        requestQueue.set(requestKey, requestPromise);

        try {
            const result = await requestPromise;
            return result;
        } finally {
            // Clean up completed request
            setTimeout(() => requestQueue.delete(requestKey), 1000);
        }
    };

    async function performRequestWithRetry(endpoint, options, retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);

        try {
            // Check network connectivity
            if (!navigator.onLine) {
                throw new Error('No internet connection. Please check your network and try again.');
            }

            // Call original request method
            return await originalRequest.call(this, endpoint, options);

        } catch (error) {
            console.error(`API request failed (attempt ${retryCount + 1}):`, error);

            // Don't retry certain errors
            const nonRetryableErrors = [400, 401, 403, 404, 422];
            if (error.message.includes('API Error') && 
                nonRetryableErrors.some(code => error.message.includes(code.toString()))) {
                throw error;
            }

            // Retry for network errors and 5xx errors
            if (retryCount < maxRetries && 
                (error.message.includes('fetch') || 
                 error.message.includes('500') || 
                 error.message.includes('502') || 
                 error.message.includes('503'))) {
                
                console.log(`Retrying request in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return await performRequestWithRetry.call(this, endpoint, options, retryCount + 1);
            }

            throw error;
        }
    }
}

// Enhanced UI feedback system
function createEnhancedUIFeedback() {
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(notificationContainer);
    }

    function showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: ${getBackgroundColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            position: relative;
            overflow: hidden;
        `;

        // Add icon based on type
        const icon = getIcon(type);
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">${icon}</span>
                <span style="flex: 1;">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; margin-left: 10px;">
                    ×
                </button>
            </div>
        `;

        // Add progress bar for timed notifications
        if (duration > 0) {
            const progressBar = document.createElement('div');
            progressBar.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255,255,255,0.3);
                width: 100%;
                transform-origin: left;
                animation: progress-shrink ${duration}ms linear;
            `;
            notification.appendChild(progressBar);
        }

        notificationContainer.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }

        return notification;
    }

    function getBackgroundColor(type) {
        const colors = {
            success: '#4caf50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196f3'
        };
        return colors[type] || colors.info;
    }

    function getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // Add CSS for progress animation
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes progress-shrink {
                from { transform: scaleX(1); }
                to { transform: scaleX(0); }
            }
        `;
        document.head.appendChild(style);
    }

    // Enhance existing UIHelpers if available
    if (window.UIHelpers) {
        const originalShowSuccess = window.UIHelpers.showSuccess;
        const originalShowError = window.UIHelpers.showError;

        window.UIHelpers.showSuccess = function(message, duration = 5000) {
            showNotification(message, 'success', duration);
            if (originalShowSuccess) originalShowSuccess.call(this, message, duration);
        };

        window.UIHelpers.showError = function(message, duration = 8000) {
            showNotification(message, 'error', duration);
            if (originalShowError) originalShowError.call(this, message, duration);
        };

        window.UIHelpers.showWarning = function(message, duration = 6000) {
            showNotification(message, 'warning', duration);
        };

        window.UIHelpers.showInfo = function(message, duration = 4000) {
            showNotification(message, 'info', duration);
        };
    }

    return { showNotification };
}

// Debug utilities
function createDebugUtilities() {
    window.debugTreasureHunter = function() {
        console.log('=== Treasure Hunter Debug Info ===');
        console.log('Globals:', window.TreasureHunterGlobals);
        console.log('Upload in progress:', window.TreasureHunterGlobals?.uploadInProgress);
        console.log('Analysis in progress:', window.TreasureHunterGlobals?.analysisInProgress);
        
        if (window.pinManager) {
            console.log('Pin Manager status:', window.pinManager.getLocationStatus());
        }
        
        if (window.apiClient) {
            console.log('API Client available:', !!window.apiClient.request);
        }
        
        console.log('Current user:', window.currentUser?.uid);
        console.log('Current location:', window.currentLocation);
        console.log('Firebase auth state:', firebase?.auth()?.currentUser?.uid);
        console.log('=== End Debug ===');
    };

    // Add debug mode toggle
    window.toggleDebugMode = function() {
        window.TreasureHunterGlobals.debugMode = !window.TreasureHunterGlobals.debugMode;
        console.log('Debug mode:', window.TreasureHunterGlobals.debugMode ? 'ON' : 'OFF');
        
        if (window.TreasureHunterGlobals.debugMode) {
            document.body.style.border = '3px solid red';
            document.body.title = 'Debug Mode Active';
        } else {
            document.body.style.border = '';
            document.body.title = '';
        }
    };

    // Quick fixes for common issues
    window.fixCommonIssues = function() {
        console.log('Running common fixes...');
        
        // Clear any stuck upload states
        window.TreasureHunterGlobals.uploadInProgress = false;
        window.TreasureHunterGlobals.analysisInProgress = false;
        
        // Clear file input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // Reset any stuck modals
        const modals = document.querySelectorAll('[style*="position: fixed"]');
        modals.forEach(modal => {
            if (modal.style.zIndex >= 1000) {
                modal.remove();
            }
        });
        
        // Clear any error displays
        const errorDisplays = document.querySelectorAll('.error-display');
        errorDisplays.forEach(error => error.remove());
        
        // Refresh location if available
        if (window.pinManager) {
            window.pinManager.refreshLocation().catch(err => {
                console.log('Location refresh failed:', err.message);
            });
        }
        
        console.log('Common fixes applied');
    };
}

// Initialize all fixes when DOM is ready
function initializeGlobalFixes() {
    console.log('Initializing global fixes...');
    
    // Enhanced API client
    enhanceApiClient();
    
    // Enhanced UI feedback
    createEnhancedUIFeedback();
    
    // Debug utilities
    createDebugUtilities();
    
    // Location error handler
    window.locationErrorHandler = createLocationErrorHandler();
    
    console.log('Global fixes initialized');
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGlobalFixes);
} else {
    initializeGlobalFixes();
}

// Export utilities
window.TreasureHunterUtils = {
    createRobustFileHandler,
    createLocationErrorHandler,
    enhanceApiClient,
    createEnhancedUIFeedback,
    createDebugUtilities
};