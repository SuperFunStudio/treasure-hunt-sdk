// shared/error-handler.js
// Enhanced error handling for better user experience

class ErrorHandler {
    static handleAnalysisError(error) {
        console.error('Analysis error:', error);
        
        // Network errors
        if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
            return {
                message: 'Network connection issue. Please check your internet and try again.',
                type: 'network',
                retry: true
            };
        }
        
        // API specific errors
        if (error.message.includes('API Error')) {
            const statusMatch = error.message.match(/API Error (\d+)/);
            if (statusMatch) {
                const status = parseInt(statusMatch[1]);
                return this.handleAPIStatus(status, error.message);
            }
        }
        
        // Firebase errors
        if (error.code) {
            return this.handleFirebaseError(error);
        }
        
        // Image compression errors
        if (error.message.includes('compression') || error.message.includes('image')) {
            return {
                message: 'Image processing failed. Please try with different photos or check file format.',
                type: 'image',
                retry: true
            };
        }
        
        // Generic fallback
        return {
            message: error.message || 'Analysis failed. Please try again.',
            type: 'generic',
            retry: true
        };
    }
    
    static handleAPIStatus(status, fullMessage) {
        switch (status) {
            case 400:
                return {
                    message: 'Invalid image data. Please ensure photos are clear and try again.',
                    type: 'validation',
                    retry: true
                };
            case 401:
                return {
                    message: 'Authentication issue. Please sign out and back in.',
                    type: 'auth',
                    retry: false
                };
            case 403:
                return {
                    message: 'Access denied. Please check your account permissions.',
                    type: 'permission',
                    retry: false
                };
            case 429:
                return {
                    message: 'Too many requests. Please wait a moment and try again.',
                    type: 'rate_limit',
                    retry: true,
                    retryDelay: 30000 // 30 seconds
                };
            case 500:
            case 502:
            case 503:
                return {
                    message: 'Server temporarily unavailable. Please try again in a few minutes.',
                    type: 'server',
                    retry: true,
                    retryDelay: 60000 // 1 minute
                };
            default:
                return {
                    message: fullMessage || `Server error (${status}). Please try again.`,
                    type: 'api',
                    retry: true
                };
        }
    }
    
    static handleFirebaseError(error) {
        const errorMap = {
            'permission-denied': {
                message: 'Access denied. Please sign out and back in to refresh permissions.',
                type: 'permission',
                retry: false
            },
            'unavailable': {
                message: 'Service temporarily unavailable. Please try again.',
                type: 'service',
                retry: true,
                retryDelay: 5000
            },
            'unauthenticated': {
                message: 'Authentication expired. Please sign in again.',
                type: 'auth',
                retry: false,
                action: 'redirect_signin'
            },
            'quota-exceeded': {
                message: 'Service limit reached. Please try again later.',
                type: 'quota',
                retry: true,
                retryDelay: 300000 // 5 minutes
            },
            'not-found': {
                message: 'Requested data not found.',
                type: 'not_found',
                retry: false
            }
        };
        
        const errorInfo = errorMap[error.code];
        if (errorInfo) {
            return errorInfo;
        }
        
        return {
            message: error.message || 'Database error. Please try again.',
            type: 'firebase',
            retry: true
        };
    }
    
    static handleEbayError(error) {
        if (error.message.includes('not connected')) {
            return {
                message: 'eBay account not connected. Please connect your account first.',
                type: 'ebay_connection',
                retry: false,
                action: 'connect_ebay'
            };
        }
        
        if (error.message.includes('requiresReauth')) {
            return {
                message: 'eBay authentication expired. Please reconnect your account.',
                type: 'ebay_auth',
                retry: false,
                action: 'reconnect_ebay'
            };
        }
        
        if (error.message.includes('policies')) {
            return {
                message: 'Please set up your payment, shipping, and return policies on eBay.com first.',
                type: 'ebay_policies',
                retry: false,
                action: 'ebay_policies'
            };
        }
        
        return {
            message: `eBay listing error: ${error.message}`,
            type: 'ebay',
            retry: false
        };
    }
    
    static showErrorWithRetry(errorInfo, retryCallback = null) {
        let message = errorInfo.message;
        
        // Add retry button if applicable
        if (errorInfo.retry && retryCallback) {
            const retryDelay = errorInfo.retryDelay || 0;
            
            if (retryDelay > 0) {
                message += ` <button onclick="setTimeout(() => (${retryCallback.toString()})(), ${retryDelay})" 
                    style="margin-left: 10px; padding: 5px 10px; background: #f44336; color: white; 
                           border: none; border-radius: 4px; cursor: pointer;">
                    Retry in ${retryDelay / 1000}s
                </button>`;
            } else {
                message += ` <button onclick="(${retryCallback.toString()})()" 
                    style="margin-left: 10px; padding: 5px 10px; background: #f44336; color: white; 
                           border: none; border-radius: 4px; cursor: pointer;">
                    Try Again
                </button>`;
            }
        }
        
        // Handle special actions
        if (errorInfo.action) {
            switch (errorInfo.action) {
                case 'redirect_signin':
                    message += ` <button onclick="window.location.href='/signin.html'" 
                        style="margin-left: 10px; padding: 5px 10px; background: #2196f3; color: white; 
                               border: none; border-radius: 4px; cursor: pointer;">
                        Sign In
                    </button>`;
                    break;
                case 'connect_ebay':
                    message += ` <button onclick="window.location.href='/ebay-connect.html'" 
                        style="margin-left: 10px; padding: 5px 10px; background: #4caf50; color: white; 
                               border: none; border-radius: 4px; cursor: pointer;">
                        Connect eBay
                    </button>`;
                    break;
                case 'reconnect_ebay':
                    message += ` <button onclick="window.location.href='/ebay-connect.html'" 
                        style="margin-left: 10px; padding: 5px 10px; background: #ff9800; color: white; 
                               border: none; border-radius: 4px; cursor: pointer;">
                        Reconnect eBay
                    </button>`;
                    break;
                case 'ebay_policies':
                    message += ` <button onclick="window.open('https://www.ebay.com/sh/settings', '_blank')" 
                        style="margin-left: 10px; padding: 5px 10px; background: #9c27b0; color: white; 
                               border: none; border-radius: 4px; cursor: pointer;">
                        eBay Settings
                    </button>`;
                    break;
            }
        }
        
        UIHelpers.showError(message);
        
        // Log for debugging
        console.group('Error Details');
        console.error('Type:', errorInfo.type);
        console.error('Message:', errorInfo.message);
        console.error('Retry:', errorInfo.retry);
        if (errorInfo.retryDelay) console.error('Retry Delay:', errorInfo.retryDelay);
        if (errorInfo.action) console.error('Action:', errorInfo.action);
        console.groupEnd();
    }
    
    static createErrorBoundary(asyncFunction, context = 'Operation') {
        return async function(...args) {
            try {
                return await asyncFunction.apply(this, args);
            } catch (error) {
                console.error(`Error in ${context}:`, error);
                
                let errorInfo;
                
                if (context.includes('Analysis')) {
                    errorInfo = ErrorHandler.handleAnalysisError(error);
                } else if (context.includes('eBay')) {
                    errorInfo = ErrorHandler.handleEbayError(error);
                } else if (error.code) {
                    errorInfo = ErrorHandler.handleFirebaseError(error);
                } else {
                    errorInfo = {
                        message: error.message || `${context} failed. Please try again.`,
                        type: 'generic',
                        retry: true
                    };
                }
                
                ErrorHandler.showErrorWithRetry(errorInfo);
                throw error;
            }
        };
    }

    // ===== PROGRESSIVE SCAN ENHANCEMENTS =====

    // Progressive scan specific error handling
    static handleProgressiveScanError(error, stage) {
        const errorInfo = this.handleAnalysisError(error);
        
        // Add stage-specific context
        errorInfo.stage = stage;
        errorInfo.stageMessage = this.getStageErrorMessage(stage);
        errorInfo.progressiveDisplay = true;
        
        return errorInfo;
    }

    static getStageErrorMessage(stage) {
        const messages = {
            'upload': 'Failed during image upload',
            'analyze': 'AI analysis failed', 
            'category': 'Category identification failed',
            'pricing': 'Market pricing lookup failed',
            'complete': 'Final processing failed'
        };
        return messages[stage] || 'Analysis failed';
    }

    // Enhanced error display that integrates with progressive loading
    static showProgressiveError(errorInfo, retryCallback = null) {
        // Remove any existing error displays in loading section
        const existingErrors = document.querySelectorAll('.error-display');
        existingErrors.forEach(error => error.remove());
        
        // Create error display that matches progressive loading design
        const errorContainer = document.createElement('div');
        errorContainer.className = 'info-stage error-display visible';
        errorContainer.style.cssText = `
            background: #ffebee; 
            border-left: 4px solid #f44336; 
            border-radius: 12px; 
            padding: 20px; 
            margin-bottom: 15px;
            animation: slideInUp 0.5s ease;
        `;
        
        // Determine appropriate actions based on error type
        let actionButtons = '';
        
        if (errorInfo.retry && retryCallback) {
            const retryDelay = errorInfo.retryDelay || 0;
            
            if (retryDelay > 0) {
                actionButtons = `
                    <button class="btn btn-primary" onclick="retryAfterDelay(${retryDelay})" id="retryBtn">
                        Retry in ${Math.ceil(retryDelay / 1000)}s
                    </button>
                    <button class="btn btn-secondary" onclick="backToUpload()">
                        Back to Upload
                    </button>
                `;
            } else {
                actionButtons = `
                    <button class="btn btn-primary" onclick="retryAnalysis()">
                        Try Again
                    </button>
                    <button class="btn btn-secondary" onclick="backToUpload()">
                        Back to Upload
                    </button>
                `;
            }
        } else {
            actionButtons = `
                <button class="btn btn-secondary" onclick="backToUpload()">
                    Back to Upload
                </button>
            `;
        }
        
        // Handle special actions
        if (errorInfo.action) {
            switch (errorInfo.action) {
                case 'redirect_signin':
                    actionButtons += `
                        <button class="btn btn-primary" onclick="window.location.href='/signin.html'">
                            Sign In
                        </button>
                    `;
                    break;
                case 'connect_ebay':
                    actionButtons += `
                        <button class="btn btn-primary" onclick="window.location.href='/ebay-connect.html'">
                            Connect eBay
                        </button>
                    `;
                    break;
                case 'reconnect_ebay':
                    actionButtons += `
                        <button class="btn btn-warning" onclick="window.location.href='/ebay-connect.html'">
                            Reconnect eBay
                        </button>
                    `;
                    break;
                case 'ebay_policies':
                    actionButtons += `
                        <button class="btn btn-primary" onclick="window.open('https://www.ebay.com/sh/settings', '_blank')">
                            eBay Settings
                        </button>
                    `;
                    break;
            }
        }
        
        errorContainer.innerHTML = `
            <div class="stage-header">
                <div class="stage-icon" style="background: rgba(244, 67, 54, 0.1); color: #f44336;">⚠️</div>
                <h3>${errorInfo.stageMessage || 'Analysis Failed'}</h3>
            </div>
            <div class="stage-content">
                <p style="margin-bottom: 15px; color: #666; line-height: 1.5;">${errorInfo.message}</p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                    ${actionButtons}
                </div>
            </div>
        `;
        
        // Insert into progressive info section
        const progressiveInfo = document.getElementById('progressiveInfo');
        if (progressiveInfo) {
            progressiveInfo.appendChild(errorContainer);
            
            // Scroll error into view
            setTimeout(() => {
                errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        } else {
            // Fallback to regular error display
            UIHelpers.showError(errorInfo.message);
        }
        
        // Set up retry functions
        if (retryCallback) {
            window.retryAnalysis = () => {
                errorContainer.remove();
                retryCallback();
            };
            
            window.retryAfterDelay = (delay) => {
                const retryBtn = document.getElementById('retryBtn');
                if (retryBtn) {
                    retryBtn.disabled = true;
                    let countdown = Math.ceil(delay / 1000);
                    
                    const countdownInterval = setInterval(() => {
                        countdown--;
                        retryBtn.textContent = `Retry in ${countdown}s`;
                        
                        if (countdown <= 0) {
                            clearInterval(countdownInterval);
                            retryBtn.textContent = 'Retrying...';
                            errorContainer.remove();
                            retryCallback();
                        }
                    }, 1000);
                }
            };
        }
        
        window.backToUpload = () => {
            errorContainer.remove();
            if (typeof showSection === 'function') {
                showSection('upload');
            }
            if (typeof clearPreviousResults === 'function') {
                clearPreviousResults();
            }
        };
    }

    // Enhanced wrapper for progressive scan operations
    static wrapProgressiveOperation(asyncFunction, stage, context = 'Operation') {
        return async function(...args) {
            try {
                return await asyncFunction.apply(this, args);
            } catch (error) {
                console.error(`Error in ${context} (${stage}):`, error);
                
                const errorInfo = ErrorHandler.handleProgressiveScanError(error, stage);
                ErrorHandler.showProgressiveError(errorInfo, () => {
                    // Retry the same operation
                    return asyncFunction.apply(this, args);
                });
                
                throw error;
            }
        };
    }

    // Network-specific error handling with better UX
    static handleNetworkError(context = 'network operation') {
        const error = new Error(`Network connection failed during ${context}`);
        const errorInfo = this.handleAnalysisError(error);
        
        // Add network-specific suggestions
        errorInfo.suggestions = [
            'Check your internet connection',
            'Try switching to a different network (WiFi/Mobile)',
            'Disable VPN if using one',
            'Wait a moment and try again'
        ];
        
        return errorInfo;
    }

    // File processing error with specific guidance
    static handleFileProcessingError(fileName, errorDetails) {
        const error = new Error(`File processing failed for ${fileName}: ${errorDetails}`);
        const errorInfo = this.handleAnalysisError(error);
        
        // Add file-specific suggestions
        errorInfo.suggestions = [
            'Try a different image file',
            'Ensure image is under 10MB',
            'Use JPG, PNG, or WebP format',
            'Check that image is not corrupted'
        ];
        
        return errorInfo;
    }

    // Progress stage error tracking
    static trackProgressError(stage, error) {
        console.group(`Progress Error - Stage: ${stage}`);
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        console.error('Timestamp:', new Date().toISOString());
        console.groupEnd();
        
        // Could send to analytics/error reporting service here
        // analytics.track('progress_error', { stage, error: error.message });
    }

    // Enhanced error boundary specifically for progressive operations
    static createProgressiveErrorBoundary(asyncFunction, stage, retryCallback = null) {
        return async function(...args) {
            try {
                return await asyncFunction.apply(this, args);
            } catch (error) {
                ErrorHandler.trackProgressError(stage, error);
                
                const errorInfo = ErrorHandler.handleProgressiveScanError(error, stage);
                ErrorHandler.showProgressiveError(errorInfo, retryCallback || (() => {
                    return asyncFunction.apply(this, args);
                }));
                
                throw error;
            }
        };
    }
}

// Export to global scope
window.ErrorHandler = ErrorHandler;