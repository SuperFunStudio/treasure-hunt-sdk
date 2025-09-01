// services/ebay/policyManager.js
// eBay business policy management

const ebayService = require('./ebayService');
const { db, admin, serverTimestamp } = require('../../config/firebase');

class EbayPolicyManager {
  constructor() {
    this.ebayService = ebayService;
  }

  /**
   * Sync policies to Firestore
   */
  async syncPoliciesToFirestore(userId, policies) {
    console.log('Syncing policies to Firestore...');
    
    const updateData = {
      'ebay.hasBusinessPolicies': policies.hasCompletePolicySet,
      'ebay.policySyncedAt': serverTimestamp(),
      'metadata.updatedAt': serverTimestamp()
    };
    
    if (policies.hasCompletePolicySet && policies.selected) {
      updateData['ebay.policies'] = policies.selected;
      updateData['ebay.allPolicies'] = {
        fulfillment: policies.fulfillment.map(p => ({
          id: p.fulfillmentPolicyId,
          name: p.name,
          marketplaceId: p.marketplaceId
        })),
        payment: policies.payment.map(p => ({
          id: p.paymentPolicyId,
          name: p.name,
          marketplaceId: p.marketplaceId
        })),
        return: policies.return.map(p => ({
          id: p.returnPolicyId,
          name: p.name,
          marketplaceId: p.marketplaceId
        }))
      };
    } else {
      updateData['ebay.policies'] = admin.firestore.FieldValue.delete();
      updateData['ebay.allPolicies'] = admin.firestore.FieldValue.delete();
    }
    
    await db.collection('users').doc(userId).update(updateData);
    
    console.log('Firestore sync complete');
    
    return {
      policies: policies.selected,
      hasCompletePolicySet: policies.hasCompletePolicySet
    };
  }

  /**
   * Ensure user has complete set of eBay policies
   */
  async ensureUserEbayPolicies(userId) {
    console.log(`Getting eBay policies for user: ${userId}`);
    
    try {
      // Get user's access token
      const tokenManager = require('./tokenManager');
      const accessToken = await tokenManager.getValidEbayToken(userId);
      
      // First, sync to see what we have
      const existingPolicies = await this.ebayService.fetchAllEbayPolicies(accessToken);
      
      let result;
      if (existingPolicies.hasCompletePolicySet) {
        // We already have all policies
        result = {
          success: true,
          policies: existingPolicies.selected,
          created: false
        };
      } else {
        // Need to create missing policies
        const createdPolicies = await this.ebayService.createMissingPolicies(accessToken, existingPolicies);
        
        // Sync the new state to Firestore
        const updatedPolicies = await this.ebayService.fetchAllEbayPolicies(accessToken);
        await this.syncPoliciesToFirestore(userId, updatedPolicies);
        
        result = {
          success: true,
          policies: createdPolicies,
          created: true
        };
      }
      
      console.log('Policies retrieved/ensured:', result.policies);
      return result.policies;
      
    } catch (error) {
      console.error('Failed to get user eBay policies:', error);
      throw new Error(`Unable to setup eBay business policies: ${error.message}`);
    }
  }

  /**
   * Delete all policies for a user (cleanup function)
   */
  async deleteAllUserPolicies(userId, confirmationString) {
    if (confirmationString !== 'DELETE_ALL_POLICIES') {
      throw new Error('Confirmation required. Must provide "DELETE_ALL_POLICIES"');
    }
    
    console.log('Deleting all policies for user:', userId);
    
    const tokenManager = require('./tokenManager');
    const accessToken = await tokenManager.getValidEbayToken(userId);
    const policies = await this.ebayService.fetchAllEbayPolicies(accessToken);
    
    const deletionResults = [];
    
    // Delete fulfillment policies
    for (const policy of policies.fulfillment) {
      try {
        await this.ebayService.callEbayAPI(accessToken, 'DELETE', `/sell/account/v1/fulfillment_policy/${policy.fulfillmentPolicyId}`);
        deletionResults.push({ type: 'fulfillment', id: policy.fulfillmentPolicyId, success: true });
      } catch (error) {
        deletionResults.push({ type: 'fulfillment', id: policy.fulfillmentPolicyId, success: false, error: error.message });
      }
    }
    
    // Delete payment policies
    for (const policy of policies.payment) {
      try {
        await this.ebayService.callEbayAPI(accessToken, 'DELETE', `/sell/account/v1/payment_policy/${policy.paymentPolicyId}`);
        deletionResults.push({ type: 'payment', id: policy.paymentPolicyId, success: true });
      } catch (error) {
        deletionResults.push({ type: 'payment', id: policy.paymentPolicyId, success: false, error: error.message });
      }
    }
    
    // Delete return policies
    for (const policy of policies.return) {
      try {
        await this.ebayService.callEbayAPI(accessToken, 'DELETE', `/sell/account/v1/return_policy/${policy.returnPolicyId}`);
        deletionResults.push({ type: 'return', id: policy.returnPolicyId, success: true });
      } catch (error) {
        deletionResults.push({ type: 'return', id: policy.returnPolicyId, success: false, error: error.message });
      }
    }
    
    // Clear Firestore
    await db.collection('users').doc(userId).update({
      'ebay.policies': admin.firestore.FieldValue.delete(),
      'ebay.hasBusinessPolicies': false,
      'metadata.updatedAt': serverTimestamp()
    });
    
    return {
      success: true,
      message: 'All policies deleted',
      results: deletionResults
    };
  }

  /**
   * Get user's current policy status
   */
  async getUserPolicyStatus(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.ebay?.isConnected) {
      return { connected: false, hasBusinessPolicies: false };
    }
    
    return {
      connected: true,
      hasBusinessPolicies: userData.ebay?.hasBusinessPolicies || false,
      policies: userData.ebay?.policies || null,
      allPolicies: userData.ebay?.allPolicies || null,
      lastSyncedAt: userData.ebay?.policySyncedAt || null
    };
  }
}

module.exports = new EbayPolicyManager();