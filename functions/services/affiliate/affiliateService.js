// services/affiliate/affiliateService.js
// eBay Partner Network affiliate tracking service

const { config, getEPNConfig } = require('../../config/environment');
const { AFFILIATE_CONFIG, COMMISSION_CONFIG, ERROR_CODES } = require('../../config/constants');
const { db, admin, serverTimestamp } = require('../../config/firebase');

class AffiliateService {
  constructor() {
    this.epnConfig = getEPNConfig();
    this.networkId = AFFILIATE_CONFIG.EBAY_NETWORK_ID;
    this.trackingParams = AFFILIATE_CONFIG.TRACKING_PARAMS;
  }

  /**
   * Generate unique custom tracking ID for eBay Partner Network
   * Format: prefix_tier_userId_scanId_timestamp
   */
  generateCustomId(userId, scanId, subscriptionTier = 'free') {
    const prefix = this.epnConfig.customIdPrefix;
    const userIdShort = userId.substring(0, 8);
    const timestamp = Date.now().toString(36);
    
    // Keep within eBay's 256 character limit
    const customId = `${prefix}_${subscriptionTier}_${userIdShort}_${scanId}_${timestamp}`;
    
    if (customId.length > AFFILIATE_CONFIG.CUSTOM_ID_MAX_LENGTH) {
      throw new Error(`Custom ID too long: ${customId.length} chars`);
    }
    
    return customId;
  }

  /**
   * Create eBay Partner Network tracking URL
   * Uses official EPN URL structure with required parameters
   */
  createTrackingUrl(ebayItemId, customId) {
    if (!this.epnConfig.campaignId) {
      throw new Error('eBay Campaign ID not configured');
    }

    const baseUrl = `${AFFILIATE_CONFIG.TRACKING_URL_BASE}/${ebayItemId}`;
    
    const trackingParams = new URLSearchParams({
      mkevt: this.trackingParams.MKEVT,
      mkcid: this.trackingParams.MKCID, 
      mkrid: this.trackingParams.MKRID_US,
      campid: this.epnConfig.campaignId,
      toolid: this.trackingParams.TOOLID,
      customid: customId
    });

    return `${baseUrl}?${trackingParams.toString()}`;
  }

  /**
   * Initialize tracking record before listing creation
   * Returns custom ID to embed in listing process
   */
  async initializeTracking(userId, scanId, listingData, subscriptionTier = 'free') {
    try {
      if (!this.epnConfig.enabled) {
        console.log('Affiliate tracking disabled, skipping initialization');
        return null;
      }

      const customId = this.generateCustomId(userId, scanId, subscriptionTier);
      
      // Create tracking record in Firestore
      const trackingData = {
        userId,
        scanId,
        customId,
        subscriptionTier,
        status: 'pending',
        createdAt: serverTimestamp(),
        
        // Listing information
        listingTitle: listingData.title,
        listingCategory: listingData.category,
        estimatedPrice: listingData.pricing?.buyItNowPrice || 0,
        
        // Commission calculation
        commissionRate: this.getCommissionRate(subscriptionTier),
        estimatedCommission: this.calculateEstimatedCommission(
          listingData.pricing?.buyItNowPrice || 0, 
          subscriptionTier
        ),
        
        // eBay data (will be updated after listing creation)
        ebayItemId: null,
        trackingUrl: null,
        actualSalePrice: null,
        actualCommission: null,
        soldAt: null
      };

      await db.collection('affiliate_tracking').doc(customId).set(trackingData);
      
      console.log(`Affiliate tracking initialized: ${customId}`);
      return customId;
      
    } catch (error) {
      console.error('Failed to initialize affiliate tracking:', error);
      throw new Error(`${ERROR_CODES.AFFILIATE_TRACKING_FAILED}: ${error.message}`);
    }
  }

