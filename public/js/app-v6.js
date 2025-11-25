/**
 * ThriftSpot v6 - Simplified Wireframe-First Implementation
 * - Telescope rings always visible with variable speeds
 * - Multiple photo uploads before analysis
 * - Detailed analysis stage messages
 * - Correct API response parsing
 */

class ThriftSpotApp {
    constructor() {
        this.currentUser = null;
        this.analysisData = null;
        this.capturedImages = [];
        this.photoFiles = [];
        this.cameraStream = null;
        this.isMobile = window.innerWidth < 768;

        // Analysis stages with realistic messages
        this.analysisStages = [
            { name: 'Uploading images', description: 'Preparing your photos...', progress: 10 },
            { name: 'AI Vision Analysis', description: 'Claude is examining your item', progress: 25 },
            { name: 'Category Detection', description: 'Identifying product type', progress: 40 },
            { name: 'Condition Assessment', description: 'Evaluating item quality', progress: 55 },
            { name: 'Checking Market Prices', description: 'Searching eBay sold listings', progress: 70 },
            { name: 'Price Validation', description: 'Analyzing market data', progress: 85 },
            { name: 'Finalizing Results', description: 'Almost done...', progress: 95 }
        ];

        // UI Elements
        this.telescopeCenter = document.getElementById('telescopeCenter');
        this.cameraViewfinder = document.getElementById('cameraViewfinder');
        this.cameraVideo = document.getElementById('cameraVideo');
        this.uploadTrigger = document.getElementById('uploadTrigger');
        this.fileInput = document.getElementById('fileInput');
        this.captureButton = document.getElementById('captureButton');
        this.uploadButtonMobile = document.getElementById('uploadButtonMobile');

        this.photoGallery = document.getElementById('photoGallery');
        this.analyzeButton = document.getElementById('analyzeButton');
        this.analyzeButtonContainer = document.getElementById('analyzeButtonContainer');
        this.tokenCountDisplay = document.getElementById('tokenCountDisplay');

        this.analysisScreen = document.getElementById('analysisScreen');
        this.progressText = document.getElementById('progressText');
        this.stageName = document.getElementById('stageName');
        this.stageDescription = document.getElementById('stageDescription');
        this.telescopeProgress = document.getElementById('telescopeProgress');
        this.progressCircle = document.getElementById('progressCircle');

        this.resultsScreen = document.getElementById('resultsScreen');
        this.itemName = document.getElementById('itemName');
        this.estimatedValue = document.getElementById('estimatedValue');
        this.conditionBadge = document.getElementById('conditionBadge');
        this.ebayListingsContainer = document.getElementById('ebayListingsContainer');
        this.createListingBtn = document.getElementById('createListingBtn');
        this.scanAnotherBtn = document.getElementById('scanAnotherBtn');
    }

