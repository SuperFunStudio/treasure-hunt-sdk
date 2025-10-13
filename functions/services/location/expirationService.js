// functions/services/location/expirationService.js
// Pin expiration logic and cleanup services

const { db, admin, serverTimestamp } = require('../../config/firebase');
const pinService = require('./pinService');

class ExpirationService {
  constructor() {
    this.batchSize = 100; // Process pins in batches
  }

  /**
   * Main cleanup function - should be called by Cloud Functions scheduler
   */
  async runCleanup() {
    try {
      console.log('Starting pin cleanup process...');
      
      const startTime = Date.now();
      let processedCount = 0;
      let expiredCount = 0;
      let removedCount = 0;

      // Process expired pins
      const expiredResult = await this.processExpiredPins();
      expiredCount = expiredResult.processed;
      processedCount += expiredResult.processed;

      // Clean up old removed pins
      const removedResult = await this.cleanupOldRemovedPins();
      removedCount = removedResult.processed;
      processedCount += removedResult.processed;

      // Update cleanup statistics
      await this.updateCleanupStats({
        lastRun: serverTimestamp(),
        pinsProcessed: processedCount,
        pinsExpired: expiredCount,
        pinsRemoved: removedCount,
        durationMs: Date.now() - startTime
      });

      console.log(`Cleanup completed: ${processedCount} pins processed, ${expiredCount} expired, ${removedCount} removed`);
      
      return {
        success: true,
        processed: processedCount,
        expired: expiredCount,
        removed: removedCount,
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.error('Cleanup process failed:', error);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Process expired pins and update their status
   */
  async processExpiredPins() {
    try {
      console.log('Processing expired pins...');
      
      const now = new Date();
      let processedCount = 0;
      let lastDoc = null;

      while (true) {
        // Query for active pins that should be expired
        let query = db.collection('pins')
          .where('status', '==', 'active')
          .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(now))
          .limit(this.batchSize);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        
        if (snapshot.empty) {
          break;
        }

        // Process batch
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
          const pinRef = db.collection('pins').doc(doc.id);
          batch.update(pinRef, {
            status: 'expired',
            expiredAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });

        await batch.commit();
        processedCount += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        console.log(`Expired ${snapshot.docs.length} pins (total: ${processedCount})`);
        
        // Break if we got less than batch size (last batch)
        if (snapshot.docs.length < this.batchSize) {
          break;
        }
      }

      return { processed: processedCount };

    } catch (error) {
      console.error('Error processing expired pins:', error);
      throw error;
    }
  }

  /**
   * Clean up old removed pins (delete after 30 days)
   */
  async cleanupOldRemovedPins() {
    try {
      console.log('Cleaning up old removed pins...');
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let processedCount = 0;
      let lastDoc = null;

      while (true) {
        // Query for removed pins older than 30 days
        let query = db.collection('pins')
          .where('status', '==', 'removed')
          .where('removedAt', '<=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
          .limit(this.batchSize);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        
        if (snapshot.empty) {
          break;
        }

        // Delete batch
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        processedCount += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        console.log(`Deleted ${snapshot.docs.length} old pins (total: ${processedCount})`);
        
        if (snapshot.docs.length < this.batchSize) {
          break;
        }
      }

      return { processed: processedCount };

    } catch (error) {
      console.error('Error cleaning up old removed pins:', error);
      throw error;
    }
  }

  /**
   * Extend pin expiration time
   */
  async extendPinExpiration(pinId, additionalTimeMs, userId = null) {
    try {
      const pin = await pinService.getPinById(pinId);
      
      if (!pin) {
        throw new Error('Pin not found');
      }

      // Verify ownership if userId provided
      if (userId && pin.userId !== userId) {
        throw new Error('Unauthorized: You can only extend your own pins');
      }

      if (pin.status !== 'active') {
        throw new Error('Can only extend active pins');
      }

      // Calculate new expiration time
      const currentExpires = pin.expiresAt.toDate();
      const newExpires = new Date(currentExpires.getTime() + additionalTimeMs);
      
      // Limit maximum extension to prevent abuse
      const maxExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const finalExpires = new Date(Math.min(newExpires.getTime(), maxExpires.getTime()));

      await pinService.updatePin(pinId, {
        expiresAt: admin.firestore.Timestamp.fromDate(finalExpires),
        extendedAt: serverTimestamp(),
        extendedBy: userId
      });

      console.log('Pin expiration extended:', pinId, finalExpires);
      
      return {
        success: true,
        newExpiresAt: finalExpires,
        extensionMs: finalExpires.getTime() - currentExpires.getTime()
      };

    } catch (error) {
      console.error('Error extending pin expiration:', error);
      throw new Error(`Failed to extend pin expiration: ${error.message}`);
    }
  }

  /**
   * Get pins expiring soon (for notifications)
   */
  async getPinsExpiringSoon(hoursAhead = 2) {
    try {
      const futureTime = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
      
      const snapshot = await db.collection('pins')
        .where('status', '==', 'active')
        .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(futureTime))
        .where('expiresAt', '>', admin.firestore.Timestamp.fromDate(new Date()))
        .get();

      const expiringSoon = [];
      
      snapshot.forEach(doc => {
        const pin = { id: doc.id, ...doc.data() };
        const hoursRemaining = (pin.expiresAt.toDate().getTime() - Date.now()) / (1000 * 60 * 60);
        
        expiringSoon.push({
          ...pin,
          hoursRemaining: Math.round(hoursRemaining * 10) / 10
        });
      });

      return expiringSoon.sort((a, b) => a.hoursRemaining - b.hoursRemaining);

    } catch (error) {
      console.error('Error getting pins expiring soon:', error);
      throw error;
    }
  }

  /**
   * Send expiration notifications
   */
  async sendExpirationNotifications() {
    try {
      console.log('Sending expiration notifications...');
      
      // Get pins expiring in 2 hours and 30 minutes
      const expiringSoon = await this.getPinsExpiringSoon(2);
      const expiringVeryS = await this.getPinsExpiringSoon(0.5);
      
      let notificationsSent = 0;

      // Send 2-hour warnings
      for (const pin of expiringSoon) {
        if (pin.hoursRemaining <= 2 && pin.hoursRemaining > 1.5) {
          await this.sendExpirationNotification(pin, '2 hours');
          notificationsSent++;
        }
      }

      // Send 30-minute warnings
      for (const pin of expiringVeryS) {
        if (pin.hoursRemaining <= 0.5) {
          await this.sendExpirationNotification(pin, '30 minutes');
          notificationsSent++;
        }
      }

      console.log(`Sent ${notificationsSent} expiration notifications`);
      return notificationsSent;

    } catch (error) {
      console.error('Error sending expiration notifications:', error);
      throw error;
    }
  }

  /**
   * Send individual expiration notification
   */
  async sendExpirationNotification(pin, timeRemaining) {
    try {
      // Create notification document
      const notification = {
        userId: pin.userId,
        type: 'pin_expiring',
        title: `Your ${pin.item.category} pin expires in ${timeRemaining}`,
        body: `"${pin.item.title}" will expire soon. Extend it or let it expire naturally.`,
        data: {
          pinId: pin.id,
          timeRemaining,
          action: 'extend_or_expire'
        },
        createdAt: serverTimestamp(),
        read: false
      };

      await db.collection('notifications').add(notification);
      
      // TODO: Send push notification if user has FCM token
      // await sendPushNotification(pin.userId, notification);

      console.log('Expiration notification sent:', pin.id, timeRemaining);

    } catch (error) {
      console.error('Error sending expiration notification:', error);
      // Don't throw - notification failures shouldn't break cleanup
    }
  }

  /**
   * Calculate dynamic expiration based on pin activity
   */
  calculateDynamicExpiration(pin) {
    let baseExpiration = pin.expiresIn || 4 * 60 * 60 * 1000; // 4 hours default

    // Extend based on views (popular items get more time)
    if (pin.views > 20) {
      baseExpiration *= 1.5;
    } else if (pin.views > 10) {
      baseExpiration *= 1.2;
    }

    // Extend based on interested users
    if (pin.interested && pin.interested.length > 5) {
      baseExpiration *= 1.3;
    }

    // Extend based on claims
    if (pin.claims && pin.claims.length > 0) {
      baseExpiration *= 1.4;
    }

    // Reduce for items with no activity
    if (pin.views === 0 && (!pin.interested || pin.interested.length === 0)) {
      baseExpiration *= 0.7;
    }

    // Cap at reasonable limits
    const maxExpiration = 7 * 24 * 60 * 60 * 1000; // 7 days
    const minExpiration = 1 * 60 * 60 * 1000; // 1 hour
    
    return Math.max(minExpiration, Math.min(baseExpiration, maxExpiration));
  }

  /**
   * Update pin expiration based on activity
   */
  async updateDynamicExpiration(pinId) {
    try {
      const pin = await pinService.getPinById(pinId);
      
      if (!pin || pin.status !== 'active') {
        return;
      }

      const newExpirationMs = this.calculateDynamicExpiration(pin);
      const newExpiresAt = new Date(pin.createdAt.toDate().getTime() + newExpirationMs);
      
      // Only update if it would extend the expiration
      if (newExpiresAt > pin.expiresAt.toDate()) {
        await pinService.updatePin(pinId, {
          expiresAt: admin.firestore.Timestamp.fromDate(newExpiresAt),
          dynamicExpiration: true,
          lastDynamicUpdate: serverTimestamp()
        });

        console.log('Dynamic expiration updated:', pinId, newExpiresAt);
      }

    } catch (error) {
      console.error('Error updating dynamic expiration:', error);
      // Don't throw - this is a background optimization
    }
  }

  /**
   * Update cleanup statistics
   */
  async updateCleanupStats(stats) {
    try {
      await db.collection('system').doc('pin_cleanup_stats').set({
        ...stats,
        updatedAt: serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Error updating cleanup stats:', error);
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    try {
      const doc = await db.collection('system').doc('pin_cleanup_stats').get();
      
      if (!doc.exists) {
        return {
          lastRun: null,
          pinsProcessed: 0,
          pinsExpired: 0,
          pinsRemoved: 0,
          durationMs: 0
        };
      }

      return doc.data();

    } catch (error) {
      console.error('Error getting cleanup stats:', error);
      return null;
    }
  }

  /**
   * Manually expire a pin (for admin use)
   */
  async manuallyExpirePin(pinId, reason = 'manual_expiration') {
    try {
      await pinService.updatePinStatus(pinId, 'expired', {
        expiredAt: serverTimestamp(),
        expirationReason: reason,
        manualExpiration: true
      });

      console.log('Pin manually expired:', pinId, reason);
      return true;

    } catch (error) {
      console.error('Error manually expiring pin:', error);
      throw error;
    }
  }
}

module.exports = new ExpirationService();