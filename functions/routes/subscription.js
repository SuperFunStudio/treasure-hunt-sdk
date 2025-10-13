// routes/subscription.js
// Subscription and user tier management API endpoints

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/error-handler');
const { verifyAuth: verifyAuthFunction } = require('../utils/auth');
const { db, admin, serverTimestamp } = require('../config/firebase');

// Import services
const subscriptionService = require('../services/subscription/subscriptionService');
const affiliateService = require('../services/affiliate/affiliateService');
const { getStripeConfig } = require('../config/environment');
const { ERROR_CODES } = require('../config/constants');

// Initialize Stripe (only if configured)
let stripe = null;
try {
  const stripeConfig = getStripeConfig();
  if (stripeConfig.secretKey) {
    stripe = require('stripe')(stripeConfig.secretKey);
    console.log('Stripe initialized for subscription management');
  }
} catch (error) {
  console.warn('Stripe not available:', error.message);
}

/**
 * Get user's current subscription status
 */
router.get('/api/subscription/status', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;

    const subscription = await subscriptionService.getUserSubscription(userId);
    const quotaCheck = await subscriptionService.checkListingQuota(userId);
    const usageStats = await subscriptionService.getUsageStats(userId);

    res.json({
      success: true,
      subscription,
      quota: quotaCheck,
      usage: usageStats,
      availableTiers: subscriptionService.getAvailableTiers()
    });

  } catch (error) {
    console.error('Failed to get subscription status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get upgrade recommendations for user
 */
router.get('/api/subscription/recommendations', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;

    const recommendations = await subscriptionService.getUpgradeRecommendations(userId);

    res.json({
      success: true,
      ...recommendations
    });

  } catch (error) {
    console.error('Failed to get upgrade recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Create Stripe checkout session for subscription upgrade
 */
router.post('/api/subscription/create-checkout', asyncHandler(async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        success: false,
        error: 'Payment processing not available',
        errorCode: 'STRIPE_NOT_CONFIGURED'
      });
    }

    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { tier, successUrl, cancelUrl } = req.body;

    if (!tier || !['starter', 'pro'].includes(tier.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription tier',
        errorCode: ERROR_CODES.INVALID_SUBSCRIPTION_TIER
      });
    }

    const stripeConfig = getStripeConfig();
    const priceId = tier.toLowerCase() === 'starter' ? 
      stripeConfig.prices.starter : stripeConfig.prices.pro;

    if (!priceId) {
      return res.status(500).json({
        success: false,
        error: `Price ID not configured for tier: ${tier}`,
        errorCode: 'PRICE_NOT_CONFIGURED'
      });
    }

    // Get user info for customer creation
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Create or get Stripe customer
    let customerId = userData.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        metadata: {
          userId: userId,
          appName: 'ThriftSpot'
        }
      });
      customerId = customer.id;
      
      // Save customer ID to user record
      await db.collection('users').doc(userId).update({
        stripeCustomerId: customerId,
        'metadata.updatedAt': serverTimestamp()
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: successUrl || `${process.env.APP_BASE_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.APP_BASE_URL}/subscription/cancel`,
      metadata: {
        userId: userId,
        tier: tier.toLowerCase()
      },
      subscription_data: {
        metadata: {
          userId: userId,
          tier: tier.toLowerCase()
        }
      }
    });

    res.json({
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url
    });

  } catch (error) {
    console.error('Failed to create checkout session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Handle successful subscription checkout
 */
router.post('/api/subscription/checkout-success', asyncHandler(async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        success: false,
        error: 'Payment processing not available'
      });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID required'
      });
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Payment not completed'
      });
    }

    const userId = session.metadata.userId;
    const tier = session.metadata.tier;
    const subscription = session.subscription;

    // Update user's subscription
    await subscriptionService.updateSubscription(userId, tier, {
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      status: 'active',
      billingCycle: 'monthly',
      nextBilling: new Date(subscription.current_period_end * 1000)
    });

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      tier,
      subscription: await subscriptionService.getUserSubscription(userId)
    });

  } catch (error) {
    console.error('Failed to process successful checkout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Cancel user's subscription
 */
router.post('/api/subscription/cancel', asyncHandler(async (req, res) => {
  try {
    const decodedToken = await verifyAuthFunction(req);
    const userId = decodedToken.uid;
    const { reason } = req.body;

    const currentSubscription = await subscriptionService.getUserSubscription(userId);

    // Cancel in Stripe if applicable
    if (stripe && currentSubscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(currentSubscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
    }

    // Update in our system
    await subscriptionService.cancelSubscription(userId, reason);

    res.json({
      success: true,
      message: 'Subscription canceled successfully',
      subscription: await subscriptionService.getUserSubscription(userId)
    });

  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Stripe webhook handler for subscription events
 */
router.post('/api/subscription/webhook', express.raw({type: 'application/json'}), asyncHandler(async (req, res) => {
  try {
    if (!stripe) {
      return res.status(200).send('Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    const stripeConfig = getStripeConfig();

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeConfig.webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('Processing Stripe webhook:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).send('Webhook received');

  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).send('Webhook processing failed');
  }
}));

/**
 * Handle subscription update from Stripe webhook
 */
async function handleSubscriptionUpdate(subscription) {
  try {
    const userId = subscription.metadata.userId;
    const tier = subscription.metadata.tier;

    if (!userId || !tier) {
      console.warn('Missing metadata in subscription:', subscription.id);
      return;
    }

    await subscriptionService.updateSubscription(userId, tier, {
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      status: subscription.status,
      billingCycle: 'monthly',
      nextBilling: new Date(subscription.current_period_end * 1000)
    });

    console.log(`Subscription updated for user ${userId}: ${tier}`);

  } catch (error) {
    console.error('Failed to handle subscription update:', error);
  }
}

/**
 * Handle subscription cancellation from Stripe webhook
 */
async function handleSubscriptionCancellation(subscription) {
  try {
    const userId = subscription.metadata.userId;

    if (!userId) {
      console.warn('Missing userId in canceled subscription:', subscription.id);
      return;
    }

    await subscriptionService.cancelSubscription(userId, 'stripe_cancellation');
    console.log(`Subscription canceled for user ${userId}`);

  } catch (error) {
    console.error('Failed to handle subscription cancellation:', error);
  }
}

/**
 * Handle successful payment from Stripe webhook
 */
async function handlePaymentSuccess(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    
    if (subscriptionId) {
      // Log successful payment
      await db.collection('payment_events').add({
        type: 'payment_success',
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        createdAt: serverTimestamp()
      });
    }

  } catch (error) {
    console.error('Failed to handle payment success:', error);
  }
}

/**
 * Handle failed payment from Stripe webhook
 */
async function handlePaymentFailure(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    
    if (subscriptionId) {
      // Log failed payment
      await db.collection('payment_events').add({
        type: 'payment_failed',
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        amount: invoice.amount_due,
        currency: invoice.currency,
        createdAt: serverTimestamp()
      });

      // Could add logic here to notify user or downgrade subscription after multiple failures
    }

  } catch (error) {
    console.error('Failed to handle payment failure:', error);
  }
}

module.exports = router;