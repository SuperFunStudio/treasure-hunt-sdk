// routes/tokens.js
// Token system routes for awarding, spending, and purchasing tokens

const express = require('express');
const router = express.Router();

// Dependencies (injected)
let db = null;
let admin = null;
let stripe = null;

// Inject dependencies
function injectDependencies(dependencies) {
  db = dependencies.db;
  admin = dependencies.admin;
  stripe = dependencies.stripe;
}

// ========== MIDDLEWARE ==========

// Verify Firebase Auth token
const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({ success: false, error: 'Invalid authentication token' });
  }
};

// ========== HELPER FUNCTIONS ==========

// Get user's current token balance
async function getTokenBalance(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return 5; // Default starting balance
    }
    const data = userDoc.data();
    return data.tokens?.balance || 5;
  } catch (error) {
    console.error('Error getting token balance:', error);
    throw error;
  }
}

// Get user's subscription status
async function getSubscriptionStatus(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { tier: 'free', status: 'none' };
    }
    const data = userDoc.data();
    return data.subscription || { tier: 'free', status: 'none' };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return { tier: 'free', status: 'none' };
  }
}

// Record token transaction
async function recordTransaction(userId, type, amount, reason, relatedId = null) {
  try {
    const transactionRef = db.collection('users').doc(userId).collection('tokenTransactions').doc();
    const currentBalance = await getTokenBalance(userId);
    const newBalance = type === 'earn' ? currentBalance + amount : currentBalance - amount;

    const transaction = {
      type: type, // 'earn', 'spend', or 'purchase'
      amount: amount,
      balance: newBalance,
      reason: reason,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      relatedDocId: relatedId,
      metadata: {
        userAgent: 'backend',
        source: 'cloud-function'
      }
    };

    await transactionRef.set(transaction);
    return { success: true, newBalance, transactionId: transactionRef.id };
  } catch (error) {
    console.error('Error recording transaction:', error);
    throw error;
  }
}

// ========== ROUTES ==========

// GET /api/tokens/balance - Get current token balance
router.get('/balance', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const balance = await getTokenBalance(userId);
    const subscription = await getSubscriptionStatus(userId);

    res.json({
      success: true,
      balance: balance,
      subscription: subscription,
      unlimitedTokens: subscription.tier !== 'free' && subscription.status === 'active'
    });
  } catch (error) {
    console.error('Error getting token balance:', error);
    res.status(500).json({ success: false, error: 'Failed to get token balance' });
  }
});

// POST /api/tokens/award - Award tokens to user (server-side only)
router.post('/award', verifyAuth, async (req, res) => {
  try {
    const { userId, amount, reason, relatedId } = req.body;

    // Verify the requesting user is the same as the userId (or is an admin)
    if (req.user.uid !== userId && !req.user.admin) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Reason is required' });
    }

    // Record the transaction
    const result = await recordTransaction(userId, 'earn', amount, reason, relatedId);

    // Update user's token balance
    const userRef = db.collection('users').doc(userId);
    await userRef.set({
      tokens: {
        balance: result.newBalance,
        totalEarned: admin.firestore.FieldValue.increment(amount),
        lastEarned: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });

    console.log(`✅ Awarded ${amount} tokens to user ${userId} for: ${reason}`);

    res.json({
      success: true,
      balance: result.newBalance,
      amount: amount,
      reason: reason,
      transactionId: result.transactionId
    });
  } catch (error) {
    console.error('Error awarding tokens:', error);
    res.status(500).json({ success: false, error: 'Failed to award tokens' });
  }
});

// POST /api/tokens/spend - Spend tokens (deduct from balance)
router.post('/spend', verifyAuth, async (req, res) => {
  try {
    const { userId, amount, reason, relatedId } = req.body;

    // Verify the requesting user is the same as the userId
    if (req.user.uid !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Reason is required' });
    }

    // Check subscription status - if user has active subscription, they have unlimited tokens for listings
    const subscription = await getSubscriptionStatus(userId);
    if (subscription.tier !== 'free' && subscription.status === 'active' && reason.includes('listing')) {
      console.log(`User ${userId} has active ${subscription.tier} subscription - skipping token spend for listing`);
      return res.json({
        success: true,
        balance: await getTokenBalance(userId),
        amount: 0,
        reason: 'unlimited_subscription',
        message: 'Your subscription includes unlimited listing tokens'
      });
    }

    // Check if user has enough tokens
    const currentBalance = await getTokenBalance(userId);
    if (currentBalance < amount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient tokens',
        balance: currentBalance,
        required: amount
      });
    }

    // Record the transaction
    const result = await recordTransaction(userId, 'spend', amount, reason, relatedId);

    // Update user's token balance
    const userRef = db.collection('users').doc(userId);
    await userRef.set({
      tokens: {
        balance: result.newBalance,
        totalSpent: admin.firestore.FieldValue.increment(amount),
        lastSpent: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });

    console.log(`✅ Deducted ${amount} tokens from user ${userId} for: ${reason}`);

    res.json({
      success: true,
      balance: result.newBalance,
      amount: amount,
      reason: reason,
      transactionId: result.transactionId
    });
  } catch (error) {
    console.error('Error spending tokens:', error);
    res.status(500).json({ success: false, error: 'Failed to spend tokens' });
  }
});

