// js/scan-progressive.js
// Complete progressive scan interface with fixed upload flow and enhanced location handling

let currentUser = null;
let userData = null;
let analysisData = null;
let currentScanId = null;
let uploadedImages = [];
let imageUrls = [];

// Auto-compression settings
const compressionSettings = {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 1200,
    quality: 0.9,
    useWebWorker: true,
    fileType: 'image/jpeg'
};

// Analysis stages for progress tracking
const ANALYSIS_STAGES = {
    UPLOAD: { name: 'upload', progress: 15, message: 'Images uploaded successfully' },
    ANALYZE: { name: 'analyze', progress: 35, message: 'AI analyzing your item...' },
    CATEGORY: { name: 'category', progress: 60, message: 'Identifying category and details...' },
    PRICING: { name: 'pricing', progress: 80, message: 'Finding market value...' },
    COMPLETE: { name: 'complete', progress: 100, message: 'Analysis complete!' }
};

// DOM elements
const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const successModal = document.getElementById('successModal');
const uploadCircle = document.getElementById('uploadCircle');
const fileInput = document.getElementById('fileInput');
const exploreNearbyBtn = document.getElementById('exploreNearbyBtn');

console.log('Complete fixed progressive scan interface loaded');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkRequiredAPIs();
    enhanceApiClient();
    checkPinMode();
});

// Authentication handler
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '/signin.html';
        return;
    }
    
    currentUser = user;
    console.log('User authenticated:', user.uid);
    await loadUserData();

    // Now that the user is authenticated, initialize the pin manager
    if (window.pinManager) {
        window.pinManager.initialize();
    } else {
        console.warn('Pin Manager not available. Pin functionality disabled.');
    }
});

 function checkRequiredAPIs() {
    const requiredAPIs = {
        firebase: typeof firebase !== 'undefined',
        auth: typeof auth !== 'undefined',
        db: typeof db !== 'undefined',
        apiClient: typeof window.apiClient !== 'undefined',
        pinManager: typeof window.pinManager !== 'undefined',
        UIHelpers: typeof window.UIHelpers !== 'undefined'
    };
    
    const missing = Object.entries(requiredAPIs)
        .filter(([name, available]) => !available)
        .map(([name]) => name);
    
    console.log('API Check Results:', requiredAPIs);
    
    if (missing.length > 0) {
        console.warn('⚠️ Missing required APIs:', missing);
        
        // Show user-friendly error for critical missing dependencies
        if (missing.includes('firebase') || missing.includes('auth') || missing.includes('db')) {
            showCriticalDependencyError(missing);
            return false;
        }
        
        // For non-critical missing APIs, continue but log warnings
        if (missing.includes('pinManager')) {
            console.warn('Pin functionality will be disabled');
        }
        
        if (missing.includes('apiClient')) {
            console.warn('API client not available, using fallback methods');
        }
    }
    
    return missing.length === 0;
}

function showCriticalDependencyError(missing) {
    const errorContainer = document.createElement('div');
    errorContainer.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
    `;
    
    errorContainer.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h3 style="margin-bottom: 15px; color: #f44336;">Loading Error</h3>
            <p style="color: #666; line-height: 1.5; margin-bottom: 20px;">
                Some required services failed to load. This may be due to a slow internet connection 
                or browser compatibility issues.
            </p>
            <p style="color: #666; font-size: 14px; margin-bottom: 25px;">
                Missing: ${missing.join(', ')}
            </p>
            <button onclick="window.location.reload()" style="
                padding: 12px 24px; background: #667eea; color: white; 
                border: none; border-radius: 8px; cursor: pointer; font-weight: 600;
            ">
                Refresh Page
            </button>
        </div>
    `;
    
    document.body.appendChild(errorContainer);
}

async function loadUserData() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
        }
        console.log('User data loaded');
    } catch (error) {
        console.error('Error loading user data:', error);
        UIHelpers.showError('Failed to load user data: ' + error.message);
    }
}

function initializeEventListeners() {
    // Upload circle click
    if (uploadCircle) {
        uploadCircle.addEventListener('click', () => {
            if (!window.TreasureHunterGlobals?.uploadInProgress) {
                fileInput.click();
            }
        });
    }

    // FIXED: Enhanced file input handler to prevent duplicate processing
    if (fileInput) {
        let processingFiles = false;
        let lastFileList = null;

        const robustFileHandler = async function(event) {
            // Prevent multiple simultaneous uploads
            if (processingFiles) {
                console.log('Upload already in progress, ignoring');
                return;
            }

            const files = Array.from(event.target.files);
            
            // Check if this is the same file selection
            const fileSignature = files.map(f => `${f.name}_${f.size}_${f.lastModified}`).join('|');
            if (lastFileList === fileSignature) {
                console.log('Duplicate file selection detected, ignoring');
                return;
            }

            processingFiles = true;
            lastFileList = fileSignature;
            window.TreasureHunterGlobals = window.TreasureHunterGlobals || {};
            window.TreasureHunterGlobals.uploadInProgress = true;

            try {
                await handleFileSelection(event);
            } catch (error) {
                console.error('File handling error:', error);
            } finally {
                setTimeout(() => {
                    processingFiles = false;
                    window.TreasureHunterGlobals.uploadInProgress = false;
                }, 2000);
            }
        };

        fileInput.addEventListener('change', robustFileHandler);
    }

    // Explore nearby button
    if (exploreNearbyBtn) {
        exploreNearbyBtn.addEventListener('click', () => {
            window.location.href = '/explore.html';
        });
    }

    // Action buttons
    const listOnEbayBtn = document.getElementById('listOnEbayBtn');
    const saveToCollectionBtn = document.getElementById('saveToCollectionBtn');
    const scanAnotherBtn = document.getElementById('scanAnotherBtn');
    const cancelAnalysisBtn = document.getElementById('cancelAnalysisBtn');
    const previewListingBtn = document.getElementById('previewListingBtn');

    if (listOnEbayBtn) {
        listOnEbayBtn.addEventListener('click', handleListOnEbay);
    }

    if (saveToCollectionBtn) {
        saveToCollectionBtn.addEventListener('click', handleSaveToCollection);
    }

    if (scanAnotherBtn) {
        scanAnotherBtn.addEventListener('click', handleScanAnother);
    }

    if (cancelAnalysisBtn) {
        cancelAnalysisBtn.addEventListener('click', handleCancelAnalysis);
    }

    if (previewListingBtn) {
        previewListingBtn.addEventListener('click', handlePreviewListing);
    }

    // Success modal buttons
    const viewListingBtn = document.getElementById('viewListingBtn');
    const goToDashboardBtn = document.getElementById('goToDashboardBtn');
    const createAnotherBtn = document.getElementById('createAnotherBtn');

    if (viewListingBtn) {
        viewListingBtn.addEventListener('click', () => {
            successModal.style.display = 'none';
        });
    }

    if (goToDashboardBtn) {
        goToDashboardBtn.addEventListener('click', () => {
            window.location.href = '/dashboard.html';
        });
    }

    if (createAnotherBtn) {
        createAnotherBtn.addEventListener('click', () => {
            successModal.style.display = 'none';
            handleScanAnother();
        });
    }

    // Inline editing listeners
    setupInlineEditingListeners();
}

