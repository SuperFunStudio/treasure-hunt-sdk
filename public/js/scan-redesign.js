// js/scan-redesign.js
// Streamlined scan interface based on sketches

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

// Category colors for animation
const categoryColors = {
    'electronics': '#2196f3',
    'furniture': '#8b4513',
    'clothing': '#e91e63',
    'tools': '#ff9800',
    'collectibles': '#9c27b0',
    'books': '#4caf50',
    'jewelry': '#ffc107',
    'automotive': '#607d8b',
    'sports': '#00bcd4',
    'home': '#795548'
};

// DOM elements
const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const uploadCircle = document.getElementById('uploadCircle');
const fileInput = document.getElementById('fileInput');
const exploreNearbyBtn = document.getElementById('exploreNearbyBtn');

console.log('Redesigned scan interface loaded');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkRequiredAPIs();
});

// Check for required APIs
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
            fileInput.click();
        });
    }

    // File input change
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
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

    if (listOnEbayBtn) {
        listOnEbayBtn.addEventListener('click', handleListOnEbay);
    }

    if (saveToCollectionBtn) {
        saveToCollectionBtn.addEventListener('click', handleSaveToCollection);
    }

    if (scanAnotherBtn) {
        scanAnotherBtn.addEventListener('click', handleScanAnother);
    }

    // Inline editing listeners
    setupInlineEditingListeners();
}

function setupInlineEditingListeners() {
    // Price input changes
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

    // List on eBay button shows pricing section
    const listBtn = document.getElementById('listOnEbayBtn');
    if (listBtn) {
        listBtn.addEventListener('click', () => {
            const pricingSection = document.getElementById('pricingSection');
            if (pricingSection) {
                pricingSection.style.display = 'block';
                pricingSection.scrollIntoView({ behavior: 'smooth' });
                listBtn.textContent = '🚀 Create eBay Listing';
                listBtn.onclick = handleListOnEbay;
            }
        });
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
                const base64 = await fileToBase64(file);
                compressedFiles.push(file);
                base64Images.push(base64);
            }
        }

        uploadedImages = compressedFiles;
        
        // Start analysis with progress animation
        await analyzeWithProgressAnimation(base64Images);
        
    } catch (error) {
        console.error('Error processing files:', error);
        UIHelpers.showError('Failed to process images: ' + error.message);
        showSection('upload');
    }
}

async function analyzeWithProgressAnimation(base64Images) {
    try {
        // Start progress animation
        animateProgress();
        
        // Animate category dots
        animateCategoryDots();
        
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

        // Complete progress
        completeProgress();
        
        // Brief pause before showing results
        await new Promise(resolve => setTimeout(resolve, 800));

        // Save to Firestore and get scan ID
        await saveScanToFirestore(result);

        // Show results
        displayResults(result);
        showSection('results');

    } catch (error) {
        console.error('Analysis error:', error);
        
        if (typeof ErrorHandler !== 'undefined') {
            const errorInfo = ErrorHandler.handleAnalysisError(error);
            ErrorHandler.showErrorWithRetry(errorInfo, () => {
                analyzeWithProgressAnimation(base64Images);
            });
        } else {
            UIHelpers.showError('Analysis failed: ' + error.message);
        }
        
        showSection('upload');
    }
}

function animateProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (!progressFill || !progressText) return;
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90; // Don't complete until analysis is done
        
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    }, 300);
    
    // Store interval for cleanup
    window.progressInterval = interval;
}

function completeProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
    }
    
    if (progressFill && progressText) {
        progressFill.style.width = '100%';
        progressText.textContent = '100%';
    }
}

function animateCategoryDots() {
    const categoryDots = document.querySelectorAll('.category-dot');
    let currentIndex = 0;
    
    const animateNext = () => {
        // Reset all dots
        categoryDots.forEach(dot => dot.classList.remove('active'));
        
        // Activate current dot
        if (categoryDots[currentIndex]) {
            categoryDots[currentIndex].classList.add('active');
        }
        
        currentIndex = (currentIndex + 1) % categoryDots.length;
    };
    
    // Start animation
    const interval = setInterval(animateNext, 800);
    
    // Store interval for cleanup
    window.categoryInterval = interval;
    
    // Stop after analysis completes
    setTimeout(() => {
        if (window.categoryInterval) {
            clearInterval(window.categoryInterval);
        }
    }, 10000);
}

