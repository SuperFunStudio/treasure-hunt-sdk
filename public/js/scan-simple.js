// js/scan-simple.js
// Fixed Shazam-style scan interface with proper image handling and error management

let currentUser = null;
let userData = null;
let analysisData = null;
let currentScanId = null;
let uploadedImages = [];
let imageUrls = []; // Store processed image URLs

// Auto-compression settings (balanced quality)
const compressionSettings = {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 1200,
    quality: 0.9,
    useWebWorker: true,
    fileType: 'image/jpeg'
};

// Loading messages for realistic progress
const loadingMessages = [
    { step: 1, title: 'Processing images...', message: 'Optimizing photo quality' },
    { step: 2, title: 'Identifying your item...', message: 'Reading labels and examining details' },
    { step: 3, title: 'Checking market prices...', message: 'Scanning eBay, Amazon, and other marketplaces' },
    { step: 4, title: 'Complete!', message: 'Analysis complete' }
];

// DOM elements
const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const shazamCircle = document.getElementById('shazamCircle');
const fileInput = document.getElementById('fileInput');

console.log('Fixed Scan Simple loaded');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkRequiredAPIs();
});

// Check for required APIs and show helpful errors
function checkRequiredAPIs() {
    const missing = [];
    
    if (typeof firebase === 'undefined') missing.push('Firebase');
    if (typeof imageCompression === 'undefined') missing.push('Image Compression');
    if (typeof UIHelpers === 'undefined') missing.push('UI Helpers');
    if (typeof apiClient === 'undefined') missing.push('API Client');
    
    if (missing.length > 0) {
        console.error('Missing required dependencies:', missing);
        UIHelpers?.showError(`Missing dependencies: ${missing.join(', ')}. Please check your script includes.`);
    }
}

// Authentication handler
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '/signin.html';
        return;
    }
    
    currentUser = user;
    console.log('User authenticated:', user.uid);
    await loadUserData();
});

async function loadUserData() {
    try {
        userData = await getCurrentUserData();
        console.log('User data loaded');
    } catch (error) {
        console.error('Error loading user data:', error);
        const errorMessage = handleFirebaseError(error);
        UIHelpers.showError(errorMessage);
    }
}

function initializeEventListeners() {
    // Shazam circle click
    if (shazamCircle) {
        shazamCircle.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // File input change
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }

    // Action buttons
    const createListingBtn = document.getElementById('createListingBtn');
    const saveToCollectionBtn = document.getElementById('saveToCollectionBtn');
    const scanAnotherBtn = document.getElementById('scanAnotherBtn');

    if (createListingBtn) {
        createListingBtn.addEventListener('click', handleCreateListing);
    }

    if (saveToCollectionBtn) {
        saveToCollectionBtn.addEventListener('click', handleSaveToCollection);
    }

    if (scanAnotherBtn) {
        scanAnotherBtn.addEventListener('click', handleScanAnother);
    }
}

async function handleFileSelection(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    console.log(`Processing ${files.length} files`);
    
    // Clear previous results
    clearPreviousResults();
    
    // Show loading immediately
    showSection('loading');
    
    try {
        // Validate file types
        const validFiles = files.filter(file => file.type.startsWith('image/'));
        if (validFiles.length === 0) {
            throw new Error('Please select valid image files (JPG, PNG, etc.)');
        }

        // Compress images automatically
        const compressedFiles = [];
        const base64Images = [];
        
        for (const file of validFiles.slice(0, 3)) { // Max 3 images
            console.log(`Compressing ${file.name}...`);
            
            try {
                const compressed = await imageCompression(file, compressionSettings);
                const base64 = await fileToBase64(compressed);
                
                compressedFiles.push(compressed);
                base64Images.push(base64);
                
                console.log(`Compressed ${file.name}: ${UIHelpers.formatFileSize(file.size)} -> ${UIHelpers.formatFileSize(compressed.size)}`);
            } catch (compressionError) {
                console.error(`Failed to compress ${file.name}:`, compressionError);
                // Continue with original file if compression fails
                const base64 = await fileToBase64(file);
                compressedFiles.push(file);
                base64Images.push(base64);
            }
        }

        uploadedImages = compressedFiles;
        
        // Start analysis with loading animation
        await analyzeWithAnimation(base64Images);
        
    } catch (error) {
        console.error('Error processing files:', error);
        UIHelpers.showError('Failed to process images: ' + error.message);
        showSection('upload');
    }
}

