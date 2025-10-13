// js/scan-editor.js
// Enhanced scan editor functionality with marketplace integration

// State variables
let currentUser = null;
let userData = null;
let selectedFiles = [];
let compressedFiles = [];
let base64Images = [];
let currentScanId = null;
let analysisData = null;

// DOM element references
const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const shazamCircle = document.getElementById('shazamCircle');
const fileInput = document.getElementById('fileInput');

console.log('Enhanced scan editor loaded');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Scan Editor initialized');
    initializeEventListeners();
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
    const viewMoreSimilarBtn = document.getElementById('viewMoreSimilarBtn');

    if (createListingBtn) {
        createListingBtn.addEventListener('click', handleCreateListing);
    }

    if (saveToCollectionBtn) {
        saveToCollectionBtn.addEventListener('click', handleSaveToCollection);
    }

    if (scanAnotherBtn) {
        scanAnotherBtn.addEventListener('click', handleScanAnother);
    }

    if (viewMoreSimilarBtn) {
        viewMoreSimilarBtn.addEventListener('click', handleViewMoreSimilar);
    }
}

async function handleFileSelection(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    console.log(`Processing ${files.length} files`);
    
    // Show loading immediately
    showSection('loading');
    updateLoadingStep(1, 'Processing images...');

    try {
        await processImages(files);
        updateLoadingStep(2, 'Identifying item...');
        
        await performAnalysis();
        updateLoadingStep(4, 'Complete!');
        
        // Small delay for UX
        setTimeout(() => {
            showSection('results');
        }, 500);

    } catch (error) {
        console.error('File processing error:', error);
        UIHelpers.showError(`Processing failed: ${error.message}`);
        showSection('upload');
    }
}

async function processImages(files) {
    selectedFiles = Array.from(files).slice(0, 3);
    compressedFiles = [];
    base64Images = [];
    
    for (const file of selectedFiles) {
        try {
            // Compress image
            const compressedFile = await imageCompression(file, {
                maxSizeMB: 0.8,
                maxWidthOrHeight: 1200,
                quality: 0.9
            });
            
            compressedFiles.push(compressedFile);
            
            // Convert to base64
            const base64 = await fileToBase64(compressedFile);
            base64Images.push(base64.split(',')[1]);
            
        } catch (error) {
            console.error('Error processing image:', error);
            throw new Error(`Image processing failed: ${error.message}`);
        }
    }
    
    console.log(`Processed ${base64Images.length} images`);
}

async function performAnalysis() {
    if (base64Images.length === 0) {
        throw new Error('No images to analyze');
    }

    updateLoadingStep(3, 'Checking market prices...');

    try {
        const analysisResult = await apiClient.analyzeImages(base64Images);
        
        if (!analysisResult.success) {
            throw new Error(analysisResult.message || 'Analysis failed');
        }

        analysisData = analysisResult;
        console.log('Analysis completed:', analysisData);
        
        // Display results
        displayAnalysisResults(analysisData);

    } catch (error) {
        console.error('Analysis error:', error);
        throw new Error(`Analysis failed: ${error.message}`);
    }
}

function displayAnalysisResults(data) {
    console.log('Displaying enhanced analysis results:', data);
    
    const analysis = data.analysis || {};
    const routes = data.routes || {};
    
    // Display main item info
    displayItemInfo(analysis);
    
    // Display market analysis panel
    if (routes.marketAnalysis) {
        displayMarketAnalysis(routes.marketAnalysis);
    }
    
    // Display similar items
    displaySimilarItems(routes);
    
    // Display confidence
    updateConfidenceBadge(analysis.confidence || analysis.confidence_rating || 5);
    
    // Display uploaded images
    displayCardImages();
}

function displayItemInfo(analysis) {
    const itemTitle = document.getElementById('itemTitle');
    const itemCondition = document.getElementById('itemCondition');
    const itemCategory = document.getElementById('itemCategory');
    const itemBrand = document.getElementById('itemBrand');
    const itemDescription = document.getElementById('itemDescription');
    const estimatedValue = document.getElementById('estimatedValue');

    if (itemTitle) {
        itemTitle.textContent = generateItemTitle(analysis);
    }
    
    if (itemCondition) {
        itemCondition.textContent = formatCondition(analysis.condition);
    }
    
    if (itemCategory) {
        itemCategory.textContent = analysis.category || 'Unknown';
    }
    
    if (itemBrand) {
        itemBrand.textContent = analysis.brand || 'Unknown';
    }
    
    if (itemDescription) {
        itemDescription.textContent = generateDescription(analysis);
    }
    
    if (estimatedValue) {
        const price = getEstimatedPrice(analysisData.routes, analysis);
        estimatedValue.textContent = `$${price}`;
    }
}

