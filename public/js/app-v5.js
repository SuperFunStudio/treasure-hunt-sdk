/**
 * ThriftSpot v5 - Main Application
 * Single-page app with Spot/Thrift mode switching
 */

class ThriftSpotApp {
    constructor() {
        this.currentMode = 'spot';
        this.currentUser = null;
        this.map = null;
        this.cameraStream = null;
        this.telescopeLoader = null;
        this.analysisData = null;
        this.selectedPin = null;
        this.stripe = null;
        this.cardElement = null;

        this.init();
    }

    async init() {
        // Initialize Firebase Auth
        await this.initAuth();

        // Initialize UI
        this.initModeSwitching();
        this.initCamera();
        this.initUpload();
        this.initModals();

        // Initialize map (lazy load when entering thrift mode)
        this.setupMapLazyLoad();

        // Initialize Stripe (lazy load when needed)
        this.setupStripeLazyLoad();
    }

    /**
     * Authentication
     */
    async initAuth() {
        firebase.auth().onAuthStateChanged((user) => {
            this.currentUser = user;

            const userMenu = document.getElementById('userMenu');
            const authButtons = document.getElementById('authButtons');

            if (user) {
                // Show user menu
                userMenu.classList.remove('hidden');
                authButtons.classList.add('hidden');

                // Set user avatar
                const userAvatar = document.getElementById('userAvatar');
                const initials = user.displayName
                    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase()
                    : user.email[0].toUpperCase();
                userAvatar.textContent = initials;
            } else {
                // Show auth buttons
                userMenu.classList.add('hidden');
                authButtons.classList.remove('hidden');
            }
        });

        // User menu dropdown
        const userAvatar = document.getElementById('userAvatar');
        const dropdownMenu = document.getElementById('dropdownMenu');

        userAvatar?.addEventListener('click', () => {
            dropdownMenu.classList.toggle('hidden');
        });

        // Sign out
        document.getElementById('signOutBtn')?.addEventListener('click', async () => {
            await firebase.auth().signOut();
            window.location.href = 'signin.html';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userAvatar?.contains(e.target) && !dropdownMenu?.contains(e.target)) {
                dropdownMenu?.classList.add('hidden');
            }
        });
    }

    /**
     * Mode Switching
     */
    initModeSwitching() {
        // Desktop toggle
        const desktopToggleBtns = document.querySelectorAll('.mode-toggle .mode-toggle-btn');
        desktopToggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.switchMode(mode);
            });
        });

        // Mobile bottom nav
        const bottomNavItems = document.querySelectorAll('.bottom-nav-item[data-mode]');
        bottomNavItems.forEach(item => {
            item.addEventListener('click', () => {
                const mode = item.dataset.mode;
                this.switchMode(mode);
            });
        });
    }

    switchMode(mode) {
        if (mode === this.currentMode) return;

        this.currentMode = mode;

        // Update views
        const spotMode = document.getElementById('spotMode');
        const thriftMode = document.getElementById('thriftMode');

        if (mode === 'spot') {
            spotMode.classList.add('active');
            thriftMode.classList.remove('active');
        } else {
            spotMode.classList.remove('active');
            thriftMode.classList.add('active');

            // Initialize map if needed
            if (!this.map) {
                this.initMap();
            }
        }

        // Update toggle buttons
        document.querySelectorAll('[data-mode]').forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * Camera Functionality
     */
    initCamera() {
        // Check if mobile
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            this.startCamera();
        }

        // Capture button
        const captureBtn = document.getElementById('captureBtn');
        captureBtn?.addEventListener('click', () => {
            this.capturePhoto();
        });
    }

    async startCamera() {
        try {
            const cameraView = document.getElementById('cameraView');
            const video = document.getElementById('cameraVideo');
            const captureBtn = document.getElementById('captureBtn');
            const uploadArea = document.getElementById('uploadArea');

            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera on mobile
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            this.cameraStream = stream;
            video.srcObject = stream;

            // Show camera view
            cameraView.classList.remove('hidden');
            captureBtn.classList.remove('hidden');
            uploadArea?.classList.add('hidden');

        } catch (error) {
            console.error('Camera access denied:', error);
            // Fallback to file upload
            this.showUploadFallback();
        }
    }

    showUploadFallback() {
        const cameraView = document.getElementById('cameraView');
        const captureBtn = document.getElementById('captureBtn');
        const uploadArea = document.getElementById('uploadArea');

        cameraView?.classList.add('hidden');
        captureBtn?.classList.add('hidden');
        uploadArea?.classList.remove('hidden');
    }

    async capturePhoto() {
        const video = document.getElementById('cameraVideo');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
            await this.processImages([file]);
        }, 'image/jpeg', 0.9);
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
    }

    /**
     * File Upload
     */
    initUpload() {
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');

        fileInput?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                this.processImages(files);
            }
        });

        // Drag and drop
        uploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea?.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea?.addEventListener('drop', async (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) {
                await this.processImages(files);
            }
        });
    }

    /**
     * Image Processing and Analysis
     */
    async processImages(files) {
        // Stop camera if active
        this.stopCamera();

        // Show analyzing section
        this.showSection('analyzingSection');

        // Compress images
        const compressedFiles = await this.compressImages(files);

        // Create telescope loader
        const container = document.getElementById('telescopeContainer');
        this.telescopeLoader = createTelescopeLoader(container);
        this.telescopeLoader.start();

        try {
            // Upload and analyze
            const analysis = await this.analyzeWithAPI(compressedFiles);

            // Store analysis data
            this.analysisData = analysis;

            // Complete loading
            this.telescopeLoader.animateTo(100, 1000);

            // Wait for animation to complete
            setTimeout(() => {
                this.showResults(analysis);
            }, 1500);

        } catch (error) {
            console.error('Analysis failed:', error);
            this.showError('Failed to analyze image. Please try again.');
            this.showSection('uploadSection');
        }
    }

    async compressImages(files) {
        const options = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1200,
            useWebWorker: true
        };

        const compressed = await Promise.all(
            files.map(file => imageCompression(file, options))
        );

        return compressed;
    }

    async analyzeWithAPI(files) {
        // Convert files to base64
        const filePromises = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        });

        const base64Images = await Promise.all(filePromises);

        // Simulate progress through stages
        const stages = [
            { percent: 20, duration: 800, name: 'Uploading' },
            { percent: 40, duration: 2000, name: 'AI Analysis' },
            { percent: 60, duration: 1500, name: 'Category Detection' },
            { percent: 80, duration: 1500, name: 'Pricing Research' },
        ];

        for (const stage of stages) {
            this.updateStageInfo(stage.name);
            this.telescopeLoader?.animateTo(stage.percent, stage.duration);
            await new Promise(resolve => setTimeout(resolve, stage.duration));
        }

        // Call actual API
        const apiClient = window.apiClient || { analyzeImages: this.mockAnalyzeImages.bind(this) };
        const result = await apiClient.analyzeImages(base64Images);

        return result;
    }

    // Mock API for testing
    mockAnalyzeImages(images) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    name: 'IKEA POÄNG Chair',
                    estimatedValue: 65,
                    condition: 'Good',
                    description: 'IKEA POÄNG in good condition. Acquired for around $200 a year ago. Minor scuffs no tears, and all parts included.',
                    category: 'Furniture',
                    ebayListings: [
                        { price: 75, date: '11/19/2025', soldDate: '11/19/2025', title: 'IKEA POÄNG Chair Brown' },
                        { price: 65, date: '09/14/2025', soldDate: '09/14/2025', title: 'IKEA POÄNG Armchair' },
                        { price: 62, date: '11/13/2025', soldDate: '11/13/2025', title: 'IKEA POÄNG Rocking Chair' }
                    ],
                    images: images
                });
            }, 500);
        });
    }

    updateStageInfo(stageName) {
        const stageNameEl = document.getElementById('stageName');
        const stageDescEl = document.getElementById('stageDescription');

        if (stageNameEl) stageNameEl.textContent = stageName;

        const descriptions = {
            'Uploading': 'Sending images to our servers...',
            'AI Analysis': 'Claude AI is analyzing your item...',
            'Category Detection': 'Identifying item category and brand...',
            'Pricing Research': 'Researching recent eBay sales...'
        };

        if (stageDescEl) stageDescEl.textContent = descriptions[stageName] || 'Processing...';
    }

    /**
     * Results Display
     */
    showResults(analysis) {
        this.showSection('resultsSection');

        // Populate item details
        document.getElementById('itemName').textContent = analysis.name;
        document.getElementById('estimatedValue').textContent = `$${analysis.estimatedValue}`;
        document.getElementById('conditionBadge').textContent = analysis.condition;

        // Display eBay listings
        const ebayContainer = document.getElementById('ebayListingsContainer');
        ebayContainer.innerHTML = '';

        if (analysis.ebayListings && analysis.ebayListings.length > 0) {
            analysis.ebayListings.forEach(listing => {
                const listingEl = document.createElement('div');
                listingEl.className = 'ebay-listing-item';
                listingEl.style.cssText = 'padding: var(--space-3); border: 1px solid var(--gray-200); border-radius: var(--radius-md); margin-bottom: var(--space-2);';
                listingEl.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="font-medium">${listing.title}</p>
                            <p class="text-sm text-muted">Sold: ${listing.soldDate}</p>
                        </div>
                        <p class="text-lg font-bold">$${listing.price}</p>
                    </div>
                `;
                ebayContainer.appendChild(listingEl);
            });
        } else {
            ebayContainer.innerHTML = '<p class="text-muted">No recent eBay sales found</p>';
        }

        // Preview listing button
        document.getElementById('previewListingBtn').onclick = () => {
            this.showListingPreview(analysis);
        };
    }

    /**
     * Listing Preview Modal
     */
    showListingPreview(analysis) {
        const modal = document.getElementById('listingModal');
        const backdrop = document.getElementById('listingModalBackdrop');

        // Populate fields
        document.getElementById('listingTitle').value = analysis.name;
        document.getElementById('listingPrice').value = analysis.estimatedValue;
        document.getElementById('listingCondition').value = analysis.condition.toLowerCase();
        document.getElementById('listingDescription').value = analysis.description || '';

        // Show photos
        const photoGallery = document.getElementById('photoGallery');
        photoGallery.innerHTML = '';
        if (analysis.images) {
            analysis.images.forEach((img, index) => {
                const photoDiv = document.createElement('div');
                photoDiv.style.cssText = 'position: relative; width: 80px; height: 80px;';
                photoDiv.innerHTML = `
                    <img src="${img}" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-md);">
                    <button class="remove-photo" data-index="${index}" style="position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; background: var(--error); color: white; border: none; cursor: pointer;">✕</button>
                `;
                photoGallery.appendChild(photoDiv);
            });
        }

        // Show modal
        backdrop.classList.remove('hidden');

        // Add photo button
        document.getElementById('addPhotosBtn').onclick = () => {
            document.getElementById('addPhotosInput').click();
        };

        document.getElementById('addPhotosInput').onchange = (e) => {
            this.handleNewPhotos(e.target.files);
        };

        // Publish button
        document.getElementById('publishListingBtn').onclick = () => {
            this.publishListing();
        };

        // Close buttons
        document.getElementById('closeListingModal').onclick = () => {
            backdrop.classList.add('hidden');
        };

        document.getElementById('cancelListingBtn').onclick = () => {
            backdrop.classList.add('hidden');
        };
    }

    async handleNewPhotos(files) {
        if (files.length === 0) return;

        // Show confirmation dialog
        const shouldReanalyze = confirm('Photos changed. Re-analyze condition and value?');

        if (shouldReanalyze) {
            // Close modal
            document.getElementById('listingModalBackdrop').classList.add('hidden');

            // Re-run analysis with new photos
            await this.processImages(Array.from(files));
        } else {
            // Just add photos to gallery
            const photoGallery = document.getElementById('photoGallery');
            const compressed = await this.compressImages(Array.from(files));

            for (const file of compressed) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const photoDiv = document.createElement('div');
                    photoDiv.style.cssText = 'position: relative; width: 80px; height: 80px;';
                    photoDiv.innerHTML = `
                        <img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-md);">
                        <button class="remove-photo" style="position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; background: var(--error); color: white; border: none; cursor: pointer;">✕</button>
                    `;
                    photoGallery.appendChild(photoDiv);
                };
                reader.readAsDataURL(file);
            }
        }
    }

    async publishListing() {
        if (!this.currentUser) {
            alert('Please sign in to publish listings');
            window.location.href = 'signin.html';
            return;
        }

        // Get form data
        const listingData = {
            title: document.getElementById('listingTitle').value,
            price: parseFloat(document.getElementById('listingPrice').value),
            condition: document.getElementById('listingCondition').value,
            description: document.getElementById('listingDescription').value,
            acceptOffers: document.getElementById('acceptOffers').checked,
            listOnLocality: document.getElementById('listOnLocality').checked,
            listOnEbay: document.getElementById('listOnEbay').checked,
            userId: this.currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            // Save to Firestore
            await firebase.firestore().collection('listings').add(listingData);

            // Show success modal
            this.showSuccessModal(listingData);

            // Close listing modal
            document.getElementById('listingModalBackdrop').classList.add('hidden');

        } catch (error) {
            console.error('Failed to publish listing:', error);
            alert('Failed to publish listing. Please try again.');
        }
    }

    showSuccessModal(listingData) {
        const backdrop = document.getElementById('successModalBackdrop');
        backdrop.classList.remove('hidden');

        // View on map button
        document.getElementById('viewOnMapBtn').onclick = () => {
            backdrop.classList.add('hidden');
            this.switchMode('thrift');
        };

        // Edit button
        document.getElementById('editListingBtn').onclick = () => {
            backdrop.classList.add('hidden');
            this.showListingPreview(this.analysisData);
        };
    }

    /**
     * Map Functionality
     */
    setupMapLazyLoad() {
        // Initialize map when entering thrift mode
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.classList.contains('active') && !this.map) {
                    this.initMap();
                }
            });
        });

        const thriftMode = document.getElementById('thriftMode');
        observer.observe(thriftMode, { attributes: true, attributeFilter: ['class'] });
    }

    async initMap() {
        const mapDiv = document.getElementById('map');

        // Create Leaflet map
        this.map = L.map(mapDiv, {
            center: [34.0522, -118.2437], // Los Angeles default
            zoom: 13,
            zoomControl: true
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Get user location
        this.getUserLocation();

        // Load nearby pins
        await this.loadNearbyPins();

        // Initialize weather
        this.initWeather();

        // Grid toggle
        let gridLayer = null;
        document.getElementById('toggleGridBtn').onclick = () => {
            if (gridLayer) {
                this.map.removeLayer(gridLayer);
                gridLayer = null;
                document.getElementById('gridToggleText').textContent = 'Show Grid';
            } else {
                gridLayer = this.createGridOverlay();
                gridLayer.addTo(this.map);
                document.getElementById('gridToggleText').textContent = 'Hide Grid';
            }
        };
    }

    getUserLocation() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                this.map.setView([latitude, longitude], 13);

                // Add user marker
                L.marker([latitude, longitude], {
                    icon: L.divIcon({
                        html: '<div style="width: 20px; height: 20px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                        className: 'user-marker',
                        iconSize: [20, 20]
                    })
                }).addTo(this.map).bindPopup('You are here');
            });
        }
    }

    async loadNearbyPins() {
        // Load pins from Firestore
        const pinsSnapshot = await firebase.firestore()
            .collection('pins')
            .where('status', 'in', ['active', 'sold'])
            .limit(50)
            .get();

        pinsSnapshot.forEach(doc => {
            const pin = doc.data();
            this.addPinToMap(doc.id, pin);
        });
    }

    addPinToMap(pinId, pinData) {
        const isSold = pinData.status === 'sold';
        const iconColor = isSold ? '#dc2626' : '#10b981';

        const marker = L.marker([pinData.location.latitude, pinData.location.longitude], {
            icon: L.divIcon({
                html: `<div style="width: 30px; height: 30px; background: ${iconColor}; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px;">${isSold ? '🔴' : '📍'}</div>`,
                className: 'pin-marker',
                iconSize: [30, 30]
            })
        }).addTo(this.map);

        marker.on('click', () => {
            this.showPinDetails(pinId, pinData);
        });
    }

    showPinDetails(pinId, pinData) {
        this.selectedPin = { id: pinId, ...pinData };

        const backdrop = document.getElementById('pinModalBackdrop');
        const detailsContainer = document.getElementById('pinDetailsContainer');
        const purchaseBtn = document.getElementById('purchaseBtn');

        // Populate details
        const isSold = pinData.status === 'sold';

        detailsContainer.innerHTML = `
            ${isSold ? '<div class="sold-badge">SOLD</div>' : ''}
            <img src="${pinData.images?.[0] || 'https://via.placeholder.com/400x300'}" style="width: 100%; border-radius: var(--radius-lg); margin-bottom: var(--space-4);">
            <h3>${pinData.title || 'Item'}</h3>
            <div class="flex justify-between items-center mt-4">
                <p class="text-2xl font-bold">$${pinData.price}</p>
                <span class="badge badge-primary">${pinData.condition}</span>
            </div>
            <p class="mt-4 text-muted">${pinData.description || 'No description available'}</p>
        `;

        // Show/hide purchase button
        if (isSold) {
            purchaseBtn.classList.add('hidden');
        } else {
            purchaseBtn.classList.remove('hidden');
            purchaseBtn.onclick = () => {
                this.showCheckout(pinData);
            };
        }

        backdrop.classList.remove('hidden');

        // Close button
        document.getElementById('closePinModal').onclick = () => {
            backdrop.classList.add('hidden');
        };
    }

    createGridOverlay() {
        // Create a simple grid overlay
        const bounds = this.map.getBounds();
        const gridLines = [];

        // Vertical lines
        for (let lng = Math.floor(bounds.getWest()); lng <= Math.ceil(bounds.getEast()); lng += 0.01) {
            gridLines.push([
                [bounds.getSouth(), lng],
                [bounds.getNorth(), lng]
            ]);
        }

        // Horizontal lines
        for (let lat = Math.floor(bounds.getSouth()); lat <= Math.ceil(bounds.getNorth()); lat += 0.01) {
            gridLines.push([
                [lat, bounds.getWest()],
                [lat, bounds.getEast()]
            ]);
        }

        return L.polyline(gridLines, {
            color: '#9ca3af',
            weight: 1,
            opacity: 0.3
        });
    }

    async initWeather() {
        // Get weather data (would use OpenWeatherMap API in production)
        const weatherWidget = document.getElementById('weatherWidget');
        weatherWidget.innerHTML = `
            <div style="background: white; padding: var(--space-3); border-radius: var(--radius-md); box-shadow: var(--shadow-md); position: absolute; top: var(--space-4); left: var(--space-4); z-index: 1000;">
                <p style="font-size: var(--text-sm); color: var(--gray-600);">Chance of rain in 3 hours</p>
            </div>
        `;
    }

    /**
     * Checkout/Purchase
     */
    setupStripeLazyLoad() {
        // Load Stripe when needed
        window.loadStripe = async () => {
            if (!this.stripe) {
                const stripeScript = document.createElement('script');
                stripeScript.src = 'https://js.stripe.com/v3/';
                stripeScript.onload = () => {
                    this.stripe = Stripe('YOUR_STRIPE_PUBLIC_KEY'); // Replace with actual key
                    const elements = this.stripe.elements();
                    this.cardElement = elements.create('card');
                    this.cardElement.mount('#card-element');
                };
                document.head.appendChild(stripeScript);
            }
        };
    }

    showCheckout(pinData) {
        // Close pin modal
        document.getElementById('pinModalBackdrop').classList.add('hidden');

        // Load Stripe if not loaded
        if (!this.stripe) {
            window.loadStripe();
        }

        const backdrop = document.getElementById('checkoutModalBackdrop');
        const itemSummary = document.getElementById('checkoutItemSummary');
        const total = document.getElementById('checkoutTotal');

        // Populate item summary
        itemSummary.innerHTML = `
            <div class="flex gap-4">
                <img src="${pinData.images?.[0] || 'https://via.placeholder.com/80'}" style="width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-md);">
                <div class="flex-1">
                    <h4>${pinData.title}</h4>
                    <p class="text-muted">${pinData.condition}</p>
                    <p class="font-bold">$${pinData.price}</p>
                </div>
            </div>
        `;

        total.textContent = `$${pinData.price}`;

        backdrop.classList.remove('hidden');

        // Close buttons
        document.getElementById('closeCheckoutModal').onclick = () => {
            backdrop.classList.add('hidden');
        };

        document.getElementById('cancelCheckoutBtn').onclick = () => {
            backdrop.classList.add('hidden');
        };

        // Purchase button
        document.getElementById('completePurchaseBtn').onclick = async () => {
            await this.completePurchase(pinData);
        };
    }

    async completePurchase(pinData) {
        if (!this.currentUser) {
            alert('Please sign in to make a purchase');
            return;
        }

        try {
            // In production, would create Stripe payment intent
            // For now, simulate purchase

            // Update pin status
            await firebase.firestore()
                .collection('pins')
                .doc(this.selectedPin.id)
                .update({
                    status: 'sold',
                    soldTo: this.currentUser.uid,
                    soldAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            // Close checkout
            document.getElementById('checkoutModalBackdrop').classList.add('hidden');

            // Show success
            alert('Purchase successful! 🎉');

            // Reload pins
            this.map.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    this.map.removeLayer(layer);
                }
            });
            await this.loadNearbyPins();

        } catch (error) {
            console.error('Purchase failed:', error);
            alert('Purchase failed. Please try again.');
        }
    }

    /**
     * Modals
     */
    initModals() {
        // Close modals when clicking backdrop
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    backdrop.classList.add('hidden');
                }
            });
        });
    }

    /**
     * Section Management
     */
    showSection(sectionId) {
        const sections = ['uploadSection', 'analyzingSection', 'resultsSection'];
        sections.forEach(id => {
            const section = document.getElementById(id);
            if (id === sectionId) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });
    }

    showError(message) {
        alert(message); // In production, use a toast/notification system
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ThriftSpotApp();
});
