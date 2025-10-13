// js/firebase-config.js
// Shared Firebase configuration for all pages

const firebaseConfig = {
  apiKey: "AIzaSyDymYwo7NUAu7lhoPfS9KLQmckvVgky7PU",
  authDomain: "treasurehunter-sdk.firebaseapp.com",
  projectId: "treasurehunter-sdk",
  storageBucket: "treasurehunter-sdk.firebasestorage.app",
  messagingSenderId: "328804663359",
  appId: "1:328804663359:web:eb124f150c4853c123788a",
  measurementId: "G-YNJ58GLX3T"
};

// Initialize Firebase (this will be included on each page)
firebase.initializeApp(firebaseConfig);

// Global Firebase instances
const auth = firebase.auth();
const db = firebase.firestore();

// Global auth state checker
function requireAuth() {
    return new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                window.location.href = '/signin.html';
                reject(new Error('Authentication required'));
            }
        });
    });
}

// Enhanced user data loader with auto-repair
async function getCurrentUserData() {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            console.log('🔧 User document not found, creating missing document...');
            const newUserData = await createMissingUserDocument(user);
            return newUserData;
        }
        
        const userData = userDoc.data();
        
        // Validate and repair incomplete documents
        const repairedData = await validateAndRepairUserDocument(user, userData);
        return repairedData;
        
    } catch (error) {
        console.error('Error loading user data:', error);
        
        // If it's a permission error, try to create the document
        if (error.code === 'permission-denied') {
            console.log('🔧 Permission denied, attempting to create user document...');
            return await createMissingUserDocument(user);
        }
        
        throw error;
    }
}

// Create missing user document with proper structure
async function createMissingUserDocument(user) {
    console.log('📝 Creating missing user document for:', user.uid);
    
    const userData = {
        uid: user.uid,
        email: user.email,
        profile: user.displayName || user.email.split('@')[0] || 'Treasure Hunter',
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
            emailVerified: user.emailVerified || false,
            communityRating: 0
        }
    };
    
    try {
        await db.collection('users').doc(user.uid).set(userData);
        console.log('✅ User document created successfully');
        
        // Return the data with resolved timestamps
        return {
            ...userData,
            metadata: {
                ...userData.metadata,
                createdAt: new Date(),
                lastLoginAt: new Date(),
                lastActiveAt: new Date(),
                updatedAt: new Date()
            }
        };
    } catch (error) {
        console.error('❌ Failed to create user document:', error);
        throw new Error(`Failed to create user profile: ${error.message}`);
    }
}

// Validate and repair user document structure
async function validateAndRepairUserDocument(user, userData) {
    let needsUpdate = false;
    const updates = {};
    
    // Check required fields and add defaults if missing
    const requiredFields = {
        'uid': user.uid,
        'email': user.email,
        'profile': user.displayName || user.email.split('@')[0] || 'Treasure Hunter',
        'location': 'Not specified',
        'ebay.isConnected': false,
        'stats.totalScans': 0,
        'stats.pinsCreated': 0,
        'stats.totalEarnings': 0,
        'verification.emailVerified': user.emailVerified || false,
        'verification.communityRating': 0
    };
    
    // Check each required field
    Object.entries(requiredFields).forEach(([path, defaultValue]) => {
        const value = getNestedValue(userData, path);
        if (value === undefined || value === null) {
            setNestedValue(updates, path, defaultValue);
            needsUpdate = true;
        }
    });
    
    // Update last active
    updates['metadata.lastActiveAt'] = firebase.firestore.FieldValue.serverTimestamp();
    updates['metadata.updatedAt'] = firebase.firestore.FieldValue.serverTimestamp();
    needsUpdate = true;
    
    if (needsUpdate) {
        console.log('🔧 Repairing user document with missing fields:', Object.keys(updates));
        try {
            await db.collection('users').doc(user.uid).update(updates);
            console.log('✅ User document repaired successfully');
            
            // Merge updates with existing data
            const repairedData = { ...userData };
            Object.entries(updates).forEach(([path, value]) => {
                if (path.includes('timestamp')) {
                    setNestedValue(repairedData, path, new Date());
                } else {
                    setNestedValue(repairedData, path, value);
                }
            });
            
            return repairedData;
        } catch (error) {
            console.error('❌ Failed to repair user document:', error);
            // Return original data even if repair failed
            return userData;
        }
    }
    
    return userData;
}

// Utility functions for nested object access
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
        if (!current[key]) current[key] = {};
        return current[key];
    }, obj);
    target[lastKey] = value;
}

// Update user login metadata
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
        // Don't throw - this is non-critical
    }
}

// Global error handler
function handleFirebaseError(error) {
    console.error('Firebase error:', error);
    
    const errorMessages = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'permission-denied': 'You do not have permission to perform this action.',
        'not-found': 'The requested document was not found.',
        'User document not found': 'Setting up your profile...'
    };
    
    return errorMessages[error.code] || errorMessages[error.message] || error.message || 'An unexpected error occurred';
}