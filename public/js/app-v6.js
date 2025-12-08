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

        // Mode state
        this.currentMode = 'spot';

        // Map state (lazy initialized)
        this.map = null;
        this.mapInitialized = false;
        this.markers = [];
        this.pins = [];
        this.selectedPin = null;
        this.userLocation = null;
        this.currentFilter = 'all';

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

        // Capture row upload button
        const fileInputCapture = document.getElementById('fileInputCapture');
        if (fileInputCapture) {
            fileInputCapture.addEventListener('change', (e) => this.handleFileSelect(e));
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
        if (toggleSlider && !toggleSlider.classList.contains('slide-right')) {
            toggleSlider.classList.add('slide-right');
        }

        if (spotBtn) {
            spotBtn.addEventListener('click', () => {
                if (this.currentMode === 'spot') return;

                this.currentMode = 'spot';
                spotBtn.classList.add('active');
                if (thriftBtn) thriftBtn.classList.remove('active');

                // Update slider
                if (toggleSlider) {
                    toggleSlider.classList.remove('slide-left');
                    toggleSlider.classList.add('slide-right');
                }

                // Switch to spot mode (no page reload)
                document.body.classList.remove('thrift-mode');

                // Close pin panel if open
                this.closePinPanel();

                console.log('📷 Switched to Spot mode');
            });
        }

        if (thriftBtn) {
            thriftBtn.addEventListener('click', () => {
                if (this.currentMode === 'thrift') return;

                this.currentMode = 'thrift';
                thriftBtn.classList.add('active');
                if (spotBtn) spotBtn.classList.remove('active');

                // Update slider
                if (toggleSlider) {
                    toggleSlider.classList.remove('slide-right');
                    toggleSlider.classList.add('slide-left');
                }

                // Switch to thrift mode (no page reload)
                document.body.classList.add('thrift-mode');

                // Initialize map on first switch (lazy loading)
                if (!this.mapInitialized) {
                    this.initMap();
                } else {
                    // Invalidate map size in case container was hidden
                    setTimeout(() => {
                        if (this.map) this.map.invalidateSize();
                    }, 100);
                }

                console.log('🗺️ Switched to Thrift mode');
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

    /**
     * Build an enhanced description for assortments with itemized list
     * @param {Object} analysis - The analysis object with itemizedList
     * @param {string} itemName - The overall item name/category
     * @returns {string} - Formatted description with itemized contents
     */
    buildItemizedDescription(analysis, itemName) {
        const items = analysis.itemizedList || [];
        const itemCount = items.length;
        const overallCondition = analysis.condition?.rating || 'good';

        // Start with summary
        let description = `${itemName} - ${itemCount} items included.\n\n`;
        description += `Overall Condition: ${overallCondition.charAt(0).toUpperCase() + overallCondition.slice(1)}\n\n`;

        // Add itemized list
        description += `📚 CONTENTS:\n`;
        description += `─────────────────────\n`;

        items.forEach((item, index) => {
            const num = index + 1;
            let itemLine = `${num}. ${item.title}`;

            // Add author/brand if available
            if (item.author && item.author !== 'Unknown' && item.author.trim()) {
                itemLine += ` by ${item.author}`;
            }

            // Add type if available
            if (item.type && item.type !== 'Unknown' && item.type.trim()) {
                itemLine += ` (${item.type})`;
            }

            description += itemLine + '\n';

            // Add condition on separate line if different from overall or has notes
            if (item.condition && item.condition !== overallCondition) {
                description += `   Condition: ${item.condition}`;
                if (item.conditionNotes) {
                    description += ` - ${item.conditionNotes}`;
                }
                description += '\n';
            } else if (item.conditionNotes) {
                description += `   Note: ${item.conditionNotes}\n`;
            }

            // Add estimated value if available
            if (item.estimatedValue && item.estimatedValue !== 'Unknown') {
                description += `   Est. Value: ${item.estimatedValue}\n`;
            }
        });

        description += `─────────────────────\n\n`;

        // Add any overall condition notes
        if (analysis.condition?.description) {
            description += `Additional Notes: ${analysis.condition.description}\n`;
        }

        console.log('📝 Built itemized description with', itemCount, 'items');
        return description;
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

            // Store description for listing creation - enhanced for assortments
            let description = analysis.condition?.description ||
                              analysis.description ||
                              `${itemName} in ${analysis.condition?.rating || 'good'} condition`;

            // DEBUG: Log assortment check before building description
            console.log('🔍 Assortment check:', {
                isAssortment: analysis.isAssortment,
                hasItemizedList: !!analysis.itemizedList,
                itemizedListLength: analysis.itemizedList?.length || 0,
                firstItems: analysis.itemizedList?.slice(0, 3)?.map(i => i.title) || []
            });

            // If this is an assortment with itemized list, build enhanced description
            if (analysis.isAssortment && analysis.itemizedList && analysis.itemizedList.length > 0) {
                description = this.buildItemizedDescription(analysis, itemName);
                console.log('✅ Built itemized description for assortment');
            } else {
                console.log('⏭️ Using standard description (not an assortment or no itemized list)');
            }

            // Store the full analysis data for listing creation
            this.listingDescription = description;
            this.listingBrand = brand; // Use the extracted brand variable
            this.listingModel = model; // Use the extracted model variable
            this.listingMaterials = analysis.materials || [];
            this.listingCondition = analysis.condition || {};

            // Price extraction - correct path based on backend structure
            // Backend returns: routes.marketAnalysis.estimatedValue.suggested
            let price = 0;

            // DEBUG: Log all price sources to understand where value comes from
            console.log('💰 Price sources check:', {
                suggested: routes.marketAnalysis?.estimatedValue?.suggested,
                itemizedEstimate: routes.marketAnalysis?.estimatedValue?.itemizedEstimate,
                source: routes.marketAnalysis?.estimatedValue?.source,
                itemizedNote: routes.marketAnalysis?.estimatedValue?.itemizedNote,
                median: routes.marketAnalysis?.estimatedValue?.priceRange?.median
            });

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

            // Ensure scanId is included for eBay listing creation
            scanId: this.analysisData?.scanId || this.analysisData?.id || this.analysisData?._id,

            // Enhanced fields for listing creation
            prepopulatedData: {
                description: this.listingDescription || '',
                brand: this.listingBrand || '',
                model: this.listingModel || '',
                materials: this.listingMaterials || [],
                condition: this.listingCondition || {},
                estimatedPrice: this.analysisData?.routes?.marketAnalysis?.estimatedValue?.suggested || 0,
                category: this.analysisData?.analysis?.category || '',
                itemName: this.analysisData?.analysis?.category || 'Unknown Item',
                // Assortment/multi-item support
                isAssortment: this.analysisData?.analysis?.isAssortment || false,
                itemizedList: this.analysisData?.analysis?.itemizedList || [],
                itemCount: this.analysisData?.analysis?.itemCount || 1
            }
        };

        // Log scanId for debugging
        console.log('📌 scanId being saved:', listingData.scanId);

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

    // ==================== MAP MODE METHODS ====================

    initMap() {
        console.log('🗺️ Initializing map...');

        // Initialize map centered on default location
        this.map = L.map('map').setView([37.7749, -122.4194], 13);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Try to get user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    this.map.setView([this.userLocation.lat, this.userLocation.lng], 13);

                    // Add user location marker
                    L.marker([this.userLocation.lat, this.userLocation.lng], {
                        icon: L.divIcon({
                            className: 'user-location-marker',
                            html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>',
                            iconSize: [22, 22]
                        })
                    }).addTo(this.map);

                    // Re-fit to nearest items after getting location
                    if (this.markers.length > 0) {
                        this.fitToNearestItems(5);
                    }
                },
                (error) => {
                    console.warn('Could not get user location:', error);
                }
            );
        }

        // Load pins
        this.loadPins();

        // Setup map event listeners
        this.setupMapEventListeners();

        this.mapInitialized = true;
        console.log('✅ Map initialized');
    }

    setupMapEventListeners() {
        // Close pin panel button
        const closePinPanel = document.getElementById('closePinPanel');
        if (closePinPanel) {
            closePinPanel.addEventListener('click', () => this.closePinPanel());
        }

        // Filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.filterByCategory(chip.dataset.category);
            });
        });
    }

    async loadPins() {
        try {
            const db = firebase.firestore();
            const pinsSnapshot = await db.collection('pins')
                .where('status', '==', 'active')
                .get();

            pinsSnapshot.forEach((doc) => {
                const pin = { id: doc.id, ...doc.data() };
                this.pins.push(pin);
                this.addPinToMap(pin);
            });

            console.log(`📍 Loaded ${pinsSnapshot.size} pins`);

            // Fit map to nearest items after loading
            this.fitToNearestItems(5);
        } catch (error) {
            console.error('Error loading pins:', error);
        }
    }

    addPinToMap(pin) {
        if (!pin.lat || !pin.lng) {
            console.warn('Pin missing coordinates:', pin.id);
            return;
        }

        const icon = this.getPinIcon(pin);
        const marker = L.marker([pin.lat, pin.lng], { icon })
            .addTo(this.map)
            .on('click', () => this.showPinDetails(pin.id));

        this.markers.push({ id: pin.id, marker, category: pin.category });
    }

    getPinIcon(pin) {
        let color = '#fbbf24'; // Friendly yellow for available/unknown
        let textColor = 'black';

        if (pin.claimedBy) {
            color = '#ef4444'; // red
            textColor = 'white';
        } else if (pin.reservedBy) {
            color = '#f59e0b'; // amber for reserved
            textColor = 'white';
        }

        const icon = this.getCategoryEmoji(pin.category);
        if (icon !== '?') {
            textColor = 'white';
        }

        return L.divIcon({
            className: 'custom-pin-marker',
            html: `<div style="background: ${color}; color: ${textColor}; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${icon === '?' ? '24px' : '20px'}; font-weight: ${icon === '?' ? '700' : 'normal'}; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer;">${icon}</div>`,
            iconSize: [46, 46]
        });
    }

    getCategoryEmoji(category) {
        const emojis = {
            'electronics': '📱',
            'furniture': '🪑',
            'clothing': '👕',
            'tools': '🔧',
            'books': '📚',
            'toys': '🧸',
            'home & garden': '🏠',
            'collectibles': '🎨',
            'sporting goods': '⚽',
            'sports': '⚽',
            'automotive': '🚗',
            'jewelry': '💎'
        };
        return emojis[category?.toLowerCase()] || '?';
    }

    filterByCategory(category) {
        this.currentFilter = category;

        // Update active state on filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.category === category);
        });

        // Show/hide markers based on category
        this.markers.forEach(({ marker, id }) => {
            const pin = this.pins.find(p => p.id === id);
            if (!pin) return;

            const pinCategory = pin.category?.toLowerCase() || '';
            const shouldShow = category === 'all' || pinCategory === category || pinCategory.includes(category);

            if (shouldShow) {
                if (!this.map.hasLayer(marker)) {
                    marker.addTo(this.map);
                }
            } else {
                if (this.map.hasLayer(marker)) {
                    this.map.removeLayer(marker);
                }
            }
        });

        console.log(`🔍 Filtered to: ${category}`);
    }

    fitToNearestItems(count = 5) {
        if (this.markers.length === 0) return;

        if (this.userLocation) {
            const sorted = this.markers
                .map(m => ({
                    marker: m.marker,
                    distance: this.getDistance(this.userLocation, m.marker.getLatLng())
                }))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, count);

            if (sorted.length > 0) {
                const group = L.featureGroup(sorted.map(s => s.marker));
                this.map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
                return;
            }
        }

        // Fallback: fit all markers
        if (this.markers.length > 0) {
            const group = L.featureGroup(this.markers.map(m => m.marker));
            this.map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 14 });
        }
    }

    getDistance(point1, point2) {
        const R = 6371;
        const lat1 = point1.lat * Math.PI / 180;
        const lat2 = point2.lat * Math.PI / 180;
        const deltaLat = (point2.lat - point1.lat) * Math.PI / 180;
        const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    async showPinDetails(pinId) {
        try {
            const db = firebase.firestore();
            const pinDoc = await db.collection('pins').doc(pinId).get();

            if (!pinDoc.exists) {
                console.error('Pin not found:', pinId);
                return;
            }

            const pin = { id: pinDoc.id, ...pinDoc.data() };
            this.selectedPin = pin;

            this.renderPinPanel(pin);

            // Show panel
            document.getElementById('pinPanel').classList.add('active');
        } catch (error) {
            console.error('Error showing pin details:', error);
        }
    }

    renderPinPanel(pin) {
        const isOwner = this.currentUser && pin.userId === this.currentUser.uid;
        const isReserved = !!pin.reservedBy;
        const isClaimed = !!pin.claimedBy;
        const canReserve = this.currentUser && !isOwner && !isReserved && !isClaimed;
        const canClaim = this.currentUser && !isOwner && isReserved && pin.reservedBy === this.currentUser.uid;

        let statusBadge = '';
        if (isClaimed) {
            statusBadge = '<span class="pin-status-badge status-claimed">✓ Claimed</span>';
        } else if (isReserved) {
            statusBadge = '<span class="pin-status-badge status-reserved">⏰ Reserved</span>';
        } else {
            statusBadge = '<span class="pin-status-badge status-available">✓ Available</span>';
        }

        const images = pin.images && pin.images.length > 0
            ? pin.images.map(url => `<img src="${url}" class="pin-image" alt="Item photo">`).join('')
            : '<div style="padding: 40px; background: var(--gray-100); border-radius: 8px; text-align: center; color: var(--gray-500);">No images</div>';

        const listingType = pin.listingType === 'rent'
            ? `<span class="meta-item">📅 For Rent (${pin.rentalPeriod})</span>`
            : '<span class="meta-item">💰 For Sale</span>';

        let actions = '';
        if (isOwner) {
            actions = `
                <button class="btn btn-secondary">Edit Listing</button>
                <button class="btn btn-danger" onclick="app.deletePinListing('${pin.id}')">Delete</button>
            `;
        } else if (canClaim) {
            actions = `
                <button class="btn btn-primary" onclick="app.claimPin('${pin.id}')">Claim Item</button>
                <button class="btn btn-secondary" onclick="app.cancelReservation('${pin.id}')">Cancel Reservation</button>
            `;
        } else if (canReserve) {
            actions = `
                <button class="btn btn-primary" onclick="app.reservePin('${pin.id}')">Reserve for 24h</button>
                <button class="btn btn-secondary">Message Seller</button>
            `;
        } else if (!this.currentUser) {
            actions = `
                <a href="signin.html" class="btn btn-primary">Sign In to Reserve</a>
            `;
        }

        document.getElementById('pinPanelContent').innerHTML = `
            ${statusBadge}
            <h2 class="pin-title">${pin.title || 'Untitled Item'}</h2>
            <div class="pin-price">$${pin.price || '0'}</div>
            <div class="pin-meta">
                ${listingType}
                <span class="meta-item">📦 ${pin.category || 'General'}</span>
                <span class="meta-item">⭐ ${pin.condition || 'Good'}</span>
            </div>
            <div class="pin-images">${images}</div>
            <p class="pin-description">${pin.description || 'No description provided.'}</p>
            ${pin.location ? `<p class="meta-item">📍 ${pin.location}</p>` : ''}
            ${pin.locationNotes ? `<p class="meta-item" style="color: var(--gray-600); font-size: 0.9em;">Note: ${pin.locationNotes}</p>` : ''}
            <div class="pin-actions">${actions}</div>
        `;
    }

    closePinPanel() {
        const pinPanel = document.getElementById('pinPanel');
        if (pinPanel) {
            pinPanel.classList.remove('active');
        }
        this.selectedPin = null;
    }

    async reservePin(pinId) {
        if (!this.currentUser) {
            window.location.href = 'signin.html';
            return;
        }

        try {
            const db = firebase.firestore();
            const reservedUntil = new Date();
            reservedUntil.setHours(reservedUntil.getHours() + 24);

            await db.collection('pins').doc(pinId).update({
                reservedBy: this.currentUser.uid,
                reservedByEmail: this.currentUser.email,
                reservedAt: firebase.firestore.FieldValue.serverTimestamp(),
                reservedUntil: firebase.firestore.Timestamp.fromDate(reservedUntil),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert('Item reserved for 24 hours! Go claim it!');
            this.showPinDetails(pinId);
            this.reloadPins();
        } catch (error) {
            console.error('Error reserving pin:', error);
            alert('Failed to reserve item: ' + error.message);
        }
    }

    async claimPin(pinId) {
        if (!this.currentUser) {
            window.location.href = 'signin.html';
            return;
        }

        if (!confirm('Are you sure you want to claim this item? This will mark it as claimed.')) {
            return;
        }

        try {
            const db = firebase.firestore();
            await db.collection('pins').doc(pinId).update({
                claimedBy: this.currentUser.uid,
                claimedByEmail: this.currentUser.email,
                claimedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'claimed',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert('Item claimed successfully! Congrats on your find!');
            this.closePinPanel();
            this.reloadPins();
        } catch (error) {
            console.error('Error claiming pin:', error);
            alert('Failed to claim item: ' + error.message);
        }
    }

    async cancelReservation(pinId) {
        try {
            const db = firebase.firestore();
            await db.collection('pins').doc(pinId).update({
                reservedBy: null,
                reservedByEmail: null,
                reservedAt: null,
                reservedUntil: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert('Reservation cancelled.');
            this.showPinDetails(pinId);
            this.reloadPins();
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            alert('Failed to cancel reservation: ' + error.message);
        }
    }

    async deletePinListing(pinId) {
        if (!confirm('Are you sure you want to delete this listing?')) {
            return;
        }

        try {
            const db = firebase.firestore();
            await db.collection('pins').doc(pinId).update({
                status: 'deleted',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert('Listing deleted.');
            this.closePinPanel();
            this.reloadPins();
        } catch (error) {
            console.error('Error deleting pin:', error);
            alert('Failed to delete listing: ' + error.message);
        }
    }

    async reloadPins() {
        // Clear existing markers
        this.markers.forEach(({ marker }) => this.map.removeLayer(marker));
        this.markers = [];
        this.pins = [];

        // Reload pins
        await this.loadPins();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ThriftSpotApp();
    window.app.init();
});