function displayMarketAnalysis(marketAnalysis) {
    console.log('Displaying market analysis:', marketAnalysis);
    
    const panel = document.getElementById('marketAnalysisPanel');
    const content = document.getElementById('analysisContent');
    const dataSource = document.getElementById('dataSource');
    const searchInfo = document.getElementById('searchInfo');
    const searchQuery = document.getElementById('searchQuery');
    
    if (!panel || !content) return;
    
    const ev = marketAnalysis.estimatedValue || {};
    
    // Debug log the market analysis structure
    console.log('Market analysis structure:', {
        estimatedValue: ev,
        hasEbayData: !!marketAnalysis.ebaySearchResults,
        hasItems: !!marketAnalysis.items,
        hasComparables: !!marketAnalysis.comparableItems,
        hasRawData: !!marketAnalysis.rawEbayData,
        keys: Object.keys(marketAnalysis)
    });
    
    // Show the panel
    panel.style.display = 'block';
    
    // Update data source
    if (dataSource) {
        const source = ev.source || 'fallback';
        const isEbaySource = source.toLowerCase().includes('ebay');
        const sampleSize = ev.sampleSize;
        
        let sourceText = `Data source: ${source.charAt(0).toUpperCase() + source.slice(1)}`;
        if (sampleSize && isEbaySource) {
            sourceText += ` (${sampleSize} items analyzed)`;
        }
        
        dataSource.textContent = sourceText;
        
        // Style based on source quality
        if (isEbaySource) {
            dataSource.style.background = '#e8f5e9';
            dataSource.style.color = '#2e7d32';
            dataSource.style.borderColor = '#4caf50';
        } else {
            dataSource.style.background = '#fff3e0';
            dataSource.style.color = '#f57c00';
            dataSource.style.borderColor = '#ff9800';
        }
    }
    
    // Build analysis content
    const analysisRows = [];
    
    if (ev.suggested) {
        analysisRows.push({
            label: 'Suggested Price:',
            value: `${ev.suggested}`,
            valueClass: 'price-highlight'
        });
    }
    
    if (ev.confidence) {
        const confidence = ev.confidence.charAt(0).toUpperCase() + ev.confidence.slice(1);
        analysisRows.push({
            label: 'Confidence:',
            value: confidence,
            valueClass: getConfidenceClass(ev.confidence)
        });
    }
    
    if (ev.netProfit !== undefined) {
        analysisRows.push({
            label: 'Est. Net Profit:',
            value: `${ev.netProfit.toFixed(2)}`,
            valueClass: ev.netProfit > 0 ? 'profit-positive' : 'profit-negative'
        });
    }
    
    if (ev.sampleSize && ev.sampleSize > 0) {
        analysisRows.push({
            label: 'Market Data:',
            value: `${ev.sampleSize} eBay listings`,
            valueClass: 'comparables-count'
        });
    } else if (marketAnalysis.comparableItems?.length > 0) {
        analysisRows.push({
            label: 'Comparables Found:',
            value: `${marketAnalysis.comparableItems.length} items`,
            valueClass: 'comparables-count'
        });
    }
    
    // Render analysis rows
    content.innerHTML = analysisRows.map(row => `
        <div class="analysis-row">
            <span class="label">${row.label}</span>
            <span class="value ${row.valueClass || ''}">${row.value}</span>
        </div>
    `).join('');
    
    // Show search query if available
    if (ev.searchQuery && searchInfo && searchQuery) {
        searchQuery.textContent = ev.searchQuery;
        searchInfo.style.display = 'block';
    }
}

