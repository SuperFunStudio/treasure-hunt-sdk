// functions/capture-sdk/config/firebase-config.js (FOR BACKEND ONLY)
const admin = require('firebase-admin');

let app;
if (admin.apps.length === 0) {
  app = admin.initializeApp();
} else {
  app = admin.app();
}

const db = admin.firestore();
const storage = admin.storage();
const auth = admin.auth();

module.exports = { admin, app, db, storage, auth };