async function analyzeWithAnimation(base64Images) {
    try {
        // Animate through loading steps
        for (let i = 0; i < loadingMessages.length - 1; i++) {
            const message = loadingMessages[i];
            
            // Update UI
            const loadingTitle = document.getElementById('loadingTitle');
            const loadingMessage = document.getElementById('loadingMessage');
            
            if (loadingTitle) loadingTitle.textContent = message.title;
            if (loadingMessage) loadingMessage.textContent = message.message;
            
            // Update step indicators
            updateLoadingStep(message.step);
            
            // Wait for realistic timing
            await new Promise(resolve => setTimeout(resolve, i === 0 ? 500 : 1200));
        }

        // Call analysis API
        console.log('Calling analysis API with', base64Images.length, 'images');
        const result = await apiClient.analyzeImages(base64Images, {
            uid: currentUser?.uid,
            saveToFirestore: true,
            imageCount: base64Images.length,
            quality: 'balanced',
            timestamp: new Date().toISOString()
        });

        console.log('Analysis API response:', result);

        if (!result || !result.success) {
            throw new Error(result?.error || result?.message || 'Analysis failed - no response from server');
        }

        analysisData = result;

        // Show final loading step
        updateLoadingStep(4);
        const loadingTitle = document.getElementById('loadingTitle');
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingTitle) loadingTitle.textContent = loadingMessages[3].title;
        if (loadingMessage) loadingMessage.textContent = loadingMessages[3].message;
        
        await new Promise(resolve => setTimeout(resolve, 800));

        // Save to Firestore and get scan ID
        await saveScanToFirestore(result);

        // Show results
        displayResults(result);
        showSection('results');

    } catch (error) {
        console.error('Analysis error:', error);
        
        // Use enhanced error handling
        if (typeof ErrorHandler !== 'undefined') {
            const errorInfo = ErrorHandler.handleAnalysisError(error);
            ErrorHandler.showErrorWithRetry(errorInfo, () => {
                // Retry the analysis
                analyzeWithAnimation(base64Images);
            });
        } else {
            // Fallback error handling
            let errorMessage = 'Analysis failed. Please try again.';
            
            if (error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message.includes('API Error 400')) {
                errorMessage = 'Invalid image data. Please try different photos.';
            } else if (error.message.includes('API Error 429')) {
                errorMessage = 'Too many requests. Please wait a moment and try again.';
            } else if (error.message.includes('API Error 500')) {
                errorMessage = 'Server error. Please try again in a few minutes.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            UIHelpers.showError(errorMessage);
        }
        
        showSection('upload');
    }
}