function displaySimilarItems(routes) {
    const similarItems = document.getElementById('similarItems');
    const similarGrid = document.getElementById('similarGrid');
    const similarCount = document.getElementById('similarCount');
    
    if (!similarItems || !similarGrid) return;
    
    // Get similar items from various sources in the routes data
    const comparableItems = routes?.marketAnalysis?.comparableItems || [];
    const similarListings = routes?.marketAnalysis?.similarListings || [];
    const relatedItems = routes?.marketAnalysis?.relatedItems || [];
    
    // Combine all similar items sources
    let allSimilarItems = [
        ...comparableItems,
        ...similarListings,
        ...relatedItems
    ];
    
    // Remove duplicates based on title or URL
    allSimilarItems = allSimilarItems.filter((item, index, self) => 
        index === self.findIndex(i => i.title === item.title || i.url === item.url)
    );
    
    // Limit to top 6 items for display
    allSimilarItems = allSimilarItems.slice(0, 6);
    
    console.log('Similar items to display:', allSimilarItems);
    
    if (allSimilarItems.length === 0) {
        // Hide similar items section if no data
        similarItems.style.display = 'none';
        return;
    }
    
    // Show similar items section
    similarItems.style.display = 'block';
    
    // Update count
    if (similarCount) {
        similarCount.textContent = `Found ${allSimilarItems.length} similar item${allSimilarItems.length !== 1 ? 's' : ''}`;
    }
    
    // Clear and populate grid
    similarGrid.innerHTML = '';
    
    allSimilarItems.forEach((item, index) => {
        const similarItemEl = createSimilarItemElement(item, index);
        similarGrid.appendChild(similarItemEl);
    });
}

function createSimilarItemElement(item, index) {
    const div = document.createElement('div');
    div.className = 'similar-item';
    div.setAttribute('data-url', item.url || '#');
    div.setAttribute('data-index', index);
    
    // Format price
    const price = formatPrice(item.price || item.currentPrice || item.buyItNowPrice);
    const condition = item.condition || item.itemCondition || 'Used';
    const title = item.title || item.name || `Similar Item ${index + 1}`;
    const imageUrl = item.image || item.imageUrl || item.galleryURL;
    
    div.innerHTML = `
        <div class="similar-item-source">eBay</div>
        <div class="similar-item-image">
            ${imageUrl ? 
                `<img src="${imageUrl}" alt="${title}" loading="lazy">` : 
                `<div class="placeholder">📷</div>`
            }
        </div>
        <div class="similar-item-title">${truncateTitle(title, 40)}</div>
        <div class="similar-item-price">${price}</div>
        <div class="similar-item-condition">${condition}</div>
    `;
    
    // Add click handler to open eBay listing
    div.addEventListener('click', () => {
        const url = div.getAttribute('data-url');
        if (url && url !== '#') {
            window.open(url, '_blank');
        }
    });
    
    return div;
}

function displayCardImages() {
    const cardImages = document.getElementById('cardImages');
    if (!cardImages || base64Images.length === 0) return;
    
    // Show first image as primary
    const primaryImage = base64Images[0];
    cardImages.innerHTML = `
        <img src="data:image/jpeg;base64,${primaryImage}" alt="Scanned item" />
    `;
}

function updateConfidenceBadge(confidence) {
    const badge = document.getElementById('confidenceBadge');
    if (!badge) return;
    
    const confidenceNum = typeof confidence === 'number' ? confidence : 5;
    const percentage = Math.round(confidenceNum * 10);
    
    let className = 'confidence-badge';
    let text = `${percentage}% Confident`;
    
    if (confidenceNum >= 8) {
        className += ' confidence-high';
        text = `${percentage}% Confident - High`;
    } else if (confidenceNum >= 6) {
        className += ' confidence-medium'; 
        text = `${percentage}% Confident - Medium`;
    } else {
        className += ' confidence-low';
        text = `${percentage}% Confident - Low`;
    }
    
    badge.className = className;
    badge.textContent = text;
}

