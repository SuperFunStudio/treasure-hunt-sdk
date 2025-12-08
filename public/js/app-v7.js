/**
 * ThriftSpot v7 - Viral Loop Optimized Implementation
 * 
 * Key Changes:
 * - Share-first UI after scan results
 * - Sharer ID tracking in all URLs for viral factor calculation
 * - Progressive results reveal (no blocking analysis screen)
 * - Streamlined decision flow (Leave it / Keep it)
 * - Token counter only shown when relevant
 */

class ThriftSpotApp {
    constructor() {
        this.currentUser = null;
        this.analysisData = null;
        this.capturedImages = [];
        this.photoFiles = [];
        this.cameraStream = null;
        this.isMobile = window.innerWidth < 768;
        this.scanCount = parseInt(sessionStorage.getItem('scanCount') || '0');

        // Get referrer ID from URL if present (for viral tracking)
        this.referrerId = this.getUrlParam('ref');

        // Map state
        this.map = null;
        this.mapMarkers = [];
        this.allPins = [];
        this.filteredPins = [];
        this.selectedPin = null;
        this.userLocation = null;
        this.activeCategory = 'all';
        this.mapSearchTimeout = null;
        this.currentMode = 'spot'; // 'spot' or 'thrift'
        this.spotSubMode = 'scan'; // 'scan' or 'results' - tracks state within Spot mode
        this.mapInitialized = false;

        // Initialize Firebase Analytics
        this.analytics = null;
        try {
            if (firebase.analytics) {
                this.analytics = firebase.analytics();
            }
        } catch (e) {
            console.warn('Firebase Analytics not available:', e.message);
        }
        
        // Analysis stages
        this.analysisStages = [
            { name: 'Uploading', description: 'Preparing your photos...', progress: 10 },
            { name: 'AI Vision', description: 'Examining your item...', progress: 25 },
            { name: 'Identifying', description: 'Detecting product type...', progress: 40 },
            { name: 'Assessing', description: 'Evaluating condition...', progress: 55 },
            { name: 'Pricing', description: 'Checking market data...', progress: 70 },
            { name: 'Validating', description: 'Analyzing comparables...', progress: 85 },
            { name: 'Complete', description: 'Almost done...', progress: 95 }
        ];

        this.initElements();
    }

    initElements() {
        // Scan mode elements
        this.scanMode = document.getElementById('scanMode');
        this.telescopeContainer = document.getElementById('telescopeContainer');
        this.telescopeCenter = document.getElementById('telescopeCenter');
        this.cameraViewfinder = document.getElementById('cameraViewfinder');
        this.cameraVideo = document.getElementById('cameraVideo');
        this.uploadTrigger = document.getElementById('uploadTrigger');
        this.fileInput = document.getElementById('fileInput');
        // fileInputSecondary removed - redundant with capture row upload
        this.fileInputCapture = document.getElementById('fileInputCapture');
        this.captureButton = document.getElementById('captureButton');
        this.photoGallery = document.getElementById('photoGallery');
        this.analyzeButton = document.getElementById('analyzeButton');
        this.scanActionArea = document.getElementById('scanActionArea');
        this.tokenCounter = document.getElementById('tokenCounter');
        this.tokenCountDisplay = document.getElementById('tokenCountDisplay');
        
        // Progress elements
        this.telescopeProgress = document.getElementById('telescopeProgress');
        this.progressCircle = document.getElementById('progressCircle');

        // Results mode elements
        this.resultsMode = document.getElementById('resultsMode');
        this.resultsVerdict = document.getElementById('resultsVerdict');
        this.heroPrice = document.getElementById('heroPrice');
        this.heroContext = document.getElementById('heroContext');
        this.itemName = document.getElementById('itemName');
        this.conditionBadge = document.getElementById('conditionBadge');
        this.aiDescription = document.getElementById('aiDescription');
        this.ebayListingsContainer = document.getElementById('ebayListingsContainer');
        this.ebayCount = document.getElementById('ebayCount');
        this.uploadedPhotosGrid = document.getElementById('uploadedPhotosGrid');
        
        // Action buttons
        this.shareButton = document.getElementById('shareButton');
        this.leaveItBtn = document.getElementById('leaveItBtn');
        this.keepItBtn = document.getElementById('keepItBtn');
        this.scanAnotherBtn = document.getElementById('scanAnotherBtn');
        
        // Share modal
        this.shareModalOverlay = document.getElementById('shareModalOverlay');
        this.shareModal = document.getElementById('shareModal');
        this.shareModalClose = document.getElementById('shareModalClose');
        this.shareLinkInput = document.getElementById('shareLinkInput');
        this.copyLinkBtn = document.getElementById('copyLinkBtn');
        this.sharePreviewImage = document.getElementById('sharePreviewImage');
        this.sharePreviewTitle = document.getElementById('sharePreviewTitle');
        this.sharePreviewPrice = document.getElementById('sharePreviewPrice');
        
        // Pin modal
        this.pinModalOverlay = document.getElementById('pinModalOverlay');
        this.pinModal = document.getElementById('pinModal');
        this.pinModalClose = document.getElementById('pinModalClose');
        this.pinLocationInput = document.getElementById('pinLocationInput');
        this.pinNotesInput = document.getElementById('pinNotesInput');
        this.useLocationBtn = document.getElementById('useLocationBtn');
        this.pinSubmitBtn = document.getElementById('pinSubmitBtn');
        this.pinItemImage = document.getElementById('pinItemImage');
        this.pinItemName = document.getElementById('pinItemName');
        this.pinItemValue = document.getElementById('pinItemValue');
    }

    async init() {
        console.log('🚀 ThriftSpot v7 initializing...');

        // Track referral visit if user came via referral link
        if (this.referrerId) {
            console.log('📊 Referred by:', this.referrerId);
            sessionStorage.setItem('referrerId', this.referrerId);
            this.trackEvent('referral_visit', {
                referrer_id: this.referrerId,
                landing_page: window.location.pathname,
                source: this.getUrlParam('source') || 'direct'
            });
        }

        // Initialize Firebase Auth
        await this.initAuth();

        // Setup camera or upload based on device
        if (this.isMobile) {
            await this.initCamera();
        } else {
            this.initUpload();
        }

        // Event listeners
        this.setupEventListeners();

        // Setup mode toggle
        this.setupModeToggle();

        // Setup hamburger menu
        this.setupHamburgerMenu();

        // Update token display (contextually)
        this.updateTokenDisplay();

        console.log('✅ ThriftSpot v7 ready!');
    }

