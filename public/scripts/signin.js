
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

        // UI Elements
        const signinTab = document.getElementById('signinTab');
        const signupTab = document.getElementById('signupTab');
        const signinForm = document.getElementById('signinForm');
        const signupForm = document.getElementById('signupForm');
        const googleSignin = document.getElementById('googleSignin');
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');
        const loading = document.getElementById('loading');
        const forgotPassword = document.getElementById('forgotPassword');

        // =====================
        // ENHANCED FUNCTIONS
        // =====================

        // Updated createUserDocument function that matches your Firebase structure
        async function createUserDocument(uid, userData) {
            console.log('🔥 Creating user document for:', uid);
            console.log('📝 User data:', userData);
            
            try {
                // This matches the structure I see in your Firebase console
                const userDoc = {
                    uid: uid,
                    email: userData.email,
                    profile: userData.profile, // This becomes "Brooklyn Treasure Hunter" etc.
                    location: userData.location || 'Not specified',
                    
                    // eBay integration (matching your current structure)
                    ebay: {
                        isConnected: false,
                        sellerAccount: null
                    },
                    
                    // Metadata (matching your current structure)
                    metadata: {
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    
                    // Statistics (matching your current structure)
                    stats: {
                        totalScans: 0,
                        pinsCreated: 0,
                        totalEarnings: 0,
                        lastScanDate: null,
                        lastConfidenceScore: null
                    },
                    
                    // Verification (matching your current structure)
                    verification: {
                        emailVerified: false,
                        communityRating: 0
                    }
                };
                
                // Create the user document
                console.log('📄 Writing user document to Firestore...');
                await db.collection('users').doc(uid).set(userDoc);
                console.log('✅ User document created successfully in Firestore');
                
                return userDoc;
                
            } catch (error) {
                console.error('❌ Error creating user document:', error);
                console.error('Error details:', {
                    code: error.code,
                    message: error.message,
                    uid: uid,
                    auth: auth.currentUser?.uid
                });
                
                // More specific error messages
                if (error.code === 'permission-denied') {
                    throw new Error('Permission denied. Please make sure you are signed in.');
                } else if (error.code === 'unavailable') {
                    throw new Error('Database unavailable. Please check your connection.');
                } else {
                    throw new Error(`Failed to create user profile: ${error.message}`);
                }
            }
        }

        // Test function to verify Firestore permissions work correctly
        async function testUserDocumentCreation() {
            if (!auth.currentUser) {
                console.log('❌ No user signed in for testing');
                return;
            }
            
            const testUserId = auth.currentUser.uid;
            console.log('🧪 Testing user document access for:', testUserId);
            
            try {
                // Try to read the user's own document
                const userDoc = await db.collection('users').doc(testUserId).get();
                
                if (userDoc.exists) {
                    console.log('✅ Can read own user document');
                    console.log('📊 User data:', userDoc.data());
                } else {
                    console.log('⚠️ User document does not exist yet');
                }
                
                // Try to read someone else's document (should fail)
                try {
                    await db.collection('users').doc('fake_user_id').get();
                    console.log('❌ Security issue: can read other users documents');
                } catch (permError) {
                    if (permError.code === 'permission-denied') {
                        console.log('✅ Security working: cannot read other users documents');
                    }
                }
                
            } catch (error) {
                console.error('❌ Test failed:', error);
            }
        }

        // Enhanced sign up with better error handling
        async function handleSignUp(name, email, password, location) {
            console.log('🚀 Starting enhanced sign up process...');
            showLoading(true);
            clearMessages();
            
            try {
                // Input validation
                if (!name?.trim()) throw new Error('Name is required');
                if (!email?.trim()) throw new Error('Email is required');
                if (!password) throw new Error('Password is required');
                if (!location?.trim()) throw new Error('Location is required');
                if (password.length < 6) throw new Error('Password must be at least 6 characters');
                
                console.log('✅ Input validation passed');
                
                // Step 1: Create Firebase Auth user
                console.log('👤 Creating Firebase Auth user...');
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                console.log('✅ Firebase Auth user created:', user.uid);
                
                // Step 2: Update Auth profile
                console.log('📝 Updating Auth profile...');
                await user.updateProfile({
                    displayName: name
                });
                console.log('✅ Auth profile updated');
                
                // Step 3: Wait a moment for auth state to stabilize
                console.log('⏳ Waiting for auth state...');
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Step 4: Create Firestore document
                console.log('🗃️ Creating Firestore user document...');
                await createUserDocument(user.uid, {
                    email: email,
                    profile: name,
                    location: location
                });
                console.log('✅ User document created successfully');
                
                // Step 5: Test the creation
                await testUserDocumentCreation();
                
                // Step 6: Send email verification (optional)
                try {
                    await user.sendEmailVerification();
                    console.log('✅ Email verification sent');
                } catch (emailError) {
                    console.warn('⚠️ Email verification failed (non-critical):', emailError.message);
                }
                
                showSuccess('🎉 Account created successfully! Redirecting to dashboard...');
                
                // Redirect after success
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 2000);
                
            } catch (error) {
                console.error('❌ Sign up failed:', error);
                
                // Handle specific errors
                let errorMessage = 'Sign up failed. Please try again.';
                
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'An account with this email already exists. Try signing in instead.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password must be at least 6 characters long.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Please enter a valid email address.';
                        break;
                    case 'permission-denied':
                        errorMessage = 'Permission denied creating user profile. Please try again.';
                        break;
                    case 'unavailable':
                        errorMessage = 'Service temporarily unavailable. Please try again.';
                        break;
                    default:
                        errorMessage = error.message;
                }
                
                showError(errorMessage);
            } finally {
                showLoading(false);
            }
        }

        // Enhanced Google sign in
        async function handleGoogleSignIn() {
            console.log('🔍 Starting Google sign in...');
            showLoading(true);
            clearMessages();
            
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('email');
                provider.addScope('profile');
                
                const result = await auth.signInWithPopup(provider);
                const user = result.user;
                console.log('✅ Google sign in successful:', user.uid);
                
                // Wait for auth state
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Check if user document exists
                console.log('🔍 Checking for existing user document...');
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (!userDoc.exists) {
                    console.log('📝 Creating new user document for Google user...');
                    
                    await createUserDocument(user.uid, {
                        email: user.email,
                        profile: user.displayName || user.email.split('@')[0],
                        location: 'Not specified'
                    });
                    
                    showSuccess('🎉 Welcome to Treasure Hunter! Account setup complete.');
                } else {
                    console.log('👋 Existing user, updating metadata...');
                    await updateUserMetadata(user.uid);
                    showSuccess('👋 Welcome back to Treasure Hunter!');
                }
                
                // Test the setup
                await testUserDocumentCreation();
                
                // Redirect
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 1500);
                
            } catch (error) {
                console.error('❌ Google sign in error:', error);
                
                let errorMessage = 'Google sign in failed. Please try again.';
                
                switch (error.code) {
                    case 'auth/popup-closed-by-user':
                        errorMessage = 'Sign in was cancelled.';
                        break;
                    case 'auth/popup-blocked':
                        errorMessage = 'Pop-up was blocked. Please allow pop-ups and try again.';
                        break;
                    case 'permission-denied':
                        errorMessage = 'Permission denied. Please try again.';
                        break;
                }
                
                showError(errorMessage);
            } finally {
                showLoading(false);
            }
        }

        // Update user metadata on sign in
        async function updateUserMetadata(uid) {
            try {
                await db.collection('users').doc(uid).update({
                    'metadata.lastLoginAt': firebase.firestore.FieldValue.serverTimestamp(),
                    'metadata.lastActiveAt': firebase.firestore.FieldValue.serverTimestamp(),
                    'metadata.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ User metadata updated');
            } catch (error) {
                console.error('❌ Error updating metadata:', error);
            }
        }

        // =====================
        // EVENT LISTENERS
        // =====================

        // Tab switching
        signinTab.addEventListener('click', () => {
            signinTab.classList.add('active');
            signupTab.classList.remove('active');
            signinForm.style.display = 'block';
            signupForm.style.display = 'none';
            clearMessages();
        });

        signupTab.addEventListener('click', () => {
            signupTab.classList.add('active');
            signinTab.classList.remove('active');
            signinForm.style.display = 'none';
            signupForm.style.display = 'block';
            clearMessages();
        });

        // Sign In Form - Enhanced
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signinEmail').value.trim();
            const password = document.getElementById('signinPassword').value;
            
            showLoading(true);
            clearMessages();
            
            try {
                console.log('🔑 Signing in user...');
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                console.log('✅ Sign in successful:', userCredential.user.email);
                
                // Update user metadata
                await updateUserMetadata(userCredential.user.uid);
                
                showSuccess('✅ Sign in successful! Redirecting...');
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 1000);
                
            } catch (error) {
                console.error('❌ Sign in error:', error);
                showError(getErrorMessage(error.code));
            } finally {
                showLoading(false);
            }
        });

        // Sign Up Form - Enhanced (THIS IS THE KEY CHANGE)
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('signupName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;
            const location = document.getElementById('signupLocation').value.trim();
            
            // Call the enhanced sign up function
            await handleSignUp(name, email, password, location);
        });

        // Google Sign In - Enhanced (THIS IS THE KEY CHANGE)
        googleSignin.addEventListener('click', handleGoogleSignIn);

        // Forgot Password
        forgotPassword.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signinEmail').value;
            
            if (!email) {
                showError('Please enter your email address first');
                return;
            }
            
            try {
                await auth.sendPasswordResetEmail(email);
                showSuccess('Password reset email sent! Check your inbox.');
            } catch (error) {
                console.error('Password reset error:', error);
                showError(getErrorMessage(error.code));
            }
        });

        // Check if user is already signed in
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('👤 User already signed in:', user.email);
                window.location.href = '/dashboard.html';
            }
        });

        // Debug info on page load
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🔥 Treasure Hunter Debug Info:');
            console.log('- Firebase Apps:', firebase.apps.length);
            console.log('- Auth:', !!auth);
            console.log('- Firestore:', !!db);
            console.log('- Project:', firebaseConfig.projectId);
            
            // Monitor auth state changes
            auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log('👤 User signed in:', user.uid, user.email);
                } else {
                    console.log('👤 No user signed in');
                }
            });
        });

        // =====================
        // UTILITY FUNCTIONS
        // =====================

        function showLoading(show) {
            loading.style.display = show ? 'block' : 'none';
            signinForm.style.display = show ? 'none' : (signinTab.classList.contains('active') ? 'block' : 'none');
            signupForm.style.display = show ? 'none' : (signupTab.classList.contains('active') ? 'block' : 'none');
        }

        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        }

        function showSuccess(message) {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
        }

        function clearMessages() {
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';
        }

        function getErrorMessage(errorCode) {
            switch (errorCode) {
                case 'auth/user-not-found':
                    return 'No account found with this email address.';
                case 'auth/wrong-password':
                    return 'Incorrect password.';
                case 'auth/email-already-in-use':
                    return 'An account with this email already exists.';
                case 'auth/weak-password':
                    return 'Password should be at least 6 characters.';
                case 'auth/invalid-email':
                    return 'Please enter a valid email address.';
                case 'auth/popup-closed-by-user':
                    return 'Sign in was cancelled.';
                case 'auth/too-many-requests':
                    return 'Too many failed attempts. Please try again later.';
                default:
                    return `Authentication error: ${errorCode}`;
            }
        }
