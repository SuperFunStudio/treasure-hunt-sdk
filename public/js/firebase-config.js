// js/firebase-config.js
// Shared Firebase configuration for all pages

// TODO: Replace with your actual Firebase config
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

// Global user data loader
async function getCurrentUserData() {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) throw new Error('User document not found');
    
    return userDoc.data();
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
        'not-found': 'The requested document was not found.'
    };
    
    return errorMessages[error.code] || error.message || 'An unexpected error occurred';
}