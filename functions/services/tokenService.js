/**
 * Token Service
 * Manages the ThriftSpot token economy system
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// Token costs and rewards configuration
const TOKEN_CONFIG = {
  costs: {
    scan: 5,
    reserve: 3,
    claim: 10
  },
  rewards: {
    pinCreated: 2,
    pinClaimed: 5,
    monthlyAllocation: 100,
    referral: 50
  },
  packages: {
    starter: { tokens: 50, price: 4.99 },
    standard: { tokens: 150, price: 12.99 },
    premium: { tokens: 500, price: 39.99 },
    pro: { tokens: 1500, price: 99.99 }
  }
};

/**
 * Initialize token system for a new user
 */
async function initializeUserTokens(userId, userEmail) {
  const userRef = db.collection('users').doc(userId);

  const userData = {
    uid: userId,
    email: userEmail,
    tokens: {
      balance: TOKEN_CONFIG.rewards.monthlyAllocation,
      totalEarned: TOKEN_CONFIG.rewards.monthlyAllocation,
      totalSpent: 0,
      totalPurchased: 0,
      monthlyAllocation: TOKEN_CONFIG.rewards.monthlyAllocation,
      lastMonthlyReset: admin.firestore.FieldValue.serverTimestamp(),
      tier: 'free'
    },
    stats: {
      pinsCreated: 0,
      pinsClaimed: 0,
      itemsScanned: 0,
      itemsReserved: 0
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await userRef.set(userData, { merge: true });

  // Log initial token allocation
  await logTokenTransaction(userId, {
    type: 'earn',
    action: 'monthly_allocation',
    amount: TOKEN_CONFIG.rewards.monthlyAllocation,
    balanceBefore: 0,
    balanceAfter: TOKEN_CONFIG.rewards.monthlyAllocation,
    metadata: {
      description: 'Initial token allocation'
    }
  });

  return userData.tokens;
}

/**
 * Get user's token balance
 */
async function getTokenBalance(userId) {
  const userDoc = await db.collection('users').doc(userId).get();

  if (!userDoc.exists) {
    throw new Error('User not found');
  }

  const userData = userDoc.data();

  // Check if monthly reset is needed
  await checkMonthlyReset(userId, userData);

  // Refresh user data after potential reset
  const refreshedDoc = await db.collection('users').doc(userId).get();
  const refreshedData = refreshedDoc.data();

  return {
    balance: refreshedData.tokens?.balance || 0,
    monthlyAllocation: refreshedData.tokens?.monthlyAllocation || 100,
    tier: refreshedData.tokens?.tier || 'free',
    totalEarned: refreshedData.tokens?.totalEarned || 0,
    totalSpent: refreshedData.tokens?.totalSpent || 0
  };
}

/**
 * Check and perform monthly token reset if needed
 */
async function checkMonthlyReset(userId, userData) {
  if (!userData.tokens?.lastMonthlyReset) {
    return;
  }

  const lastReset = userData.tokens.lastMonthlyReset.toDate();
  const now = new Date();

  // Check if it's been a month since last reset
  const monthDiff = (now.getFullYear() - lastReset.getFullYear()) * 12 +
                    (now.getMonth() - lastReset.getMonth());

  if (monthDiff >= 1) {
    const allocationAmount = userData.tokens.monthlyAllocation || TOKEN_CONFIG.rewards.monthlyAllocation;
    const currentBalance = userData.tokens.balance || 0;
    const newBalance = currentBalance + allocationAmount;

    await db.collection('users').doc(userId).update({
      'tokens.balance': newBalance,
      'tokens.totalEarned': admin.firestore.FieldValue.increment(allocationAmount),
      'tokens.lastMonthlyReset': admin.firestore.FieldValue.serverTimestamp(),
      'updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });

    await logTokenTransaction(userId, {
      type: 'earn',
      action: 'monthly_allocation',
      amount: allocationAmount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      metadata: {
        description: 'Monthly token allocation'
      }
    });
  }
}

/**
 * Deduct tokens from user balance
 */
async function deductTokens(userId, action, amount, metadata = {}) {
  return await db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const currentBalance = userData.tokens?.balance || 0;

    if (currentBalance < amount) {
      throw new Error('Insufficient tokens');
    }

    const newBalance = currentBalance - amount;

    // Update user balance
    transaction.update(userRef, {
      'tokens.balance': newBalance,
      'tokens.totalSpent': admin.firestore.FieldValue.increment(amount),
      'updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });

    // Update stats based on action
    if (action === 'scan') {
      transaction.update(userRef, {
        'stats.itemsScanned': admin.firestore.FieldValue.increment(1)
      });
    } else if (action === 'reserve') {
      transaction.update(userRef, {
        'stats.itemsReserved': admin.firestore.FieldValue.increment(1)
      });
    } else if (action === 'claim') {
      transaction.update(userRef, {
        'stats.pinsClaimed': admin.firestore.FieldValue.increment(1)
      });
    }

    // Log transaction
    const transactionRef = db.collection('tokenTransactions').doc();
    transaction.set(transactionRef, {
      userId: userId,
      type: 'spend',
      action: action,
      amount: -amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      metadata: metadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      newBalance: newBalance,
      transactionId: transactionRef.id
    };
  });
}

/**
 * Award tokens to user
 */
async function awardTokens(userId, action, amount, metadata = {}) {
  return await db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const currentBalance = userData.tokens?.balance || 0;
    const newBalance = currentBalance + amount;

    // Update user balance
    transaction.update(userRef, {
      'tokens.balance': newBalance,
      'tokens.totalEarned': admin.firestore.FieldValue.increment(amount),
      'updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });

    // Update stats based on action
    if (action === 'pin_created') {
      transaction.update(userRef, {
        'stats.pinsCreated': admin.firestore.FieldValue.increment(1)
      });
    }

    // Log transaction
    const transactionRef = db.collection('tokenTransactions').doc();
    transaction.set(transactionRef, {
      userId: userId,
      type: 'earn',
      action: action,
      amount: amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      metadata: metadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      newBalance: newBalance,
      transactionId: transactionRef.id
    };
  });
}

/**
 * Award tokens for creating a pin
 */
async function awardPinCreationTokens(userId, pinId) {
  return await awardTokens(
    userId,
    'pin_created',
    TOKEN_CONFIG.rewards.pinCreated,
    {
      pinId: pinId,
      description: 'Tokens earned for creating a map pin'
    }
  );
}

/**
 * Award bonus tokens when user's pin is claimed
 */
async function awardPinClaimedBonus(pinOwnerId, pinId, claimerId) {
  return await awardTokens(
    pinOwnerId,
    'pin_claimed',
    TOKEN_CONFIG.rewards.pinClaimed,
    {
      pinId: pinId,
      claimerId: claimerId,
      description: 'Bonus tokens for your pin being claimed'
    }
  );
}

/**
 * Process token purchase
 */
async function processPurchase(userId, packageType, stripeSessionId) {
  const packageData = TOKEN_CONFIG.packages[packageType];

  if (!packageData) {
    throw new Error('Invalid package type');
  }

  return await db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const currentBalance = userData.tokens?.balance || 0;
    const newBalance = currentBalance + packageData.tokens;

    // Update user balance
    transaction.update(userRef, {
      'tokens.balance': newBalance,
      'tokens.totalPurchased': admin.firestore.FieldValue.increment(packageData.tokens),
      'updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });

    // Log transaction
    const transactionRef = db.collection('tokenTransactions').doc();
    transaction.set(transactionRef, {
      userId: userId,
      type: 'purchase',
      action: 'token_purchase',
      amount: packageData.tokens,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      metadata: {
        packageType: packageType,
        price: packageData.price,
        stripeSessionId: stripeSessionId,
        description: `Purchased ${packageData.tokens} tokens (${packageType} package)`
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      newBalance: newBalance,
      tokensAdded: packageData.tokens,
      transactionId: transactionRef.id
    };
  });
}

/**
 * Get user's token transaction history
 */
async function getTransactionHistory(userId, limit = 50, offset = 0) {
  const snapshot = await db.collection('tokenTransactions')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .offset(offset)
    .get();

  const transactions = [];
  snapshot.forEach(doc => {
    transactions.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return transactions;
}

/**
 * Log a token transaction
 */
async function logTokenTransaction(userId, data) {
  return await db.collection('tokenTransactions').add({
    userId: userId,
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Check if user has sufficient tokens
 */
async function hasSufficientTokens(userId, requiredAmount) {
  const balance = await getTokenBalance(userId);
  return balance.balance >= requiredAmount;
}

/**
 * Get token cost for an action
 */
function getTokenCost(action) {
  return TOKEN_CONFIG.costs[action] || 0;
}

/**
 * Get token reward for an action
 */
function getTokenReward(action) {
  const actionKey = action.replace('_', '');
  return TOKEN_CONFIG.rewards[actionKey] || 0;
}

module.exports = {
  TOKEN_CONFIG,
  initializeUserTokens,
  getTokenBalance,
  deductTokens,
  awardTokens,
  awardPinCreationTokens,
  awardPinClaimedBonus,
  processPurchase,
  getTransactionHistory,
  hasSufficientTokens,
  getTokenCost,
  getTokenReward
};
