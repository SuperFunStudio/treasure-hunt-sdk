// services/subscription/subscriptionService.js
// User subscription and quota management service

const { SUBSCRIPTION_TIERS, USAGE_LIMITS, ERROR_CODES } = require('../../config/constants');
const { getStripeConfig } = require('../../config/environment');
const { db, admin, serverTimestamp } = require('../../config/firebase');

class SubscriptionService {
  constructor() {
    this.tiers = SUBSCRIPTION_TIERS;
    this.usageLimits = USAGE_LIMITS;
    this.stripeConfig = getStripeConfig();
  }

  /**
   * Get user's current subscription details
   */
  async getUserSubscription(userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data();
      const subscription = userData.subscription || {};
      
      // Default to free tier if no subscription
      const tier = subscription.tier || 'FREE';
      const tierConfig = this.tiers[tier.toUpperCase()];
      
      return {
        userId,
        tier: tier.toLowerCase(),
        tierConfig,
        status: subscription.status || 'active',
        stripeSubscriptionId: subscription.stripeSubscriptionId || null,
        stripePriceId: subscription.stripePriceId || null,
        billingCycle: subscription.billingCycle || null,
        nextBilling: subscription.nextBilling || null,
        canceledAt: subscription.canceledAt || null,
        trialEndsAt: subscription.trialEndsAt || null,
        createdAt: subscription.createdAt || null,
        updatedAt: subscription.updatedAt || null
      };
      
    } catch (error) {
      console.error('Failed to get user subscription:', error);
      throw error;
    }
  }

  /**
   * Check if user can create more listings based on their subscription tier
   */
  async checkListingQuota(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      const tierConfig = subscription.tierConfig;
      
      // Unlimited for pro tier
      if (tierConfig.monthlyListings === -1) {
        return {
          allowed: true,
          remaining: 'unlimited',
          used: 0,
          limit: 'unlimited',
          tier: subscription.tier,
          resetDate: null
        };
      }

      // Calculate current month usage
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      // Count listings created this month
      const listingsQuery = await db.collection('users')
        .doc(userId)
        .collection('scans')
        .where('createdAt', '>=', monthStart)
        .where('createdAt', '<=', monthEnd)
        .where('status', 'in', ['published', 'active', 'listed'])
        .get();

      const monthlyUsage = listingsQuery.size;
      const remaining = Math.max(0, tierConfig.monthlyListings - monthlyUsage);
      
      // Calculate reset date (first day of next month)
      const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      return {
        allowed: remaining > 0,
        remaining,
        used: monthlyUsage,
        limit: tierConfig.monthlyListings,
        tier: subscription.tier,
        resetDate,
        upgradeRequired: remaining === 0
      };
      
    } catch (error) {
      console.error('Failed to check listing quota:', error);
      throw error;
    }
  }

  /**
   * Check rate limits for listing creation
   */
  async checkRateLimit(userId, action = 'listing') {
    try {
      const subscription = await this.getUserSubscription(userId);
      const tierConfig = subscription.tierConfig;
      
      // Get rate limit for this tier
      const hourlyLimit = this.usageLimits.RATE_LIMITS.LISTINGS_PER_HOUR[subscription.tier.toUpperCase()];
      
      // Unlimited for pro tier
      if (hourlyLimit === -1) {
        return { allowed: true, remaining: 'unlimited' };
      }

      // Check usage in last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const recentListingsQuery = await db.collection('users')
        .doc(userId)
        .collection('scans')
        .where('createdAt', '>=', oneHourAgo)
        .get();

      const hourlyUsage = recentListingsQuery.size;
      const remaining = Math.max(0, hourlyLimit - hourlyUsage);
      
      return {
        allowed: remaining > 0,
        remaining,
        used: hourlyUsage,
        limit: hourlyLimit,
        resetTime: new Date(Date.now() + 60 * 60 * 1000) // Next hour
      };
      
    } catch (error) {
      console.error('Failed to check rate limit:', error);
      throw error;
    }
  }

  /**
   * Update user's subscription tier
   */
  async updateSubscription(userId, newTier, subscriptionData = {}) {
    try {
      const tierKey = newTier.toUpperCase();
      
      if (!this.tiers[tierKey]) {
        throw new Error(`${ERROR_CODES.INVALID_SUBSCRIPTION_TIER}: ${newTier}`);
      }

      const updateData = {
        'subscription.tier': newTier.toLowerCase(),
        'subscription.status': subscriptionData.status || 'active',
        'subscription.updatedAt': serverTimestamp()
      };

      // Add Stripe data if provided
      if (subscriptionData.stripeSubscriptionId) {
        updateData['subscription.stripeSubscriptionId'] = subscriptionData.stripeSubscriptionId;
      }
      if (subscriptionData.stripePriceId) {
        updateData['subscription.stripePriceId'] = subscriptionData.stripePriceId;
      }
      if (subscriptionData.billingCycle) {
        updateData['subscription.billingCycle'] = subscriptionData.billingCycle;
      }
      if (subscriptionData.nextBilling) {
        updateData['subscription.nextBilling'] = subscriptionData.nextBilling;
      }

      await db.collection('users').doc(userId).update(updateData);
      
      // Log subscription change
      await db.collection('subscription_events').add({
        userId,
        eventType: 'subscription_updated',
        previousTier: subscriptionData.previousTier || null,
        newTier: newTier.toLowerCase(),
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId || null,
        createdAt: serverTimestamp()
      });

      console.log(`Subscription updated for user ${userId}: ${newTier}`);
      return await this.getUserSubscription(userId);
      
    } catch (error) {
      console.error('Failed to update subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel user's subscription
   */
  async cancelSubscription(userId, cancelReason = null) {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      const updateData = {
        'subscription.status': 'canceled',
        'subscription.canceledAt': serverTimestamp(),
        'subscription.cancelReason': cancelReason,
        'subscription.updatedAt': serverTimestamp()
      };

      await db.collection('users').doc(userId).update(updateData);
      
      // Log cancellation
      await db.collection('subscription_events').add({
        userId,
        eventType: 'subscription_canceled',
        previousTier: subscription.tier,
        newTier: 'free',
        cancelReason,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        createdAt: serverTimestamp()
      });

      console.log(`Subscription canceled for user ${userId}`);
      return await this.getUserSubscription(userId);
      
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics for user
   */
  async getUsageStats(userId, timeframe = 'current_month') {
    try {
      let startDate, endDate;
      const now = new Date();
      
      switch (timeframe) {
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          break;
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
          break;
        case 'last_30_days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          endDate = now;
          break;
        default:
          throw new Error(`Invalid timeframe: ${timeframe}`);
      }

      // Get listings in timeframe
      const listingsQuery = await db.collection('users')
        .doc(userId)
        .collection('scans')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const listings = listingsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate statistics
      const totalListings = listings.length;
      const activeListings = listings.filter(l => l.status === 'active' || l.status === 'listed').length;
      const soldListings = listings.filter(l => l.status === 'sold').length;
      
      // Get commission data
      const commissionsQuery = await db.collection('commissions')
        .where('userId', '==', userId)
        .where('transactionDate', '>=', startDate)
        .where('transactionDate', '<=', endDate)
        .get();

      const commissions = commissionsQuery.docs.map(doc => doc.data());
      const totalRevenue = commissions.reduce((sum, c) => sum + c.saleAmount, 0);
      const totalCommissions = commissions.reduce((sum, c) => sum + c.ourCommission, 0);

      return {
        timeframe,
        startDate,
        endDate,
        listings: {
          total: totalListings,
          active: activeListings,
          sold: soldListings,
          conversionRate: totalListings > 0 ? (soldListings / totalListings) * 100 : 0
        },
        revenue: {
          totalSales: totalRevenue,
          totalCommissions,
          averageSale: soldListings > 0 ? totalRevenue / soldListings : 0
        }
      };
      
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      throw error;
    }
  }

  /**
   * Get all available subscription tiers
   */
  getAvailableTiers() {
    return Object.entries(this.tiers).map(([key, config]) => ({
      id: key.toLowerCase(),
      name: config.name,
      monthlyFee: config.monthlyFee,
      monthlyListings: config.monthlyListings,
      commissionRate: config.commissionRate,
      features: config.features,
      limits: config.limits
    }));
  }

  /**
   * Calculate upgrade recommendations for user
   */
  async getUpgradeRecommendations(userId) {
    try {
      const currentSub = await this.getUserSubscription(userId);
      const quotaCheck = await this.checkListingQuota(userId);
      const usageStats = await this.getUsageStats(userId, 'last_30_days');
      
      const recommendations = [];
      
      // If user is hitting quota limits
      if (quotaCheck.remaining <= 5 && currentSub.tier === 'free') {
        recommendations.push({
          type: 'quota_limit',
          tier: 'starter',
          reason: 'You are approaching your monthly listing limit',
          benefit: 'Upgrade to Starter for 150 listings per month'
        });
      }
      
      // If user has high usage
      if (usageStats.listings.total > 50 && currentSub.tier === 'free') {
        recommendations.push({
          type: 'high_usage',
          tier: 'pro',
          reason: 'You are a power user with high listing volume',
          benefit: 'Upgrade to Pro for unlimited listings and better commission rates'
        });
      }
      
      // If user is making good money
      if (usageStats.revenue.totalCommissions > 10 && currentSub.tier !== 'pro') {
        recommendations.push({
          type: 'revenue_optimization',
          tier: 'pro',
          reason: 'Maximize your earnings with higher commission rates',
          benefit: `Increase your commission rate to ${this.tiers.PRO.commissionRate * 100}%`
        });
      }

      return {
        currentTier: currentSub.tier,
        recommendations,
        usage: usageStats,
        quota: quotaCheck
      };
      
    } catch (error) {
      console.error('Failed to get upgrade recommendations:', error);
      throw error;
    }
  }
}

module.exports = new SubscriptionService();