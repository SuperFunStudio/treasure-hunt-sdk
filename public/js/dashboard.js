// js/dashboard.js
// Dashboard functionality and data management

let currentUser = null;
let userData = {};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initialized');
    initializeEbayConnectionHandling();
});

// Authentication state handler - using existing Firebase config pattern
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

// Enhanced user data loading with auto-repair
async function loadUserData() {
    try {
        console.log('Loading user data for:', currentUser.uid);
        
        // Show loading state
        showLoadingState(true);
        
        // Use enhanced utility function with auto-repair
        userData = await getCurrentUserData();
        console.log('Dashboard user data loaded successfully:', userData);
        
        updateUserInterface();
        showLoadingState(false);
        
    } catch (error) {
        console.error('Error loading user data:', error);
        
        // Try one more time with manual repair if needed
        if (error.message.includes('User document not found') || error.message.includes('permission-denied')) {
            console.log('Attempting manual user document repair...');
            try {
                userData = await repairUserAccount();
                updateUserInterface();
                UIHelpers.showSuccess('Your account has been set up successfully!');
            } catch (repairError) {
                console.error('Failed to repair user account:', repairError);
                handleUserDataError(repairError);
            }
        } else {
            handleUserDataError(error);
        }
        
        showLoadingState(false);
    }
}

