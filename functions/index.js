// functions/index.js - With explicit public access
const {onRequest} = require('firebase-functions/v2/https');
const {setGlobalOptions} = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Set global options for all functions
setGlobalOptions({maxInstances: 10});

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Configuration
const VERIFICATION_TOKEN = 'treasurehunter-sdk-1753755107391-zfgw1dyhl';
const ENDPOINT_URL = 'https://ebaynotifications-beprv7ll2q-uc.a.run.app';

/**
 * eBay Marketplace Account Deletion Notification Handler
 * Allows unauthenticated access for eBay webhooks
 */
exports.ebayNotifications = onRequest(
  {
    cors: true,
    invoker: 'public' // This allows unauthenticated access
  },
  async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-eBay-Signature');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method === 'GET') {
      // Handle eBay challenge verification
      return handleChallengeVerification(req, res);
    }

    if (req.method === 'POST') {
      // Handle eBay marketplace account deletion notifications
      return handleAccountDeletionNotification(req, res);
    }

    res.status(405).json({ error: 'Method not allowed' });
  }
);

/**
 * Handle eBay challenge verification (GET request)
 */
function handleChallengeVerification(req, res) {
  const challengeCode = req.query.challenge_code;
  
  if (!challengeCode) {
    console.error('Missing challenge_code parameter');
    res.status(400).json({ error: 'Missing challenge_code parameter' });
    return;
  }

  try {
    // Create hash: challengeCode + verificationToken + endpoint
    const hash = crypto.createHash('sha256');
    hash.update(challengeCode);
    hash.update(VERIFICATION_TOKEN);
    hash.update(ENDPOINT_URL);
    const responseHash = hash.digest('hex');

    console.log('eBay challenge verification successful:', {
      challengeCode: challengeCode,
      responseHashPreview: responseHash.substring(0, 10) + '...',
      timestamp: new Date().toISOString()
    });

    res.set('Content-Type', 'application/json');
    res.status(200).json({
      challengeResponse: responseHash
    });

  } catch (error) {
    console.error('Challenge verification failed:', error);
    res.status(500).json({ error: 'Challenge verification failed' });
  }
}

/**
 * Handle eBay marketplace account deletion notification (POST request)
 */
async function handleAccountDeletionNotification(req, res) {
  try {
    const notification = req.body;
    const notificationId = notification.notification && notification.notification.notificationId ? notification.notification.notificationId : 'unknown';
    
    // Acknowledge receipt immediately (required by eBay)
    res.status(200).json({ 
      status: 'received', 
      timestamp: new Date().toISOString(),
      notificationId: notificationId
    });

    // Log the notification
    const notificationData = notification.notification && notification.notification.data ? notification.notification.data : null;
    
    if (notificationData) {
      console.log('Received eBay account deletion notification:', {
        notificationId: notificationId,
        username: notificationData.username || 'unknown',
        userId: notificationData.userId || 'unknown',
        eventDate: notification.notification.eventDate || 'unknown',
        publishDate: notification.notification.publishDate || 'unknown',
        publishAttemptCount: notification.notification.publishAttemptCount || 0
      });

      // Process the account deletion
      await processAccountDeletion(notificationData);
    }

    // Store notification for audit purposes
    await storeNotificationForAudit(notification);

  } catch (error) {
    console.error('Error processing eBay notification:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
}

/**
 * Process account deletion - remove user data from your systems
 */
async function processAccountDeletion(userData) {
  const username = userData.username || 'unknown';
  const userId = userData.userId || 'unknown';
  
  console.log('Processing account deletion for eBay user: ' + username + ' (' + userId + ')');
  
  try {
    // Delete user data from Firestore
    const batch = db.batch();
    
    // Delete user profile if stored
    const userRef = db.collection('users').where('ebayUserId', '==', userId);
    const userSnapshot = await userRef.get();
    userSnapshot.docs.forEach(doc => {
      console.log('Deleting user document: ' + doc.id);
      batch.delete(doc.ref);
    });

    // Delete user's items/listings
    const itemsRef = db.collection('items').where('ebayUserId', '==', userId);
    const itemsSnapshot = await itemsRef.get();
    itemsSnapshot.docs.forEach(doc => {
      console.log('Deleting item document: ' + doc.id);
      batch.delete(doc.ref);
    });

    // Delete user's pins/locations if they're tied to eBay user
    const pinsRef = db.collection('pins').where('ebayUserId', '==', userId);
    const pinsSnapshot = await pinsRef.get();
    pinsSnapshot.docs.forEach(doc => {
      console.log('Deleting pin document: ' + doc.id);
      batch.delete(doc.ref);
    });

    // Commit all deletions
    await batch.commit();
    console.log('Successfully deleted all data for eBay user ' + userId);

  } catch (error) {
    console.error('Error deleting data for user ' + userId + ':', error);
    
    // Log the error but don't throw - we've already acknowledged to eBay
    await db.collection('deletion_errors').add({
      userId: userId,
      username: username,
      error: error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false
    });
  }
}

/**
 * Store notification for audit/compliance purposes
 */
async function storeNotificationForAudit(notification) {
  try {
    const notificationObj = notification.notification || {};
    await db.collection('ebay_deletion_notifications').add({
      notificationId: notificationObj.notificationId || 'unknown',
      eventDate: notificationObj.eventDate || null,
      publishDate: notificationObj.publishDate || null,
      userData: notificationObj.data || null,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processed'
    });
  } catch (error) {
    console.error('Error storing notification for audit:', error);
  }
}

/**
 * Health check endpoint - Public access
 */
exports.health = onRequest(
  {
    cors: true,
    invoker: 'public'
  },
  (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'Treasure Hunt SDK - eBay Notification Handler',
      version: '1.0.0',
      config: {
        verificationToken: 'configured',
        endpointUrl: ENDPOINT_URL
      }
    });
  }
);

/**
 * Test endpoint for development - Public access
 */
exports.testEbayEndpoint = onRequest(
  {
    cors: true,
    invoker: 'public'
  },
  (req, res) => {
    res.status(200).json({
      message: 'eBay notification endpoint is ready',
      verificationToken: 'configured',
      endpointUrl: ENDPOINT_URL,
      timestamp: new Date().toISOString()
    });
  }
);