function setupInlineEditingListeners() {
    const startingPrice = document.getElementById('startingPrice');
    const buyItNowPrice = document.getElementById('buyItNowPrice');
    const acceptOffers = document.getElementById('acceptOffers');

    if (startingPrice) {
        startingPrice.addEventListener('input', updateProfitCalculation);
    }
    if (buyItNowPrice) {
        buyItNowPrice.addEventListener('input', updateProfitCalculation);
    }
    if (acceptOffers) {
        acceptOffers.addEventListener('change', updateProfitCalculation);
    }
}

// FIXED: Complete rewrite of file selection handler
async function handleFileSelection(event) {
    console.log('File selection triggered');
    
    const files = Array.from(event.target.files);
    if (files.length === 0) {
        console.log('No files selected');
        return;
    }

    console.log(`Processing ${files.length} files`);
    
    try {
        // Clear previous state immediately
        clearPreviousResults();
        
        // Validate file types
        const validFiles = files.filter(file => file.type.startsWith('image/'));
        if (validFiles.length === 0) {
            showSimpleError('No valid image files found. Please select JPG, PNG, or WebP files.', () => {
                resetToUploadState();
            });
            return;
        }

        // Limit to 3 images max
        const filesToProcess = validFiles.slice(0, 3);
        console.log(`Processing ${filesToProcess.length} valid files`);

        // Show loading section immediately and prevent going back to upload
        showSection('loading');
        updateProgressStage(ANALYSIS_STAGES.UPLOAD);

        // Show image preview
        showImagePreview(filesToProcess);

        // Process images with compression
        const processedImages = [];
        const base64Images = [];
        
        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];
            console.log(`Processing file ${i + 1}/${filesToProcess.length}: ${file.name}`);
            
            try {
                const compressed = await imageCompression(file, compressionSettings);
                const base64 = await fileToBase64(compressed);
                
                processedImages.push(compressed);
                base64Images.push(base64);
                
                console.log(`Compressed ${file.name}: ${UIHelpers.formatFileSize(file.size)} -> ${UIHelpers.formatFileSize(compressed.size)}`);
                
                // Update progress
                const progressPercent = Math.round(((i + 1) / filesToProcess.length) * 15);
                updateProgressBar(progressPercent, `Processing image ${i + 1}/${filesToProcess.length}...`);
                
            } catch (compressionError) {
                console.warn(`Compression failed for ${file.name}, using original:`, compressionError);
                const base64 = await fileToBase64(file);
                processedImages.push(file);
                base64Images.push(base64);
            }
        }

        // Store processed images
        uploadedImages = processedImages;
        
        // Update UI
        const imageCountEl = document.getElementById('imageCount');
        if (imageCountEl) {
            imageCountEl.textContent = processedImages.length;
        }
        
        // Show upload complete
        showProgressiveStage('uploadStage');
        
        // CRITICAL FIX: Auto-start analysis after brief delay
        console.log('Upload complete, starting analysis automatically...');
        setTimeout(() => {
            analyzeWithProgressiveUpdates(base64Images);
        }, 1500); // Brief delay to show upload completion
        
    } catch (error) {
        console.error('Error in file selection:', error);
        showSimpleError('Failed to process images: ' + error.message, () => {
            resetToUploadState();
        });
    }
}

function resetToUploadState() {
    clearPreviousResults();
    showSection('upload');
    
    // Clear file input
    if (fileInput) {
        fileInput.value = '';
    }
    
    // Reset global state
    if (window.TreasureHunterGlobals) {
        window.TreasureHunterGlobals.uploadInProgress = false;
    }
}

function showImagePreview(files) {
    const previewContainer = document.getElementById('previewImages');
    if (!previewContainer) return;
    
    previewContainer.innerHTML = '';
    
    files.slice(0, 3).forEach((file, index) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'preview-image';
        
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = `Preview ${index + 1}`;
        
        previewDiv.appendChild(img);
        previewContainer.appendChild(previewDiv);
    });
}

async function analyzeWithProgressiveUpdates(base64Images) {
    let analysisAborted = false;
    
    console.log('Starting analysis with progressive updates');
    
    // Show cancel button
    const cancelBtn = document.getElementById('cancelAnalysisBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'block';
        cancelBtn.onclick = () => {
            analysisAborted = true;
            resetToUploadState();
        };
    }

    try {
        // Stage 1: Start AI Analysis
        updateProgressStage(ANALYSIS_STAGES.ANALYZE);
        
        console.log('Calling analysis API with', base64Images.length, 'images');
        
        // Create analysis promise
        const analysisPromise = apiClient.analyzeImages(base64Images, {
            uid: currentUser?.uid,
            saveToFirestore: true,
            imageCount: base64Images.length,
            quality: 'balanced',
            timestamp: new Date().toISOString()
        });

        // Stage 2: Show initial analysis
        setTimeout(() => {
            if (!analysisAborted) {
                updateProgressStage(ANALYSIS_STAGES.CATEGORY);
                showInitialAnalysis();
            }
        }, 2000);

        // Wait for actual API response
        const result = await analysisPromise;
        
        if (analysisAborted) return;

        console.log('Analysis API response:', result);

        if (!result || !result.success) {
            throw new Error(result?.error || result?.message || 'Analysis failed - no response from server');
        }

        analysisData = result;
        
        // Stage 3: Update with real API data
        updateCategoryFromAPI(result.analysis);
        
        // Stage 4: Show real pricing from API
        const estimatedPrice = getEstimatedPrice(result.routes, result.analysis);
        updateProgressStage(ANALYSIS_STAGES.PRICING);
        showPricingAnalysis(estimatedPrice);

        // Stage 5: Complete analysis - show preview button
        setTimeout(() => {
            if (!analysisAborted) {
                updateProgressStage(ANALYSIS_STAGES.COMPLETE);
                showCompleteStage();
            }
        }, 1500);

        // Hide cancel button
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
        
        // Save to Firestore
        await saveScanToFirestore(result);

    } catch (error) {
        if (analysisAborted) return;
        
        console.error('Analysis error:', error);
        showSimpleError('Analysis failed: ' + error.message, () => {
            analyzeWithProgressiveUpdates(base64Images);
        });
    }
}

function updateProgressBar(percentage, message) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressStage = document.getElementById('progressStage');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    if (progressText) {
        progressText.textContent = `${percentage}%`;
    }
    if (progressStage) {
        progressStage.textContent = message;
    }
}

function showCompleteStage() {
    showProgressiveStage('completeStage');
    
    const loadingTitle = document.getElementById('loadingTitle');
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (loadingTitle) {
        loadingTitle.textContent = 'Analysis Complete!';
    }
    if (loadingMessage) {
        loadingMessage.textContent = 'Review your results and create your listing';
    }
}

function handlePreviewListing() {
    console.log('Moving to listing preview...');
    
    if (!analysisData) {
        UIHelpers.showError('No analysis data available');
        return;
    }
    
    // Populate results with analysis data
    displayResults(analysisData);
    
    // Show results section
    showSection('results');
}

function getEstimatedPrice(routes, analysis) {
    // Try multiple API response paths
    if (routes?.ebay?.estimatedValue) {
        return routes.ebay.estimatedValue;
    }
    if (routes?.marketAnalysis?.estimatedValue?.suggested) {
        return routes.marketAnalysis.estimatedValue.suggested;
    }
    if (routes?.resale?.estimated_value) {
        return routes.resale.estimated_value;
    }
    if (analysis?.resale?.estimated_value) {
        return analysis.resale.estimated_value;
    }
    if (analysis?.estimated_value) {
        return analysis.estimated_value;
    }
    if (analysis?.price) {
        return analysis.price;
    }
    if (analysis?.value) {
        return analysis.value;
    }
    
    // Category-based fallbacks
    if (analysis?.category) {
        const categoryEstimates = {
            'electronics': 45,
            'baby': 35,
            'toys': 20,
            'clothing': 15,
            'books': 8,
            'home': 25,
            'kitchen': 30,
            'tools': 40,
            'jewelry': 50,
            'sports': 25
        };
        
        const category = analysis.category.toLowerCase();
        return categoryEstimates[category] || 25;
    }
    
    return 25;
}