    async init() {
        console.log('🚀 ThriftSpot v6 initializing...');

        // Initialize Firebase Auth
        await this.initAuth();

        // Setup camera or upload based on device
        if (this.isMobile) {
            await this.initCamera();
        } else {
            this.initUpload();
        }

        // Event listeners
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Mobile file input (if exists)
        const fileInputMobile = document.getElementById('fileInputMobile');
        if (fileInputMobile) {
            fileInputMobile.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (this.captureButton) {
            this.captureButton.addEventListener('click', () => this.capturePhoto());
        }
        if (this.uploadButtonMobile) {
            const mobileFileInput = this.uploadButtonMobile.querySelector('input[type="file"]');
            if (mobileFileInput) {
                mobileFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
            }
        }
        this.analyzeButton.addEventListener('click', () => this.startAnalysis());
        this.createListingBtn.addEventListener('click', () => this.createListing());
        this.scanAnotherBtn.addEventListener('click', () => this.resetToHome());

        // Mode toggle
        this.setupModeToggle();

        // Setup hamburger menu
        this.setupHamburgerMenu();

        // Setup menu dropdown click handler
        this.setupMenuDropdown();

        // Update token display
        this.updateTokenDisplay();

        // Restore app state if coming back from map
        await this.restoreAppState();

        console.log('✅ ThriftSpot v6 ready!');
    }

    async updateTokenDisplay() {
        try {
            if (window.tokenSystem && this.tokenCountDisplay) {
                const balance = await window.tokenSystem.loadBalance();
                this.tokenCountDisplay.textContent = balance || '15';
            } else if (this.tokenCountDisplay) {
                // Default to 15 for beta users
                this.tokenCountDisplay.textContent = '15';
            }
        } catch (error) {
            console.error('Error updating token display:', error);
            // Default to 15 on error
            if (this.tokenCountDisplay) {
                this.tokenCountDisplay.textContent = '15';
            }
        }
    }

    setupMenuDropdown() {
        // Handle click on user avatar to toggle dropdown
        document.addEventListener('click', (e) => {
            const userAvatar = e.target.closest('.user-avatar');
            const dropdown = document.querySelector('.user-dropdown');

            if (userAvatar) {
                e.stopPropagation();
                dropdown?.classList.toggle('show');
            } else if (!e.target.closest('.user-dropdown')) {
                // Click outside - close dropdown
                dropdown?.classList.remove('show');
            }
        });
    }

    setupModeToggle() {
        const spotBtn = document.getElementById('spotBtn');
        const thriftBtn = document.getElementById('thriftBtn');
        const toggleSlider = document.querySelector('.mode-toggle-slider');

        // Initialize slider position for spot mode
        if (toggleSlider) {
            toggleSlider.classList.add('slide-right');
        }

        if (spotBtn) {
            spotBtn.addEventListener('click', () => {
                // Already on spot mode, no action needed
                spotBtn.classList.add('active');
                thriftBtn.classList.remove('active');
                if (toggleSlider) {
                    toggleSlider.classList.remove('slide-left');
                    toggleSlider.classList.add('slide-right');
                }
            });
        }

        if (thriftBtn) {
            thriftBtn.addEventListener('click', () => {
                // Save current state before navigation
                this.saveAppState();

                // Update slider before navigation
                if (toggleSlider) {
                    toggleSlider.classList.remove('slide-right');
                    toggleSlider.classList.add('slide-left');
                }
                // Small delay for animation to be visible before navigation
                setTimeout(() => {
                    window.location.href = 'pin-map.html';
                }, 150);
            });
        }
    }

    setupHamburgerMenu() {
        const hamburgerMenu = document.getElementById('hamburgerMenu');
        const hamburgerDropdown = document.getElementById('hamburgerDropdown');
        const signOutBtn = document.getElementById('signOutBtn');

        if (hamburgerMenu && hamburgerDropdown) {
            // Toggle dropdown on hamburger click
            hamburgerMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                hamburgerDropdown.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.hamburger-menu') && !e.target.closest('.hamburger-dropdown')) {
                    hamburgerDropdown.classList.remove('show');
                }
            });

