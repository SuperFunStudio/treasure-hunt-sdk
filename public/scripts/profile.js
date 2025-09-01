
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
        let originalData = null;

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

        // 🎯 Enhanced eBay Account Display FOR PROFILE PAGE
        function displayEbayAccountInfo(accountInfo) {
            const profileContainer = document.getElementById('ebayConnectionStatus');
            if (profileContainer) {
                profileContainer.innerHTML = `
                    <div class="ebay-connection ebay-connected">
                        <div class="ebay-status">
                            <div class="status-icon">✅</div>
                            <div class="status-text">
                                <h4>eBay Account Connected</h4>
                                <p><strong>${accountInfo.displayName || accountInfo.username}</strong> (@${accountInfo.username})</p>
                                <p>Account Type: ${accountInfo.sellerAccount}</p>
                                ${accountInfo.email ? `<p>Email: ${accountInfo.email}</p>` : ''}
                                <p>Connected: ${new Date(accountInfo.connectedAt).toLocaleDateString()}</p>
                                <p>Environment: ${accountInfo.environment === 'sandbox' ? '🧪 Sandbox' : '🌐 Production'}</p>
                                ${accountInfo.canList ? 
                                    '<p style="color: #2e7d32;">✅ Listing capability verified</p>' : 
                                    '<p style="color: #f57c00;">⚠️ Basic account - limited listing capability</p>'
                                }
                            </div>
                        </div>
                        <div class="action-buttons">
                            <button class="btn btn-secondary" onclick="refreshEbayConnection()">
                                🔄 Refresh Connection
                            </button>
                            <button class="btn btn-danger" onclick="disconnectEbay()">
                                🔌 Disconnect eBay
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        function displayEbayNotConnected() {
            const profileContainer = document.getElementById('ebayConnectionStatus');
            if (profileContainer) {
                profileContainer.innerHTML = `
                    <div class="ebay-connection ebay-disconnected">
                        <div class="ebay-status">
                            <div class="status-icon">⚠️</div>
                            <div class="status-text">
                                <h4>eBay Account Not Connected</h4>
                                <p>Connect your eBay account to create listings directly from scans</p>
                            </div>
                        </div>
                        <div class="action-buttons">
                            <button class="btn btn-success" onclick="connectEbay()">
                                🔗 Connect eBay Account
                            </button>
                        </div>
                        <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #666;">
                            <strong>Benefits of connecting eBay:</strong>
                            <ul style="margin: 10px 0 0 20px;">
                                <li>Create listings directly from scan results</li>
                                <li>Get real market pricing data</li>
                                <li>Streamlined selling workflow</li>
                                <li>Automatic listing optimization</li>
                            </ul>
                        </div>
                    </div>
                `;
            }
        }

        function displayEbayError(errorMessage) {
            console.error('eBay connection error:', errorMessage);
            
            const profileContainer = document.getElementById('ebayConnectionStatus');
            if (profileContainer) {
                profileContainer.innerHTML = `
                    <div class="ebay-connection ebay-disconnected">
                        <div class="ebay-status">
                            <div class="status-icon">❌</div>
                            <div class="status-text">
                                <h4>eBay Connection Error</h4>
                                <p>Error: ${errorMessage}</p>
                                <p>Please try refreshing or reconnecting your eBay account.</p>
                            </div>
                        </div>
                        <div class="action-buttons">
                            <button class="btn btn-secondary" onclick="loadEbayAccountInfo()">
                                🔄 Retry
                            </button>
                            <button class="btn btn-success" onclick="connectEbay()">
                                🔗 Reconnect eBay
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        // 🎯 Enhanced Refresh eBay Connection
        async function refreshEbayConnection() {
            console.log('🔄 Refreshing eBay connection...');
            
            const refreshButtons = document.querySelectorAll('button[onclick="refreshEbayConnection()"]');
            refreshButtons.forEach(btn => {
                btn.disabled = true;
                btn.textContent = '🔄 Refreshing...';
            });
            
            try {
                const accountInfo = await loadEbayAccountInfo();
                
                if (accountInfo) {
                    showSuccess('eBay connection refreshed successfully!');
                } else {
                    showError('Failed to refresh eBay connection. Please try reconnecting.');
                }
            } catch (error) {
                console.error('Error refreshing eBay connection:', error);
                showError('Error refreshing eBay connection: ' + error.message);
            } finally {
                refreshButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = '🔄 Refresh Connection';
                });
            }
        }

        function connectEbay() {
            console.log('🔗 Redirecting to eBay connection...');
            window.location.href = '/ebay-connect.html';
        }

        // 🎯 Enhanced Disconnect eBay Function
        async function disconnectEbay() {
            if (!confirm('Are you sure you want to disconnect your eBay account? You will no longer be able to create listings directly.')) {
                return;
            }
            
            try {
                const user = firebase.auth().currentUser;
                if (!user) {
                    throw new Error('No authenticated user');
                }
                
                showLoading(true);
                
                await db.collection('users').doc(user.uid).update({
                    'ebay.isConnected': false,
                    'ebay.accessToken': null,
                    'ebay.refreshToken': null,
                    'metadata.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('✅ eBay account disconnected');
                displayEbayNotConnected();
                showSuccess('eBay account disconnected successfully');
                
            } catch (error) {
                console.error('Error disconnecting eBay:', error);
                showError('Failed to disconnect eBay: ' + error.message);
            } finally {
                showLoading(false);
            }
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
                }
                
                setTimeout(async () => {
                    console.log('🔄 Refreshing page data after eBay connection...');
                    await loadUserProfile();
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

        // Check authentication
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                await loadUserProfile();
                
                setTimeout(() => {
                    initializeEbayConnectionHandling();
                }, 500);
            } else {
                window.location.href = '/signin.html';
            }
        });

        // Load user profile data
        async function loadUserProfile() {
            try {
                showLoading(true);
                
                const userDoc = await db.collection('users').doc(currentUser.uid).get();
                
                if (userDoc.exists) {
                    userData = userDoc.data();
                    originalData = { ...userData };
                    
                    populateProfile();
                } else {
                    showError('User profile not found');
                }
            } catch (error) {
                console.error('Error loading profile:', error);
                showError('Failed to load profile: ' + error.message);
            } finally {
                showLoading(false);
            }
        }

        // Populate profile information
        function populateProfile() {
            const initials = getInitials(userData.profile || currentUser.displayName || 'TH');
            document.getElementById('profileAvatar').textContent = initials;
            document.getElementById('profileName').textContent = userData.profile || currentUser.displayName || 'Treasure Hunter';
            document.getElementById('profileEmail').textContent = userData.email || currentUser.email;
            
            const stats = userData.stats || {};
            document.getElementById('totalScansCount').textContent = stats.totalScans || 0;
            document.getElementById('totalEarningsAmount').textContent = `${(stats.totalEarnings || 0).toFixed(2)}`;
            document.getElementById('communityRatingValue').textContent = (userData.verification?.communityRating || 0).toFixed(1);
            
            document.getElementById('displayName').value = userData.profile || '';
            document.getElementById('email').value = userData.email || '';
            document.getElementById('location').value = userData.location || '';
            document.getElementById('timezone').value = userData.timezone || 'EST';
            
            loadEbayAccountInfo();
        }

        // Profile form submission
        document.getElementById('profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                profile: document.getElementById('displayName').value.trim(),
                location: document.getElementById('location').value.trim(),
                timezone: document.getElementById('timezone').value
            };
            
            if (!formData.profile) {
                showError('Display name is required');
                return;
            }
            
            try {
                showLoading(true);
                
                await db.collection('users').doc(currentUser.uid).update({
                    ...formData,
                    'metadata.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
                });
                
                await currentUser.updateProfile({
                    displayName: formData.profile
                });
                
                userData = { ...userData, ...formData };
                
                document.getElementById('profileName').textContent = formData.profile;
                document.getElementById('profileAvatar').textContent = getInitials(formData.profile);
                
                showSuccess('Profile updated successfully!');
                
            } catch (error) {
                console.error('Error updating profile:', error);
                showError('Failed to update profile: ' + error.message);
            } finally {
                showLoading(false);
            }
        });

        // Feedback form submission
        document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const feedback = document.getElementById('feedback').value.trim();
            
            if (!feedback) {
                showError('Please enter your feedback');
                return;
            }
            
            try {
                showLoading(true);
                
                await db.collection('feedback').add({
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                    feedback: feedback,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                });
                
                document.getElementById('feedback').value = '';
                showSuccess('Thank you for your feedback! We appreciate your input.');
                
            } catch (error) {
                console.error('Error submitting feedback:', error);
                showError('Failed to submit feedback: ' + error.message);
            } finally {
                showLoading(false);
            }
        });

        // Security functions
        function changePassword() {
            if (!currentUser.email) {
                showError('Cannot change password for social login accounts');
                return;
            }
            
            const email = currentUser.email;
            
            if (confirm(`Send password reset email to ${email}?`)) {
                auth.sendPasswordResetEmail(email)
                    .then(() => {
                        showSuccess('Password reset email sent! Check your inbox.');
                    })
                    .catch((error) => {
                        console.error('Password reset error:', error);
                        showError('Failed to send password reset email: ' + error.message);
                    });
            }
        }

        function enableTwoFactor() {
            showInfo('Two-factor authentication setup coming soon!');
        }

        function deleteAccount() {
            const confirmText = 'DELETE';
            const userInput = prompt(
                `⚠️ WARNING: This will permanently delete your account and all data.\n\n` +
                `This action cannot be undone. All your scans, listings, and profile data will be lost.\n\n` +
                `Type "${confirmText}" to confirm account deletion:`
            );
            
            if (userInput !== confirmText) {
                if (userInput !== null) {
                    showError('Account deletion cancelled - confirmation text did not match');
                }
                return;
            }
            
            if (confirm('Are you absolutely sure? This action cannot be undone.')) {
                deleteAccountPermanently();
            }
        }

        async function deleteAccountPermanently() {
            try {
                showLoading(true);
                
                await deleteUserData();
                await currentUser.delete();
                
                localStorage.setItem('accountDeleted', 'true');
                window.location.href = '/signin.html';
                
            } catch (error) {
                console.error('Error deleting account:', error);
                showError('Failed to delete account: ' + error.message);
                showLoading(false);
            }
        }

        async function deleteUserData() {
            const batch = db.batch();
            
            const userRef = db.collection('users').doc(currentUser.uid);
            batch.delete(userRef);
            
            const scansQuery = await db.collection('users')
                .doc(currentUser.uid)
                .collection('scans')
                .get();
            
            scansQuery.forEach((doc) => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
        }

        function resetForm() {
            if (originalData) {
                document.getElementById('displayName').value = originalData.profile || '';
                document.getElementById('location').value = originalData.location || '';
                document.getElementById('timezone').value = originalData.timezone || 'EST';
                
                showSuccess('Form reset to original values');
            }
        }

        // Utility functions
        function getInitials(name) {
            if (!name) return 'TH';
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        }

        function showLoading(show) {
            const buttons = document.querySelectorAll('button[type="submit"]');
            buttons.forEach(btn => {
                btn.disabled = show;
                if (show) {
                    btn.textContent = 'Loading...';
                }
            });
        }

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

        function showInfo(message) {
            showSuccess(message);
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

        // Auto-save form changes (debounced)
        let saveTimeout;
        const formInputs = ['displayName', 'location', 'timezone'];
        
        formInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        console.log('Auto-saving profile changes...');
                    }, 2000);
                });
            }
        });

        // Check for account deletion message and handle eBay connection
        document.addEventListener('DOMContentLoaded', () => {
            if (localStorage.getItem('accountDeleted')) {
                localStorage.removeItem('accountDeleted');
                showSuccess('Account deleted successfully');
            }
            
            if (window.location.hash === '#ebay') {
                setTimeout(() => {
                    document.getElementById('ebaySection').scrollIntoView({ behavior: 'smooth' });
                }, 500);
            }

            // Initialize eBay connection handling
            initializeEbayConnectionHandling();
        });
   