// routes/stripe-webhooks.js
// Stripe webhook handler for token purchases and subscriptions

const express = require('express');
const router = express.Router();

// Dependencies (injected)
let db = null;
let admin = null;
let stripe = null;

function injectDependencies(dependencies) {
  db = dependencies.db;
  admin = dependencies.admin;
  stripe = dependencies.stripe;
}

// Webhook endpoint - NOTE: This expects raw body, not JSON parsed
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`✅ Stripe webhook received: ${event.type}`);

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// ========== WEBHOOK HANDLERS ==========

async function handleCheckoutSessionCompleted(session) {
  console.log('Processing completed checkout session:', session.id);

  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId) {
    console.error('No userId found in session');
    return;
  }

  const purpose = session.metadata?.purpose;

  if (purpose === 'token_purchase') {
    // One-time token purchase
    await handleTokenPurchaseCompleted(session, userId);
  } else if (purpose === 'subscription') {
    // Subscription started
    await handleSubscriptionCheckoutCompleted(session, userId);
  } else if (purpose === 'listing_purchase') {
    // Listing/item purchase
    await handleListingPurchaseCompleted(session);
  }
}

async function handleTokenPurchaseCompleted(session, userId) {
  const tokenAmount = parseInt(session.metadata?.tokenAmount || '0');
  const packageType = session.metadata?.packageType || 'unknown';

  if (tokenAmount <= 0) {
    console.error('Invalid token amount in session metadata');
    return;
  }

  try {
    // Get current balance
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const currentBalance = userDoc.exists ? (userDoc.data().tokens?.balance || 5) : 5;
    const newBalance = currentBalance + tokenAmount;

    // Record transaction
    const transactionRef = userRef.collection('tokenTransactions').doc();
    await transactionRef.set({
      type: 'purchase',
      amount: tokenAmount,
      balance: newBalance,
      reason: `purchased_${packageType}_pack`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        stripeSessionId: session.id,
        packageType: packageType,
        amountPaid: session.amount_total / 100,
        currency: session.currency
      }
    });

    // Update user's token balance
    await userRef.set({
      tokens: {
        balance: newBalance,
        totalEarned: admin.firestore.FieldValue.increment(tokenAmount),
        lastPurchase: admin.firestore.FieldValue.serverTimestamp()
      },
      purchases: {
        lastPurchaseDate: admin.firestore.FieldValue.serverTimestamp(),
        totalPurchaseAmount: admin.firestore.FieldValue.increment(session.amount_total / 100)
      }
    }, { merge: true });

    console.log(`✅ Added ${tokenAmount} tokens to user ${userId} from ${packageType} pack purchase`);
  } catch (error) {
    console.error('Error processing token purchase:', error);
    throw error;
  }
}

async function handleSubscriptionCheckoutCompleted(session, userId) {
  const tier = session.metadata?.tier || 'pro';

  try {
    const userRef = db.collection('users').doc(userId);

    await userRef.set({
      subscription: {
        tier: tier,
        status: 'active',
        stripeSubscriptionId: session.subscription,
        stripeCustomerId: session.customer,
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        currentPeriodEnd: null, // Will be updated by subscription.updated event
      }
    }, { merge: true });

    console.log(`✅ Activated ${tier} subscription for user ${userId}`);
  } catch (error) {
    console.error('Error activating subscription:', error);
    throw error;
  }
}