            // Close dropdown when clicking menu items (except sign out button)
            hamburgerDropdown.querySelectorAll('a.menu-item').forEach(item => {
                item.addEventListener('click', () => {
                    hamburgerDropdown.classList.remove('show');
                });
            });
        }

        // Sign out handler
        if (signOutBtn) {
            signOutBtn.addEventListener('click', async () => {
                try {
                    await firebase.auth().signOut();
                    window.location.href = 'signin.html';
                } catch (error) {
                    console.error('Error signing out:', error);
                }
            });
        }
    }

    async initAuth() {
        return new Promise((resolve) => {
            firebase.auth().onAuthStateChanged((user) => {
                this.currentUser = user;
                this.updateAuthUI();
                resolve();
            });
        });
    }

    updateAuthUI() {
        const authSection = document.getElementById('authSection');
        const tokenCounter = document.getElementById('tokenCounter');

        if (this.currentUser) {
            // Get user initials from display name or email
            const displayName = this.currentUser.displayName || this.currentUser.email;
            const initials = this.getUserInitials(displayName);

            authSection.innerHTML = `
                <div class="user-menu-container">
                    <div class="user-avatar" id="userAvatar">${initials}</div>
                    <div class="user-dropdown">
                        <a href="profile-v6.html" class="dropdown-item">Profile</a>
                        <a href="dashboard-v6.html" class="dropdown-item">Dashboard</a>
                        <button class="dropdown-item" onclick="firebase.auth().signOut()">Sign Out</button>
                    </div>
                </div>
            `;

            // Show token counter and load balance
            if (tokenCounter) {
                tokenCounter.style.display = 'block';
                this.loadTokenBalance();
            }
        } else {
            authSection.innerHTML = `
                <a href="signin.html" class="btn btn-primary">Sign In</a>
            `;

            // Hide token counter when not authenticated
            if (tokenCounter) {
                tokenCounter.style.display = 'none';
            }
        }
    }

    async loadTokenBalance() {
        if (window.tokenSystem && window.tokenSystem.loadBalance) {
            try {
                // Set currentUser globally for token-system.js
                window.currentUser = this.currentUser;
                await window.tokenSystem.loadBalance();
            } catch (error) {
                console.error('Error loading token balance:', error);
                // Set default value
                if (this.tokenCountDisplay) {
                    this.tokenCountDisplay.textContent = '15';
                }
            }
        } else {
            // Fallback if token system not loaded
            if (this.tokenCountDisplay) {
                this.tokenCountDisplay.textContent = '15';
            }
        }
    }

    getUserInitials(name) {
        if (!name) return 'U';

        // If it's an email, take first 2 characters before @
        if (name.includes('@')) {
            return name.substring(0, 2).toUpperCase();
        }

        // If it's a name, take first letter of each word
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }

        // Single word name
        return name.substring(0, 2).toUpperCase();
    }

    async initCamera() {
        console.log('📷 Initializing camera...');

        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            this.cameraVideo.srcObject = this.cameraStream;

            // Show camera viewfinder in center
            this.uploadTrigger.classList.add('hidden');
            this.cameraViewfinder.classList.remove('hidden');

            // Show capture button
            if (this.captureButton) {
                this.captureButton.style.display = 'flex';
            }

            console.log('✅ Camera ready!');
        } catch (error) {
            console.error('❌ Camera access denied:', error);
            // Fallback to upload
            this.initUpload();
        }
    }

    initUpload() {
        console.log('📁 Initializing file upload...');
        // Upload trigger is already visible by default
        this.cameraViewfinder.classList.add('hidden');
        this.uploadTrigger.classList.remove('hidden');

        // Hide capture button on desktop
        if (this.captureButton) {
            this.captureButton.style.display = 'none';
        }
    }

    capturePhoto() {
        if (!this.cameraStream) return;

        console.log('📸 Capturing photo...');

        // Create canvas to capture frame
        const canvas = document.createElement('canvas');
        canvas.width = this.cameraVideo.videoWidth;
        canvas.height = this.cameraVideo.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.cameraVideo, 0, 0);

        // Convert to blob
        canvas.toBlob((blob) => {
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            this.addPhotoToGallery(file);

            // DON'T auto-analyze - let user take multiple photos
        }, 'image/jpeg', 0.9);
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        console.log(`📁 Selected ${files.length} file(s)`);

        files.forEach(file => {
            this.addPhotoToGallery(file);
        });

        // Reset file input so same files can be selected again
        this.fileInput.value = '';
    }

    addPhotoToGallery(file) {
        const photoIndex = this.photoFiles.length;
        this.photoFiles.push(file);

        // Create thumbnail wrapper with delete button
        const reader = new FileReader();
        reader.onload = (e) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'photo-thumbnail-wrapper';
            wrapper.dataset.index = photoIndex;

            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'photo-thumbnail';
            img.alt = 'Uploaded photo';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'photo-delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = () => this.deletePhoto(photoIndex);

            wrapper.appendChild(img);
            wrapper.appendChild(deleteBtn);
            this.photoGallery.appendChild(wrapper);
        };
        reader.readAsDataURL(file);

        // Show gallery and enable analyze button
        this.photoGallery.classList.remove('hidden');
        this.analyzeButton.disabled = false;

        console.log(`📷 Added photo. Total: ${this.photoFiles.length}`);
    }

    deletePhoto(index) {
        console.log(`🗑️ Deleting photo at index ${index}`);

        // Remove from array
        this.photoFiles.splice(index, 1);

        // Remove from DOM
        const wrapper = this.photoGallery.querySelector(`[data-index="${index}"]`);
        if (wrapper) {
            wrapper.remove();
        }

        // Update remaining indices
        const wrappers = this.photoGallery.querySelectorAll('.photo-thumbnail-wrapper');
        wrappers.forEach((w, i) => {
            w.dataset.index = i;
        });

        // If no photos left, disable analyze button and hide gallery
        if (this.photoFiles.length === 0) {
            this.analyzeButton.disabled = true;
            this.photoGallery.classList.add('hidden');
        }

        console.log(`📷 Photos remaining: ${this.photoFiles.length}`);
    }

    async startAnalysis() {
        if (this.photoFiles.length === 0) {
            alert('Please add at least one photo first');
            return;
        }

        console.log(`🔄 Starting analysis with ${this.photoFiles.length} photo(s)...`);

        // Spend tokens for scan (this will check balance and show modal if insufficient)
        if (window.tokenSystem && window.tokenSystem.spendTokens) {
            const tokenResult = await window.tokenSystem.spendTokens('scan');
            if (!tokenResult.success) {
                console.error('❌ Failed to spend tokens:', tokenResult.error);
                return;
            }
            console.log(`✅ Spent ${tokenResult.amount} tokens. Remaining: ${tokenResult.balance}`);

            // Update token display with animation
            if (this.tokenCountDisplay) {
                // Add countdown animation
                this.tokenCountDisplay.classList.add('token-countdown');
                setTimeout(() => {
                    this.tokenCountDisplay.textContent = tokenResult.balance;
                    this.tokenCountDisplay.classList.remove('token-countdown');
                }, 300);
            }
        }

        // Hide capture UI and button during analysis
        this.photoGallery.classList.add('hidden');
        this.analyzeButtonContainer.style.display = 'none';
        if (this.cameraStream) {
            this.cameraViewfinder.classList.add('hidden');
        }
        this.uploadTrigger.classList.add('hidden');

        // Show analysis screen
        this.showAnalysisScreen();

        try {
            // Run through analysis stages
            await this.runAnalysisStages();

        } catch (error) {
            console.error('❌ Error during analysis:', error);
            alert('Error analyzing images. Please try again.');
            this.resetToHome();
        }
    }

    async runAnalysisStages() {
        // Stage 1: Compress images
        this.updateAnalysisStage(
            this.analysisStages[0].name,
            this.analysisStages[0].description,
            this.analysisStages[0].progress
        );
        const compressedImages = await this.compressImages(this.photoFiles);

        // Stage 2: Convert to base64
        this.updateAnalysisStage(
            this.analysisStages[1].name,
            this.analysisStages[1].description,
            this.analysisStages[1].progress
        );
        const base64Images = await Promise.all(
            compressedImages.map(file => this.fileToBase64(file))
        );

        // Stages 3-7: API call with progress updates
        await this.analyzeImages(base64Images);
    }

    async compressImages(files) {
        console.log('🗜️ Compressing images...');

        const options = {
            maxSizeMB: 0.2,
            maxWidthOrHeight: 600,
            useWebWorker: true,
            initialQuality: 0.5
        };

        const compressed = await Promise.all(
            files.map(file => imageCompression(file, options))
        );

        return compressed;
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async uploadImagesToFirebase() {
        if (!firebase.storage) {
            console.warn('Firebase Storage not available');
            return [];
        }

        try {
            const uploadedUrls = [];

            for (let i = 0; i < this.photoFiles.length; i++) {
                const file = this.photoFiles[i];
                const filename = `${Date.now()}-${i}.jpg`;
                const storageRef = firebase.storage().ref().child(`scans/${this.currentUser.uid}/${filename}`);

                console.log(`📤 Uploading image ${i + 1}/${this.photoFiles.length}...`);
                const snapshot = await storageRef.put(file);
                const downloadURL = await snapshot.ref.getDownloadURL();
                uploadedUrls.push(downloadURL);
                console.log(`✅ Image ${i + 1} uploaded: ${downloadURL}`);
            }

            console.log(`✅ All ${uploadedUrls.length} images uploaded to Firebase Storage`);
            return uploadedUrls;
        } catch (error) {
            console.error('Error uploading images to Firebase:', error);
            throw error;
        }
    }

    async analyzeImages(base64Images) {
        console.log('🤖 Calling Claude AI API...');

        // Get auth token
        let idToken = null;
        if (this.currentUser) {
            idToken = await this.currentUser.getIdToken();
        }

        // Animate through remaining stages while API processes
        const stageInterval = setInterval(() => {
            const currentProgress = parseInt(this.progressText.textContent);
            const nextStage = this.analysisStages.find(s => s.progress > currentProgress);

            if (nextStage && nextStage.progress < 95) {
                this.updateAnalysisStage(
                    nextStage.name,
                    nextStage.description,
                    nextStage.progress
                );
            }
        }, 1500);

        try {
            // Call API
            const response = await fetch('/api/analyze-json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(idToken && { 'Authorization': `Bearer ${idToken}` })
                },
                body: JSON.stringify({
                    images: base64Images
                })
            });

            clearInterval(stageInterval);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Analysis complete:', data);

            // Store analysis data
            this.analysisData = data;

            // Upload images to Firebase Storage immediately after analysis
            this.updateAnalysisStage('Complete!', 'Uploading images...', 95);
            let uploadedImageUrls = [];
            try {
                uploadedImageUrls = await this.uploadImagesToFirebase();
                console.log('✅ Images uploaded to Firebase:', uploadedImageUrls);
                // Store uploaded URLs in analysis data for later use
                this.analysisData.uploadedImageUrls = uploadedImageUrls;
            } catch (uploadError) {
                console.error('⚠️ Image upload failed, continuing anyway:', uploadError);
            }

            // Final stage
            this.updateAnalysisStage('Complete!', 'Preparing results...', 100);

            // Wait a moment then show results
            setTimeout(() => {
                this.showResults();
            }, 1000);

        } catch (error) {
            clearInterval(stageInterval);
            throw error;
        }
    }

    showAnalysisScreen() {
        this.analysisScreen.classList.add('active');
        this.resultsScreen.classList.remove('active');
        this.telescopeProgress.classList.add('active');
    }

    updateAnalysisStage(name, description, progress) {
        this.stageName.textContent = name;
        this.stageDescription.textContent = description;
        this.progressText.textContent = `${progress}%`;

        // Update progress circle
        const circumference = 597;
        const offset = circumference - (circumference * progress / 100);
        this.progressCircle.style.strokeDashoffset = offset;
    }

    showResults() {
        console.log('📊 Showing results with full data:', this.analysisData);

        // Hide analysis screen
        this.analysisScreen.classList.remove('active');
        this.telescopeProgress.classList.remove('active');

        // Show results screen
        this.resultsScreen.classList.add('active');

        // Parse API response - it comes wrapped in {success, analysis, routes, priceValidation}
        if (this.analysisData) {
            // Extract the actual analysis data
            const analysis = this.analysisData.analysis || this.analysisData;
            const routes = this.analysisData.routes || {};
            const priceValidation = this.analysisData.priceValidation || {};

            console.log('📦 Full API response:', this.analysisData);
            console.log('📦 Analysis object:', analysis);
            console.log('📦 Analysis keys:', Object.keys(analysis));
            console.log('💰 Routes object:', routes);

            // Debug: Check all possible brand/model fields
            console.log('🔍 Brand/Model Debug:', {
                'analysis.brand': analysis.brand,
                'analysis.Brand': analysis.Brand,
                'analysis.manufacturer': analysis.manufacturer,
                'analysis.model': analysis.model,
                'analysis.Model': analysis.Model,
                'analysis.category': analysis.category,
                'analysis.itemName': analysis.itemName
            });

            // Build complete item name with brand and model
            let itemNameParts = [];

            // Try multiple field names for brand (case-insensitive)
            const brand = analysis.brand || analysis.Brand || analysis.manufacturer || 'Unknown';
            if (brand && brand !== 'Unknown') {
                itemNameParts.push(brand);
            }

            // Try multiple field names for model (case-insensitive)
            const model = analysis.model || analysis.Model || analysis.modelNumber || '';
            if (model && model !== 'Unknown' && model.trim()) {
                itemNameParts.push(model);
            }

            // Category
            if (analysis.category) {
                itemNameParts.push(analysis.category);
            }

            const itemName = itemNameParts.join(' ') || analysis.itemName || 'Unknown Item';
            this.itemName.textContent = itemName;

            console.log('🏷️ Item name built:', {
                brand,
                model,
                category: analysis.category,
                itemNameParts,
                finalName: itemName
            });

            // Store description for listing creation
            const description = analysis.condition?.description ||
                              analysis.description ||
                              `${itemName} in ${analysis.condition?.rating || 'good'} condition`;

            // Store the full analysis data for listing creation
            this.listingDescription = description;
            this.listingBrand = brand; // Use the extracted brand variable
            this.listingModel = model; // Use the extracted model variable
            this.listingMaterials = analysis.materials || [];
            this.listingCondition = analysis.condition || {};

            // Price extraction - correct path based on backend structure
            // Backend returns: routes.marketAnalysis.estimatedValue.suggested
            let price = 0;

            if (routes.marketAnalysis?.estimatedValue?.suggested) {
                price = routes.marketAnalysis.estimatedValue.suggested;
                console.log('💵 Found price in routes.marketAnalysis.estimatedValue.suggested:', price);
            }
            // Fallback: Check if price is directly in marketAnalysis
            else if (routes.marketAnalysis?.suggested) {
                price = routes.marketAnalysis.suggested;
                console.log('💵 Found price in routes.marketAnalysis.suggested:', price);
            }
            // Fallback: Check AI resale estimate
            else if (analysis.resale?.priceRange?.high) {
                price = analysis.resale.priceRange.high;
                console.log('💵 Found price in analysis.resale.priceRange.high:', price);
            }
            // Fallback: Check priceValidation if available
            else if (priceValidation?.aiEstimate) {
                price = priceValidation.aiEstimate;
                console.log('💵 Found price in priceValidation.aiEstimate:', price);
            }
            else {
                console.warn('❌ Price not found. Full routes.marketAnalysis:', routes.marketAnalysis);
            }

            this.estimatedValue.textContent = `$${price}`;

            // Condition - nested in analysis.condition.rating
            const condition = analysis.condition?.rating ||
                            analysis.condition ||
                            'good';
            this.conditionBadge.textContent = condition;

            // Display AI-generated description
            const descriptionElement = document.getElementById('aiDescription');
            console.log('📝 Description debug:', {
                description,
                descriptionLength: description?.length,
                element: descriptionElement,
                elementExists: !!descriptionElement,
                conditionDescription: analysis.condition?.description,
                analysisDescription: analysis.description
            });

            if (descriptionElement) {
                descriptionElement.textContent = description;
                console.log('✅ Description set successfully');
            } else {
                console.error('❌ aiDescription element not found in DOM!');
            }

            console.log('📝 Populated results:', {
                itemName,
                price,
                condition,
                description,
                brand: this.listingBrand,
                materials: this.listingMaterials,
                hasAnalysis: !!analysis,
                hasRoutes: !!routes,
                routesStructure: Object.keys(routes),
                priceLocation: routes.recommendedRoutes?.ebay?.marketAnalysis?.suggested ? 'recommendedRoutes.ebay.marketAnalysis.suggested' : 'other'
            });

            // eBay listings
            this.displayEbayListings();

            // Display uploaded photos
            this.displayUploadedPhotos();
        } else {
            console.error('❌ No analysis data available!');
        }
    }

    displayEbayListings() {
        // Extract from nested structure
        const analysis = this.analysisData.analysis || this.analysisData;
        const routes = this.analysisData.routes || {};
        const priceValidation = this.analysisData.priceValidation || {};

        // eBay comparable items from preliminary response (routes.marketAnalysis.estimatedValue.comparableItems)
        // OR from background pricing (marketInsights.recentSales)
        const ebayListings = routes.marketAnalysis?.estimatedValue?.comparableItems ||
                           this.analysisData.marketInsights?.recentSales ||
                           routes.marketAnalysis?.estimatedValue?.recentSales ||
                           priceValidation?.marketData?.recommendation?.recentSales ||
                           routes.ebayListings ||
                           priceValidation.recentSales ||
                           analysis.ebayListings ||
                           this.analysisData.ebayListings ||
                           this.analysisData.recentSales ||
                           this.analysisData.marketData?.listings ||
                           [];

        console.log(`📦 Found ${ebayListings.length} eBay comparable listings`);
        console.log('📦 eBay listings data:', ebayListings); // Show all for debugging

        if (ebayListings.length === 0) {
            this.ebayListingsContainer.innerHTML = `
                <p style="color: var(--gray-500); text-align: center; padding: 16px;">
                    No recent eBay sales data available
                </p>
            `;
            return;
        }

        this.ebayListingsContainer.innerHTML = ebayListings
            .map(listing => {
                const price = listing.price || listing.soldPrice || listing.value || 0;
                const title = listing.title || listing.name || 'Unlisted item';
                const condition = listing.condition || '';
                const url = listing.url || listing.itemWebUrl || '#';
                const image = listing.image || null;

                return `
                    <a href="${url}" target="_blank" class="ebay-listing-item">
                        ${image ? `<img src="${image}" alt="${title}" class="ebay-listing-thumbnail">` : ''}
                        <div class="ebay-listing-content">
                            <div class="ebay-listing-price">$${price}</div>
                            <div class="ebay-listing-title">${this.truncate(title, 60)}</div>
                            ${condition ? `<div class="ebay-listing-condition">${condition}</div>` : ''}
                        </div>
                    </a>
                `;
            })
            .join('');
    }

    displayUploadedPhotos() {
        // Add uploaded photos to results (if not already there)
        const resultsCard = document.querySelector('.results-item-card');

        // Check if photos section already exists
        if (resultsCard && !resultsCard.querySelector('.uploaded-photos')) {
            const photosSection = document.createElement('div');
            photosSection.className = 'uploaded-photos';
            photosSection.style.cssText = 'margin-top: 24px; display: flex; gap: 8px; flex-wrap: wrap;';

            this.photoFiles.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = `Photo ${index + 1}`;
                    img.style.cssText = 'width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid var(--gray-200);';
                    photosSection.appendChild(img);
                };
                reader.readAsDataURL(file);
            });

            // Insert before eBay listings
            const ebaySection = document.getElementById('ebayListingsSection');
            if (ebaySection) {
                resultsCard.insertBefore(photosSection, ebaySection);
            }
        }
    }

    truncate(str, maxLength) {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    }

    async createListing() {
        if (!this.currentUser) {
            window.location.href = 'signin.html';
            return;
        }

        console.log('📝 Creating listing...');

        // Prepare comprehensive listing data
        const listingData = {
            // Core analysis data
            ...this.analysisData,

            // Enhanced fields for listing creation
            prepopulatedData: {
                description: this.listingDescription || '',
                brand: this.listingBrand || '',
                model: this.listingModel || '',
                materials: this.listingMaterials || [],
                condition: this.listingCondition || {},
                estimatedPrice: this.analysisData?.routes?.marketAnalysis?.estimatedValue?.suggested || 0,
                category: this.analysisData?.analysis?.category || '',
                itemName: this.analysisData?.analysis?.category || 'Unknown Item'
            }
        };

        // Use already-uploaded images from analysis phase to avoid delay
        try {
            // Check if images were already uploaded during analysis
            let uploadedImageUrls = this.analysisData?.uploadedImageUrls || [];

            // If not uploaded yet (fallback), upload now
            if (uploadedImageUrls.length === 0) {
                console.log('📤 Uploading images to Firebase Storage...');
                uploadedImageUrls = await this.uploadImagesToFirebase();
            } else {
                console.log('✅ Using pre-uploaded images from analysis phase');
            }

            // Add image URLs to listing data
            listingData.imageUrls = uploadedImageUrls;

            // Store only the analysis data and URLs (much smaller than base64)
            sessionStorage.setItem('pendingAnalysis', JSON.stringify(listingData));

            console.log('📦 Listing data prepared:', {
                description: this.listingDescription,
                brand: this.listingBrand,
                materials: this.listingMaterials,
                photos: uploadedImageUrls.length,
                imageUrls: uploadedImageUrls
            });

            window.location.href = 'listing-preview-v6.html';
        } catch (error) {
            console.error('❌ Error creating listing:', error);
            alert('Failed to upload images. Please try again.');
        }
    }

    saveAppState() {
        const state = {
            photoFiles: this.photoFiles.map(file => ({
                name: file.name,
                type: file.type,
                size: file.size
            })),
            capturedImages: this.capturedImages,
            analysisData: this.analysisData,
            timestamp: Date.now()
        };
        sessionStorage.setItem('spotModeState', JSON.stringify(state));
        console.log('💾 Saved app state');
    }

    async restoreAppState() {
        const savedState = sessionStorage.getItem('spotModeState');
        if (!savedState) return;

        try {
            const state = JSON.parse(savedState);

            // Only restore if less than 30 minutes old
            if (Date.now() - state.timestamp > 30 * 60 * 1000) {
                sessionStorage.removeItem('spotModeState');
                return;
            }

            // Restore captured images
            if (state.capturedImages && state.capturedImages.length > 0) {
                this.capturedImages = state.capturedImages;
                this.displayPhotoGallery();
            }

            // Restore analysis data
            if (state.analysisData) {
                this.analysisData = state.analysisData;
            }

            console.log('✅ Restored app state');
            sessionStorage.removeItem('spotModeState');
        } catch (error) {
            console.error('Error restoring state:', error);
            sessionStorage.removeItem('spotModeState');
        }
    }

    resetToHome() {
        console.log('🔄 Resetting to home...');

        // Clear saved state
        sessionStorage.removeItem('spotModeState');

        // Hide screens
        this.analysisScreen.classList.remove('active');
        this.resultsScreen.classList.remove('active');
        this.telescopeProgress.classList.remove('active');
        this.photoGallery.classList.add('hidden');

        // Clear photo gallery
        this.photoGallery.innerHTML = '';
        this.photoFiles = [];

        // Show and disable analyze button
        this.analyzeButtonContainer.style.display = 'block';
        this.analyzeButton.disabled = true;

        // Show camera/upload again
        if (this.cameraStream) {
            this.cameraViewfinder.classList.remove('hidden');
            this.uploadTrigger.classList.add('hidden');
        } else {
            this.uploadTrigger.classList.remove('hidden');
            this.cameraViewfinder.classList.add('hidden');
        }

        // Reset data
        this.analysisData = null;

        // Reset file inputs
        this.fileInput.value = '';
        const fileInputMobile = document.getElementById('fileInputMobile');
        if (fileInputMobile) {
            fileInputMobile.value = '';
        }

        // Reset progress
        this.updateAnalysisStage('Starting Analysis', 'Please wait...', 0);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ThriftSpotApp();
    window.app.init();
});