  /**
   * Update tracking record with eBay item ID after successful listing
   */
  async updateTrackingWithListing(customId, ebayItemId, actualListingPrice) {
    try {
      if (!this.epnConfig.enabled || !customId) {
        return null;
      }

      const trackingUrl = this.createTrackingUrl(ebayItemId, customId);
      const updatedEstimatedCommission = this.calculateEstimatedCommission(
        actualListingPrice, 
        null // Will get tier from existing record
      );

      const updateData = {
        ebayItemId,
        trackingUrl,
        listingPrice: actualListingPrice,
        estimatedCommission: updatedEstimatedCommission,
        status: 'active',
        listedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await db.collection('affiliate_tracking').doc(customId).update(updateData);
      
      console.log(`Tracking updated for listing ${ebayItemId}: ${trackingUrl}`);
      return {
        customId,
        trackingUrl,
        estimatedCommission: updatedEstimatedCommission
      };
      
    } catch (error) {
      console.error('Failed to update tracking with listing:', error);
      throw new Error(`${ERROR_CODES.AFFILIATE_TRACKING_FAILED}: ${error.message}`);
    }
  }

  /**
   * Process commission data from eBay Partner Network reports
   * This would be called by a scheduled function that imports EPN data
   */
  async processCommissionData(commissionRecord) {
    try {
      const { customId, itemId, saleAmount, commissionAmount, transactionDate } = commissionRecord;
      
      // Find our tracking record
      const trackingDoc = await db.collection('affiliate_tracking').doc(customId).get();
      
      if (!trackingDoc.exists) {
        console.warn(`No tracking record found for customId: ${customId}`);
        return false;
      }

      const trackingData = trackingDoc.data();
      
      // Calculate our commission share
      const ourCommissionRate = this.getCommissionRate(trackingData.subscriptionTier);
      const ourCommission = commissionAmount * ourCommissionRate;
      
      // Update tracking record with sale data
      await db.collection('affiliate_tracking').doc(customId).update({
        status: 'sold',
        actualSalePrice: saleAmount,
        ebayCommission: commissionAmount,
        actualCommission: ourCommission,
        soldAt: new Date(transactionDate),
        processedAt: serverTimestamp()
      });

      // Record commission in separate collection for reporting
      await db.collection('commissions').add({
        userId: trackingData.userId,
        scanId: trackingData.scanId,
        customId,
        ebayItemId: itemId,
        subscriptionTier: trackingData.subscriptionTier,
        saleAmount,
        ebayCommission: commissionAmount,
        ourCommission,
        commissionRate: ourCommissionRate,
        transactionDate: new Date(transactionDate),
        processedAt: serverTimestamp()
      });

      // Update user stats
      await this.updateUserCommissionStats(trackingData.userId, ourCommission, saleAmount);
      
      console.log(`Commission processed: ${customId} - $${ourCommission.toFixed(2)}`);
      return true;
      
    } catch (error) {
      console.error('Failed to process commission data:', error);
      throw new Error(`${ERROR_CODES.COMMISSION_CALCULATION_ERROR}: ${error.message}`);
    }
  }

  /**
   * Get commission rate for subscription tier
   */
  getCommissionRate(subscriptionTier) {
    const tier = subscriptionTier?.toUpperCase() || 'FREE';
    return COMMISSION_CONFIG.RATES[tier] || COMMISSION_CONFIG.RATES.FREE;
  }

  /**
   * Calculate estimated commission based on listing price and tier
   */
  calculateEstimatedCommission(listingPrice, subscriptionTier) {
    if (!listingPrice || listingPrice <= 0) return 0;
    
    const ebayCommission = listingPrice * COMMISSION_CONFIG.EBAY_AVERAGE_COMMISSION;
    const ourRate = this.getCommissionRate(subscriptionTier);
    return ebayCommission * ourRate;
  }

  /**
   * Update user's commission statistics
   */
  async updateUserCommissionStats(userId, commissionAmount, saleAmount) {
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      
      if (userDoc.exists) {
        const currentStats = userDoc.data().stats || {};
        
        const updates = {
          'stats.totalCommissions': (currentStats.totalCommissions || 0) + commissionAmount,
          'stats.totalSales': (currentStats.totalSales || 0) + 1,
          'stats.totalRevenue': (currentStats.totalRevenue || 0) + saleAmount,
          'stats.lastSaleDate': serverTimestamp(),
          'stats.averageSale': ((currentStats.totalRevenue || 0) + saleAmount) / ((currentStats.totalSales || 0) + 1),
          'metadata.updatedAt': serverTimestamp()
        };
        
        transaction.update(userRef, updates);
      }
    });
  }

  /**
   * Get user's commission report for dashboard
   */
  async getUserCommissionReport(userId, startDate, endDate) {
    try {
      let query = db.collection('commissions').where('userId', '==', userId);
      
      if (startDate) {
        query = query.where('transactionDate', '>=', startDate);
      }
      if (endDate) {
        query = query.where('transactionDate', '<=', endDate);
      }
      
      const snapshot = await query.orderBy('transactionDate', 'desc').get();
      
      const commissions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        transactionDate: doc.data().transactionDate.toDate()
      }));

      // Calculate summary statistics
      const summary = {
        totalSales: commissions.length,
        totalRevenue: commissions.reduce((sum, c) => sum + c.saleAmount, 0),
        totalCommissions: commissions.reduce((sum, c) => sum + c.ourCommission, 0),
        averageSale: commissions.length > 0 ? 
          commissions.reduce((sum, c) => sum + c.saleAmount, 0) / commissions.length : 0,
        averageCommission: commissions.length > 0 ?
          commissions.reduce((sum, c) => sum + c.ourCommission, 0) / commissions.length : 0
      };

      return { commissions, summary };
      
    } catch (error) {
      console.error('Failed to get user commission report:', error);
      throw error;
    }
  }

  /**
   * Get tracking status for a specific listing
   */
  async getTrackingStatus(customId) {
    try {
      const trackingDoc = await db.collection('affiliate_tracking').doc(customId).get();
      
      if (!trackingDoc.exists) {
        return null;
      }
      
      return {
        id: trackingDoc.id,
        ...trackingDoc.data()
      };
      
    } catch (error) {
      console.error('Failed to get tracking status:', error);
      throw error;
    }
  }

  /**
   * Validate eBay Partner Network configuration
   */
  validateConfiguration() {
    const errors = [];
    
    if (!this.epnConfig.campaignId) {
      errors.push('eBay Campaign ID not configured');
    }
    
    if (this.epnConfig.campaignId && !/^\d{10}$/.test(this.epnConfig.campaignId)) {
      errors.push('eBay Campaign ID must be 10 digits');
    }
    
    if (!this.epnConfig.customIdPrefix) {
      errors.push('Custom ID prefix not configured');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new AffiliateService();