async function handleListingPurchaseCompleted(session) {
  const pinId = session.metadata?.pinId;
  const pinDocId = session.metadata?.pinDocId;
  const buyerId = session.metadata?.buyerId;
  const sellerId = session.metadata?.sellerId;
  const itemTitle = session.metadata?.itemTitle || 'Item';

  // Platform fee data from metadata
  const totalAmount = parseFloat(session.metadata?.totalAmount) || (session.amount_total / 100);
  const platformFee = parseFloat(session.metadata?.platformFee) || 0;
  const sellerAmount = parseFloat(session.metadata?.sellerAmount) || totalAmount;
  const platformFeePercent = parseFloat(session.metadata?.platformFeePercent) || 10;

  if (!pinId || !buyerId || !sellerId) {
    console.error('Missing required metadata for listing purchase');
    return;
  }

  console.log(`Processing listing purchase: Total $${totalAmount}, Platform fee $${platformFee} (${platformFeePercent}%), Seller gets $${sellerAmount}`);

  try {
    // Create order record
    const orderRef = db.collection('orders').doc();
    const orderId = orderRef.id;

    await orderRef.set({
      // Order identifiers
      orderId: orderId,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,

      // Item and listing info
      pinId: pinId,
      pinDocId: pinDocId,
      itemTitle: itemTitle,

      // Parties involved
      buyerId: buyerId,
      sellerId: sellerId,

      // Financial details (with platform fee breakdown)
      amount: totalAmount,
      platformFee: platformFee,
      platformFeePercent: platformFeePercent,
      sellerAmount: sellerAmount,
      currency: session.currency,
      paymentStatus: 'paid',
      platformFeeCollected: true,
      sellerPayoutStatus: 'pending', // Seller will be paid manually

      // Order status
      status: 'paid',
      statusHistory: [{
        status: 'paid',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        notes: 'Payment received via Stripe'
      }],

      // Timestamps
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paidAt: admin.firestore.FieldValue.serverTimestamp(),

      // Additional data
      buyerEmail: session.customer_email || session.customer_details?.email,
      metadata: session.metadata
    });

    console.log(`✅ Created order ${orderId} for listing ${pinId}`);

    // Record platform earnings
    await db.collection('platformEarnings').add({
      orderId: orderId,
      pinId: pinId,
      sellerId: sellerId,
      buyerId: buyerId,
      totalAmount: totalAmount,
      platformFee: platformFee,
      platformFeePercent: platformFeePercent,
      sellerAmount: sellerAmount,
      stripeSessionId: session.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Recorded platform earnings: $${platformFee} from order ${orderId}`);

    // Update pin status to sold
    if (pinDocId) {
      const pinRef = db.collection('pins').doc(pinDocId);
      await pinRef.update({
        status: 'sold',
        soldTo: buyerId,
        soldAt: admin.firestore.FieldValue.serverTimestamp(),
        orderId: orderId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Updated pin ${pinId} status to sold`);
    }

    // Add to buyer's purchase history
    await db.collection('users').doc(buyerId).set({
      purchases: {
        totalPurchases: admin.firestore.FieldValue.increment(1),
        totalSpent: admin.firestore.FieldValue.increment(totalAmount),
        lastPurchaseDate: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });

    // Add to seller's sales history (track seller's actual earnings after platform fee)
    await db.collection('users').doc(sellerId).set({
      sales: {
        totalSales: admin.firestore.FieldValue.increment(1),
        totalRevenue: admin.firestore.FieldValue.increment(sellerAmount), // Seller amount after platform fee
        totalGrossSales: admin.firestore.FieldValue.increment(totalAmount), // Total before fees
        platformFeesTotal: admin.firestore.FieldValue.increment(platformFee),
        pendingPayout: admin.firestore.FieldValue.increment(sellerAmount), // Track pending payouts
        lastSaleDate: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });

    console.log(`✅ Listing purchase completed: Order ${orderId}, Platform fee: $${platformFee}, Seller payout: $${sellerAmount}`);

  } catch (error) {
    console.error('Error processing listing purchase:', error);
    throw error;
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('Subscription created:', subscription.id);
  // This is handled by checkout.session.completed
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated:', subscription.id);

  // Find user by subscription ID
  const usersSnapshot = await db.collection('users')
    .where('subscription.stripeSubscriptionId', '==', subscription.id)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.error('No user found for subscription:', subscription.id);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;

  const status = subscription.status; // active, past_due, canceled, etc.
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  await db.collection('users').doc(userId).set({
    subscription: {
      status: status,
      currentPeriodEnd: admin.firestore.Timestamp.fromDate(currentPeriodEnd),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }
  }, { merge: true });

  console.log(`✅ Updated subscription status for user ${userId}: ${status}`);
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription cancelled:', subscription.id);

  // Find user by subscription ID
  const usersSnapshot = await db.collection('users')
    .where('subscription.stripeSubscriptionId', '==', subscription.id)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.error('No user found for subscription:', subscription.id);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;

  await db.collection('users').doc(userId).set({
    subscription: {
      tier: 'free',
      status: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      endDate: admin.firestore.FieldValue.serverTimestamp()
    }
  }, { merge: true });

  console.log(`✅ Cancelled subscription for user ${userId}`);
}

async function handleInvoicePaymentSucceeded(invoice) {
  console.log('Invoice payment succeeded:', invoice.id);
  // Subscription renewal successful - subscription.updated will handle this
}

async function handleInvoicePaymentFailed(invoice) {
  console.log('Invoice payment failed:', invoice.id);

  // Find user by customer ID
  const usersSnapshot = await db.collection('users')
    .where('subscription.stripeCustomerId', '==', invoice.customer)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.error('No user found for customer:', invoice.customer);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;

  await db.collection('users').doc(userId).set({
    subscription: {
      status: 'past_due',
      paymentFailedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  }, { merge: true });

  console.log(`⚠️ Payment failed for user ${userId}`);

  // TODO: Send email notification to user about failed payment
}

module.exports = {
  router,
  injectDependencies
};