function updateLoadingStep(activeStep) {
    // Reset all steps
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step${i}`);
        if (step) {
            step.classList.remove('active', 'completed');
            
            if (i < activeStep) {
                step.classList.add('completed');
            } else if (i === activeStep) {
                step.classList.add('active');
            }
        }
    }
}
 
async function saveScanToFirestore(analysisResult) {
    try {
        console.log('=== STARTING SAVE SCAN DEBUG ===');
        
        // Check if user is authenticated
        console.log('1. Checking authentication...');
        console.log('currentUser:', currentUser);
        console.log('currentUser.uid:', currentUser?.uid);
        console.log('firebase.auth().currentUser:', firebase.auth().currentUser);
        
        if (!currentUser || !currentUser.uid) {
            throw new Error('User not authenticated');
        }

        console.log('2. Authentication OK, checking Firebase instances...');
        console.log('db:', typeof db, db);
        console.log('firebase.firestore:', typeof firebase.firestore);
        console.log('firebase.storage:', typeof firebase.storage);
        
        console.log('3. Saving scan for user:', currentUser.uid);
        
        // Try a simple test write first
        console.log('4. Testing basic Firestore write...');
        try {
            const testRef = await db
                .collection('users')
                .doc(currentUser.uid)
                .collection('scans')
                .add({
                    test: true,
                    timestamp: new Date(),
                    uid: currentUser.uid
                });
            console.log('✅ Basic test write successful:', testRef.id);
            
            // Clean up test document
            await testRef.delete();
            console.log('✅ Test document deleted');
        } catch (testError) {
            console.error('❌ Basic test write failed:', testError);
            console.error('Test error code:', testError.code);
            console.error('Test error message:', testError.message);
            throw new Error(`Firestore write test failed: ${testError.message}`);
        }
        
        // Upload images to Firebase Storage
        console.log('5. Starting image upload...');
        let uploadedImageUrls = [];
        try {
            uploadedImageUrls = await uploadImagesToStorage();
            console.log('✅ Images uploaded successfully:', uploadedImageUrls.length);
        } catch (uploadError) {
            console.error('❌ Image upload failed:', uploadError);
            // Continue without images for now
            console.log('Continuing without images...');
        }
        
        // Create scan record with proper data validation
        console.log('6. Preparing scan data...');
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
            uid: currentUser.uid // Add uid field for extra security
        };
        
        console.log('7. Scan data prepared:', {
            hasAnalysis: !!scanData.analysis,
            hasRoutes: !!scanData.routes,
            imageCount: scanData.images.length,
            confidence: scanData.scanMetadata.confidence,
            uid: scanData.uid
        });
        
        // Use the correct collection path
        console.log('8. Attempting to save to Firestore...');
        const scanRef = await db
            .collection('users')
            .doc(currentUser.uid)
            .collection('scans')
            .add(scanData);
        
        currentScanId = scanRef.id;
        console.log('✅ Scan saved with ID:', currentScanId);
        
        // Update user stats
        console.log('9. Updating user stats...');
        try {
            await updateUserStats(scanData.scanMetadata.confidence);
            console.log('✅ User stats updated');
        } catch (statsError) {
            console.error('❌ User stats update failed:', statsError);
            // Don't throw, this is not critical
        }
        
        console.log('=== SAVE SCAN COMPLETED SUCCESSFULLY ===');
        return scanRef.id;
        
    } catch (error) {
        console.log('=== SAVE SCAN FAILED ===');
        console.error('Error saving scan to Firestore:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // More specific error handling
        if (error.code === 'permission-denied') {
            console.error('❌ Permission denied. Check Firestore rules and user authentication.');
            console.error('Current user:', currentUser);
            console.error('User UID:', currentUser?.uid);
        } else if (error.code === 'unauthenticated') {
            console.error('❌ User not authenticated properly');
        } else if (error.code === 'unavailable') {
            console.error('❌ Firestore service unavailable');
        }
        
        throw error;
    }
}

// Add this function to debug your authentication state
async function debugAuthentication() {
    console.log('=== DEBUGGING AUTHENTICATION ===');
    console.log('currentUser:', currentUser);
    console.log('currentUser.uid:', currentUser?.uid);
    console.log('Auth state:', firebase.auth().currentUser);
    
    if (currentUser) {
        try {
            // Test if we can read the user document
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            console.log('User document exists:', userDoc.exists);
            console.log('User document data:', userDoc.data());
            
            // Test if we can write to scans collection
            const testScan = {
                test: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                uid: currentUser.uid
            };
            
            const testRef = await db
                .collection('users')
                .doc(currentUser.uid)
                .collection('scans')
                .add(testScan);
                
            console.log('Test scan created successfully with ID:', testRef.id);
            
            // Clean up test document
            await testRef.delete();
            console.log('Test scan deleted');
            
        } catch (error) {
            console.error('Error in authentication test:', error);
        }
    } else {
        console.error('No current user found!');
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
    
    // Display images using proper gallery
    displayCardImages();
    
    // Update item details
    updateItemDetails(analysis);
    
    // Update estimated value with proper formatting
    updateEstimatedValue(routes, analysis);
    
    // Update description
    updateDescription(analysis);
    
    // Display similar items if available
    displaySimilarItems(routes);
}

function updateConfidenceBadge(analysis) {
    const confidenceBadge = document.getElementById('confidenceBadge');
    if (!confidenceBadge) return;
    
    const confidence = analysis.confidence || analysis.confidence_rating || 7;
    const percentage = Math.round(confidence * 10);
    
    confidenceBadge.textContent = `${percentage}% Confident`;
    
    // Update badge color and class based on confidence
    confidenceBadge.className = 'confidence-badge';
    
    if (confidence >= 8) {
        confidenceBadge.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
        confidenceBadge.classList.add('confidence-high');
    } else if (confidence >= 6) {
        confidenceBadge.style.background = 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)';
        confidenceBadge.classList.add('confidence-medium');
    } else {
        confidenceBadge.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
        confidenceBadge.classList.add('confidence-low');
    }
}

function displayCardImages() {
    const cardImages = document.getElementById('cardImages');
    if (!cardImages || uploadedImages.length === 0) return;
    
    // Clear existing content
    cardImages.innerHTML = '';
    
    // Create image URLs and store for cleanup
    imageUrls = uploadedImages.map(file => URL.createObjectURL(file));
    
    if (imageUrls.length === 1) {
        // Single image - simple display
        const img = document.createElement('img');
        img.src = imageUrls[0];
        img.alt = 'Scanned item';
        img.style.cssText = 'width: 100%; height: 200px; object-fit: cover; border-radius: 12px; cursor: pointer;';
        img.onclick = () => openImageModal(0);
        cardImages.appendChild(img);
    } else {
        // Multiple images - use gallery structure
        const mainContainer = document.createElement('div');
        mainContainer.className = 'main-image-container';
        
        const mainImg = document.createElement('img');
        mainImg.src = imageUrls[0];
        mainImg.alt = 'Main view';
        mainImg.className = 'main-image';
        mainImg.onclick = () => openImageModal(0);
        
        const badge = document.createElement('div');
        badge.className = 'image-count-badge';
        badge.textContent = `${imageUrls.length} photo${imageUrls.length !== 1 ? 's' : ''}`;
        
        mainContainer.appendChild(mainImg);
        mainContainer.appendChild(badge);
        cardImages.appendChild(mainContainer);
        
        // Add thumbnail strip if more than one image
        if (imageUrls.length > 1) {
            const thumbnailStrip = document.createElement('div');
            thumbnailStrip.className = 'thumbnail-strip';
            
            imageUrls.forEach((url, index) => {
                const thumbDiv = document.createElement('div');
                thumbDiv.className = `thumbnail-item ${index === 0 ? 'active' : ''}`;
                
                const thumbImg = document.createElement('img');
                thumbImg.src = url;
                thumbImg.alt = `View ${index + 1}`;
                thumbImg.onclick = () => switchMainImage(index);
                
                thumbDiv.appendChild(thumbImg);
                thumbnailStrip.appendChild(thumbDiv);
            });
            
            cardImages.appendChild(thumbnailStrip);
        }
    }
}

function switchMainImage(index) {
    if (index < 0 || index >= imageUrls.length) return;
    
    const mainImg = document.querySelector('.main-image');
    if (mainImg) {
        mainImg.src = imageUrls[index];
    }
    
    // Update active thumbnail
    document.querySelectorAll('.thumbnail-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
}

function openImageModal(index) {
    // Simple modal implementation
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

function updateItemDetails(analysis) {
    // Item title
    const itemTitle = document.getElementById('itemTitle');
    const title = generateItemTitle(analysis);
    if (itemTitle) itemTitle.textContent = title;
    
    // Item details
    updateItemDetail('itemCondition', formatCondition(analysis.condition));
    updateItemDetail('itemCategory', analysis.category || 'Unknown');
    updateItemDetail('itemBrand', analysis.brand || 'Unbranded');
}

function updateEstimatedValue(routes, analysis) {
    const estimatedValue = document.getElementById('estimatedValue');
    if (!estimatedValue) return;
    
    const price = getEstimatedPrice(routes, analysis);
    
    // Format as currency
    let formattedPrice = price;
    if (typeof price === 'string' && price.startsWith('$')) {
        formattedPrice = price;
    } else {
        const numPrice = parseFloat(price);
        formattedPrice = isNaN(numPrice) ? '$25' : `$${numPrice.toFixed(0)}`;
    }
    
    estimatedValue.textContent = formattedPrice;
}

function updateDescription(analysis) {
    const itemDescription = document.getElementById('itemDescription');
    if (!itemDescription) return;
    
    const description = generateDescription(analysis);
    itemDescription.textContent = description;
}

function generateItemTitle(analysis) {
    const parts = [];
    
    if (analysis.brand && analysis.brand !== 'Unknown') {
        parts.push(analysis.brand);
    }
    
    if (analysis.model && analysis.model !== 'Unknown') {
        parts.push(analysis.model);
    } else if (analysis.category) {
        parts.push(analysis.category);
    }
    
    if (parts.length === 0) {
        parts.push('Item for Sale');
    }
    
    return parts.join(' ');
}

function getEstimatedPrice(routes, analysis) {
    // Try multiple sources for price
    if (routes?.marketAnalysis?.estimatedValue?.suggested) {
        return routes.marketAnalysis.estimatedValue.suggested;
    }
    if (analysis?.resale?.estimated_value) {
        return analysis.resale.estimated_value;
    }
    if (analysis?.resale?.priceRange?.low) {
        return analysis.resale.priceRange.low;
    }
    if (analysis?.price) {
        return analysis.price;
    }
    return '25';
}

function formatCondition(condition) {
    if (!condition) return 'Good';
    
    if (typeof condition === 'object') {
        return condition.rating || condition.description || 'Good';
    }
    
    return condition;
}

function generateDescription(analysis) {
    const parts = [];
    
    if (analysis.condition?.description) {
        parts.push(analysis.condition.description);
    }
    
    if (analysis.keyFeatures && analysis.keyFeatures.length > 0) {
        parts.push(`Key features: ${analysis.keyFeatures.join(', ')}`);
    }
    
    if (analysis.materials && analysis.materials.length > 0) {
        parts.push(`Materials: ${analysis.materials.join(', ')}`);
    }
    
    if (parts.length === 0) {
        parts.push('Item appears to be in good condition. Please see photos for details.');
    }
    
    return parts.join('. ');
}

function updateItemDetail(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function displaySimilarItems(routes) {
    const similarItems = document.getElementById('similarItems');
    
    // Check if we have similar items data
    const comparableItems = routes?.marketAnalysis?.comparableItems || [];
    const similarListings = routes?.marketAnalysis?.similarListings || [];
    
    if (comparableItems.length === 0 && similarListings.length === 0) {
        if (similarItems) {
            similarItems.style.display = 'none';
        }
        return;
    }
    
    // For now, hide similar items section as it needs more complex implementation
    if (similarItems) {
        similarItems.style.display = 'none';
    }
}

// Action Handlers 


async function handleCreateListing() {
    if (!analysisData || !currentScanId) {
        UIHelpers.showError('No analysis data available');
        return;
    }
    
    try {
        // Check if user has eBay connected
        if (!userData?.ebay?.isConnected) {
            showEbayConnectionPrompt();
            return;
        }
        
        // Show inline editing interface
        showInlineListingEditor();
        
    } catch (error) {
        console.error('Error preparing listing:', error);
        UIHelpers.showError('Failed to prepare listing: ' + error.message);
    }
}

function showInlineListingEditor() {
    const analysis = analysisData.analysis || {};
    const routes = analysisData.routes || {};
    
    // Generate initial values
    const initialTitle = generateItemTitle(analysis);
    const initialPrice = getNumericPrice(getEstimatedPrice(routes, analysis));
    const initialDescription = generateDescription(analysis);
    const initialCondition = analysis.condition?.rating || 'good';
    const initialCategory = analysis.category || 'Electronics';
    
    // Create inline editor HTML
    const editorHTML = `
        <div class="inline-listing-editor" style="
            background: white;
            border: 2px solid #667eea;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        ">
            <h3 style="margin: 0 0 20px 0; color: #333;">Review Your eBay Listing</h3>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                    Title (Max 80 characters):
                </label>
                <input type="text" id="inlineTitle" maxlength="80" value="${initialTitle}" style="
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    box-sizing: border-box;
                ">
                <div style="text-align: right; font-size: 12px; color: #666; margin-top: 4px;">
                    <span id="titleCharCount">${initialTitle.length}</span>/80
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div>
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                        Starting Price ($):
                    </label>
                    <input type="number" id="inlineStartPrice" min="0.99" step="0.01" 
                           value="${Math.max(0.99, initialPrice * 0.8).toFixed(2)}" style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        box-sizing: border-box;
                    ">
                </div>
                
                <div>
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                        Buy It Now ($):
                    </label>
                    <input type="number" id="inlineBuyItNow" min="0.99" step="0.01" 
                           value="${initialPrice.toFixed(2)}" style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        box-sizing: border-box;
                    ">
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div>
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                        Condition:
                    </label>
                    <select id="inlineCondition" style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        box-sizing: border-box;
                    ">
                        <option value="new" ${initialCondition === 'new' ? 'selected' : ''}>New</option>
                        <option value="like_new" ${initialCondition === 'like_new' ? 'selected' : ''}>Like New</option>
                        <option value="excellent" ${initialCondition === 'excellent' ? 'selected' : ''}>Excellent</option>
                        <option value="very_good" ${initialCondition === 'very_good' ? 'selected' : ''}>Very Good</option>
                        <option value="good" ${initialCondition === 'good' ? 'selected' : ''}>Good</option>
                        <option value="acceptable" ${initialCondition === 'acceptable' ? 'selected' : ''}>Acceptable</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                        Category:
                    </label>
                    <input type="text" id="inlineCategory" value="${initialCategory}" style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        box-sizing: border-box;
                    ">
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                    Description:
                </label>
                <textarea id="inlineDescription" rows="4" style="
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    box-sizing: border-box;
                    resize: vertical;
                ">${initialDescription}</textarea>
            </div>
            
            <div style="
                background: #f0f4ff;
                padding: 16px;
                border-radius: 8px;
                margin-bottom: 20px;
            ">
                <h4 style="margin: 0 0 12px 0; color: #333;">Profit Estimate</h4>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Sale Price:</span>
                    <span id="profitSalePrice">$${initialPrice.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>eBay Fees (13.25%):</span>
                    <span id="profitFees">$${(initialPrice * 0.1325).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 600; border-top: 1px solid #ddd; padding-top: 8px;">
                    <span>Your Profit:</span>
                    <span id="profitTotal" style="color: #2e7d32;">$${(initialPrice * 0.8675).toFixed(2)}</span>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button id="cancelListingBtn" style="
                    flex: 1;
                    padding: 12px 24px;
                    background: #f5f5f5;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                ">Cancel</button>
                
                <button id="confirmListingBtn" style="
                    flex: 2;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                ">Create eBay Listing</button>
            </div>
        </div>
    `;
    
    // Insert editor after the results section
    const resultsSection = document.getElementById('resultsSection');
    const editorDiv = document.createElement('div');
    editorDiv.innerHTML = editorHTML;
    resultsSection.appendChild(editorDiv);
    
    // Add event listeners
    setupInlineEditorListeners();
    
    // Scroll to editor
    editorDiv.scrollIntoView({ behavior: 'smooth' });
}

function setupInlineEditorListeners() {
    // Title character counter
    const titleInput = document.getElementById('inlineTitle');
    const charCount = document.getElementById('titleCharCount');
    
    titleInput.addEventListener('input', () => {
        const length = titleInput.value.length;
        charCount.textContent = length;
        charCount.style.color = length > 75 ? '#f44336' : length > 60 ? '#ff9800' : '#4caf50';
    });
    
    // Price change listeners for profit calculation
    const startPriceInput = document.getElementById('inlineStartPrice');
    const buyItNowInput = document.getElementById('inlineBuyItNow');
    
    const updateProfitCalc = () => {
        const salePrice = parseFloat(buyItNowInput.value) || 0;
        const fees = salePrice * 0.1325;
        const profit = salePrice - fees;
        
        document.getElementById('profitSalePrice').textContent = `$${salePrice.toFixed(2)}`;
        document.getElementById('profitFees').textContent = `$${fees.toFixed(2)}`;
        document.getElementById('profitTotal').textContent = `$${Math.max(0, profit).toFixed(2)}`;
    };
    
    startPriceInput.addEventListener('input', updateProfitCalc);
    buyItNowInput.addEventListener('input', updateProfitCalc);
    
    // Cancel button
    document.getElementById('cancelListingBtn').addEventListener('click', () => {
        const editor = document.querySelector('.inline-listing-editor');
        if (editor) {
            editor.remove();
        }
    });
    
    // Confirm button
    document.getElementById('confirmListingBtn').addEventListener('click', handleConfirmListing);
}

async function handleConfirmListing() {
    const confirmBtn = document.getElementById('confirmListingBtn');
    const originalText = confirmBtn.textContent;
    
    try {
        // Show loading state
        confirmBtn.textContent = 'Creating...';
        confirmBtn.disabled = true;
        
        // Collect form data
        const listingData = {
            scanId: currentScanId,
            title: document.getElementById('inlineTitle').value,
            description: document.getElementById('inlineDescription').value,
            category: document.getElementById('inlineCategory').value,
            condition: document.getElementById('inlineCondition').value,
            brand: analysisData.analysis?.brand || 'Unbranded',
            model: analysisData.analysis?.model || 'See Description',
            images: [], // Will be populated with Firebase Storage URLs
            pricing: {
                buyItNowPrice: parseFloat(document.getElementById('inlineBuyItNow').value),
                startingPrice: parseFloat(document.getElementById('inlineStartPrice').value),
                acceptOffers: true
            }
        };
        
        console.log('Creating eBay listing with data:', listingData);
        
        // Create eBay listing
        const result = await apiClient.createEbayListing(listingData);
        
        if (result.success) {
            // Update scan status
            await updateScanStatus('listed', { 
                ebayListingId: result.listingId,
                ebayUrl: result.url,
                listingData: listingData
            });
            
            // Remove editor
            const editor = document.querySelector('.inline-listing-editor');
            if (editor) {
                editor.remove();
            }
            
            // Show success message
            UIHelpers.showSuccess(`🎉 eBay listing created successfully! <a href="${result.url}" target="_blank" style="color: #2e7d32; text-decoration: underline;">View on eBay</a>`);
            
        } else {
            throw new Error(result.error || 'Failed to create listing');
        }
        
    } catch (error) {
        console.error('Create listing error:', error);
        UIHelpers.showError('Failed to create listing: ' + error.message);
        
        // Reset button
        confirmBtn.textContent = originalText;
        confirmBtn.disabled = false;
    }
}

// New function to handle the actual eBay listing creation
async function createEbayListingWithBackend(listingData) {
    try {
        console.log('Creating eBay listing with final data:', listingData);
        
        // Upload images to Firebase Storage first (convert object URLs to storage URLs)
        const uploadedImageUrls = await uploadImagesToStorage();
        
        // Prepare final listing data with Firebase Storage URLs
        const ebayListingData = {
            scanId: currentScanId,
            title: listingData.title,
            description: listingData.description,
            category: listingData.category,
            condition: listingData.condition,
            brand: listingData.brand || 'Unbranded',
            model: listingData.model || 'See Description',
            images: uploadedImageUrls, // Use Firebase Storage URLs for eBay
            pricing: {
                buyItNowPrice: listingData.pricing.buyItNow,
                startingPrice: listingData.pricing.starting,
                acceptOffers: listingData.pricing.acceptOffers
            },
            shipping: listingData.shipping
        };
        
        console.log('Calling eBay API with backend data:', ebayListingData);
        
        // Create eBay listing using existing API client
        const result = await apiClient.createEbayListing(ebayListingData);
        
        if (result.success) {
            // Update scan status in Firestore
            await updateScanStatus('listed', { 
                ebayListingId: result.listingId,
                ebayUrl: result.url,
                listingData: ebayListingData
            });
            
            // Show success message with eBay link
            showListingSuccessMessage(result);
            
        } else {
            throw new Error(result.error || 'Failed to create listing');
        }
        
    } catch (error) {
        console.error('Create listing error:', error);
        
        // Enhanced error handling
        if (typeof ErrorHandler !== 'undefined') {
            const errorInfo = ErrorHandler.handleEbayError(error);
            ErrorHandler.showErrorWithRetry(errorInfo, () => {
                // Retry callback - show the modal again
                handleCreateListing();
            });
        } else {
            // Fallback error handling
            let errorMessage = 'Failed to create listing: ' + error.message;
            
            if (error.message.includes('authentication') || error.message.includes('token')) {
                errorMessage = 'eBay authentication error. Please reconnect your eBay account.';
            } else if (error.message.includes('category')) {
                errorMessage = 'Invalid category. Please try selecting a different category.';
            } else if (error.message.includes('policy')) {
                errorMessage = 'eBay seller policies not configured. Please set up your policies on eBay.com first.';
            }
            
            UIHelpers.showError(errorMessage);
        }
        
        // Re-throw to let modal handle loading state
        throw error;
    }
}
// Function to show success message with eBay link and stats
function showListingSuccessMessage(result) {
    const successHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
            <h3 style="color: #2e7d32; margin-bottom: 16px;">Listing Created Successfully!</h3>
            <p style="margin-bottom: 20px; color: #666;">
                Your item is now live on eBay and ready for buyers to discover.
            </p>
            <div style="background: #e8f5e9; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <div style="font-weight: 600; color: #2e7d32; margin-bottom: 8px;">
                    eBay Item #${result.listingId}
                </div>
                <a href="${result.url}" target="_blank" 
                   style="color: #1976d2; text-decoration: none; font-weight: 500;">
                    View Your Listing on eBay →
                </a>
            </div>
            <p style="font-size: 14px; color: #666;">
                You'll be redirected to your dashboard in a few seconds...
            </p>
        </div>
    `;
    
    // Create and show success modal
    const successModal = document.createElement('div');
    successModal.className = 'success-modal-overlay active';
    successModal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8); z-index: 10001;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
    `;
    
    const successContent = document.createElement('div');
    successContent.style.cssText = `
        background: white; border-radius: 16px; max-width: 500px; width: 100%;
        box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    `;
    successContent.innerHTML = successHTML;
    
    successModal.appendChild(successContent);
    document.body.appendChild(successModal);
    
    // Auto-redirect after 5 seconds
    setTimeout(() => {
        successModal.remove();
        window.location.href = '/dashboard.html?success=listing_created';
    }, 5000);
    
    // Allow manual close
    successModal.addEventListener('click', (e) => {
        if (e.target === successModal) {
            successModal.remove();
            window.location.href = '/dashboard.html?success=listing_created';
        }
    });
}

// Helper function to calculate shipping cost based on category
function calculateShippingCost(category) {
    const shippingRates = {
        'electronics': 12,
        'clothing': 6,
        'furniture': 25,
        'tools': 15,
        'automotive': 20,
        'sporting goods': 18,
        'books': 4,
        'toys': 8,
        'jewelry': 5,
        'collectibles': 10,
        'home': 15,
        'garden': 20
    };
    
    const categoryLower = category?.toLowerCase() || '';
    
    // Check for partial matches
    for (const [cat, rate] of Object.entries(shippingRates)) {
        if (categoryLower.includes(cat)) {
            return rate;
        }
    }
    
    return 8; // Default shipping cost
}


async function handleSaveToCollection() {
    if (!currentScanId) {
        UIHelpers.showError('No scan data to save');
        return;
    }
    
    try {
        // Update scan status to saved
        await updateScanStatus('saved');
        
        UIHelpers.showSuccess('Item saved to your collection!');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Save to collection error:', error);
        UIHelpers.showError('Failed to save item');
    }
}

function handleScanAnother() {
    // Clean up image URLs to prevent memory leaks
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
    
    // Show upload section
    showSection('upload');
}

function clearPreviousResults() {
    // Clear any error/success messages
    UIHelpers.clearMessages();
    
    // Reset card content
    const cardImages = document.getElementById('cardImages');
    if (cardImages) {
        cardImages.innerHTML = '';
    }
    
    // Clean up any existing object URLs
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
    const modal = UIHelpers.createModal(
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

// Section Management
function showSection(section) {
    // Hide all sections
    if (uploadSection) uploadSection.style.display = 'none';
    if (loadingSection) loadingSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    
    // Show requested section
    switch (section) {
        case 'upload':
            if (uploadSection) uploadSection.style.display = 'block';
            break;
        case 'loading':
            if (loadingSection) loadingSection.style.display = 'block';
            break;
        case 'results':
            if (resultsSection) resultsSection.style.display = 'block';
            break;
    }
}

// Utility Functions
function getNumericPrice(priceValue) {
    if (typeof priceValue === 'number') {
        return priceValue;
    }
    
    if (typeof priceValue === 'string') {
        // Remove currency symbols and extract number
        const numStr = priceValue.replace(/[^0-9.]/g, '');
        const num = parseFloat(numStr);
        return isNaN(num) ? 25 : num;
    }
    
    return 25; // fallback
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

// Global functions for modal buttons and external access

window.handleCreateListing = handleCreateListing;
window.createEbayListingWithBackend = createEbayListingWithBackend;
window.handleSaveToCollection = handleSaveToCollection;
window.switchMainImage = switchMainImage;
window.openImageModal = openImageModal;

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    imageUrls.forEach(url => URL.revokeObjectURL(url));
});