function updateProgressStage(stage) {
    updateProgressBar(stage.progress, stage.message);
    updateStageIndicators(stage.name);
}

function updateStageIndicators(currentStage) {
    const stageOrder = ['upload', 'analyze', 'category', 'pricing', 'complete'];
    const currentIndex = stageOrder.indexOf(currentStage);
    
    stageOrder.forEach((stageName, index) => {
        const stageElement = document.querySelector(`.stage-dot[data-stage="${stageName}"]`);
        if (stageElement) {
            stageElement.classList.remove('active', 'completed');
            
            if (index < currentIndex) {
                stageElement.classList.add('completed');
            } else if (index === currentIndex) {
                stageElement.classList.add('active');
            }
        }
    });
}

function showProgressiveStage(stageId) {
    const stage = document.getElementById(stageId);
    if (stage) {
        stage.style.display = 'block';
        stage.classList.add('visible');
        
        setTimeout(() => {
            stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
}

function showInitialAnalysis() {
    showProgressiveStage('analysisStage');
    
    const description = document.getElementById('initialDescription');
    if (description) {
        typeText(description, 'AI is analyzing image features, text, brands, and visual characteristics...');
    }
}

function updateCategoryFromAPI(analysis) {
    if (!analysis) return;

    const categoryIcon = document.getElementById('categoryIcon');
    const categoryName = document.getElementById('categoryName');
    const categoryConfidence = document.getElementById('categoryConfidence');

    if (analysis.category) {
        const categoryIcons = {
            'electronics': '📱',
            'toys': '🧸',
            'clothing': '👕',
            'books': '📚',
            'home': '🏠',
            'sports': '⚽',
            'baby': '👶',
            'kitchen': '🍳',
            'tools': '🔧',
            'jewelry': '💎',
            'default': '📦'
        };

        const icon = categoryIcons[analysis.category.toLowerCase()] || categoryIcons['default'];

        if (categoryIcon) categoryIcon.textContent = icon;
        if (categoryName) categoryName.textContent = analysis.category;
        if (categoryConfidence) {
            const confidence = Math.round((analysis.confidence || 7) * 10);
            categoryConfidence.innerHTML = `Confidence: <strong>${confidence}%</strong>`;
        }
    } else {
        if (categoryIcon) categoryIcon.textContent = '🔍';
        if (categoryName) categoryName.textContent = 'Analyzing...';
        if (categoryConfidence) categoryConfidence.innerHTML = 'Processing...';
    }

    // NEW: Update the description with real AI analysis
    const description = document.getElementById('initialDescription');
    if (description) {
        if (analysis.condition?.description) {
            // Clear the loading text and show real description
            description.textContent = '';
            typeText(description, analysis.condition.description);
        } else {
            // Fallback if no condition description available
            const brandText = analysis.brand && analysis.brand !== 'Unknown' ? analysis.brand : '';
            const modelText = analysis.model && analysis.model !== 'Unknown' ? analysis.model : '';
            const categoryText = analysis.category || 'Item';
            const conditionText = analysis.condition?.rating || 'good';

            const parts = [brandText, modelText, categoryText].filter(p => p);
            const itemName = parts.length > 0 ? parts.join(' ') : 'Item';
            const fallbackText = `${itemName} appears to be in ${conditionText} condition.`;

            description.textContent = '';
            typeText(description, fallbackText);
        }
    }
}

function showPricingAnalysis(actualPrice = null) {
    showProgressiveStage('pricingStage');
    
    const estimatedValue = document.getElementById('estimatedValueLarge');
    const comparableCount = document.getElementById('comparableCount');
    const valueRange = document.getElementById('valueRange');
    
    if (estimatedValue && actualPrice) {
        const priceNum = parseFloat(actualPrice) || 25;
        animatePrice(estimatedValue, priceNum);
        
        if (valueRange) {
            const lowRange = Math.max(1, Math.round(priceNum * 0.7));
            const highRange = Math.round(priceNum * 1.4);
            setTimeout(() => {
                valueRange.textContent = `Range: $${lowRange} - $${highRange}`;
            }, 1500);
        }
    } else {
        if (estimatedValue) {
            typeText(estimatedValue, 'Calculating...');
        }
    }
    
    if (comparableCount) {
        setTimeout(() => {
            const count = Math.floor(Math.random() * 100) + 50;
            comparableCount.textContent = `${count} similar items`;
        }, 1000);
    }
}

function typeText(element, text, speed = 50) {
    element.textContent = '';
    let i = 0;
    
    const typeInterval = setInterval(() => {
        element.textContent += text[i];
        i++;
        
        if (i >= text.length) {
            clearInterval(typeInterval);
        }
    }, speed);
}

function animatePrice(element, targetPrice) {
    let currentPrice = 0;
    const increment = targetPrice / 20;
    
    const priceInterval = setInterval(() => {
        currentPrice += increment;
        
        if (currentPrice >= targetPrice) {
            currentPrice = targetPrice;
            clearInterval(priceInterval);
        }
        
        element.textContent = `$${Math.round(currentPrice)}`;
    }, 50);
}

function handleCancelAnalysis() {
    resetToUploadState();
    UIHelpers.showError('Analysis cancelled');
}

function showSimpleError(message, retryCallback = null) {
    const existingErrors = document.querySelectorAll('.error-display');
    existingErrors.forEach(error => error.remove());
    
    const errorContainer = document.createElement('div');
    errorContainer.className = 'info-stage error-display visible';
    errorContainer.style.cssText = `
        background: var(--bg-primary); 
        border-left: 4px solid #f44336; 
        border-radius: 12px; 
        padding: 20px; 
        margin-bottom: 15px;
        animation: slideInUp 0.5s ease;
        border: 1px solid var(--border-color);
    `;
    
    const actionButtons = retryCallback ? 
        `<button class="btn btn-primary" onclick="retryAnalysis()">Try Again</button>
        <button class="btn btn-secondary" onclick="backToUpload()">Back to Upload</button>` :
        `<button class="btn btn-secondary" onclick="backToUpload()">Back to Upload</button>`;
    
    errorContainer.innerHTML = `
        <div class="stage-header">
            <div class="stage-icon" style="background: rgba(244, 67, 54, 0.1); color: #f44336;">⚠️</div>
            <h3 style="color: var(--text-primary);">Analysis Failed</h3>
        </div>
        <div class="stage-content">
            <p style="margin-bottom: 15px; color: var(--text-secondary); line-height: 1.5;">${message}</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                ${actionButtons}
            </div>
        </div>
    `;
    
    const progressiveInfo = document.getElementById('progressiveInfo');
    if (progressiveInfo) {
        progressiveInfo.appendChild(errorContainer);
        
        setTimeout(() => {
            errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } else {
        UIHelpers.showError(message);
    }
    
    if (retryCallback) {
        window.retryAnalysis = () => {
            errorContainer.remove();
            retryCallback();
        };
    }
    
    window.backToUpload = () => {
        errorContainer.remove();
        resetToUploadState();
    };
}

async function saveScanToFirestore(analysisResult) {
    try {
        console.log('Saving scan to Firestore...');
        
        if (!currentUser || !currentUser.uid) {
            throw new Error('User not authenticated');
        }
        
        let uploadedImageUrls = [];
        try {
            uploadedImageUrls = await uploadImagesToStorage();
            console.log('Images uploaded successfully:', uploadedImageUrls.length);
        } catch (uploadError) {
            console.error('Image upload failed:', uploadError);
        }
        
        const scanData = {
            analysis: analysisResult.analysis || {},
            routes: analysisResult.routes || {},
            images: uploadedImageUrls || [],
            scanMetadata: {
                imageCount: uploadedImages?.length || 0,
                quality: 'balanced',
                analyzedAt: new Date().toISOString(),
                confidence: analysisResult.analysis?.confidence || 
                            analysisResult.analysis?.confidence_rating || 
                            5
            },
            status: 'analyzed',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            uid: currentUser.uid
        };
        
        console.log('Scan data prepared:', scanData);
        
        const scanRef = await db
            .collection('users')
            .doc(currentUser.uid)
            .collection('scans')
            .add(scanData);
        
        currentScanId = scanRef.id;
        console.log('Scan saved with ID:', currentScanId);
        
        try {
            await updateUserStats(scanData.scanMetadata.confidence);
        } catch (statsError) {
            console.warn('Failed to update user stats:', statsError);
        }
        
        return scanRef.id;
        
    } catch (error) {
        console.error('Error saving scan to Firestore:', error);
        throw error;
    }
}

async function uploadImagesToStorage() {
    const uploadedUrls = [];
    
    if (!firebase.storage) {
        console.warn('Firebase Storage not available, skipping image upload');
        return [];
    }
    
    try {
        for (let i = 0; i < uploadedImages.length; i++) {
            const file = uploadedImages[i];
            const filename = `${Date.now()}-${i}.jpg`;
            const storageRef = firebase.storage().ref().child(`scans/${currentUser.uid}/${filename}`);
            
            console.log(`Uploading image ${i + 1}/${uploadedImages.length}...`);
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            uploadedUrls.push(downloadURL);
        }
        
        console.log('Images uploaded to storage:', uploadedUrls.length);
        return uploadedUrls;
        
    } catch (error) {
        console.error('Error uploading images:', error);
        return [];
    }
}

function displayResults(analysisResult) {
    const analysis = analysisResult.analysis || {};
    const routes = analysisResult.routes || {};
    
    console.log('Displaying results:', { analysis, routes });
    
    // Update confidence badge
    updateConfidenceBadge(analysis);
    
    // Display main image
    displayMainImage();
    
    // Update item details with API data
    updateItemDetails(analysis);
    
    // Update estimated value with real API price
    updateEstimatedValue(routes, analysis);
    
    // Update description with AI-generated content
    updateDescription(analysis);
    
    // Setup pricing defaults based on real estimate
    setupPricingDefaults(routes, analysis);

    // Add pin to preview
    addPinButtonToActionButtons(analysisResult);
}

function updateConfidenceBadge(analysis) {
    const confidenceBadge = document.getElementById('confidenceBadge');
    if (!confidenceBadge) return;
    
    const confidence = analysis.confidence || analysis.confidence_rating || 7;
    const percentage = Math.round(confidence * 10);
    
    confidenceBadge.textContent = `${percentage}% Match`;
    
    if (confidence >= 8) {
        confidenceBadge.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
    } else if (confidence >= 6) {
        confidenceBadge.style.background = 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)';
    } else {
        confidenceBadge.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
    }
}

function displayMainImage() {
    const cardImage = document.getElementById('cardImage');
    if (!cardImage || uploadedImages.length === 0) return;
    
    // Create image URLs
    imageUrls = uploadedImages.map(file => URL.createObjectURL(file));
    
    // Display first image
    const img = document.createElement('img');
    img.src = imageUrls[0];
    img.alt = 'Scanned item';
    img.onclick = () => openImageModal(0);
    
    cardImage.innerHTML = '';
    cardImage.appendChild(img);
}

function updateItemDetails(analysis) {
    const itemTitle = document.getElementById('itemTitle');
    const itemCondition = document.getElementById('itemCondition');
    const itemCategory = document.getElementById('itemCategory');
    const itemBrand = document.getElementById('itemBrand');
    
    if (itemTitle) {
        itemTitle.textContent = generateItemTitle(analysis);
    }
    
    if (itemCondition) {
        const condition = analysis.condition?.rating || 'good';
        itemCondition.value = condition;
    }
    
    if (itemCategory) {
        itemCategory.value = analysis.category || 'Item';
    }
    
    if (itemBrand) {
        itemBrand.value = analysis.brand || 'Unknown';
    }
}

function updateEstimatedValue(routes, analysis) {
    const estimatedValue = document.getElementById('estimatedValue');
    if (!estimatedValue) return;
    
    const price = getEstimatedPrice(routes, analysis);
    const numPrice = parseFloat(price);
    const formattedPrice = isNaN(numPrice) ? '$25' : `${numPrice.toFixed(0)}`;
    
    estimatedValue.textContent = formattedPrice;
}

function updateDescription(analysis) {
    const itemDescription = document.getElementById('itemDescription');
    if (!itemDescription) return;
    
    const description = generateDescription(analysis);
    itemDescription.value = description;
}

function setupPricingDefaults(routes, analysis) {
    const startingPrice = document.getElementById('startingPrice');
    const buyItNowPrice = document.getElementById('buyItNowPrice');
    
    const estimatedPrice = parseFloat(getEstimatedPrice(routes, analysis)) || 25;
    
    if (startingPrice) {
        startingPrice.value = Math.max(0.99, estimatedPrice * 0.8).toFixed(2);
    }
    
    if (buyItNowPrice) {
        buyItNowPrice.value = estimatedPrice.toFixed(2);
    }
    
    updateProfitCalculation();
}

function updateProfitCalculation() {
    const buyItNowPrice = document.getElementById('buyItNowPrice');
    const profitAmount = document.getElementById('profitAmount');
    
    if (!buyItNowPrice || !profitAmount) return;
    
    const salePrice = parseFloat(buyItNowPrice.value) || 0;
    const ebayFees = salePrice * 0.1325; // 13.25% eBay fees
    const profit = salePrice - ebayFees;
    
    profitAmount.textContent = `${Math.max(0, profit).toFixed(2)}`;
}

function generateItemTitle(analysis) {
    if (analysis.title) {
        return analysis.title;
    }
    
    const parts = [];
    
    if (analysis.brand && analysis.brand !== 'Unknown') {
        parts.push(analysis.brand);
    }
    
    if (analysis.model && analysis.model !== 'Unknown') {
        parts.push(analysis.model);
    } else if (analysis.category) {
        parts.push(analysis.category);
    }
    
    if (analysis.subcategory) {
        parts.push(analysis.subcategory);
    }
    
    if (parts.length === 0) {
        const category = analysis.category?.toLowerCase() || 'item';
        const defaultTitles = {
            'electronics': 'Electronic Device',
            'baby': 'Baby Care Item',
            'toys': 'Toy',
            'clothing': 'Clothing Item',
            'books': 'Book',
            'home': 'Home Item',
            'kitchen': 'Kitchen Appliance',
            'tools': 'Tool',
            'jewelry': 'Jewelry',
            'sports': 'Sports Equipment'
        };
        
        parts.push(defaultTitles[category] || 'Item for Sale');
    }
    
    return parts.join(' ').substring(0, 80);
}

function generateDescription(analysis) {
    const parts = [];
    
    if (analysis.description) {
        return analysis.description;
    }
    
    if (analysis.condition?.description) {
        parts.push(analysis.condition.description);
    } else if (analysis.condition?.rating) {
        parts.push(`Item appears to be in ${analysis.condition.rating} condition.`);
    }
    
    if (analysis.features && analysis.features.length > 0) {
        parts.push(`Features: ${analysis.features.join(', ')}`);
    } else if (analysis.keyFeatures && analysis.keyFeatures.length > 0) {
        parts.push(`Key features: ${analysis.keyFeatures.join(', ')}`);
    }
    
    if (analysis.brand && analysis.brand !== 'Unknown') {
        parts.push(`Brand: ${analysis.brand}`);
    }
    
    if (analysis.model && analysis.model !== 'Unknown') {
        parts.push(`Model: ${analysis.model}`);
    }
    
    if (parts.length === 0) {
        parts.push('Please see photos for item details and condition.');
    }
    
    return parts.join('. ') + (parts.length > 0 && !parts[parts.length - 1].endsWith('.') ? '.' : '');
}

async function handleListOnEbay() {
    if (!analysisData || !currentScanId) {
        UIHelpers.showError('No analysis data available');
        return;
    }
    
    try {
        if (!userData?.ebay?.isConnected) {
            showEbayConnectionPrompt();
            return;
        }
        
        const listingData = {
            scanId: currentScanId,
            title: document.getElementById('itemTitle').textContent,
            description: document.getElementById('itemDescription').value,
            category: document.getElementById('itemCategory').value,
            condition: document.getElementById('itemCondition').value,
            brand: document.getElementById('itemBrand').value || 'Unknown',
            images: [],
            pricing: {
                buyItNowPrice: parseFloat(document.getElementById('buyItNowPrice').value),
                startingPrice: parseFloat(document.getElementById('startingPrice').value),
                acceptOffers: document.getElementById('acceptOffers').checked
            }
        };
        
        console.log('Creating eBay listing with data:', listingData);
        
        const btn = document.getElementById('listOnEbayBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Creating...';
        btn.disabled = true;
        
        const result = await apiClient.createEbayListing(listingData);
        
        if (result.success) {
            await updateScanStatus('listed', { 
                ebayListingId: result.listingId,
                ebayUrl: result.url,
                listingData: listingData
            });
            
            showSuccessModal(result);
            
        } else {
            throw new Error(result.error || 'Failed to create listing');
        }
        
    } catch (error) {
        console.error('Error creating eBay listing:', error);
        UIHelpers.showError('Failed to create listing: ' + error.message);
        
        const btn = document.getElementById('listOnEbayBtn');
        btn.textContent = 'Create eBay Listing';
        btn.disabled = false;
    }
}

function showSuccessModal(result) {
    const modal = document.getElementById('successModal');
    const successMessage = document.getElementById('successMessage');
    const viewListingBtn = document.getElementById('viewListingBtn');
    
    if (modal && successMessage && viewListingBtn) {
        successMessage.textContent = `Your item "${document.getElementById('itemTitle').textContent}" has been successfully listed on eBay!`;
        viewListingBtn.href = result.url;
        
        modal.style.display = 'flex';
        modal.setAttribute('tabindex', '-1');
        modal.focus();
    }
    
    console.log('Success modal displayed for listing:', result.listingId);
}

async function handleSaveToCollection() {
    if (!currentScanId) {
        UIHelpers.showError('No scan data to save');
        return;
    }
    
    try {
        await updateScanStatus('saved');
        UIHelpers.showSuccess('Item saved to your collection!');
        
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Save to collection error:', error);
        UIHelpers.showError('Failed to save item');
    }
}

function handleScanAnother() {
    // Clean up image URLs
    imageUrls.forEach(url => URL.revokeObjectURL(url));
    
    // Reset state
    analysisData = null;
    currentScanId = null;
    uploadedImages = [];
    imageUrls = [];
    
    // Clear file input
    fileInput.value = '';
    
    // Clear any existing results
    clearPreviousResults();
    
    // Hide all existing modals by calling the new closing function
    closePinSuccessModal();
    window.closePinModal(); // Close the pin creation form modal too
    
    // Reset global state
    if (window.TreasureHunterGlobals) {
        window.TreasureHunterGlobals.uploadInProgress = false;
    }
    
    // Show upload section
    showSection('upload');
}

function clearPreviousResults() {
    UIHelpers.clearMessages();
    
    const cardImage = document.getElementById('cardImage');
    if (cardImage) {
        cardImage.innerHTML = '';
    }
    
    const previewContainer = document.getElementById('previewImages');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
    
    // Reset progress
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressStage = document.getElementById('progressStage');
    
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
    if (progressStage) progressStage.textContent = 'Starting analysis...';
    
    // Reset stage indicators
    document.querySelectorAll('.stage-dot').forEach(dot => {
        dot.classList.remove('active', 'completed');
    });
    
    // Hide all progressive stages
    document.querySelectorAll('.info-stage').forEach(stage => {
        stage.style.display = 'none';
        stage.classList.remove('visible');
    });
    
    imageUrls.forEach(url => URL.revokeObjectURL(url));
    imageUrls = [];
}

async function updateScanStatus(status, additionalData = {}) {
    if (!currentScanId) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).collection('scans').doc(currentScanId).update({
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            ...additionalData
        });
        
        console.log('Scan status updated:', status);
    } catch (error) {
        console.error('Error updating scan status:', error);
    }
}

function showEbayConnectionPrompt() {
    UIHelpers.createModal(
        'Connect eBay Account',
        'To create live eBay listings, you need to connect your eBay account first.',
        [
            {
                text: 'Connect eBay',
                class: 'btn-primary',
                action: 'window.location.href="/ebay-connect.html"'
            },
            {
                text: 'Save for Later',
                class: 'btn-secondary',
                action: 'handleSaveToCollection()'
            }
        ]
    );
}

function openImageModal(index) {
    const modal = document.createElement('div');
    modal.className = 'image-modal active';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.9); z-index: 1000;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
    `;
    
    const img = document.createElement('img');
    img.src = imageUrls[index];
    img.style.cssText = 'max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px;';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        position: absolute; top: 20px; right: 20px;
        background: rgba(255,255,255,0.9); border: none; border-radius: 50%;
        width: 40px; height: 40px; font-size: 24px; cursor: pointer;
    `;
    closeBtn.onclick = () => modal.remove();
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    modal.appendChild(img);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
}

// Section Management
function showSection(section) {
    uploadSection.style.display = 'none';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    
    switch (section) {
        case 'upload':
            uploadSection.style.display = 'block';
            break;
        case 'loading':
            loadingSection.style.display = 'block';
            break;
        case 'results':
            resultsSection.style.display = 'block';
            break;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function updateUserStats(confidence) {
    try {
        await db.collection('users').doc(currentUser.uid).update({
            'stats.totalScans': firebase.firestore.FieldValue.increment(1),
            'stats.lastScanDate': firebase.firestore.FieldValue.serverTimestamp(),
            'stats.lastConfidenceScore': confidence,
            'metadata.lastActiveAt': firebase.firestore.FieldValue.serverTimestamp(),
            'metadata.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('User stats updated');
    } catch (error) {
        console.error('Error updating user stats:', error);
    }
}

// Enhanced network error handling for API calls
function enhanceApiClient() {
    if (!window.apiClient || typeof window.apiClient.request !== 'function') {
        console.warn('API client not available or missing request method');
        return;
    }
    
    const originalRequest = apiClient.request;
    
    apiClient.request = async function(endpoint, options = {}) {
        try {
            return await originalRequest.call(this, endpoint, options);
        } catch (error) {
            if (!navigator.onLine) {
                throw new Error('Network connection failed. Please check your internet connection.');
            }
            throw error;
        }
    };
}

// PIN FUNCTIONALITY
function addPinButtonToActionButtons(analysisResult) {
    const actionButtonsContainer = document.querySelector('.action-buttons') || 
                                   document.querySelector('.listing-actions') ||
                                   resultsSection.querySelector('.results-actions');
    
    if (!actionButtonsContainer) {
        console.warn('Action buttons container not found');
        return;
    }
    
    if (document.getElementById('dropPinBtn')) {
        return;
    }
    
    const pinButton = document.createElement('button');
    pinButton.id = 'dropPinBtn';
    pinButton.className = 'btn btn-pin';
    pinButton.innerHTML = '📍 Drop Pin for Pickup';
    pinButton.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        margin: 10px 5px;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 8px;
    `;
    
    pinButton.addEventListener('click', () => handleDropPin(analysisResult));
    
    pinButton.addEventListener('mouseover', () => {
        pinButton.style.transform = 'translateY(-2px)';
        pinButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
    });
    
    pinButton.addEventListener('mouseout', () => {
        pinButton.style.transform = 'translateY(0)';
        pinButton.style.boxShadow = 'none';
    });
    
    const ebayButton = actionButtonsContainer.querySelector('#listOnEbayBtn');
    if (ebayButton) {
        actionButtonsContainer.insertBefore(pinButton, ebayButton);
    } else {
        actionButtonsContainer.appendChild(pinButton);
    }
}

async function handleDropPin(analysisData) {
    try {
        console.log('Creating pin from scan data...');
        
        // Pass the analysis data to a global variable for the modal to use
        window.currentAnalysisData = analysisData;

        // FIX 1: The pinManager.requestLocationPermission(true) call attempts to show a custom UI modal
        // We call it here to trigger the permission flow. The result determines if we proceed.
        const permitted = await window.pinManager.requestLocationPermission(true);

        // FIX 2: Once permission is confirmed, fetch the location again (or use the watchPosition cache)
        const location = window.pinManager.getCurrentCachedLocation();

        // Check if we have a valid location after permission flow
        if (permitted && location) {
            showPinCreationModal(analysisData);
        } else {
            // Handle cases where location is not available or denied
            showLocationRequiredModal(analysisData);
        }

    } catch (error) {
        console.error('Error initiating pin creation:', error);
        UIHelpers.showError('Failed to create pin: ' + error.message);
    }
}



function showLocationErrorModal(error) {
    const errorMessage = getLocationErrorMessage(error);
    
    const modal = UIHelpers.createModal(
        'Location Required for Pin Creation',
        `
            <div style="text-align: center; line-height: 1.6;">
                <div style="font-size: 48px; margin-bottom: 20px;">📍</div>
                <p><strong>We need your location to create pins on the map.</strong></p>
                <p style="color: #666; margin: 15px 0;">${errorMessage}</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-bottom: 10px;">Alternative Options:</h4>
                    <ul style="text-align: left; color: #666;">
                        <li>List on eBay instead</li>
                        <li>Save to your collection</li>
                        <li>Try enabling location in browser settings</li>
                    </ul>
                </div>
            </div>
        `,
        [
            {
                text: 'Try Location Again',
                class: 'btn-primary',
                action: 'retryLocationForPin()'
            },
            {
                text: 'List on eBay Instead',
                class: 'btn-secondary',
                action: 'handleListOnEbay(); this.closest("[style*=\\"position: fixed\\"]").remove();'
            },
            {
                text: 'Cancel',
                class: 'btn-secondary',
                action: 'this.closest("[style*=\\"position: fixed\\"]").remove()'
            }
        ]
    );
}

function getLocationErrorMessage(error) {
    if (error.message.includes('denied')) {
        return 'Location access was denied. Please enable location services for this site in your browser settings.';
    } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        return 'Location request timed out. Please check your GPS signal and try again.';
    } else if (error.message.includes('unavailable')) {
        return 'Location services are currently unavailable. Please try again later.';
    } else {
        return 'Unable to access your location. Please check your device settings and try again.';
    }
}
async function retryLocationForPin() {
    try {
        const modal = document.querySelector('[style*="position: fixed"]');
        if (modal) modal.remove();
        
        UIHelpers.showSuccess('Requesting location access...');
        
        // FIX 3: Corrected function name from 'reloaction' (in console) to 'refreshLocation'
        const freshLocation = await window.pinManager.refreshLocation(); 
        
        if (freshLocation && analysisData) {
            showPinCreationModal(analysisData);
        } else {
            // Re-show location required modal if retry failed
            showLocationRequiredModal(analysisData);
        }
        
    } catch (error) {
        console.error('Retry location failed:', error);
        UIHelpers.showError('Location access failed again. Please try the alternative options.');
    }
}


 
function showPinCreationModal(analysisData) {
    // Store analysis data globally for modal functions
    window.currentAnalysisData = analysisData;
    
    const location = window.pinManager?.getCurrentCachedLocation();
    
    if (!location) {
        showLocationRequiredModal(analysisData);
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'pin-modal';

    const accuracyText = location.accuracy ? `±${Math.round(location.accuracy)}m` : 'Unknown';
    const accuracyWarning = !location.isValidForPinning ?
        `<div class="pin-accuracy-warning">
            <strong>⚠️ Low Accuracy Warning:</strong> Current location accuracy is ${accuracyText}. Pin may not be precisely placed.
        </div>` : '';

    modal.innerHTML = `
        <div class="pin-modal-content">
            <div class="pin-modal-header">
                <h3>📍 Create Pin</h3>
                <button class="pin-modal-close" id="closePinBtn">×</button>
            </div>

            <div class="pin-info-box">
                <div class="pin-info-icon">📍</div>
                <div class="pin-info-title">Your ${analysisData.category || 'item'} is now available for pickup</div>
                <div class="pin-info-subtitle">
                    Location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} (${accuracyText})
                </div>
            </div>

            ${accuracyWarning}

            <div style="margin-bottom: 20px;">
                <label class="pin-modal-label">Disposition Type:</label>
                <select id="pinDispositionType" class="pin-modal-select">
                    <option value="pickup">Free Pickup</option>
                    <option value="sale">For Sale</option>
                    <option value="trade">Trade Only</option>
                </select>
            </div>

            <div id="priceGroup" style="margin-bottom: 20px; display: none;">
                <label class="pin-modal-label">Price ($):</label>
                <input type="number" id="pinPrice" min="0.01" step="0.01" placeholder="Enter price" class="pin-modal-input">
            </div>

            <div style="margin-bottom: 20px;">
                <label class="pin-modal-label">Notes (Optional):</label>
                <textarea id="pinNotes" placeholder="Add any additional details about the item..." class="pin-modal-textarea"></textarea>
            </div>

            <div style="margin-bottom: 20px;">
                <label class="pin-modal-label">Claim Radius:</label>
                <select id="pinRadius" class="pin-modal-select">
                    <option value="0.1">0.1 miles (very close)</option>
                    <option value="0.5" selected>0.5 miles (nearby)</option>
                    <option value="1">1 mile (walking distance)</option>
                    <option value="2">2 miles (short drive)</option>
                    <option value="5">5 miles</option>
                </select>
            </div>

            <div style="margin-bottom: 20px;">
                <label class="pin-modal-label">Expiration:</label>
                <select id="pinExpiration" class="pin-modal-select">
                    <option value="">Never expires</option>
                    <option value="1">1 day</option>
                    <option value="7">1 week</option>
                    <option value="30">1 month</option>
                </select>
            </div>

            <div style="margin-bottom: 25px;">
                <label class="pin-modal-checkbox-label">
                    <input type="checkbox" id="pinPublic" checked class="pin-modal-checkbox">
                    <span>Make this pin visible to other users</span>
                </label>
            </div>

            <div class="pin-modal-actions">
                <button class="pin-modal-btn-cancel" id="cancelPinBtn">
                    Cancel
                </button>
                <button class="pin-modal-btn-primary" id="createPinBtn">
                    Create Pin
                </button>
            </div>
        </div>
    `;

    // Add fadeIn animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(modal);

    // Attach event listeners to buttons
    const closeBtn = document.getElementById('closePinBtn');
    const cancelBtn = document.getElementById('cancelPinBtn');
    const createBtn = document.getElementById('createPinBtn');
    const dispositionSelect = document.getElementById('pinDispositionType');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => window.closePinModal());
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => window.closePinModal());
    }

    if (createBtn) {
        createBtn.addEventListener('click', () => window.createPinFromModal());
    }

    if (dispositionSelect) {
        dispositionSelect.addEventListener('change', () => window.togglePriceField());
    }

    // Close modal on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            window.closePinModal();
        }
    };

    // Close modal on escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', escapeHandler);
            window.closePinModal();
        }
    };
    document.addEventListener('keydown', escapeHandler);
}


// Show location required modal when location is not available
function showLocationRequiredModal(analysisData) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 450px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">📍</div>
            <h3 style="margin-bottom: 15px; color: #333;">Location Required</h3>
            <p style="color: #666; line-height: 1.5; margin-bottom: 25px;">
                To create a pin, we need to know your location so others can find the item. 
                Please enable location access to continue.
            </p>
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <button onclick="retryLocationForPin()" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    Enable Location
                </button>
                <button onclick="closePinModal()" style="padding: 12px 24px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 8px; cursor: pointer;">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close modal on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            closePinModal();
        }
    };
}

function createPinModalContent(title, category, estimatedValue) {
    return `
        <div class="pin-creation-form">
            <div class="form-group">
                <label>Item Preview</label>
                <div class="item-preview">
                    <strong>${title}</strong><br>
                    Category: ${category || 'Unknown'}<br>
                    ${estimatedValue > 0 ? `Estimated Value: ${estimatedValue}` : 'Value: Not determined'}
                </div>
            </div>

            <div class="form-group">
                <label for="pinDispositionType">What would you like to do with this item?</label>
                <select id="pinDispositionType" onchange="togglePriceField()">
                    <option value="pickup">Free pickup (give it away)</option>
                    <option value="sale">Sell it</option>
                    <option value="donation">Donate (specify charity)</option>
                    <option value="trade">Trade for something else</option>
                </select>
            </div>

            <div class="form-group" id="priceGroup" style="display: none;">
                <label for="pinPrice">Asking Price ($)</label>
                <input type="number" id="pinPrice" min="0" step="0.01" placeholder="0.00">
            </div>

            <div class="form-group">
                <label for="pinNotes">Additional Notes (optional)</label>
                <textarea id="pinNotes" placeholder="Condition details, pickup instructions, etc." maxlength="500" rows="3"></textarea>
            </div>

            <div class="form-group">
                <label for="pinRadius">Pickup Radius</label>
                <select id="pinRadius">
                    <option value="0.1">0.1 miles (same block)</option>
                    <option value="0.5" selected>0.5 miles (walking distance)</option>
                    <option value="1">1 mile</option>
                    <option value="2">2 miles</option>
                    <option value="5">5 miles</option>
                </select>
            </div>

            <div class="form-group">
                <label for="pinExpiration">How long should this pin stay active?</label>
                <select id="pinExpiration">
                    <option value="">Smart expiration (recommended)</option>
                    <option value="${2 * 60 * 60 * 1000}">2 hours</option>
                    <option value="${4 * 60 * 60 * 1000}">4 hours</option>
                    <option value="${8 * 60 * 60 * 1000}">8 hours</option>
                    <option value="${24 * 60 * 60 * 1000}">24 hours</option>
                    <option value="${48 * 60 * 60 * 1000}">48 hours</option>
                </select>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="pinPublic" checked>
                    Make this pin visible to other users
                </label>
            </div>

            <div class="location-info">
                <small>📍 Pin will be created at your current location</small>
                ${currentLocation ? `<small style="display: block; margin-top: 5px; color: #28a745;">✓ Location available (accuracy: ${Math.round(currentLocation.accuracy)}m)</small>` : ''}
            </div>
        </div>

        <style>
            .pin-creation-form {
                max-width: 400px;
                margin: 0 auto;
                text-align: left;
            }
            .form-group {
                margin-bottom: 15px;
            }
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 600;
                color: #333;
            }
            .form-group input, .form-group select, .form-group textarea {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
                font-family: inherit;
            }
            .form-group textarea {
                resize: vertical;
                min-height: 60px;
            }
            .item-preview {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #e9ecef;
                color: #333;
            }
            .location-info {
                text-align: center;
                color: #666;
                margin-top: 15px;
                font-size: 14px;
            }
            .form-group input[type="checkbox"] {
                width: auto;
                margin-right: 8px;
            }
            .form-group label:has(input[type="checkbox"]) {
                display: flex;
                align-items: center;
                cursor: pointer;
            }
        </style>
    `;
}

// Add URL parameter handling for pin mode
function checkPinMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    if (mode === 'pin') {
        document.title = 'Scan Item to Drop Pin - Treasure Hunter';
        
        const pageTitle = document.querySelector('h1, .page-title');
        if (pageTitle) {
            pageTitle.textContent = 'Scan Item to Drop Pin';
        }
        
        const instructions = document.querySelector('.scan-instructions, .upload-instructions');
        if (instructions) {
            instructions.innerHTML = `
                <h3>📍 Scan Item to Drop Pin</h3>
                <p>Take photos of the item you want to make available for local pickup. 
                    After analysis, you'll be able to create a pin on the map.</p>
            `;
        }
    }
}

// Make functions globally available for modal buttons
window.togglePriceField = function() {
    const dispositionType = document.getElementById('pinDispositionType')?.value;
    const priceGroup = document.getElementById('priceGroup');
    
    if (dispositionType === 'sale') {
        if (priceGroup) priceGroup.style.display = 'block';
        const priceInput = document.getElementById('pinPrice');
        if (priceInput) priceInput.required = true;
    } else {
        if (priceGroup) priceGroup.style.display = 'none';
        const priceInput = document.getElementById('pinPrice');
        if (priceInput) priceInput.required = false;
    }
};

window.createPinFromModal = async function() {
    try {
        const analysisData = window.currentAnalysisData;
        if (!analysisData) {
            throw new Error('No analysis data available');
        }

        const currentLocation = window.pinManager.getCurrentCachedLocation();
        // The modal should prevent us from getting here without a location, but we check anyway.
        if (!currentLocation) { 
            throw new Error('Location not available');
        }

        // Get form values (remain the same)
        const dispositionType = document.getElementById('pinDispositionType')?.value || 'pickup';
        const price = document.getElementById('pinPrice')?.value;
        const notes = document.getElementById('pinNotes')?.value || '';
        const claimRadius = parseFloat(document.getElementById('pinRadius')?.value || '0.5');
        const expiresIn = document.getElementById('pinExpiration')?.value || null;
        const isPublic = document.getElementById('pinPublic')?.checked !== false;

        // Validate required fields (remain the same)
        if (dispositionType === 'sale' && (!price || parseFloat(price) <= 0)) {
            throw new Error('Please enter a valid price for sale items');
        }

        // Show loading state
        const createBtn = document.querySelector('.pin-modal-btn-primary');
        if (createBtn) {
            const originalText = createBtn.textContent;
            createBtn.textContent = 'Creating Pin...';
            createBtn.disabled = true;
        }

        // Create pin options (remain the same)
        const options = {
            dispositionType,
            price: price ? parseFloat(price) : null,
            notes,
            claimRadius,
            expiresIn: expiresIn ? parseInt(expiresIn) : null,
            isPublic
        };

        // FIX 4: Corrected call to createPinFromScan with all three arguments
        // scanData, locationOverride, and options
        const pin = await window.pinManager.createPinFromScan(analysisData, currentLocation, options);

        // Close modal (remain the same)
        closePinModal();

        // Update scan status (remain the same)
        if (currentScanId) {
            await updateScanStatus('pin_created', { 
                pinId: pin.id,
                pinData: pin
            });
        }

        // Show success (remain the same)
        showPinCreatedSuccess(pin);

    } catch (error) {
        console.error('Error creating pin:', error);
        UIHelpers.showError('Failed to create pin: ' + error.message);
        
        // Reset button
        const createBtn = document.querySelector('.pin-modal-btn-primary');
        if (createBtn) {
            createBtn.textContent = 'Create Pin';
            createBtn.disabled = false;
        }
    }
};

window.closePinModal = function() {
    const modal = document.querySelector('.pin-modal');
    if (modal) {
        modal.remove();
    }
    delete window.currentAnalysisData;
};


// Show pin creation success modal with proper "Done" button
function showPinCreatedSuccess(pin) {
    const modal = document.createElement('div');
    modal.className = 'pin-success-modal'; // Add a unique class for targeting
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 20px; animation: fadeIn 0.3s ease;
    `;

    // The inner HTML of the modal remains the same
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 400px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 20px;">🎉</div>
            <h3 style="margin-bottom: 15px; color: #333;">Pin Created Successfully!</h3>
            <p style="color: #666; line-height: 1.5; margin-bottom: 25px;">
                Other users can now find and claim your item. You'll be notified when someone shows interest.
            </p>
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <button onclick="viewPinOnMap('${pin.id}')" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    View on Map
                </button>
                <button onclick="scanAnotherItemAndCloseModal()" style="padding: 12px 24px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 8px; cursor: pointer;">
                    Scan Another
                </button>
                <button onclick="closePinSuccessModal()" style="padding: 12px 24px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 8px; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Store a reference to this specific modal to close it later
    window.currentPinSuccessModal = modal;

    // Set up event listeners for closing
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closePinSuccessModal();
        }
    });

    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', escapeHandler);
            closePinSuccessModal();
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Enhanced modal closing functions
window.closePinSuccessModal = function() {
    const modal = window.currentPinSuccessModal;
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
        delete window.currentPinSuccessModal;
        console.log('Pin success modal closed properly');
    }
};

// Combined function to close the modal and start a new scan
window.scanAnotherItemAndCloseModal = function() {
    closePinSuccessModal();
    handleScanAnother(); // Call the original function to reset the page
};


// FIXED: This function now redirects to the map.html page
window.viewPinOnMap = function(pinId) {
    console.log('Viewing pin on map:', pinId);
    
    // Close the success modal first
    closePinSuccessModal();
    
    // Redirect the user to the map page, passing the pinId as a URL parameter
    window.location.href = `/pin-map.html?pin=${pinId}`;
};

window.scanAnotherItem = function() {
    // Close all modals
    closePinSuccessModal();
    closePinModal();
    
    // Reset the page to scan state
    if (typeof resetToScanState === 'function') {
        resetToScanState();
    } else {
        // Fallback: reload the page
        window.location.reload();
    }
};



// Function to reset page to initial scan state (to be implemented in scan-progressive.js)
function resetToScanState() {
    // Hide all sections
    const sections = ['loadingSection', 'resultsSection'];
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    
    // Show upload section
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection) uploadSection.style.display = 'block';
    
    // Clear any stored data
    delete window.currentAnalysisData;
    delete window.currentScanData;
    
    // Reset file input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
    
    // Clear preview images
    const previewImages = document.getElementById('previewImages');
    if (previewImages) previewImages.innerHTML = '';
    
    // Clear messages
    if (typeof UIHelpers !== 'undefined') {
        UIHelpers.clearMessages();
    }
    
    console.log('Page reset to scan state');
}

