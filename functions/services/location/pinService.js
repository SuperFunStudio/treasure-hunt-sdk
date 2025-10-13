// functions/services/location/pinService.js
// Core pin CRUD operations and business logic

const { db, admin, serverTimestamp } = require('../../config/firebase');
const PinModel = require('../../models/PinModel');

class PinService {
  constructor() {
    this.collection = 'pins';
  }

  /**
   * Create a new pin
   */
  async createPin(pinData) {
    try {
      console.log('Creating new pin for user:', pinData.userId);

      // Create pin document using model
      const pin = PinModel.createPinData(pinData);

      // Validate pin data
      const validation = PinModel.validatePinData(pin);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Save to Firestore
      const docRef = await db.collection(this.collection).add(pin);
      console.log('Pin created with ID:', docRef.id);

      // Update user stats
      await this.updateUserPinStats(pin.userId, 'created');

      // Return pin with ID
      return {
        id: docRef.id,
        ...pin,
        createdAt: new Date(), // Will be replaced by server timestamp
        updatedAt: new Date()
      };

    } catch (error) {
      console.error('Error creating pin:', error);
      throw new Error(`Failed to create pin: ${error.message}`);
    }
  }

  /**
   * Get pin by ID
   */
  async getPinById(pinId) {
    try {
      const doc = await db.collection(this.collection).doc(pinId).get();
      
      if (!doc.exists) {
        return null;
      }

      const pin = { id: doc.id, ...doc.data() };
      
      // Update status based on current state
      const updatedPin = PinModel.updatePinStatus(pin);
      
      // If status changed, save it
      if (updatedPin.status !== pin.status) {
        await this.updatePinStatus(pinId, updatedPin.status);
        pin.status = updatedPin.status;
      }

      return pin;

    } catch (error) {
      console.error('Error getting pin:', error);
      throw new Error(`Failed to get pin: ${error.message}`);
    }
  }

  /**
   * Get pins by user ID
   */
  async getPinsByUser(userId, options = {}) {
    try {
      const {
        status = null,
        limit = 50,
        offset = 0,
        includeExpired = false
      } = options;

      let query = db.collection(this.collection)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc');

      if (status) {
        query = query.where('status', '==', status);
      }

      if (limit) {
        query = query.limit(limit);
      }

      if (offset > 0) {
        // For pagination, you'd need to pass the last document from previous query
        // This is a simplified version
        query = query.offset(offset);
      }

      const snapshot = await query.get();
      const pins = [];

      snapshot.forEach(doc => {
        const pin = { id: doc.id, ...doc.data() };
        
        // Check if should include expired pins
        if (!includeExpired && pin.status === 'expired') {
          return;
        }

        pins.push(pin);
      });

      return pins;

    } catch (error) {
      console.error('Error getting user pins:', error);
      throw new Error(`Failed to get user pins: ${error.message}`);
    }
  }

  /**
   * Update pin
   */
  async updatePin(pinId, updateData) {
    try {
      // Prepare update data
      const update = {
        ...updateData,
        updatedAt: serverTimestamp()
      };

      // Remove undefined values
      Object.keys(update).forEach(key => {
        if (update[key] === undefined) {
          delete update[key];
        }
      });

      await db.collection(this.collection).doc(pinId).update(update);
      console.log('Pin updated:', pinId);

      return await this.getPinById(pinId);

    } catch (error) {
      console.error('Error updating pin:', error);
      throw new Error(`Failed to update pin: ${error.message}`);
    }
  }

  /**
   * Update pin status
   */
  async updatePinStatus(pinId, status, metadata = {}) {
    try {
      const update = {
        status,
        updatedAt: serverTimestamp(),
        ...metadata
      };

      // Add status-specific timestamps
      if (status === 'claimed') {
        update.claimedAt = serverTimestamp();
      } else if (status === 'expired') {
        update.expiredAt = serverTimestamp();
      }

      await db.collection(this.collection).doc(pinId).update(update);
      console.log('Pin status updated:', pinId, status);

      return true;

    } catch (error) {
      console.error('Error updating pin status:', error);
      throw new Error(`Failed to update pin status: ${error.message}`);
    }
  }

  /**
   * Add claim to pin
   */
  async addClaimToPin(pinId, claimData) {
    try {
      const pin = await this.getPinById(pinId);
      
      if (!pin) {
        throw new Error('Pin not found');
      }

      if (pin.status !== 'active') {
        throw new Error('Pin is not active');
      }

      // Check if user already has a claim
      const existingClaim = pin.claims.find(claim => claim.userId === claimData.userId);
      if (existingClaim) {
        throw new Error('User already has a claim on this pin');
      }

      // Create claim
      const claim = PinModel.createClaim(claimData);

      // Add to pin claims array
      const updatedClaims = [...pin.claims, claim];

      // Update pin
      await this.updatePin(pinId, {
        claims: updatedClaims,
        claimCount: updatedClaims.length
      });

      // Update user stats
      await this.updateUserPinStats(claimData.userId, 'claimed');

      console.log('Claim added to pin:', pinId, claim.id);
      return claim;

    } catch (error) {
      console.error('Error adding claim:', error);
      throw new Error(`Failed to add claim: ${error.message}`);
    }
  }