// POST /api/tokens/purchase - Purchase token pack via Stripe
router.post('/purchase', verifyAuth, async (req, res) => {
  try {
    const { packageType } = req.body;
    const userId = req.user.uid;

    const packages = {
      'starter': { tokens: 10, price: 4.99, priceId: process.env.STRIPE_PRICE_TOKENS_STARTER },
      'value': { tokens: 25, price: 9.99, priceId: process.env.STRIPE_PRICE_TOKENS_VALUE },
      'power': { tokens: 50, price: 14.99, priceId: process.env.STRIPE_PRICE_TOKENS_POWER },
      'pro': { tokens: 100, price: 24.99, priceId: process.env.STRIPE_PRICE_TOKENS_PRO }
    };

    const selectedPackage = packages[packageType];
    if (!selectedPackage) {
      return res.status(400).json({ success: false, error: 'Invalid package type' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${selectedPackage.tokens} ThriftSpot Tokens`,
            description: `${packageType.charAt(0).toUpperCase() + packageType.slice(1)} Pack - ${selectedPackage.tokens} listing tokens`,
          },
          unit_amount: Math.round(selectedPackage.price * 100), // Convert to cents
        },
        quantity: 1,
      }],
      success_url: `${process.env.APP_BASE_URL || 'https://treasurehunter-sdk.web.app'}/dashboard.html?payment=success`,
      cancel_url: `${process.env.APP_BASE_URL || 'https://treasurehunter-sdk.web.app'}/dashboard.html?payment=cancelled`,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        packageType: packageType,
        tokenAmount: selectedPackage.tokens.toString(),
        purpose: 'token_purchase'
      }
    });

    console.log(`✅ Created Stripe checkout session for user ${userId}: ${session.id}`);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      package: {
        type: packageType,
        tokens: selectedPackage.tokens,
        price: selectedPackage.price
      }
    });
  } catch (error) {
    console.error('Error creating token purchase session:', error);
    res.status(500).json({ success: false, error: 'Failed to create purchase session' });
  }
});

// POST /api/tokens/subscribe - Create subscription checkout session
router.post('/subscribe', verifyAuth, async (req, res) => {
  try {
    const { tier } = req.body;
    const userId = req.user.uid;

    const tiers = {
      'pro': { price: 9.99, priceId: process.env.STRIPE_PRICE_SUB_PRO },
      'premium': { price: 19.99, priceId: process.env.STRIPE_PRICE_SUB_PREMIUM }
    };

    const selectedTier = tiers[tier];
    if (!selectedTier) {
      return res.status(400).json({ success: false, error: 'Invalid subscription tier' });
    }

    // Get user email for Stripe
    const userDoc = await db.collection('users').doc(userId).get();
    const userEmail = userDoc.exists ? userDoc.data().email : req.user.email;

    // Create Stripe subscription checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `ThriftSpot ${tier === 'pro' ? 'Pro' : 'Premium'}`,
            description: tier === 'pro'
              ? 'Unlimited tokens + priority support + analytics'
              : 'Everything in Pro + unlimited featured listings + bulk tools + API access',
          },
          unit_amount: Math.round(selectedTier.price * 100),
          recurring: {
            interval: 'month'
          }
        },
        quantity: 1,
      }],
      success_url: `${process.env.APP_BASE_URL || 'https://treasurehunter-sdk.web.app'}/dashboard.html?subscription=success`,
      cancel_url: `${process.env.APP_BASE_URL || 'https://treasurehunter-sdk.web.app'}/dashboard.html?subscription=cancelled`,
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        tier: tier,
        purpose: 'subscription'
      }
    });

    console.log(`✅ Created subscription checkout session for user ${userId}: ${session.id}`);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      tier: tier,
      price: selectedTier.price
    });
  } catch (error) {
    console.error('Error creating subscription session:', error);
    res.status(500).json({ success: false, error: 'Failed to create subscription session' });
  }
});

// GET /api/tokens/history - Get token transaction history
router.get('/history', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const limit = parseInt(req.query.limit) || 50;

    const transactionsSnapshot = await db.collection('users')
      .doc(userId)
      .collection('tokenTransactions')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const transactions = [];
    transactionsSnapshot.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      transactions: transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('Error getting token history:', error);
    res.status(500).json({ success: false, error: 'Failed to get transaction history' });
  }
});

module.exports = {
  router,
  injectDependencies
};