    setupEventListeners() {
        // File inputs
        this.fileInput?.addEventListener('change', (e) => this.handleFileSelect(e));
        // fileInputSecondary event removed - element no longer exists
        this.fileInputCapture?.addEventListener('change', (e) => this.handleFileSelect(e));

        // Capture button (mobile)
        this.captureButton?.addEventListener('click', () => this.capturePhoto());

        // Analyze button
        this.analyzeButton?.addEventListener('click', () => this.startAnalysis());

        // Results actions
        this.shareButton?.addEventListener('click', () => this.openShareModal());
        this.leaveItBtn?.addEventListener('click', () => this.openPinModal());
        this.keepItBtn?.addEventListener('click', () => this.createListing());
        this.scanAnotherBtn?.addEventListener('click', () => this.resetToScan());

        // Share modal
        this.shareModalClose?.addEventListener('click', () => this.closeShareModal());
        this.shareModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.shareModalOverlay) this.closeShareModal();
        });
        this.copyLinkBtn?.addEventListener('click', () => this.copyShareLink());
        
        // Share platform buttons
        document.querySelectorAll('.share-option-btn').forEach(btn => {
            btn.addEventListener('click', () => this.shareViaPlatform(btn.dataset.platform));
        });

        // View on Map button (shown after pin creation)
        document.getElementById('viewOnMapBtn')?.addEventListener('click', () => this.viewOnMap());

        // Pin modal
        this.pinModalClose?.addEventListener('click', () => this.closePinModal());
        this.pinModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.pinModalOverlay) this.closePinModal();
        });
        this.useLocationBtn?.addEventListener('click', () => this.useCurrentLocation());
        this.pinSubmitBtn?.addEventListener('click', () => this.submitPin());
        
        // Status toggle in pin modal
        document.querySelectorAll('.status-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.status-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // User dropdown
        document.addEventListener('click', (e) => {
            const userAvatar = e.target.closest('.user-avatar');
            const dropdown = document.querySelector('.user-dropdown');
            
            if (userAvatar) {
                e.stopPropagation();
                dropdown?.classList.toggle('show');
            } else if (!e.target.closest('.user-dropdown')) {
                dropdown?.classList.remove('show');
            }
        });
    }

    getUrlParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    async initAuth() {
        return new Promise((resolve) => {
            firebase.auth().onAuthStateChanged((user) => {
                this.currentUser = user;
                this.updateAuthUI();
                
                // Store referrer relationship if new signup
                if (user && this.referrerId) {
                    this.storeReferralRelationship(user.uid, this.referrerId);
                }
                
                resolve();
            });
        });
    }

    async storeReferralRelationship(userId, referrerId) {
        try {
            const db = firebase.firestore();

            // Check if this user was already referred
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists && userDoc.data().referredBy) {
                console.log('User already has a referrer');
                return;
            }

            // Get the share source from session storage if available
            const shareSource = sessionStorage.getItem('shareSource') || 'direct';

            // Store the referral in dedicated referrals collection (for viral coefficient tracking)
            await db.collection('referrals').add({
                referrerId: referrerId,
                newUserId: userId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                source: shareSource,
                firstScanAt: null,
                firstPurchaseAt: null,
                converted: false
            });

            // Store the referral on user document
            await db.collection('users').doc(userId).set({
                referredBy: referrerId,
                referredAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Increment referrer's invite count
            await db.collection('users').doc(referrerId).update({
                referralCount: firebase.firestore.FieldValue.increment(1)
            });

            // Track referral signup event
            this.trackEvent('referral_signup', {
                referrer_id: referrerId,
                new_user_id: userId,
                source: shareSource
            });

            console.log('✅ Referral relationship stored');
        } catch (error) {
            console.error('Error storing referral:', error);
        }
    }

    updateAuthUI() {
        const authSection = document.getElementById('authSection');
        
        if (this.currentUser) {
            const displayName = this.currentUser.displayName || this.currentUser.email;
            const initials = this.getUserInitials(displayName);

            authSection.innerHTML = `
                <div class="user-menu-container">
                    <div class="user-avatar">${initials}</div>
                    <div class="user-dropdown">
                        <a href="profile.html" class="dropdown-item">Profile</a>
                        <a href="dashboard.html" class="dropdown-item">Dashboard</a>
                        <button class="dropdown-item" onclick="firebase.auth().signOut()">Sign Out</button>
                    </div>
                </div>
            `;

            this.loadTokenBalance();
        } else {
            authSection.innerHTML = `
                <a href="signin.html" style="color: var(--accent-primary); font-weight: 600; text-decoration: none;">Sign In</a>
            `;
        }
    }

    getUserInitials(name) {
        if (!name) return 'U';
        if (name.includes('@')) {
            return name.substring(0, 2).toUpperCase();
        }
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    async loadTokenBalance() {
        try {
            if (window.tokenSystem) {
                window.currentUser = this.currentUser;
                const balance = await window.tokenSystem.loadBalance();
                this.updateTokenDisplay(balance);
            }
        } catch (error) {
            console.error('Error loading token balance:', error);
        }
    }

    updateTokenDisplay(balance = null) {
        if (!this.tokenCounter || !this.tokenCountDisplay) return;
        
        const tokenBalance = balance ?? 15;
        
        // Only show if low or user has scanned this session
        if (tokenBalance <= 3) {
            this.tokenCounter.classList.remove('hidden');
            this.tokenCounter.classList.add('warning');
            this.tokenCountDisplay.textContent = tokenBalance;
        } else if (this.scanCount > 0) {
            this.tokenCounter.classList.remove('hidden');
            this.tokenCounter.classList.remove('warning');
            this.tokenCountDisplay.textContent = tokenBalance;
        } else {
            this.tokenCounter.classList.add('hidden');
        }
    }

    setupModeToggle() {
        const spotBtn = document.getElementById('spotBtn');
        const thriftBtn = document.getElementById('thriftBtn');
        const toggleSlider = document.querySelector('.mode-toggle-slider');

        // Initialize slider position based on current mode
        if (toggleSlider) {
            toggleSlider.classList.add('slide-right');
        }

        spotBtn?.addEventListener('click', () => {
            if (this.currentMode === 'spot') return;

            spotBtn.classList.add('active');
            thriftBtn?.classList.remove('active');
            toggleSlider?.classList.add('slide-right');
            toggleSlider?.classList.remove('slide-left');

            this.switchToSpotMode();
        });

        thriftBtn?.addEventListener('click', () => {
            if (this.currentMode === 'thrift') return;

            thriftBtn.classList.add('active');
            spotBtn?.classList.remove('active');
            toggleSlider?.classList.remove('slide-right');
            toggleSlider?.classList.add('slide-left');

            this.switchToThriftMode();
        });
    }

    switchToSpotMode() {
        console.log('📷 Switching to Spot mode');
        this.currentMode = 'spot';

        // Hide map mode
        document.getElementById('mapMode')?.classList.add('hidden');

        // Show the correct Spot sub-mode (scan or results)
        if (this.spotSubMode === 'results') {
            document.getElementById('scanMode')?.classList.add('hidden');
            document.getElementById('resultsMode')?.classList.remove('hidden');
        } else {
            document.getElementById('resultsMode')?.classList.add('hidden');
            document.getElementById('scanMode')?.classList.remove('hidden');
        }

        // Resume camera if it was active and we're in scan mode
        if (this.cameraStream && this.cameraVideo && this.spotSubMode === 'scan') {
            this.telescopeContainer?.classList.add('searching');
        }
    }

    switchToThriftMode() {
        console.log('🗺️ Switching to Thrift mode');
        this.currentMode = 'thrift';

        // Hide both Spot sub-modes, show map mode
        document.getElementById('scanMode')?.classList.add('hidden');
        document.getElementById('resultsMode')?.classList.add('hidden');
        document.getElementById('mapMode')?.classList.remove('hidden');

        // Initialize map on first switch (lazy loading)
        if (!this.mapInitialized) {
            this.initMap();
            this.loadPins();
            this.setupMapEventListeners();
            this.mapInitialized = true;
        } else {
            // Invalidate map size in case container was hidden
            setTimeout(() => {
                this.map?.invalidateSize();
            }, 100);
        }
    }

    setupHamburgerMenu() {
        const hamburgerMenu = document.getElementById('hamburgerMenu');
        const hamburgerDropdown = document.getElementById('hamburgerDropdown');
        const signOutBtn = document.getElementById('signOutBtn');

        hamburgerMenu?.addEventListener('click', (e) => {
            e.stopPropagation();
            hamburgerDropdown?.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.hamburger-menu') && !e.target.closest('.hamburger-dropdown')) {
                hamburgerDropdown?.classList.remove('show');
            }
        });

        signOutBtn?.addEventListener('click', async () => {
            try {
                await firebase.auth().signOut();
                window.location.href = 'signin.html';
            } catch (error) {
                console.error('Error signing out:', error);
            }
        });
    }

    async initCamera() {
        console.log('📷 Initializing camera...');
        
        // Add searching state to telescope rings
        this.telescopeContainer?.classList.add('searching');

        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            if (this.cameraVideo) {
                this.cameraVideo.srcObject = this.cameraStream;
            }

            this.uploadTrigger?.classList.add('hidden');
            this.cameraViewfinder?.classList.remove('hidden');

            console.log('✅ Camera ready!');
        } catch (error) {
            console.error('❌ Camera access denied:', error);
            this.initUpload();
        }
    }

    initUpload() {
        console.log('📁 Initializing file upload...');
        this.cameraViewfinder?.classList.add('hidden');
        this.uploadTrigger?.classList.remove('hidden');
        this.telescopeContainer?.classList.remove('searching');
    }

    capturePhoto() {
        if (!this.cameraStream || !this.cameraVideo) return;

        console.log('📸 Capturing photo...');

        // Focus animation on telescope rings
        this.telescopeContainer?.classList.remove('searching');
        this.telescopeContainer?.classList.add('focusing');
        setTimeout(() => {
            this.telescopeContainer?.classList.remove('focusing');
            this.telescopeContainer?.classList.add('searching');
        }, 400);

        const canvas = document.createElement('canvas');
        canvas.width = this.cameraVideo.videoWidth;
        canvas.height = this.cameraVideo.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.cameraVideo, 0, 0);

        canvas.toBlob((blob) => {
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            this.addPhotoToGallery(file);
        }, 'image/jpeg', 0.9);
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        console.log(`📁 Selected ${files.length} file(s)`);

        files.forEach(file => {
            this.addPhotoToGallery(file);
        });

        // Reset inputs
        if (this.fileInput) this.fileInput.value = '';
        if (this.fileInputCapture) this.fileInputCapture.value = '';
    }

    addPhotoToGallery(file) {
        const photoIndex = this.photoFiles.length;
        this.photoFiles.push(file);

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
            this.photoGallery?.appendChild(wrapper);
        };
        reader.readAsDataURL(file);

        this.photoGallery?.classList.remove('hidden');
        if (this.analyzeButton) {
            this.analyzeButton.disabled = false;
        }

        console.log(`📷 Added photo. Total: ${this.photoFiles.length}`);
    }

    deletePhoto(index) {
        this.photoFiles.splice(index, 1);

        const wrapper = this.photoGallery?.querySelector(`[data-index="${index}"]`);
        wrapper?.remove();

        // Update indices
        this.photoGallery?.querySelectorAll('.photo-thumbnail-wrapper').forEach((w, i) => {
            w.dataset.index = i;
        });

        if (this.photoFiles.length === 0) {
            if (this.analyzeButton) this.analyzeButton.disabled = true;
            this.photoGallery?.classList.add('hidden');
        }
    }

    async startAnalysis() {
        if (this.photoFiles.length === 0) {
            alert('Please add at least one photo first');
            return;
        }

        console.log(`🔄 Starting analysis with ${this.photoFiles.length} photo(s)...`);

        // Spend tokens
        if (window.tokenSystem?.spendTokens) {
            const tokenResult = await window.tokenSystem.spendTokens('scan');
            if (!tokenResult.success) {
                console.error('❌ Failed to spend tokens:', tokenResult.error);
                return;
            }
            this.updateTokenDisplay(tokenResult.balance);
        }

        // Increment scan count for this session
        this.scanCount++;
        sessionStorage.setItem('scanCount', this.scanCount.toString());
        
        // Show token counter after first scan
        this.updateTokenDisplay();

        // Show progress on telescope rings
        this.telescopeProgress?.classList.add('active');
        this.telescopeContainer?.classList.remove('searching');
        
        // Hide gallery and action area
        this.photoGallery?.classList.add('hidden');
        this.scanActionArea.style.opacity = '0.3';
        this.scanActionArea.style.pointerEvents = 'none';

        try {
            await this.runAnalysis();
        } catch (error) {
            console.error('❌ Error during analysis:', error);
            alert('Error analyzing images. Please try again.');
            this.resetToScan();
        }
    }

    async runAnalysis() {
        // Stage 1: Compress images
        this.updateProgress(10);
        const compressedImages = await this.compressImages(this.photoFiles);

        // Stage 2: Convert to base64
        this.updateProgress(25);
        const base64Images = await Promise.all(
            compressedImages.map(file => this.fileToBase64(file))
        );

        // Stage 3-6: API call with progress animation
        await this.analyzeImages(base64Images);
    }

    async compressImages(files) {
        const options = {
            maxSizeMB: 0.2,
            maxWidthOrHeight: 600,
            useWebWorker: true,
            initialQuality: 0.5
        };

        return Promise.all(files.map(file => imageCompression(file, options)));
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async analyzeImages(base64Images) {
        let idToken = null;
        if (this.currentUser) {
            idToken = await this.currentUser.getIdToken();
        }

        // Animate progress while API processes
        const progressInterval = setInterval(() => {
            const currentProgress = this.currentProgress || 25;
            if (currentProgress < 85) {
                this.updateProgress(currentProgress + 5);
            }
        }, 800);

        try {
            const response = await fetch('/api/analyze-json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(idToken && { 'Authorization': `Bearer ${idToken}` })
                },
                body: JSON.stringify({ images: base64Images })
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Analysis complete:', data);

            this.analysisData = data;

            // Upload images to Firebase
            this.updateProgress(90);
            try {
                const uploadedUrls = await this.uploadImagesToFirebase();
                this.analysisData.uploadedImageUrls = uploadedUrls;
            } catch (uploadError) {
                console.error('⚠️ Image upload failed:', uploadError);
            }

            // Complete
            this.updateProgress(100);

            // Short delay then show results
            setTimeout(() => {
                this.showResults();
            }, 500);

        } catch (error) {
            clearInterval(progressInterval);
            throw error;
        }
    }

    updateProgress(progress) {
        this.currentProgress = progress;
        
        // Update progress circle
        const circumference = 597;
        const offset = circumference - (circumference * progress / 100);
        if (this.progressCircle) {
            this.progressCircle.style.strokeDashoffset = offset;
        }
    }

    async uploadImagesToFirebase() {
        if (!firebase.storage || !this.currentUser) {
            return [];
        }

        const uploadedUrls = [];

        for (let i = 0; i < this.photoFiles.length; i++) {
            const file = this.photoFiles[i];
            const filename = `${Date.now()}-${i}.jpg`;
            const storageRef = firebase.storage().ref().child(`scans/${this.currentUser.uid}/${filename}`);

            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            uploadedUrls.push(downloadURL);
        }

        return uploadedUrls;
    }

    showResults() {
        // Track that we're in results sub-mode
        this.spotSubMode = 'results';

        // Hide scan mode, show results
        this.scanMode?.classList.add('hidden');
        this.resultsMode?.classList.remove('hidden');
        this.telescopeProgress?.classList.remove('active');

        // Parse analysis data
        const analysis = this.analysisData?.analysis || this.analysisData || {};
        const routes = this.analysisData?.routes || {};
        const priceValidation = this.analysisData?.priceValidation || {};

        // DEBUG: Log all price sources to understand where value comes from
        console.log('💰 Price sources check:', {
            suggested: routes.marketAnalysis?.estimatedValue?.suggested,
            itemizedEstimate: routes.marketAnalysis?.estimatedValue?.itemizedEstimate,
            source: routes.marketAnalysis?.estimatedValue?.source,
            itemizedNote: routes.marketAnalysis?.estimatedValue?.itemizedNote,
            median: routes.marketAnalysis?.estimatedValue?.priceRange?.median
        });

        // Extract price
        let price = routes.marketAnalysis?.estimatedValue?.suggested ||
                   routes.marketAnalysis?.suggested ||
                   analysis.resale?.priceRange?.high ||
                   priceValidation?.aiEstimate ||
                   0;

        // Extract price range for context
        const priceRange = routes.marketAnalysis?.estimatedValue?.comparableItems || [];
        let minPrice = price;
        let maxPrice = price;
        if (priceRange.length > 0) {
            const prices = priceRange.map(item => item.price || item.soldPrice || 0).filter(p => p > 0);
            if (prices.length > 0) {
                minPrice = Math.min(...prices);
                maxPrice = Math.max(...prices);
            }
        }

        // Build item name - filter out "unknown" values
        const filterUnknown = (val) => {
            if (!val) return false;
            const lower = val.toLowerCase().trim();
            return lower !== 'unknown' && lower !== 'unbranded' && lower !== 'generic' && lower !== 'n/a' && lower !== '';
        };

        const brand = analysis.brand || analysis.Brand || '';
        const model = analysis.model || analysis.Model || '';
        const category = analysis.category || '';

        // Only include parts that are known/meaningful
        const nameParts = [brand, model, category].filter(filterUnknown);
        const itemName = nameParts.length > 0 ? nameParts.join(' ') : 'Item for Sale';

        // Condition
        const condition = analysis.condition?.rating || analysis.condition || 'good';

        // Determine verdict based on price
        let verdictClass = 'good';
        let verdictEmoji = '💰';
        let verdictText = 'Worth it!';
        
        if (price < 20) {
            verdictClass = 'low';
            verdictEmoji = '🤔';
            verdictText = 'Low value';
        } else if (price < 50) {
            verdictClass = 'maybe';
            verdictEmoji = '👍';
            verdictText = 'Good find';
        }

        // Update UI
        if (this.resultsVerdict) {
            this.resultsVerdict.className = `results-verdict ${verdictClass}`;
            this.resultsVerdict.innerHTML = `
                <span class="verdict-emoji">${verdictEmoji}</span>
                <span class="verdict-text">${verdictText}</span>
            `;
        }

        if (this.heroPrice) {
            this.heroPrice.innerHTML = `
                <span class="price-currency">$</span>
                <span class="price-value">${price}</span>
            `;
        }

        if (this.heroContext) {
            if (minPrice !== maxPrice) {
                this.heroContext.textContent = `Similar items sold for $${minPrice} - $${maxPrice}`;
            } else {
                this.heroContext.textContent = `Based on recent market data`;
            }
        }

        if (this.itemName) {
            this.itemName.textContent = itemName;
        }

        if (this.conditionBadge) {
            this.conditionBadge.textContent = condition;
        }

        // AI Description - enhanced for assortments
        let description = analysis.condition?.description ||
                          analysis.description ||
                          `${itemName} in ${condition} condition`;

        // Check if this is an assortment - either by flag or by category name
        const categoryLower = (analysis.category || '').toLowerCase();
        const isAssortmentByCategory = categoryLower.includes('assortment') ||
                                       categoryLower.includes('lot') ||
                                       categoryLower.includes('collection') ||
                                       categoryLower.includes('mixed');
        const isAssortment = analysis.isAssortment === true || isAssortmentByCategory;

        // DEBUG: Log assortment check before building description
        console.log('🔍 Assortment check:', {
            isAssortmentFlag: analysis.isAssortment,
            isAssortmentByCategory: isAssortmentByCategory,
            category: analysis.category,
            hasItemizedList: !!analysis.itemizedList,
            itemizedListLength: analysis.itemizedList?.length || 0,
            firstItems: analysis.itemizedList?.slice(0, 3)?.map(i => i.title) || [],
            fullItemizedList: analysis.itemizedList
        });

        // If this is an assortment with itemized list, build enhanced description
        if (isAssortment && analysis.itemizedList && analysis.itemizedList.length > 0) {
            description = this.buildItemizedDescription(analysis, itemName);
            console.log('✅ Built itemized description for assortment');
        } else if (isAssortment) {
            console.log('⚠️ Detected as assortment but no itemizedList - Claude may not have read item details');
        } else {
            console.log('⏭️ Using standard description (not an assortment)');
        }

        if (this.aiDescription) {
            this.aiDescription.textContent = description;
        }

        // Store for later use
        this.listingData = {
            itemName,
            price,
            condition,
            description,
            brand,
            model,
            category,
            isAssortment: isAssortment,
            itemizedList: analysis.itemizedList || [],
            itemCount: analysis.itemCount || 1
        };

        // Display eBay listings
        this.displayEbayListings(priceRange);

        // Display uploaded photos
        this.displayUploadedPhotos();

        // Generate share link
        this.generateShareLink();
    }

    displayEbayListings(listings) {
        if (!this.ebayListingsContainer) return;

        const validListings = listings.filter(l => l.price || l.soldPrice);

        if (this.ebayCount) {
            this.ebayCount.textContent = `${validListings.length} items`;
        }

        if (validListings.length === 0) {
            this.ebayListingsContainer.innerHTML = `
                <p style="color: var(--text-tertiary); text-align: center; padding: 16px;">
                    No comparable sales data available
                </p>
            `;
            return;
        }

        this.ebayListingsContainer.innerHTML = validListings
            .slice(0, 10)
            .map(listing => {
                const price = listing.price || listing.soldPrice || 0;
                const title = listing.title || listing.name || 'Item';
                const condition = listing.condition || '';
                const url = listing.url || listing.itemWebUrl || '#';
                const image = listing.image || '';

                return `
                    <a href="${url}" target="_blank" rel="noopener" class="ebay-listing-item">
                        ${image ? `<img src="${image}" alt="${title}" class="ebay-listing-thumbnail">` : ''}
                        <div class="ebay-listing-content">
                            <div class="ebay-listing-price">$${price}</div>
                            <div class="ebay-listing-title">${this.truncate(title, 50)}</div>
                            ${condition ? `<div class="ebay-listing-condition">${condition}</div>` : ''}
                        </div>
                    </a>
                `;
            })
            .join('');
    }

    displayUploadedPhotos() {
        if (!this.uploadedPhotosGrid) return;

        this.uploadedPhotosGrid.innerHTML = '';

        this.photoFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.alt = `Photo ${index + 1}`;
                this.uploadedPhotosGrid.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    }

    generateShareLink() {
        // Generate a unique scan ID
        const scanId = this.analysisData?.scanId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Include sharer ID for viral tracking
        const sharerId = this.currentUser?.uid || 'anon';
        
        // Build share URL with tracking
        const baseUrl = window.location.origin;
        this.shareUrl = `${baseUrl}/find/${scanId}?ref=${sharerId}`;
        
        // Store scan ID for later
        this.analysisData.scanId = scanId;
        
        if (this.shareLinkInput) {
            this.shareLinkInput.value = this.shareUrl;
        }
    }

    truncate(str, maxLength) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    }

    // ===== SHARE MODAL =====
    openShareModal() {
        // Update modal title based on context
        const modalTitle = this.shareModalOverlay?.querySelector('.share-modal-content h3');
        const shareModalActions = document.getElementById('shareModalActions');

        if (modalTitle) {
            if (this.justPinned) {
                modalTitle.innerHTML = `<span style="color: var(--accent-success);">📍 Pin Created!</span> Share This Find`;
            } else {
                modalTitle.textContent = 'Share This Find';
            }
        }

        // Show/hide the "View on Map" button based on whether we just pinned
        if (shareModalActions) {
            if (this.justPinned && this.lastPinId) {
                shareModalActions.classList.remove('hidden');
            } else {
                shareModalActions.classList.add('hidden');
            }
        }

        // Update preview
        if (this.sharePreviewTitle) {
            this.sharePreviewTitle.textContent = this.listingData?.itemName || 'Item';
        }
        if (this.sharePreviewPrice) {
            this.sharePreviewPrice.textContent = `$${this.listingData?.price || 0}`;
        }
        if (this.sharePreviewImage && this.analysisData?.uploadedImageUrls?.[0]) {
            this.sharePreviewImage.style.backgroundImage = `url(${this.analysisData.uploadedImageUrls[0]})`;
        }

        this.shareModalOverlay?.classList.remove('hidden');

        // Track share intent
        this.trackEvent('share_modal_opened');
    }

    closeShareModal() {
        this.shareModalOverlay?.classList.add('hidden');

        // If we just pinned, reset to scan mode for a fresh start
        if (this.justPinned) {
            this.justPinned = false;
            // Reset to scan mode
            this.resetToScan();
        }
    }

    viewOnMap() {
        if (this.lastPinId) {
            window.location.href = `pin-map.html?pin=${this.lastPinId}`;
        } else {
            window.location.href = 'pin-map.html';
        }
    }

    async copyShareLink() {
        try {
            await navigator.clipboard.writeText(this.shareUrl);
            
            if (this.copyLinkBtn) {
                this.copyLinkBtn.classList.add('copied');
                this.copyLinkBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Copied!
                `;
                
                setTimeout(() => {
                    this.copyLinkBtn.classList.remove('copied');
                    this.copyLinkBtn.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                    `;
                }, 2000);
            }
            
            this.trackEvent('share_link_copied');
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    shareViaPlatform(platform) {
        const text = `Check out this find! ${this.listingData?.itemName} - Worth $${this.listingData?.price}`;
        const url = this.shareUrl;

        let shareUrl;

        switch (platform) {
            case 'sms':
                shareUrl = `sms:?body=${encodeURIComponent(text + ' ' + url)}`;
                break;
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                break;
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank');
            this.trackEvent('share_initiated', {
                platform,
                item_name: this.listingData?.itemName,
                item_price: this.listingData?.price,
                pin_id: this.shareUrl?.match(/pin=([^&]+)/)?.[1] || null
            });
        }

        this.closeShareModal();
    }

    // ===== PIN MODAL =====
    openPinModal() {
        // Update preview
        if (this.pinItemName) {
            this.pinItemName.textContent = this.listingData?.itemName || 'Item';
        }
        if (this.pinItemValue) {
            this.pinItemValue.textContent = `$${this.listingData?.price || 0}`;
        }
        if (this.pinItemImage && this.analysisData?.uploadedImageUrls?.[0]) {
            this.pinItemImage.style.backgroundImage = `url(${this.analysisData.uploadedImageUrls[0]})`;
        }

        this.pinModalOverlay?.classList.remove('hidden');
    }

    closePinModal() {
        this.pinModalOverlay?.classList.add('hidden');
    }

    async useCurrentLocation() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        this.useLocationBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Getting location...
        `;

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000
                });
            });

            const { latitude, longitude } = position.coords;

            // Store coordinates
            this.pinCoordinates = { latitude, longitude };

            // Reverse geocode to get a human-readable address
            const address = await this.reverseGeocode(latitude, longitude);
            if (this.pinLocationInput) {
                this.pinLocationInput.value = address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            }

        } catch (error) {
            console.error('Error getting location:', error);
            alert('Unable to get your location. Please enter an address manually.');
        }

        this.useLocationBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Use my location
        `;
    }

    async reverseGeocode(lat, lng) {
        try {
            // Use Nominatim (OpenStreetMap) for reverse geocoding - free and no API key required
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'ThriftSpot/1.0'
                }
            });

            if (!response.ok) {
                console.warn('Reverse geocode failed:', response.status);
                return null;
            }

            const data = await response.json();

            if (data && data.address) {
                const addr = data.address;
                const parts = [];

                if (addr.house_number && addr.road) {
                    parts.push(`${addr.house_number} ${addr.road}`);
                } else if (addr.road) {
                    parts.push(addr.road);
                }

                if (addr.city || addr.town || addr.village || addr.suburb) {
                    parts.push(addr.city || addr.town || addr.village || addr.suburb);
                }

                return parts.length > 0 ? parts.join(', ') : null;
            }

            return null;
        } catch (error) {
            console.warn('Reverse geocode error:', error);
            return null;
        }
    }

    async submitPin() {
        const location = this.pinLocationInput?.value;
        const notes = this.pinNotesInput?.value;
        const status = document.querySelector('.status-option.active')?.dataset.status || 'free';

        // If "For Sale" is selected, redirect to listing-preview.html instead
        if (status === 'sale') {
            this.closePinModal();
            this.createListing();  // Reuse the existing "Keep & Sell" flow
            return;
        }

        this.pinSubmitBtn.innerHTML = '<span>Getting location...</span>';
        this.pinSubmitBtn.disabled = true;

        try {
            // Get geolocation - required for pins to appear on map
            let lat = null;
            let lng = null;
            let geohash = null;

            if (this.pinCoordinates) {
                lat = this.pinCoordinates.latitude;
                lng = this.pinCoordinates.longitude;
            } else {
                // Auto-get location if not already set
                try {
                    const position = await this.getCurrentPosition();
                    lat = position.coords.latitude;
                    lng = position.coords.longitude;
                    this.pinCoordinates = { latitude: lat, longitude: lng };

                    // Update the location input with reverse geocoded address
                    if (this.pinLocationInput && !this.pinLocationInput.value) {
                        const address = await this.reverseGeocode(lat, lng);
                        this.pinLocationInput.value = address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                    }
                } catch (geoError) {
                    console.error('Geolocation failed:', geoError);
                    alert('Location is required to pin items on the map. Please enable location access and try again.');
                    this.pinSubmitBtn.innerHTML = '<span>📍 Pin & Share</span>';
                    this.pinSubmitBtn.disabled = false;
                    return;
                }
            }

            // Calculate geohash for efficient geo-queries
            geohash = this.encodeGeohash(lat, lng, 9);

            this.pinSubmitBtn.innerHTML = '<span>Pinning...</span>';

            // Save to Firestore with proper lat/lng fields
            const db = firebase.firestore();
            const pinData = {
                // Item data
                title: this.listingData?.itemName,
                itemName: this.listingData?.itemName,
                price: this.listingData?.price || 0,
                condition: this.listingData?.condition,
                description: this.listingData?.description,
                category: this.listingData?.category,
                brand: this.listingData?.brand,
                images: this.analysisData?.uploadedImageUrls || [],
                imageUrls: this.analysisData?.uploadedImageUrls || [],

                // Location data (compatible with pin-map.html)
                location: location || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                locationNotes: notes,
                lat: lat,
                lng: lng,
                geohash: geohash,

                // Status and metadata
                status: 'active',
                listingType: 'free',
                userId: this.currentUser?.uid || 'anonymous',
                createdBy: this.currentUser?.uid || 'anonymous',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                scanId: this.analysisData?.scanId,

                // For reservations/claims
                claimedBy: null,
                reservedBy: null,
                reservedUntil: null
            };

            const docRef = await db.collection('pins').add(pinData);

            console.log('✅ Pin created:', docRef.id);

            // Update share URL to point to the pin on the map
            const sharerId = this.currentUser?.uid || 'anon';
            this.shareUrl = `${window.location.origin}/pin-map.html?pin=${docRef.id}&ref=${sharerId}`;

            this.closePinModal();

            // Set flag to indicate we just pinned (for proper flow after closing share modal)
            this.justPinned = true;
            this.lastPinId = docRef.id;

            // Open share modal automatically (preserves viral loop)
            this.openShareModal();

            this.trackEvent('pin_created', { status: 'free', pinId: docRef.id });

        } catch (error) {
            console.error('Error creating pin:', error);
            alert('Failed to create pin. Please try again.');
        }

        this.pinSubmitBtn.innerHTML = '<span>📍 Pin & Share</span>';
        this.pinSubmitBtn.disabled = false;
    }

    // Get current position with promise wrapper
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
    }

    // Geohash encoding for efficient geo-queries
    encodeGeohash(latitude, longitude, precision = 9) {
        const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
        let isEven = true;
        let lat = [-90.0, 90.0];
        let lon = [-180.0, 180.0];
        let geohash = '';
        let bit = 0;
        let ch = 0;

        while (geohash.length < precision) {
            if (isEven) {
                const mid = (lon[0] + lon[1]) / 2;
                if (longitude > mid) {
                    ch |= (1 << (4 - bit));
                    lon[0] = mid;
                } else {
                    lon[1] = mid;
                }
            } else {
                const mid = (lat[0] + lat[1]) / 2;
                if (latitude > mid) {
                    ch |= (1 << (4 - bit));
                    lat[0] = mid;
                } else {
                    lat[1] = mid;
                }
            }

            isEven = !isEven;

            if (bit < 4) {
                bit++;
            } else {
                geohash += BASE32[ch];
                bit = 0;
                ch = 0;
            }
        }

        return geohash;
    }

    // ===== CREATE LISTING =====
    async createListing() {
        if (!this.currentUser) {
            window.location.href = 'signin.html';
            return;
        }

        console.log('📝 Preparing listing...');

        const listingData = {
            ...this.analysisData,
            scanId: this.analysisData?.scanId,
            prepopulatedData: {
                ...this.listingData,
                estimatedPrice: this.listingData?.price,
                materials: this.analysisData?.analysis?.materials || []
            },
            imageUrls: this.analysisData?.uploadedImageUrls || []
        };

        sessionStorage.setItem('pendingAnalysis', JSON.stringify(listingData));
        
        this.trackEvent('create_listing_clicked');
        
        window.location.href = 'listing-preview.html';
    }

    // ===== RESET =====
    resetToScan() {
        // Track that we're back in scan sub-mode
        this.spotSubMode = 'scan';

        // Show scan mode, hide results
        this.resultsMode?.classList.add('hidden');
        this.scanMode?.classList.remove('hidden');
        
        // Reset progress
        this.updateProgress(0);
        this.telescopeProgress?.classList.remove('active');
        
        // Clear photos
        if (this.photoGallery) {
            this.photoGallery.innerHTML = '';
            this.photoGallery.classList.add('hidden');
        }
        this.photoFiles = [];
        
        // Reset scan action area
        if (this.scanActionArea) {
            this.scanActionArea.style.opacity = '1';
            this.scanActionArea.style.pointerEvents = 'auto';
        }
        
        // Disable analyze button
        if (this.analyzeButton) {
            this.analyzeButton.disabled = true;
        }
        
        // Restart camera searching animation
        if (this.cameraStream) {
            this.telescopeContainer?.classList.add('searching');
        }
        
        // Reset data
        this.analysisData = null;
        this.listingData = null;
        this.shareUrl = null;
        
        // Reset file inputs
        if (this.fileInput) this.fileInput.value = '';
    }

    // ===== ANALYTICS =====
    trackEvent(eventName, params = {}) {
        console.log(`📊 Event: ${eventName}`, params);

        // Add common context to all events
        const enrichedParams = {
            ...params,
            user_id: this.currentUser?.uid || 'anonymous',
            referrer_id: this.referrerId || null,
            timestamp: Date.now()
        };

        // Log to Firebase Analytics
        try {
            if (this.analytics) {
                this.analytics.logEvent(eventName, enrichedParams);
            }
        } catch (e) {
            console.warn('Analytics event failed:', e.message);
        }

        // Store locally for viral factor calculation (backup)
        try {
            const events = JSON.parse(localStorage.getItem('thriftspot_events') || '[]');
            events.push({
                event: eventName,
                params: enrichedParams,
                timestamp: Date.now(),
                userId: this.currentUser?.uid,
                referrerId: this.referrerId
            });
            localStorage.setItem('thriftspot_events', JSON.stringify(events.slice(-100)));
        } catch (e) {
            // Ignore storage errors
        }
    }

    // ===== MAP FUNCTIONALITY =====
    initMap() {
        console.log('🗺️ Initializing map...');

        this.map = L.map('map').setView([37.7749, -122.4194], 13);

        // CARTO Dark Matter (matches dark theme)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
            attribution: '© CARTO, © OpenStreetMap',
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(this.map);

        // Get user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                this.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                // User location marker
                L.marker([this.userLocation.lat, this.userLocation.lng], {
                    icon: L.divIcon({
                        className: 'user-location-marker',
                        html: '<div style="background: #3b82f6; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                        iconSize: [18, 18]
                    })
                }).addTo(this.map);

                // Re-fit to nearest items now that we have user location
                this.fitToNearestItems(5);
            });
        }

        console.log('✅ Map initialized');
    }

    async loadPins() {
        console.log('📍 Loading pins...');

        const db = firebase.firestore();
        const pinsSnapshot = await db.collection('pins')
            .where('status', '==', 'active')
            .get();

        this.allPins = [];
        pinsSnapshot.forEach((doc) => {
            this.allPins.push({ id: doc.id, ...doc.data() });
        });
        this.filteredPins = [...this.allPins];

        console.log(`📍 Loaded ${this.allPins.length} pins`);

        const groupedPins = this.groupPinsByProximity(this.allPins, 0.1);
        console.log(`📍 Grouped into ${groupedPins.length} locations`);

        groupedPins.forEach(group => {
            if (group.pins.length === 1) {
                this.addPinToMap(group.pins[0]);
            } else {
                this.addYardSaleToMap(group);
            }
        });

        // Fit map to show nearest items
        this.fitToNearestItems(5);
    }

    groupPinsByProximity(pins, radiusMiles) {
        const groups = [];
        const processed = new Set();

        pins.forEach(pin => {
            if (processed.has(pin.id)) return;

            const group = {
                center: { lat: pin.lat, lng: pin.lng },
                pins: [pin]
            };

            pins.forEach(otherPin => {
                if (otherPin.id === pin.id || processed.has(otherPin.id)) return;

                const distance = this.calculateDistance(
                    pin.lat, pin.lng,
                    otherPin.lat, otherPin.lng
                );

                const shouldGroup = (pin.userId === otherPin.userId && distance <= radiusMiles) ||
                                   (distance <= radiusMiles / 4);

                if (shouldGroup) {
                    group.pins.push(otherPin);
                    processed.add(otherPin.id);
                }
            });

            processed.add(pin.id);
            groups.push(group);
        });

        return groups;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                 Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
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

        this.mapMarkers.push({ id: pin.id, marker });
    }

    addYardSaleToMap(group) {
        const itemCount = group.pins.length;

        const categoryCounts = {};
        let mostCommonCategory = null;
        let maxCount = 0;

        group.pins.forEach(pin => {
            const category = pin.category || 'unknown';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            if (categoryCounts[category] > maxCount) {
                maxCount = categoryCounts[category];
                mostCommonCategory = category;
            }
        });

        const categoryIcon = this.getCategoryIcon(mostCommonCategory);

        const icon = L.divIcon({
            className: 'yard-sale-marker',
            html: `<div style="background: #fbbf24; color: black; min-width: 48px; height: 48px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: pointer; padding: 6px;">
                <div style="font-size: 16px; margin-bottom: 1px;">${categoryIcon}</div>
                <div style="font-size: 9px; font-weight: 700;">${itemCount}</div>
            </div>`,
            iconSize: [52, 52]
        });

        const marker = L.marker([group.center.lat, group.center.lng], { icon })
            .addTo(this.map)
            .on('click', () => this.showYardSaleDetails(group));

        this.mapMarkers.push({ id: `yard-sale-${group.pins[0].id}`, marker, isYardSale: true, group });
    }

    getPinIcon(pin) {
        // Default: Friendly yellow for available/unknown
        let bgColor = '#fbbf24';
        let textColor = 'black';

        if (pin.claimedBy) {
            bgColor = '#ef4444'; // red for claimed
            textColor = 'white';
        } else if (pin.reservedBy) {
            bgColor = '#eab308'; // darker amber for reserved
            textColor = 'white';
        }

        const icon = this.getCategoryIcon(pin.category);
        const displayColor = icon === '?' ? 'black' : textColor;

        return L.divIcon({
            className: 'custom-pin-marker',
            html: `<div style="background: ${bgColor}; color: ${displayColor}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${icon === '?' ? '20px' : '16px'}; font-weight: ${icon === '?' ? '700' : '400'}; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: pointer;">${icon}</div>`,
            iconSize: [40, 40]
        });
    }

    getCategoryIcon(category) {
        const icons = {
            'electronics': '📱',
            'furniture': '🪑',
            'clothing': '👕',
            'footwear': '👟',
            'tools': '🔧',
            'books': '📚',
            'toys': '🧸',
            'automotive': '🚗',
            'sporting goods': '⚽',
            'sports': '⚽',
            'jewelry': '💎',
            'home & garden': '🏡',
            'collectibles': '🏆'
        };
        return icons[category?.toLowerCase()] || '?';
    }

    fitToNearestItems(count = 5) {
        if (this.mapMarkers.length === 0) return;

        if (this.userLocation) {
            const markersWithDistance = this.mapMarkers
                .filter(m => m.marker && m.marker.getLatLng)
                .map(m => {
                    const latlng = m.marker.getLatLng();
                    const distance = this.calculateDistance(
                        this.userLocation.lat, this.userLocation.lng,
                        latlng.lat, latlng.lng
                    );
                    return { marker: m.marker, distance };
                })
                .sort((a, b) => a.distance - b.distance)
                .slice(0, count);

            if (markersWithDistance.length > 0) {
                const bounds = L.latLngBounds([
                    [this.userLocation.lat, this.userLocation.lng]
                ]);

                markersWithDistance.forEach(({ marker }) => {
                    bounds.extend(marker.getLatLng());
                });

                this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                console.log(`📍 Zoomed to show ${markersWithDistance.length} nearest items`);
            }
        } else {
            if (this.mapMarkers.length > 0) {
                const bounds = L.latLngBounds(
                    this.mapMarkers
                        .filter(m => m.marker && m.marker.getLatLng)
                        .map(m => m.marker.getLatLng())
                );
                if (bounds.isValid()) {
                    this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
                    console.log(`📍 Zoomed to show all ${this.mapMarkers.length} items`);
                }
            }
        }
    }

    setupMapEventListeners() {
        // Close pin panel
        document.getElementById('closeMapPinPanel')?.addEventListener('click', () => this.closeMapPinPanel());
        document.getElementById('mapPinPanelBackdrop')?.addEventListener('click', () => this.closeMapPinPanel());

        // Search
        const searchInput = document.getElementById('mapSearchInput');
        const suggestionsContainer = document.getElementById('mapSearchSuggestions');

        searchInput?.addEventListener('input', (e) => {
            clearTimeout(this.mapSearchTimeout);
            this.mapSearchTimeout = setTimeout(() => {
                this.handleMapSearch(e.target.value);
            }, 200);
        });

        searchInput?.addEventListener('focus', () => {
            if (searchInput.value.length > 0) {
                this.handleMapSearch(searchInput.value);
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.map-search-wrapper')) {
                suggestionsContainer?.classList.add('hidden');
            }
        });

        // Category filter
        const filterContainer = document.getElementById('mapCategoryFilter');
        filterContainer?.querySelectorAll('.map-filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                filterContainer.querySelectorAll('.map-filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                const category = chip.dataset.category;
                this.activeCategory = category;
                this.filterByCategory(category);
            });
        });
    }

    handleMapSearch(query) {
        const suggestionsContainer = document.getElementById('mapSearchSuggestions');

        if (query.length < 1) {
            suggestionsContainer?.classList.add('hidden');
            return;
        }

        const queryLower = query.toLowerCase();
        const matches = this.allPins.filter(pin => {
            const title = (pin.title || '').toLowerCase();
            const category = (pin.category || '').toLowerCase();
            const brand = (pin.brand || '').toLowerCase();
            const description = (pin.description || '').toLowerCase();

            return title.includes(queryLower) ||
                   category.includes(queryLower) ||
                   brand.includes(queryLower) ||
                   description.includes(queryLower);
        }).slice(0, 8);

        if (matches.length === 0) {
            suggestionsContainer.innerHTML = `<div class="map-suggestion-item" style="justify-content: center; color: var(--text-tertiary);">No items found</div>`;
        } else {
            suggestionsContainer.innerHTML = matches.map(pin => {
                const emoji = this.getCategoryIcon(pin.category);
                const displayTitle = this.buildDisplayTitle(pin);
                return `
                    <div class="map-suggestion-item" data-pin-id="${pin.id}">
                        <span style="font-size: 20px;">${emoji}</span>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; color: var(--text-primary); font-size: var(--font-sm);">${displayTitle}</div>
                            <div style="font-size: var(--font-xs); color: var(--text-tertiary);">${pin.category || 'General'}</div>
                        </div>
                        <span style="font-weight: 700; color: var(--accent-success);">$${pin.price || 0}</span>
                    </div>
                `;
            }).join('');

            suggestionsContainer.querySelectorAll('.map-suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    const pinId = item.dataset.pinId;
                    if (pinId) {
                        this.showPinDetails(pinId);
                        suggestionsContainer.classList.add('hidden');
                        document.getElementById('mapSearchInput').value = '';
                    }
                });
            });
        }

        suggestionsContainer?.classList.remove('hidden');
    }

    buildDisplayTitle(pin) {
        const parts = [];

        if (pin.brand && pin.brand.toLowerCase() !== 'unknown' && pin.brand.toLowerCase() !== 'unbranded') {
            parts.push(pin.brand);
        }

        if (pin.title && pin.title.toLowerCase() !== 'unknown' && pin.title.toLowerCase() !== 'untitled') {
            if (!parts.some(p => pin.title.toLowerCase().includes(p.toLowerCase()))) {
                parts.push(pin.title);
            } else {
                return pin.title;
            }
        } else if (pin.category && pin.category.toLowerCase() !== 'unknown') {
            parts.push(pin.category);
        }

        return parts.length > 0 ? parts.join(' ') : 'Item for Sale';
    }

    // Map specific item categories to broad filter categories
    getCategoryMapping() {
        return {
            electronics: [
                'laptop', 'computer', 'phone', 'smartphone', 'tablet', 'ipad', 'television', 'tv',
                'monitor', 'speaker', 'headphone', 'earphone', 'airpod', 'camera', 'xbox', 'playstation',
                'nintendo', 'gaming', 'console', 'keyboard', 'mouse', 'printer', 'router', 'modem',
                'drone', 'smartwatch', 'watch', 'electronic', 'charger', 'cable', 'adapter', 'projector',
                'receiver', 'amplifier', 'turntable', 'record player', 'bluetooth', 'wireless', 'apple',
                'samsung', 'dell', 'hp', 'lenovo', 'asus', 'acer', 'sony', 'lg', 'bose', 'jbl'
            ],
            clothing: [
                'shirt', 'pants', 'jeans', 'dress', 'jacket', 'coat', 'sweater', 'hoodie', 'blouse',
                'skirt', 'shorts', 'suit', 'blazer', 'vest', 'cardigan', 't-shirt', 'polo', 'clothing',
                'apparel', 'wear', 'outfit', 'top', 'bottom', 'underwear', 'socks', 'hat', 'cap',
                'scarf', 'glove', 'belt', 'tie', 'uniform'
            ],
            footwear: [
                'shoe', 'boot', 'sneaker', 'sandal', 'heel', 'loafer', 'slipper', 'footwear',
                'nike', 'adidas', 'jordan', 'converse', 'vans', 'puma', 'reebok', 'new balance'
            ],
            furniture: [
                'chair', 'table', 'desk', 'sofa', 'couch', 'bed', 'mattress', 'dresser', 'cabinet',
                'shelf', 'bookshelf', 'nightstand', 'ottoman', 'bench', 'stool', 'wardrobe', 'closet',
                'armoire', 'hutch', 'buffet', 'sideboard', 'furniture', 'futon', 'recliner', 'rocker',
                'loveseat', 'sectional', 'headboard', 'footboard', 'frame', 'dining', 'coffee table',
                'end table', 'console', 'entertainment center', 'tv stand', 'media'
            ],
            'home-garden': [
                'lamp', 'light', 'rug', 'carpet', 'curtain', 'drape', 'pillow', 'blanket', 'bedding',
                'sheet', 'towel', 'mirror', 'clock', 'vase', 'plant', 'pot', 'garden', 'lawn',
                'mower', 'trimmer', 'hose', 'sprinkler', 'outdoor', 'patio', 'grill', 'bbq',
                'home', 'decor', 'decoration', 'art', 'painting', 'frame', 'candle', 'kitchen',
                'appliance', 'blender', 'mixer', 'toaster', 'microwave', 'cookware', 'dinnerware',
                'utensil', 'storage', 'organizer', 'basket', 'bin', 'container'
            ],
            tools: [
                'tool', 'drill', 'saw', 'hammer', 'screwdriver', 'wrench', 'plier', 'socket',
                'power tool', 'hand tool', 'toolbox', 'workbench', 'ladder', 'level', 'tape measure',
                'dewalt', 'makita', 'milwaukee', 'bosch', 'craftsman', 'stanley', 'ryobi', 'black & decker'
            ],
            automotive: [
                'car', 'truck', 'suv', 'sedan', 'vehicle', 'auto', 'motorcycle', 'bike', 'scooter',
                'tire', 'wheel', 'rim', 'bumper', 'hood', 'fender', 'door', 'mirror', 'headlight',
                'taillight', 'engine', 'motor', 'transmission', 'brake', 'alternator', 'battery',
                'parts', 'accessory', 'automotive', 'oem', 'aftermarket'
            ],
            toys: [
                'toy', 'game', 'puzzle', 'jigsaw', 'jigsaw puzzle', 'piece puzzle', 'lego', 'action figure', 'doll', 'stuffed', 'plush',
                'board game', 'card game', 'playset', 'hot wheels', 'barbie', 'nerf', 'hasbro',
                'mattel', 'fisher price', 'little tikes', 'playskool', 'rc', 'remote control',
                'ravensburger', 'galison', 'buffalo games', 'springbok', 'ceaco', 'building set'
            ],
            sports: [
                'sport', 'exercise', 'fitness', 'gym', 'weight', 'dumbbell', 'barbell', 'treadmill',
                'bike', 'bicycle', 'cycling', 'golf', 'tennis', 'basketball', 'football', 'soccer',
                'baseball', 'hockey', 'ski', 'snowboard', 'surf', 'skateboard', 'yoga', 'camping',
                'hiking', 'fishing', 'hunting', 'outdoor', 'athletic', 'equipment', 'gear'
            ],
            books: [
                'book', 'novel', 'textbook', 'magazine', 'comic', 'manga', 'literature', 'reading',
                'hardcover', 'paperback', 'ebook', 'kindle'
            ],
            collectibles: [
                'collectible', 'antique', 'vintage', 'rare', 'limited edition', 'signed', 'autograph',
                'memorabilia', 'coin', 'stamp', 'card', 'trading card', 'pokemon', 'sports card',
                'figurine', 'statue', 'art', 'pottery', 'china', 'crystal', 'silver', 'brass'
            ],
            jewelry: [
                'jewelry', 'jewellery', 'ring', 'necklace', 'bracelet', 'earring', 'pendant',
                'chain', 'gold', 'silver', 'diamond', 'gemstone', 'pearl', 'watch', 'luxury'
            ]
        };
    }

    // Check if a pin matches a broad category
    matchesBroadCategory(pin, filterCategory) {
        const categoryMapping = this.getCategoryMapping();
        const keywords = categoryMapping[filterCategory] || [];

        // Get all searchable text from the pin
        const pinCategory = (pin.category || '').toLowerCase();
        const pinTitle = (pin.title || '').toLowerCase();
        const pinBrand = (pin.brand || '').toLowerCase();
        const pinDescription = (pin.description || '').toLowerCase();
        const pinModel = (pin.model || '').toLowerCase();

        const searchText = `${pinCategory} ${pinTitle} ${pinBrand} ${pinDescription} ${pinModel}`;

        // Check if any keyword matches
        return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    }

    filterByCategory(category) {
        // Clear existing markers
        this.mapMarkers.forEach(({ marker }) => this.map.removeLayer(marker));
        this.mapMarkers = [];

        // Filter pins
        if (category === 'all') {
            this.filteredPins = [...this.allPins];
        } else {
            // Use broad category matching instead of exact match
            this.filteredPins = this.allPins.filter(pin => this.matchesBroadCategory(pin, category));
        }

        // Re-render markers with filtered pins
        const groupedPins = this.groupPinsByProximity(this.filteredPins, 0.1);
        groupedPins.forEach(group => {
            if (group.pins.length === 1) {
                this.addPinToMap(group.pins[0]);
            } else {
                this.addYardSaleToMap(group);
            }
        });

        console.log(`📍 Showing ${this.filteredPins.length} pins for category: ${category}`);
    }

    async showPinDetails(pinId) {
        const db = firebase.firestore();
        const pinDoc = await db.collection('pins').doc(pinId).get();

        if (!pinDoc.exists) {
            console.error('Pin not found:', pinId);
            return;
        }

        const pin = { id: pinDoc.id, ...pinDoc.data() };
        this.selectedPin = pin;

        // Center map on pin
        if (pin.lat && pin.lng) {
            this.map.setView([pin.lat, pin.lng], 16);
        }

        await this.renderMapPinPanel(pin);

        document.getElementById('mapPinPanel')?.classList.remove('hidden');
        document.getElementById('mapPinPanelBackdrop')?.classList.remove('hidden');
    }

    showYardSaleDetails(group) {
        this.currentCollection = group;

        document.getElementById('mapPinPanelTitle').textContent = `${group.pins.length} items nearby`;

        const content = `
            <div class="map-yard-sale-items">
                ${group.pins.map(pin => {
                    const displayTitle = this.buildDisplayTitle(pin);
                    return `
                    <div class="map-yard-sale-item" onclick="app.showPinDetails('${pin.id}')">
                        <div class="map-yard-sale-item-name">${displayTitle}</div>
                        <div class="map-yard-sale-item-price">$${(pin.price || 0).toFixed(0)}</div>
                    </div>
                `}).join('')}
            </div>
            <div class="map-pin-actions" style="margin-top: var(--space-4);">
                <button class="map-pin-btn map-pin-btn-share" onclick="app.shareCollection()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    Share Collection
                </button>
            </div>
        `;

        document.getElementById('mapPinPanelContent').innerHTML = content;
        document.getElementById('mapPinPanel')?.classList.remove('hidden');
        document.getElementById('mapPinPanelBackdrop')?.classList.remove('hidden');
    }

    async renderMapPinPanel(pin) {
        const isOwner = this.currentUser && pin.userId === this.currentUser.uid;
        const isReserved = !!pin.reservedBy;
        const isClaimed = !!pin.claimedBy;

        const displayTitle = this.buildDisplayTitle(pin);

        document.getElementById('mapPinPanelTitle').textContent = `${displayTitle} - $${pin.price || '0'}`;

        let statusBadge = '';
        if (isClaimed) {
            statusBadge = '<span class="map-pin-status-badge map-pin-status-claimed">Claimed</span>';
        } else if (isReserved) {
            statusBadge = '<span class="map-pin-status-badge map-pin-status-reserved">Reserved</span>';
        } else {
            statusBadge = '<span class="map-pin-status-badge map-pin-status-available">Available</span>';
        }

        const images = pin.images && pin.images.length > 0
            ? `<div class="map-pin-images">${pin.images.map(url => `<img src="${url}" class="map-pin-image" alt="Item">`).join('')}</div>`
            : '';

        document.getElementById('mapPinPanelContent').innerHTML = `
            ${statusBadge}
            <div class="map-pin-meta">
                <span class="map-pin-meta-item">📦 ${pin.category || 'General'}</span>
                <span class="map-pin-meta-item">⭐ ${pin.condition || 'Good'}</span>
            </div>
            ${images}
            <p class="map-pin-description">${pin.description || 'No description.'}</p>
            ${pin.location ? `<p class="map-pin-location">📍 ${pin.location}</p>` : ''}
            <div class="map-pin-actions">
                <button class="map-pin-btn map-pin-btn-share" onclick="app.shareMapPin('${pin.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    Share Find
                </button>
                <a href="listing.html?id=${pin.id}" class="map-pin-btn map-pin-btn-secondary">View Full Listing →</a>
            </div>
        `;
    }

    closeMapPinPanel() {
        document.getElementById('mapPinPanel')?.classList.add('hidden');
        document.getElementById('mapPinPanelBackdrop')?.classList.add('hidden');
        this.selectedPin = null;
    }

    async shareMapPin(pinId) {
        const pin = this.selectedPin;
        const sharerId = this.currentUser?.uid || 'anon';
        const shareUrl = `${window.location.origin}/?pin=${pinId}&ref=${sharerId}`;
        const shareTitle = pin?.title || 'Check out this find!';
        const shareText = pin?.price
            ? `Found this for $${pin.price}! ${shareTitle}`
            : `Check out this find: ${shareTitle}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: shareUrl
                });
                console.log('✅ Shared successfully');
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
            }
        }

        // Fallback: Copy to clipboard
        try {
            await navigator.clipboard.writeText(shareUrl);
            alert('Link copied to clipboard!');
        } catch (err) {
            console.error('Copy failed:', err);
        }

        this.trackEvent('share_initiated', { platform: 'map', pinId });
    }

    async shareCollection() {
        if (!this.currentCollection) return;

        const group = this.currentCollection;
        const collectionId = group.pins.map(p => p.id).join(',');
        const sharerId = this.currentUser?.uid || 'anon';
        const shareUrl = `${window.location.origin}/?collection=${collectionId}&ref=${sharerId}`;
        const shareText = `Found ${group.pins.length} items nearby! Check them out on ThriftSpot.`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${group.pins.length} items nearby`,
                    text: shareText,
                    url: shareUrl
                });
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
            }
        }

        try {
            await navigator.clipboard.writeText(shareUrl);
            alert('Link copied to clipboard!');
        } catch (err) {
            console.error('Copy failed:', err);
        }
    }

    /**
     * Build an enhanced description for assortments with itemized list
     * @param {Object} analysis - Analysis data with itemizedList
     * @param {string} itemName - The item name/title
     * @returns {string} - Formatted description with itemized contents
     */
    buildItemizedDescription(analysis, itemName) {
        const items = analysis.itemizedList || [];
        const itemCount = items.length;

        if (itemCount === 0) {
            return analysis.condition?.description ||
                   `${itemName} in ${analysis.condition?.rating || 'good'} condition`;
        }

        // Build header
        let description = `${itemName} - ${itemCount} items included.\n\n`;

        // Add overall condition
        if (analysis.condition?.rating) {
            description += `Overall Condition: ${analysis.condition.rating.charAt(0).toUpperCase() + analysis.condition.rating.slice(1)}\n`;
        }
        if (analysis.condition?.description) {
            description += `${analysis.condition.description}\n`;
        }
        description += '\n';

        // Add itemized contents
        description += `CONTENTS:\n`;
        description += `─────────────────────\n`;

        items.forEach((item, index) => {
            let itemLine = `${index + 1}. ${item.title}`;

            if (item.author && item.author !== 'Unknown' && item.author !== '') {
                itemLine += ` by ${item.author}`;
            }

            if (item.type && item.type !== 'Unknown' && item.type !== '') {
                itemLine += ` (${item.type})`;
            }

            description += itemLine + '\n';

            // Add condition details on separate line if present
            if (item.condition && item.condition !== 'good') {
                description += `   Condition: ${item.condition}`;
                if (item.conditionNotes) {
                    description += ` - ${item.conditionNotes}`;
                }
                description += '\n';
            }

            // Add estimated value if present
            if (item.estimatedValue && item.estimatedValue !== 'Unknown' && item.estimatedValue !== '') {
                description += `   Est. Value: ${item.estimatedValue}\n`;
            }
        });

        description += `─────────────────────\n\n`;

        // Add note about condition
        description += `All items have been inspected and are sold as shown.\n`;
        description += `Please see photos for additional details.`;

        console.log('Built itemized description with', itemCount, 'items');

        return description;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ThriftSpotApp();
    window.app.init();
});

// Add spin animation for location button
const style = document.createElement('style');
style.textContent = `
    .spin {
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);