function updateLoadingStep(stepNum, message) {
    // Update loading message
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
        loadingMessage.textContent = message;
    }
    
    // Update step indicators
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step${i}`);
        if (step) {
            step.classList.remove('active', 'completed');
            if (i < stepNum) {
                step.classList.add('completed');
            } else if (i === stepNum) {
                step.classList.add('active');
            }
        }
    }
}

function showSection(sectionName) {
    // Hide all sections
    uploadSection.style.display = 'none';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    
    // Show requested section
    switch (sectionName) {
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
    
    return parts.join(' ');
}

function getEstimatedPrice(routes, analysis) {
    if (routes?.marketAnalysis?.estimatedValue?.suggested) {
        return routes.marketAnalysis.estimatedValue.suggested;
    }
    if (analysis.resale?.estimated_value) {
        return analysis.resale.estimated_value;
    }
    if (analysis.resale?.priceRange?.low) {
        return analysis.resale.priceRange.low;
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

function formatPrice(price) {
    if (!price) return 'N/A';
    
    // Handle different price formats
    if (typeof price === 'string') {
        // Remove currency symbols and extract number
        const numStr = price.replace(/[^\d.]/g, '');
        const num = parseFloat(numStr);
        return !isNaN(num) ? `$${num.toFixed(2)}` : price;
    }
    
    if (typeof price === 'number') {
        return `$${price.toFixed(2)}`;
    }
    
    return 'N/A';
}

function truncateTitle(title, maxLength) {
    if (!title) return 'Similar Item';
    
    if (title.length <= maxLength) {
        return title;
    }
    
    return title.substring(0, maxLength - 3) + '...';
}

function getConfidenceClass(confidence) {
    if (typeof confidence === 'string') {
        switch (confidence.toLowerCase()) {
            case 'high': return 'confidence-high';
            case 'low': return 'confidence-low';
            default: return 'confidence-medium';
        }
    }
    
    return 'confidence-medium';
}

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Action Handlers


async function handleCreateListing() {
    if (!analysisData || !analysisData.analysis) {
        UIHelpers.showError('No analysis data available');
        return;
    }
    
    try {
        // Check if user has eBay connected
        if (!userData?.ebay?.isConnected) {
            showEbayConnectionPrompt();
            return;
        }
        
        // Prepare listing data for modal preview
        const analysis = analysisData.analysis;
        const routes = analysisData.routes || {};
        
        // Convert base64 images to data URLs for preview
        const imageDataUrls = base64Images.map(base64 => `data:image/jpeg;base64,${base64}`);
        
        const listingData = {
            scanId: currentScanId,
            title: generateItemTitle(analysis),
            description: generateDescription(analysis),
            category: analysis.category || 'Electronics',
            condition: analysis.condition?.rating || 'good',
            brand: analysis.brand || 'Unbranded',
            model: analysis.model || 'See Description',
            images: imageDataUrls, // Use data URLs for modal preview
            pricing: {
                starting: Math.max(0.99, parseFloat(getEstimatedPrice(routes, analysis)) * 0.8),
                buyItNow: parseFloat(getEstimatedPrice(routes, analysis)),
                acceptOffers: true
            },
            shipping: {
                type: 'calculated',
                cost: calculateShippingCost(analysis.category)
            }
        };
        
        console.log('Showing listing preview with data:', listingData);
        
        // Check if modal is available
        if (typeof window.listingPreviewModal === 'undefined') {
            UIHelpers.showError('Listing preview not available. Please refresh the page.');
            return;
        }
        
        // Show the preview modal
        window.listingPreviewModal.show(
            listingData,
            // onConfirm callback - when user confirms listing creation
            async (finalListingData) => {
                await createEbayListingWithBackend(finalListingData);
            },
            // onCancel callback - when user cancels
            () => {
                console.log('Listing creation cancelled by user');
            }
        );
        
    } catch (error) {
        console.error('Error preparing listing preview:', error);
        UIHelpers.showError('Failed to prepare listing preview: ' + error.message);
    }
}

// New function to handle actual eBay listing creation after modal confirmation
async function createEbayListingWithBackend(listingData) {
    try {
        console.log('Creating eBay listing with confirmed data:', listingData);
        
        // First, save scan data to Firestore if not already saved
        if (!currentScanId) {
            currentScanId = await saveScanDataToFirestore();
        }
        
        // Upload images to Firebase Storage (convert data URLs back to files)
        const uploadedImageUrls = await uploadImagesToFirebaseStorage();
        
        // Prepare final listing data for eBay API
        const ebayListingData = {
            scanId: currentScanId,
            title: listingData.title,
            description: listingData.description,
            category: listingData.category,
            condition: listingData.condition,
            brand: listingData.brand,
            model: listingData.model,
            images: uploadedImageUrls, // Use Firebase Storage URLs for eBay
            pricing: {
                buyItNowPrice: listingData.pricing.buyItNow,
                startingPrice: listingData.pricing.starting,
                acceptOffers: listingData.pricing.acceptOffers
            },
            shipping: listingData.shipping
        };
        
        console.log('Calling eBay API with final data:', ebayListingData);
        
        // Create eBay listing using existing API client
        const result = await apiClient.createEbayListing(ebayListingData);
        
        if (result.success) {
            // Update scan status in Firestore
            if (currentScanId) {
                await updateScanStatus('listed', { 
                    ebayListingId: result.listingId,
                    ebayUrl: result.url,
                    listingData: ebayListingData
                });
            }
            
            // Update user stats
            if (userData?.stats) {
                userData.stats.totalListings = (userData.stats.totalListings || 0) + 1;
            }
            
            // Show success message with eBay link
            showListingSuccessMessage(result);
            
        } else {
            throw new Error(result.error || result.message || 'Failed to create listing');
        }
        
    } catch (error) {
        console.error('Create listing error:', error);
        
        // Enhanced error handling
        let errorMessage = 'Failed to create listing: ' + error.message;
        
        if (error.message.includes('authentication') || error.message.includes('token')) {
            errorMessage = 'eBay authentication error. Please reconnect your eBay account.';
        } else if (error.message.includes('category')) {
            errorMessage = 'Invalid category. Please try selecting a different category.';
        } else if (error.message.includes('policy')) {
            errorMessage = 'eBay seller policies not configured. Please set up your policies on eBay.com first.';
        }
        
        UIHelpers.showError(errorMessage);
        
        // Re-throw to let modal handle loading state
        throw error;
    }
}

// Helper function to save scan data to Firestore
async function saveScanDataToFirestore() {
    try {
        const scanData = {
            analysis: analysisData.analysis || {},
            routes: analysisData.routes || {},
            images: base64Images,
            scanMetadata: {
                imageCount: base64Images.length,
                quality: 'balanced',
                analyzedAt: new Date().toISOString(),
                confidence: analysisData.analysis?.confidence || 5
            },
            status: 'analyzed',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            uid: currentUser.uid
        };
        
        const scanRef = await db.collection('users')
            .doc(currentUser.uid)
            .collection('scans')
            .add(scanData);
        
        console.log('Scan saved to Firestore with ID:', scanRef.id);
        return scanRef.id;
        
    } catch (error) {
        console.error('Error saving scan to Firestore:', error);
        throw new Error('Failed to save scan data');
    }
}

// Helper function to upload images to Firebase Storage
async function uploadImagesToFirebaseStorage() {
    if (!firebase.storage) {
        console.warn('Firebase Storage not available');
        return [];
    }
    
    try {
        const uploadedUrls = [];
        
        for (let i = 0; i < compressedFiles.length; i++) {
            const file = compressedFiles[i];
            const filename = `${Date.now()}-${i}.jpg`;
            const storageRef = firebase.storage().ref().child(`scans/${currentUser.uid}/${filename}`);
            
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            uploadedUrls.push(downloadURL);
        }
        
        console.log('Images uploaded to Firebase Storage:', uploadedUrls.length);
        return uploadedUrls;
        
    } catch (error) {
        console.error('Error uploading images to storage:', error);
        return [];
    }
}

// Helper function to update scan status
async function updateScanStatus(status, additionalData = {}) {
    if (!currentScanId) return;
    
    try {
        await db.collection('users')
            .doc(currentUser.uid)
            .collection('scans')
            .doc(currentScanId)
            .update({
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                ...additionalData
            });
        
        console.log('Scan status updated:', status);
    } catch (error) {
        console.error('Error updating scan status:', error);
    }
}

// Helper function to calculate shipping cost
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
    
    if (!category) return 8;
    
    const categoryLower = category.toLowerCase();
    
    // Check for partial matches
    for (const [cat, rate] of Object.entries(shippingRates)) {
        if (categoryLower.includes(cat)) {
            return rate;
        }
    }
    
    return 8; // Default shipping cost
}

// Function to show success message with eBay link
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
                You can scan another item or return to your dashboard.
            </p>
        </div>
    `;
    
    // Use existing success message container
    const container = document.getElementById('successMessage');
    if (container) {
        container.innerHTML = successHTML;
        container.style.display = 'block';
        container.style.background = '#e8f5e9';
        container.style.border = '2px solid #4caf50';
        container.style.borderRadius = '12px';
        container.style.padding = '20px';
        container.style.margin = '20px 0';
        
        // Scroll to success message
        container.scrollIntoView({ behavior: 'smooth' });
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            container.style.display = 'none';
        }, 10000);
    }
}