  /**
   * Update claim status
   */
  async updateClaimStatus(pinId, claimId, status, metadata = {}) {
    try {
      const pin = await this.getPinById(pinId);
      
      if (!pin) {
        throw new Error('Pin not found');
      }

      const claimIndex = pin.claims.findIndex(claim => claim.id === claimId);
      if (claimIndex === -1) {
        throw new Error('Claim not found');
      }

      // Update claim
      pin.claims[claimIndex] = {
        ...pin.claims[claimIndex],
        status,
        updatedAt: serverTimestamp(),
        ...metadata
      };

      // Update pin status if claim was accepted
      let pinStatus = pin.status;
      if (status === 'accepted' || status === 'completed') {
        pinStatus = 'claimed';
      }

      // Save updates
      await this.updatePin(pinId, {
        claims: pin.claims,
        status: pinStatus
      });

      console.log('Claim status updated:', claimId, status);
      return pin.claims[claimIndex];

    } catch (error) {
      console.error('Error updating claim status:', error);
      throw new Error(`Failed to update claim status: ${error.message}`);
    }
  }

  /**
   * Add user to interested list
   */
  async addInterestedUser(pinId, userId) {
    try {
      const pin = await this.getPinById(pinId);
      
      if (!pin) {
        throw new Error('Pin not found');
      }

      if (pin.interested.includes(userId)) {
        return pin; // Already interested
      }

      const updatedInterested = [...pin.interested, userId];

      await this.updatePin(pinId, {
        interested: updatedInterested
      });

      console.log('User added to interested list:', pinId, userId);
      return await this.getPinById(pinId);

    } catch (error) {
      console.error('Error adding interested user:', error);
      throw new Error(`Failed to add interested user: ${error.message}`);
    }
  }

  /**
   * Increment view count
   */
  async incrementViews(pinId) {
    try {
      await db.collection(this.collection).doc(pinId).update({
        views: admin.firestore.FieldValue.increment(1),
        updatedAt: serverTimestamp()
      });

      return true;

    } catch (error) {
      console.error('Error incrementing views:', error);
      // Don't throw error for view counting failures
      return false;
    }
  }

  /**
   * Delete pin (soft delete by setting status)
   */
  async deletePin(pinId, userId = null) {
    try {
      const pin = await this.getPinById(pinId);
      
      if (!pin) {
        throw new Error('Pin not found');
      }

      // Verify ownership if userId provided
      if (userId && pin.userId !== userId) {
        throw new Error('Unauthorized: You can only delete your own pins');
      }

      await this.updatePinStatus(pinId, 'removed', {
        removedAt: serverTimestamp()
      });

      console.log('Pin deleted:', pinId);
      return true;

    } catch (error) {
      console.error('Error deleting pin:', error);
      throw new Error(`Failed to delete pin: ${error.message}`);
    }
  }

  /**
   * Report pin
   */
  async reportPin(pinId, reportData) {
    try {
      const { userId, reason, description = '' } = reportData;

      const pin = await this.getPinById(pinId);
      if (!pin) {
        throw new Error('Pin not found');
      }

      // Check if user already reported this pin
      if (pin.reportedBy.includes(userId)) {
        throw new Error('You have already reported this pin');
      }

      const report = {
        userId,
        reason,
        description: description.substring(0, 500),
        createdAt: serverTimestamp()
      };

      const updatedReports = [...(pin.reports || []), report];
      const updatedReportedBy = [...pin.reportedBy, userId];

      await this.updatePin(pinId, {
        reports: updatedReports,
        reportedBy: updatedReportedBy,
        isReported: true,
        moderationStatus: updatedReports.length >= 3 ? 'pending' : 'approved'
      });

      console.log('Pin reported:', pinId, reason);
      return true;

    } catch (error) {
      console.error('Error reporting pin:', error);
      throw new Error(`Failed to report pin: ${error.message}`);
    }
  }

  /**
   * Update user pin statistics
   */
  async updateUserPinStats(userId, action) {
    try {
      const userRef = db.collection('users').doc(userId);
      
      const updates = {
        'metadata.updatedAt': serverTimestamp()
      };

      if (action === 'created') {
        updates['stats.pinsCreated'] = admin.firestore.FieldValue.increment(1);
        updates['stats.lastPinDate'] = serverTimestamp();
      } else if (action === 'claimed') {
        updates['stats.pinsClaimed'] = admin.firestore.FieldValue.increment(1);
      }

      await userRef.update(updates);
      console.log('User pin stats updated:', userId, action);

    } catch (error) {
      console.error('Error updating user pin stats:', error);
      // Don't throw error for stats updates
    }
  }

  /**
   * Get pin statistics
   */
  async getPinStats(pinId) {
    try {
      const pin = await this.getPinById(pinId);
      if (!pin) {
        throw new Error('Pin not found');
      }

      return {
        views: pin.views || 0,
        interested: pin.interested?.length || 0,
        claims: pin.claims?.length || 0,
        timeRemaining: this.getTimeRemaining(pin.expiresAt),
        status: pin.status,
        daysActive: this.getDaysActive(pin.createdAt)
      };

    } catch (error) {
      console.error('Error getting pin stats:', error);
      throw new Error(`Failed to get pin stats: ${error.message}`);
    }
  }

  /**
   * Helper: Get time remaining until expiration
   */
  getTimeRemaining(expiresAt) {
    if (!expiresAt) return null;
    
    const now = new Date();
    const expires = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
    const msRemaining = expires.getTime() - now.getTime();
    
    if (msRemaining <= 0) {
      return { expired: true };
    }

    const hours = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

    return {
      expired: false,
      hours,
      minutes,
      totalMinutes: Math.floor(msRemaining / (1000 * 60)),
      formatted: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    };
  }

  /**
   * Helper: Get days since pin was created
   */
  getDaysActive(createdAt) {
    if (!createdAt) return 0;
    
    const now = new Date();
    const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const msActive = now.getTime() - created.getTime();
    
    return Math.floor(msActive / (1000 * 60 * 60 * 24));
  }
}

module.exports = new PinService();