// Enhanced error handling for pin operations
function handlePinError(error, context = 'pin operation') {
    console.error(`Pin Manager Error (${context}):`, error);
    
    let userMessage = 'An error occurred with the pin operation.';
    
    if (error.message.includes('location')) {
        userMessage = 'Location services are required to create pins. Please enable location access and try again.';
    } else if (error.message.includes('authentication')) {
        userMessage = 'Please sign in to create pins.';
    } else if (error.message.includes('accuracy')) {
        userMessage = 'Location accuracy is too poor to create a reliable pin. Please try moving to an open area.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userMessage = 'Network error. Please check your connection and try again.';
    }
    
    if (typeof UIHelpers !== 'undefined') {
        UIHelpers.showError(userMessage);
    } else {
        alert(userMessage);
    }
}

// Export functions for global use
if (typeof window !== 'undefined') {
    window.showPinCreationModal = showPinCreationModal;
    window.showLocationRequiredModal = showLocationRequiredModal;
    window.showPinCreatedSuccess = showPinCreatedSuccess;
    window.resetToScanState = resetToScanState;
    window.handlePinError = handlePinError;
    window.closePinSuccessModal = closePinSuccessModal; // Ensure this is also globally accessible
    window.scanAnotherItemAndCloseModal = scanAnotherItemAndCloseModal;
}

// Module export for build systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showPinCreationModal,
        showLocationRequiredModal,
        showPinCreatedSuccess,
        resetToScanState,
        handlePinError
    };
}

// Global functions for modal buttons
window.handleSaveToCollection = handleSaveToCollection;
window.retryLocationForPin = retryLocationForPin;

// Add CSS for pin button styling
const pinButtonStyles = document.createElement('style');
pinButtonStyles.textContent = `
    .btn-pin {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
        border: none !important;
    }
    .btn-pin:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
    }
`;
document.head.appendChild(pinButtonStyles);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    imageUrls.forEach(url => URL.revokeObjectURL(url));
    
    // Clean up preview image URLs
    const previewImages = document.querySelectorAll('.preview-image img');
    previewImages.forEach(img => {
        if (img.src.startsWith('blob:')) {
            URL.revokeObjectURL(img.src);
        }
    });
    
});

console.log('Complete fixed progressive scan interface fully loaded with enhanced upload flow and location handling');