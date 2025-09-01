//public/scripts/dashboard.js

        // 🎯 API Configuration
        const API_CONFIG = {
            projectId: 'treasurehunter-sdk', // Replace with your actual project ID
            region: 'us-central1', // Replace with your functions region if different
            
            get baseUrl() {
                return `https://${this.region}-${this.projectId}.cloudfunctions.net`;
            },
            
            get ebayAccountInfoUrl() {
                return `${this.baseUrl}/ebayAccountInfo`;
            },
            
            get ebayAuthUrl() {
                return `${this.baseUrl}/ebayAuth`;
            }
        };

        const API_BASE_URL = API_CONFIG.baseUrl;

        console.log('🔧 API Configuration loaded:', {
            baseUrl: API_CONFIG.baseUrl,
            ebayAccountInfo: API_CONFIG.ebayAccountInfoUrl,
            ebayAuth: API_CONFIG.ebayAuthUrl
        });

        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyDymYwo7NUAu7lhoPfS9KLQmckvVgky7PU",
            authDomain: "treasurehunter-sdk.firebaseapp.com",
            projectId: "treasurehunter-sdk",
            storageBucket: "treasurehunter-sdk.firebasestorage.app",
            messagingSenderId: "328804663359",
            appId: "1:328804663359:web:eb124f150c4853c123788a",
            measurementId: "G-YNJ58GLX3T"
        };

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();

        let currentUser = null;
        let userData = {};

        // 🎯 Enhanced eBay Account Info Loading
        async function loadEbayAccountInfo() {
            try {
                const user = firebase.auth().currentUser;
                if (!user) {
                    console.log('⚠️ No authenticated user for eBay account info');
                    return;
                }

                console.log('🔄 Loading eBay account info...');
                
                const response = await fetch(API_CONFIG.ebayAccountInfoUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${await user.getIdToken()}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log('📡 eBay account info response:', response.status);

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ eBay account info loaded:', data.accountInfo);
                    displayEbayAccountInfo(data.accountInfo);
                    return data.accountInfo;
                } else if (response.status === 400) {
                    console.log('📭 eBay account not connected');
                    displayEbayNotConnected();
                    return null;
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.error('❌ Error loading eBay account info:', error);
                displayEbayError(error.message);
                return null;
            }
        }

        // 🎯 Enhanced eBay Account Display
        function displayEbayAccountInfo(accountInfo) {
            const dashboardContainer = document.getElementById('ebayStatusContainer');
            if (dashboardContainer) {
                dashboardContainer.innerHTML = `
                    <div class="status-connected">
                        <span>✅</span>
                        <div>
                            <strong>Connected as ${accountInfo.displayName || accountInfo.username}</strong>
                            <br>
                            <small>@${accountInfo.username} • ${accountInfo.sellerAccount}</small>
                            ${accountInfo.canList ? 
                                '<br><small style="color: #2e7d32;">✅ Can create listings</small>' : 
                                '<br><small style="color: #f57c00;">⚠️ Basic account - limited listing capability</small>'
                            }
                        </div>
                    </div>
                `;
            }

            const ebayConnectBtn = document.getElementById('ebayConnectBtn');
            if (ebayConnectBtn) {
                ebayConnectBtn.textContent = 'Manage eBay Account';
                ebayConnectBtn.className = 'action-btn secondary';
                ebayConnectBtn.onclick = () => window.location.href = '/profile.html#ebay';
            }
        }

        function displayEbayNotConnected() {
            const dashboardContainer = document.getElementById('ebayStatusContainer');
            if (dashboardContainer) {
                dashboardContainer.innerHTML = `
                    <div class="status-disconnected">
                        <span>⚠️</span>
                        <span>eBay account not connected</span>
                    </div>
                `;
            }

            const ebayConnectBtn = document.getElementById('ebayConnectBtn');
            if (ebayConnectBtn) {
                ebayConnectBtn.textContent = 'Connect eBay Account';
                ebayConnectBtn.className = 'action-btn secondary';
                ebayConnectBtn.onclick = connectEbay;
            }
        }

        function displayEbayError(errorMessage) {
            console.error('eBay connection error:', errorMessage);
            
            const dashboardContainer = document.getElementById('ebayStatusContainer');
            if (dashboardContainer) {
                dashboardContainer.innerHTML = `
                    <div class="status-disconnected">
                        <span>❌</span>
                        <span>eBay connection error</span>
                    </div>
                `;
            }
        }

        function connectEbay() {
            console.log('🔗 Redirecting to eBay connection...');
            window.location.href = '/ebay-connect.html';
        }

        // 🎯 eBay Connection Success Handler
        async function handleEbayConnectionSuccess(data) {
            console.log('🎉 eBay connection successful:', data);
            
            try {
                const accountInfo = data.accountInfo;
                const successMessage = `Successfully connected to eBay as ${accountInfo.displayName || accountInfo.username}!`;
                
                showSuccess(successMessage);
                displayEbayAccountInfo(accountInfo);
                
                if (typeof userData !== 'undefined') {
                    userData.ebay = {
                        isConnected: true,
                        username: accountInfo.username,
                        displayName: accountInfo.displayName,
                        sellerAccount: accountInfo.sellerAccount,
                        canList: accountInfo.canList,
                        connectedAt: accountInfo.connectedAt,
                        environment: data.environment
                    };
                    
                    updateUserInterface();
                }
                
                setTimeout(async () => {
                    console.log('🔄 Refreshing page data after eBay connection...');
                    await loadUserData();
                    await loadEbayAccountInfo();
                }, 1000);
                
            } catch (error) {
                console.error('❌ Error handling eBay connection success:', error);
                showError('eBay connected successfully, but there was an error updating the display. Please refresh the page.');
            }
        }

        function handleEbayConnectionError(error) {
            console.error('❌ eBay connection failed:', error);
            
            let errorMessage = 'Failed to connect to eBay. ';
            
            if (error.message) {
                if (error.message.includes('user_cancelled')) {
                    errorMessage += 'You cancelled the connection process.';
                } else if (error.message.includes('access_denied')) {
                    errorMessage += 'Access was denied. Please try again and approve the connection.';
                } else if (error.message.includes('invalid_request')) {
                    errorMessage += 'There was a problem with the connection request. Please try again.';
                } else {
                    errorMessage += error.message;
                }
            } else {
                errorMessage += 'Please try again or contact support if the problem persists.';
            }
            
            showError(errorMessage);
            displayEbayNotConnected();
        }

        function initializeEbayConnectionHandling() {
            const urlParams = new URLSearchParams(window.location.search);
            const ebaySuccess = urlParams.get('ebay_success');
            const ebayError = urlParams.get('ebay_error');
            
            if (ebaySuccess === 'true') {
                console.log('🔍 Detected eBay OAuth success return');
                
                const connectionData = localStorage.getItem('ebay_connection_data');
                
                if (connectionData) {
                    try {
                        const data = JSON.parse(connectionData);
                        handleEbayConnectionSuccess(data);
                        localStorage.removeItem('ebay_connection_data');
                        const cleanUrl = window.location.pathname;
                        window.history.replaceState({}, document.title, cleanUrl);
                    } catch (parseError) {
                        console.error('Error parsing eBay connection data:', parseError);
                        showError('eBay connection was successful, but there was an error processing the data. Please refresh the page.');
                    }
                } else {
                    console.warn('eBay success detected but no connection data found');
                    showSuccess('eBay account connected successfully!');
                    setTimeout(loadEbayAccountInfo, 1000);
                }
            }
            
            if (ebayError) {
                console.log('🔍 Detected eBay OAuth error return');
                handleEbayConnectionError({ message: ebayError });
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        }

        // Check authentication state
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                
                console.log('User authenticated on dashboard:', {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName
                });
                
                await loadUserData();
                await loadDashboardData();
                
                setTimeout(() => {
                    initializeEbayConnectionHandling();
                }, 500);
            } else {
                window.location.href = '/signin.html';
            }
        });

        // Load user data from Firestore
        async function loadUserData() {
            try {
                const firebaseUID = currentUser.uid;
                console.log('Loading dashboard data for UID:', firebaseUID);
                
                const userDoc = await db.collection('users').doc(firebaseUID).get();
                
                if (userDoc.exists) {
                    userData = userDoc.data();
                    console.log('✅ Dashboard user data loaded successfully');
                    updateUserInterface();
                } else {
                    console.error('❌ User document not found for UID:', firebaseUID);
                    showUserNotFoundError();
                }
            } catch (error) {
                console.error('❌ Error loading user data:', error);
                showLoadingError(error);
            }
        }

        // Update UI with user data
        function updateUserInterface() {
            const welcomeMessage = document.getElementById('welcomeMessage');
            const userName = userData.profile || currentUser.displayName || 'Treasure Hunter';
            welcomeMessage.textContent = `Welcome back, ${userName}!`;
            
            const userAvatar = document.getElementById('userAvatar');
            const initials = getInitials(userName);
            userAvatar.textContent = initials;

            const hasLocations = userData.shippingLocations && userData.shippingLocations.length > 0;
const locationSetupCard = document.getElementById('locationSetupCard');
if (locationSetupCard) {
    locationSetupCard.style.display = hasLocations ? 'none' : 'block';
}
            
            const stats = userData.stats || {};
            document.getElementById('totalScans').textContent = stats.totalScans || 0;
            document.getElementById('totalEarnings').textContent = `$${(stats.totalEarnings || 0).toFixed(2)}`;
            document.getElementById('pinsCreated').textContent = stats.pinsCreated || 0;
            document.getElementById('communityRating').textContent = (userData.verification?.communityRating || 0).toFixed(1);
            
            loadEbayAccountInfo();
        }

        // Load dashboard data
        async function loadDashboardData() {
            await loadRecentScans();
            await loadEbayAccountInfo();
        }

        // Load recent scans
        async function loadRecentScans() {
            const container = document.getElementById('recentScansContainer');
            
            try {
                console.log('🔍 Loading recent scans for user:', currentUser.uid);
                
                const testQuery = await db.collection('scanned_items')
                    .where('uid', '==', currentUser.uid)
                    .limit(5)
                    .get();
                
                console.log('✅ Basic query successful, found', testQuery.size, 'documents');
                
                if (testQuery.empty) {
                    console.log('📭 No scans found for this user');
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">📱</div>
                            <p>No scans yet. Start by scanning your first item!</p>
                            <button class="action-btn" onclick="window.location.href='/scan-editor.html'" style="margin-top: 15px; max-width: 200px;">
                                Scan First Item
                            </button>
                        </div>
                    `;
                    return;
                }
                
                let scansQuery;
                try {
                    console.log('📊 Attempting ordered query...');
                    scansQuery = await db.collection('scanned_items')
                        .where('uid', '==', currentUser.uid)
                        .orderBy('timestamp', 'desc')
                        .limit(5)
                        .get();
                } catch (orderError) {
                    console.warn('⚠️ Ordered query failed, using unordered:', orderError.message);
                    scansQuery = testQuery;
                }
                
                console.log('✅ Final query successful, processing', scansQuery.size, 'documents');
                
                let scansHtml = '';
                scansQuery.forEach((doc) => {
                    const scan = doc.data();
                    console.log('📄 Processing scan:', doc.id, scan);
                    const scanItem = createScanItem(doc.id, scan);
                    scansHtml += scanItem;
                });
                
                container.innerHTML = scansHtml;
                
            } catch (error) {
                console.error('❌ Error loading recent scans:', error);
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <p><strong>Debug Info:</strong></p>
                        <p>Error: ${error.message}</p>
                        <p>User ID: ${currentUser.uid}</p>
                        <p>Collection: scanned_items</p>
                        <button class="action-btn" onclick="testFirestoreAccess()" style="margin-top: 15px; max-width: 200px;">
                            Test Firestore Access
                        </button>
                    </div>
                `;
            }
        }

        // Test Firestore access
        async function testFirestoreAccess() {
            console.log('🧪 Starting Firestore access test...');
            const container = document.getElementById('recentScansContainer');
            
            try {
                console.log('Test 1: Authentication');
                if (!currentUser) {
                    throw new Error('No authenticated user');
                }
                console.log('✅ User authenticated:', currentUser.uid);
                
                console.log('Test 2: Basic Firestore read');
                const basicTest = await db.collection('scanned_items').limit(1).get();
                console.log('✅ Basic Firestore read successful');
                
                console.log('Test 3: Check document count');
                const allDocs = await db.collection('scanned_items').get();
                console.log(`✅ Found ${allDocs.size} total documents in scanned_items`);
                
                console.log('Test 4: Check user documents');
                const userDocs = await db.collection('scanned_items')
                    .where('uid', '==', currentUser.uid)
                    .get();
                console.log(`✅ Found ${userDocs.size} documents for user ${currentUser.uid}`);
                
                console.log('Test 5: Analyzing UIDs in collection');
                const uidCounts = {};
                allDocs.forEach(doc => {
                    const uid = doc.data().uid;
                    uidCounts[uid] = (uidCounts[uid] || 0) + 1;
                });
                console.log('UID distribution:', uidCounts);
                
                if (allDocs.size > 0) {
                    const sampleDoc = allDocs.docs[0];
                    console.log('Sample document structure:', sampleDoc.id, sampleDoc.data());
                }
                
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">✅</div>
                        <h3>Firestore Test Results</h3>
                        <p><strong>User ID:</strong> ${currentUser.uid}</p>
                        <p><strong>Total Documents:</strong> ${allDocs.size}</p>
                        <p><strong>User Documents:</strong> ${userDocs.size}</p>
                        <p><strong>UIDs Found:</strong> ${Object.keys(uidCounts).join(', ')}</p>
                        <p>Check browser console for detailed logs</p>
                        <button class="action-btn" onclick="loadRecentScans()" style="margin-top: 15px;">
                            Try Loading Scans Again
                        </button>
                    </div>
                `;
                
            } catch (error) {
                console.error('❌ Firestore test failed:', error);
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">❌</div>
                        <h3>Firestore Test Failed</h3>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p><strong>Code:</strong> ${error.code || 'Unknown'}</p>
                        <p>Check browser console and Firebase rules</p>
                    </div>
                `;
            }
        }

        // Create scan item HTML
        function createScanItem(scanId, scan) {
            console.log('🏗️ Creating scan item for:', scanId, scan);
            
            const analysis = scan.analysis || scan;
            const category = analysis.category || scan.category || 'Unknown Item';
            const brand = (analysis.brand && analysis.brand !== 'Unknown') ? analysis.brand : '';
            const title = brand ? `${brand} ${category}` : category;
            
            let createdAt = 'Recently';
            if (scan.timestamp) {
                try {
                    const date = typeof scan.timestamp === 'string' 
                        ? new Date(scan.timestamp) 
                        : scan.timestamp.toDate ? scan.timestamp.toDate() : new Date(scan.timestamp);
                    createdAt = date.toLocaleDateString();
                } catch (e) {
                    console.warn('Failed to parse timestamp:', scan.timestamp);
                }
            } else if (scan.createdAt) {
                try {
                    createdAt = scan.createdAt.toDate ? 
                        scan.createdAt.toDate().toLocaleDateString() : 
                        new Date(scan.createdAt).toLocaleDateString();
                } catch (e) {
                    console.warn('Failed to parse createdAt:', scan.createdAt);
                }
            }
            
            const status = scan.status || 'completed';
            const statusClass = `status-${status}`;
            const statusText = status.charAt(0).toUpperCase() + status.slice(1);
            
            const confidence = analysis.confidence || analysis.confidence_rating || scan.confidence || 'N/A';
            const categoryIcon = getCategoryIcon(category);
            
            return `
                <div class="scan-item" onclick="openScan('${scanId}')">
                    <div class="scan-image">
                        ${categoryIcon}
                    </div>
                    <div class="scan-details">
                        <div class="scan-title">${title}</div>
                        <div class="scan-meta">${createdAt} • Confidence: ${confidence}/10</div>
                    </div>
                    <div class="scan-status ${statusClass}">
                        ${statusText}
                    </div>
                </div>
            `;
        }

        // Get category icon
        function getCategoryIcon(category) {
            const icons = {
                'electronics': '📱',
                'furniture': '🪑',
                'clothing': '👕',
                'tools': '🔧',
                'books': '📚',
                'toys': '🧸',
                'jewelry': '💍',
                'automotive': '🚗',
                'sporting goods': '⚽',
                'home & garden': '🏡'
            };
            
            return icons[category?.toLowerCase()] || '📦';
        }

        // Open scan for editing
        function openScan(scanId) {
            window.location.href = `/scan-editor.html?scanId=${scanId}`;
        }

        // Scroll to recent scans
        function scrollToRecentScans() {
            document.querySelector('.recent-scans').scrollIntoView({ 
                behavior: 'smooth' 
            });
        }

        // Update last active timestamp
        async function updateLastActive() {
            try {
                await db.collection('users').doc(currentUser.uid).update({
                    'metadata.lastActiveAt': firebase.firestore.FieldValue.serverTimestamp(),
                    'metadata.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error('Error updating last active:', error);
            }
        }

        // Error handling functions
        function showUserNotFoundError() {
            showError('User profile not found. Please try signing out and back in.');
        }

        function showLoadingError(error) {
            showError(`Failed to load dashboard data: ${error.message}`);
        }

        // Utility functions
        function showSuccess(message) {
            console.log('✅', message);
            const successDiv = document.getElementById('successMessage');
            if (successDiv) {
                successDiv.textContent = message;
                successDiv.style.display = 'block';
                successDiv.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => {
                    successDiv.style.display = 'none';
                }, 5000);
            } else {
                createTemporaryMessage(message, 'success');
            }
        }

        function showError(message) {
            console.error('❌', message);
            const errorDiv = document.getElementById('errorMessage');
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
                errorDiv.scrollIntoView({ behavior: 'smooth' });
            } else {
                createTemporaryMessage(message, 'error');
            }
        }

        function createTemporaryMessage(message, type) {
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                background: ${type === 'success' ? '#4caf50' : '#f44336'};
            `;
            messageDiv.textContent = message;
            document.body.appendChild(messageDiv);
            
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, type === 'success' ? 5000 : 8000);
        }

        function getInitials(name) {
            if (!name) return 'TH';
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        }

        // Sign out
        document.getElementById('signoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await auth.signOut();
                window.location.href = '/signin.html';
            } catch (error) {
                console.error('Sign out error:', error);
            }
        });

        // Auto-refresh data every 30 seconds
        setInterval(async () => {
            if (currentUser) {
                await updateLastActive();
            }
        }, 30000);

        // Initialize eBay connection handling on page load
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🎯 Dashboard initialized');
            initializeEbayConnectionHandling();
        });
   