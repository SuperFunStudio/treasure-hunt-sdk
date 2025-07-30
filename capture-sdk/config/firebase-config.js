// capture-sdk/config/firebase-config.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDymYwo7NUAu7lhoPfS9KLQmckvVgky7PU",
  authDomain: "treasurehunter-sdk.firebaseapp.com",
  projectId: "treasurehunter-sdk",
  storageBucket: "treasurehunter-sdk.firebasestorage.app",
  messagingSenderId: "328804663359",
  appId: "1:328804663359:web:eb124f150c4853c123788a",
  measurementId: "G-YNJ58GLX3T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Helper function to check if Firebase is initialized
export const isFirebaseInitialized = () => {
  try {
    return app.name === '[DEFAULT]';
  } catch {
    return false;
  }
};

export default app;