// Manual user account repair function
async function repairUserAccount() {
    console.log('Starting manual user account repair...');
    
    if (!currentUser) {
        throw new Error('No authenticated user available for repair');
    }
    
    const userData = {
        uid: currentUser.uid,
        email: currentUser.email,
        profile: currentUser.displayName || currentUser.email.split('@')[0] || 'Treasure Hunter',
        location: 'Not specified',
        
        // eBay integration
        ebay: {
            isConnected: false,
            sellerAccount: null
        },
        
        // Metadata
        metadata: {
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        
        // Statistics
        stats: {
            totalScans: 0,
            pinsCreated: 0,
            totalEarnings: 0,
            lastScanDate: null,
            lastConfidenceScore: null
        },
        
        // Verification
        verification: {
            emailVerified: currentUser.emailVerified || false,
            communityRating: 0
        }
    };
    
    try {
        await db.collection('users').doc(currentUser.uid).set(userData, { merge: true });
        console.log('User document repair completed successfully');
        
        // Return resolved data for immediate use
        return {
            ...userData,
            metadata: {
                createdAt: new Date(),
                lastLoginAt: new Date(),
                lastActiveAt: new Date(),
                updatedAt: new Date()
            }
        };
    } catch (error) {
        console.error('User document repair failed:', error);
        throw new Error(`Failed to repair user account: ${error.message}`);
    }
}

// Handle user data loading errors
function handleUserDataError(error) {
    const errorMessage = handleFirebaseError(error);
    
    // Show more specific error messages
    if (error.message.includes('permission-denied')) {
        UIHelpers.showError('There was a permissions issue setting up your account. Please try refreshing the page or signing out and back in.');
    } else if (error.message.includes('network')) {
        UIHelpers.showError('Network error loading your profile. Please check your connection and try again.');
    } else {
        UIHelpers.showError(`Error loading your profile: ${errorMessage}`);
    }
    
    // Show minimal UI in error state
    updateUserInterfaceMinimal();
}

// Show loading state
function showLoadingState(show) {
    const statsGrid = document.getElementById('statsGrid');
    const actionsSection = document.querySelector('.actions-section');
    const recentScans = document.querySelector('.recent-scans');
    
    if (show) {
        document.body.classList.add('dashboard-loading');
        if (statsGrid) statsGrid.style.opacity = '0.6';
        if (actionsSection) actionsSection.style.opacity = '0.6';
        if (recentScans) recentScans.style.opacity = '0.6';
    } else {
        document.body.classList.remove('dashboard-loading');
        if (statsGrid) statsGrid.style.opacity = '1';
        if (actionsSection) actionsSection.style.opacity = '1';
        if (recentScans) recentScans.style.opacity = '1';
    }
}

// Update UI with user data
function updateUserInterface() {
    const welcomeMessage = document.getElementById('welcomeMessage');
    const userName = userData.profile || currentUser.displayName || 'Treasure Hunter';
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome back, ${userName}!`;
    }
    
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        const initials = UIHelpers.getInitials(userName);
        userAvatar.textContent = initials;
    }

    // Check for shipping locations
    const hasLocations = userData.shippingLocations && userData.shippingLocations.length > 0;
    const locationSetupCard = document.getElementById('locationSetupCard');
    if (locationSetupCard) {
        locationSetupCard.style.display = hasLocations ? 'none' : 'block';
    }
    
    // Update stats with safety checks
    const stats = userData.stats || {};
    const elements = {
        totalScans: stats.totalScans || 0,
        totalEarnings: `$${(stats.totalEarnings || 0).toFixed(2)}`,
        pinsCreated: stats.pinsCreated || 0,
        communityRating: (userData.verification?.communityRating || 0).toFixed(1)
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
    
    loadEbayAccountInfo();
}

// Minimal UI update for error states
function updateUserInterfaceMinimal() {
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.textContent = 'Welcome to Treasure Hunter!';
    }
    
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.textContent = 'TH';
    }
    
    // Show default values
    const elements = {
        totalScans: 0,
        totalEarnings: '$0.00',
        pinsCreated: 0,
        communityRating: '0.0'
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

// Load dashboard data
async function loadDashboardData() {
    await loadRecentScans();
    await loadEbayAccountInfo();
}

// eBay Account Management
async function loadEbayAccountInfo() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            console.log('No authenticated user for eBay account info');
            return;
        }

        console.log('Loading eBay account info...');
        
        const data = await apiClient.getEbayAccountInfo();
        console.log('eBay account info loaded:', data.accountInfo);
        displayEbayAccountInfo(data.accountInfo);
        return data.accountInfo;
    } catch (error) {
        console.log('eBay account not connected or error:', error.message);
        if (error.message.includes('not connected') || error.message.includes('User not found')) {
            displayEbayNotConnected();
        } else {
            displayEbayError(error.message);
        }
        return null;
    }
}

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
    console.log('Redirecting to eBay connection...');
    window.location.href = '/ebay-connect.html';
}

// Recent Scans Management
async function loadRecentScans() {
    const container = document.getElementById('recentScansContainer');
    
    try {
        console.log('Loading recent scans for user:', currentUser.uid);
        
        const testQuery = await db.collection('scanned_items')
            .where('uid', '==', currentUser.uid)
            .limit(5)
            .get();
        
        console.log('Basic query successful, found', testQuery.size, 'documents');
        
        if (testQuery.empty) {
            console.log('No scans found for this user');
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
            console.log('Attempting ordered query...');
            scansQuery = await db.collection('scanned_items')
                .where('uid', '==', currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();
        } catch (orderError) {
            console.warn('Ordered query failed, using unordered:', orderError.message);
            scansQuery = testQuery;
        }
        
        console.log('Final query successful, processing', scansQuery.size, 'documents');
        
        let scansHtml = '';
        scansQuery.forEach((doc) => {
            const scan = doc.data();
            console.log('Processing scan:', doc.id, scan);
            const scanItem = createScanItem(doc.id, scan);
            scansHtml += scanItem;
        });
        
        container.innerHTML = scansHtml;
        
    } catch (error) {
        console.error('Error loading recent scans:', error);
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

function createScanItem(scanId, scan) {
    console.log('Creating scan item for:', scanId, scan);
    
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
    const categoryIcon = UIHelpers.getCategoryIcon(category);
    
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

// Utility Functions
function openScan(scanId) {
    window.location.href = `/scan-editor.html?scanId=${scanId}`;
}

function scrollToRecentScans() {
    document.querySelector('.recent-scans').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

async function testFirestoreAccess() {
    console.log('Starting Firestore access test...');
    const container = document.getElementById('recentScansContainer');
    
    try {
        console.log('Test 1: Authentication');
        if (!currentUser) {
            throw new Error('No authenticated user');
        }
        console.log('User authenticated:', currentUser.uid);
        
        console.log('Test 2: Basic Firestore read');
        const basicTest = await db.collection('scanned_items').limit(1).get();
        console.log('Basic Firestore read successful');
        
        console.log('Test 3: Check document count');
        const allDocs = await db.collection('scanned_items').get();
        console.log(`Found ${allDocs.size} total documents in scanned_items`);
        
        console.log('Test 4: Check user documents');
        const userDocs = await db.collection('scanned_items')
            .where('uid', '==', currentUser.uid)
            .get();
        console.log(`Found ${userDocs.size} documents for user ${currentUser.uid}`);
        
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
        console.error('Firestore test failed:', error);
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

// eBay Connection Handling
function initializeEbayConnectionHandling() {
    const urlParams = new URLSearchParams(window.location.search);
    const ebaySuccess = urlParams.get('ebay_success');
    const ebayError = urlParams.get('ebay_error');
    
    if (ebaySuccess === 'true') {
        console.log('Detected eBay OAuth success return');
        
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
                UIHelpers.showError('eBay connection was successful, but there was an error processing the data. Please refresh the page.');
            }
        } else {
            console.warn('eBay success detected but no connection data found');
            UIHelpers.showSuccess('eBay account connected successfully!');
            setTimeout(loadEbayAccountInfo, 1000);
        }
    }
    
    if (ebayError) {
        console.log('Detected eBay OAuth error return');
        handleEbayConnectionError({ message: ebayError });
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
}

async function handleEbayConnectionSuccess(data) {
    console.log('eBay connection successful:', data);
    
    try {
        const accountInfo = data.accountInfo;
        const successMessage = `Successfully connected to eBay as ${accountInfo.displayName || accountInfo.username}!`;
        
        UIHelpers.showSuccess(successMessage);
        displayEbayAccountInfo(accountInfo);
        
        if (userData) {
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
            console.log('Refreshing page data after eBay connection...');
            await loadUserData();
            await loadEbayAccountInfo();
        }, 1000);
        
    } catch (error) {
        console.error('Error handling eBay connection success:', error);
        UIHelpers.showError('eBay connected successfully, but there was an error updating the display. Please refresh the page.');
    }
}

function handleEbayConnectionError(error) {
    console.error('eBay connection failed:', error);
    
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
    
    UIHelpers.showError(errorMessage);
    displayEbayNotConnected();
}

// Update last active timestamp
async function updateLastActive() {
    try {
        if (currentUser && userData) {
            await db.collection('users').doc(currentUser.uid).update({
                'metadata.lastActiveAt': firebase.firestore.FieldValue.serverTimestamp(),
                'metadata.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error('Error updating last active:', error);
        // Don't throw - this is non-critical
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const signoutBtn = document.getElementById('signoutBtn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await auth.signOut();
                window.location.href = '/signin.html';
            } catch (error) {
                console.error('Sign out error:', error);
            }
        });
    }
});

// Auto-refresh data every 30 seconds
setInterval(async () => {
    if (currentUser) {
        await updateLastActive();
    }
}, 30000);