async function handleSaveToCollection() {
    if (!analysisData) {
        UIHelpers.showError('No analysis data available');
        return;
    }
    
    try {
        const saveBtn = document.getElementById('saveToCollectionBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
        
        // Save to user's collection in Firestore
        const collectionData = {
            analysis: analysisData.analysis,
            routes: analysisData.routes,
            images: base64Images,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'saved'
        };
        
        await db.collection('users').doc(currentUser.uid)
            .collection('collection').add(collectionData);
        
        UIHelpers.showSuccess('Item saved to your collection!');
        
        // Update user stats
        if (userData?.stats) {
            userData.stats.pinsCreated = (userData.stats.pinsCreated || 0) + 1;
        }
        
        // Restore button
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        
    } catch (error) {
        console.error('Save to collection error:', error);
        UIHelpers.showError(`Failed to save: ${error.message}`);
        
        // Restore button
        const saveBtn = document.getElementById('saveToCollectionBtn');
        saveBtn.textContent = '💾 Save to Collection';
        saveBtn.disabled = false;
    }
}

function handleScanAnother() {
    // Reset state
    selectedFiles = [];
    compressedFiles = [];
    base64Images = [];
    analysisData = null;
    currentScanId = null;
    
    // Clear file input
    if (fileInput) {
        fileInput.value = '';
    }
    
    // Show upload section
    showSection('upload');
}

function handleViewMoreSimilar() {
    if (!analysisData?.routes?.marketAnalysis?.estimatedValue?.searchQuery) {
        // Fallback search based on item details
        const analysis = analysisData.analysis;
        const searchTerms = [];
        
        if (analysis.brand && analysis.brand !== 'Unknown') {
            searchTerms.push(analysis.brand);
        }
        if (analysis.model && analysis.model !== 'Unknown') {
            searchTerms.push(analysis.model);
        }
        if (analysis.category) {
            searchTerms.push(analysis.category);
        }
        
        const fallbackQuery = searchTerms.length > 0 ? searchTerms.join(' ') : 'similar items';
        const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(fallbackQuery)}`;
        window.open(ebayUrl, '_blank');
        return;
    }
    
    // Use the actual search query from market analysis
    const searchQuery = analysisData.routes.marketAnalysis.estimatedValue.searchQuery;
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}`;
    window.open(ebayUrl, '_blank');
}

function showEbayConnectionPrompt() {
    const message = `
        <div style="text-align: center; padding: 20px;">
            <h3>Connect eBay to List Items</h3>
            <p>Connect your eBay account to automatically create listings from your scans.</p>
            <a href="/ebay-connect.html" class="btn btn-primary" style="margin-top: 15px;">
                Connect eBay Account
            </a>
        </div>
    `;
    
    // Create modal or use existing success message area
    const container = document.getElementById('successMessage');
    if (container) {
        container.innerHTML = message;
        container.style.display = 'block';
        container.style.background = '#e3f2fd';
        container.style.border = '1px solid #2196f3';
        container.style.borderRadius = '10px';
        container.style.padding = '20px';
        container.style.margin = '20px 0';
    }
}

// CSS class helpers for dynamic styling
function addPriceHighlightStyles() {
    if (document.getElementById('dynamic-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'dynamic-styles';
    style.textContent = `
        .price-highlight {
            color: #28a745 !important;
            font-weight: 700 !important;
        }
        
        .profit-positive {
            color: #28a745 !important;
            font-weight: 700 !important;
        }
        
        .profit-negative {
            color: #dc3545 !important;
            font-weight: 700 !important;
        }
        
        .comparables-count {
            color: #667eea !important;
            font-weight: 600 !important;
        }
        
        .confidence-high {
            color: #2e7d32 !important;
        }
        
        .confidence-medium {
            color: #f57c00 !important;
        }
        
        .confidence-low {
            color: #c62828 !important;
        }
    `;
    
    document.head.appendChild(style);
}

// Initialize dynamic styles
document.addEventListener('DOMContentLoaded', addPriceHighlightStyles);