async function saveScanToFirestore(analysisResult) {
    try {
        console.log('Saving scan to Firestore...');
        
        if (!currentUser || !currentUser.uid) {
            throw new Error('User not authenticated');
        }
        
        // Upload images to Firebase Storage
        let uploadedImageUrls = [];
        try {
            uploadedImageUrls = await uploadImagesToStorage();
            console.log('Images uploaded successfully:', uploadedImageUrls.length);
        } catch (uploadError) {
            console.error('Image upload failed:', uploadError);
        }
        
        // Create scan record
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
        
        // Update user stats
        await updateUserStats(scanData.scanMetadata.confidence);
        
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
    
    // Update item details
    updateItemDetails(analysis);
    
    // Update estimated value
    updateEstimatedValue(routes, analysis);
    
    // Update description
    updateDescription(analysis);
    
    // Setup pricing defaults
    setupPricingDefaults(routes, analysis);
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
        itemCategory.value = analysis.category || 'Electronics';
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

async function handleListOnEbay() {
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
        
        // Collect listing data
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
        
        // Show loading state
        const btn = document.getElementById('listOnEbayBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Creating...';
        btn.disabled = true;
        
        // Create eBay listing
        const result = await apiClient.createEbayListing(listingData);
        
        if (result.success) {
            await updateScanStatus('listed', { 
                ebayListingId: result.listingId,
                ebayUrl: result.url,
                listingData: listingData
            });
            
            UIHelpers.showSuccess(`🎉 eBay listing created successfully! <a href="${result.url}" target="_blank" style="color: #2e7d32; text-decoration: underline;">View on eBay</a>`);
            
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 3000);
            
        } else {
            throw new Error(result.error || 'Failed to create listing');
        }
        
    } catch (error) {
        console.error('Error creating eBay listing:', error);
        UIHelpers.showError('Failed to create listing: ' + error.message);
        
        const btn = document.getElementById('listOnEbayBtn');
        btn.textContent = '🛒 List on eBay';
        btn.disabled = false;
    }
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
    
    // Show upload section
    showSection('upload');
}

function clearPreviousResults() {
    UIHelpers.clearMessages();
    
    const cardImage = document.getElementById('cardImage');
    if (cardImage) {
        cardImage.innerHTML = '';
    }
    
    imageUrls.forEach(url => URL.revokeObjectURL(url));
    imageUrls = [];
    
    // Clean up intervals
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
    }
    if (window.categoryInterval) {
        clearInterval(window.categoryInterval);
    }
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

// Utility Functions
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
    
    return parts.join(' ').substring(0, 60);
}

function getEstimatedPrice(routes, analysis) {
    if (routes?.marketAnalysis?.estimatedValue?.suggested) {
        return routes.marketAnalysis.estimatedValue.suggested;
    }
    if (analysis?.resale?.estimated_value) {
        return analysis.resale.estimated_value;
    }
    if (analysis?.price) {
        return analysis.price;
    }
    return '25';
}

function generateDescription(analysis) {
    const parts = [];
    
    if (analysis.condition?.description) {
        parts.push(analysis.condition.description);
    }
    
    if (analysis.keyFeatures && analysis.keyFeatures.length > 0) {
        parts.push(`Key features: ${analysis.keyFeatures.join(', ')}`);
    }
    
    if (parts.length === 0) {
        parts.push('Item appears to be in good condition. Please see photos for details.');
    }
    
    return parts.join('. ');
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

// Global functions for modal buttons
window.handleSaveToCollection = handleSaveToCollection;

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    imageUrls.forEach(url => URL.revokeObjectURL(url));
    if (window.progressInterval) clearInterval(window.progressInterval);
    if (window.categoryInterval) clearInterval(window.categoryInterval);
});