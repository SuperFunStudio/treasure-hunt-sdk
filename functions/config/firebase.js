// config/firebase.js
// Firebase initialization and configuration

const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

const { config } = require('./environment');
const { FUNCTION_CONFIG } = require('./constants');

// Firebase Admin initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

// Set global options for all functions
setGlobalOptions(FUNCTION_CONFIG.DEFAULT_OPTIONS);

// Get Firestore database instance
const db = admin.firestore();

// Export Firebase utilities
module.exports = {
  functions,
  onRequest,
  admin,
  db,
  setGlobalOptions,
  
  // Function configuration helpers
  getAppConfig: () => FUNCTION_CONFIG.APP_OPTIONS,
  getHealthConfig: () => FUNCTION_CONFIG.HEALTH_OPTIONS,
  
  // Authentication helper
  verifyIdToken: async (idToken) => {
    return await admin.auth().verifyIdToken(idToken);
  },
  
  // Firestore helpers
  serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
  fieldDelete: () => admin.firestore.FieldValue.delete(),
  
  // Logging utility
  logStartup: () => {
    console.log('🚀 Firebase Functions initialized');
    console.log('📊 Configuration status:');
    console.log('  - OpenAI Key:', !!config.OPENAI_API_KEY ? '✅' : '❌');
    console.log('  - Claude Key:', !!config.CLAUDE_API_KEY ? '✅' : '❌');
    console.log('  - eBay configured:', !!(config.EBAY_CLIENT_ID && config.EBAY_CLIENT_SECRET) ? '✅' : '❌');
    console.log('  - eBay environment:', config.EBAY_ENVIRONMENT);
  }
};