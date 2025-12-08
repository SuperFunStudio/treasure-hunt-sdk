/**
 * Token Management Script
 * Used for admin tasks like setting token balances, awarding tokens, etc.
 *
 * Usage:
 *   node scripts/manage-tokens.js set <userId> <amount>
 *   node scripts/manage-tokens.js award <userId> <amount> [reason]
 *   node scripts/manage-tokens.js get <userId>
 *   node scripts/manage-tokens.js reset-all-to-15
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Try to find service account key
let serviceAccountPath;
const possiblePaths = [
  path.join(__dirname, '..', 'serviceAccountKey.json'),
  path.join(__dirname, '..', 'functions', 'service-account-key.json'),
  path.join(__dirname, '..', 'service-account-key.json')
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    serviceAccountPath = p;
    break;
  }
}

if (!serviceAccountPath) {
  console.error('❌ Could not find service account key file.');
  console.error('   Looked in:', possiblePaths);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Parse command line arguments
const [,, command, ...args] = process.argv;

async function setTokenBalance(userId, amount) {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error(`❌ User ${userId} not found`);
      return;
    }

    const currentBalance = userDoc.data().tokens?.balance || 0;

    await userRef.update({
      'tokens.balance': amount,
      'updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });

    // Log the transaction
    await db.collection('tokenTransactions').add({
      userId: userId,
      type: 'admin_set',
      action: 'admin_balance_adjustment',
      amount: amount - currentBalance,
      balanceBefore: currentBalance,
      balanceAfter: amount,
      metadata: {
        description: 'Admin balance adjustment via script'
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Updated token balance for user ${userId}`);
    console.log(`   Previous balance: ${currentBalance}`);
    console.log(`   New balance: ${amount}`);
  } catch (error) {
    console.error('❌ Error setting token balance:', error);
  }
}

async function awardTokens(userId, amount, reason = 'admin_award') {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error(`❌ User ${userId} not found`);
      return;
    }

    const currentBalance = userDoc.data().tokens?.balance || 0;
    const newBalance = currentBalance + amount;

    await userRef.update({
      'tokens.balance': newBalance,
      'tokens.totalEarned': admin.firestore.FieldValue.increment(amount),
      'updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });

    // Log the transaction
    await db.collection('tokenTransactions').add({
      userId: userId,
      type: 'earn',
      action: reason,
      amount: amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      metadata: {
        description: `Admin awarded tokens: ${reason}`
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Awarded ${amount} tokens to user ${userId}`);
    console.log(`   Previous balance: ${currentBalance}`);
    console.log(`   New balance: ${newBalance}`);
    console.log(`   Reason: ${reason}`);
  } catch (error) {
    console.error('❌ Error awarding tokens:', error);
  }
}

async function getTokenBalance(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.error(`❌ User ${userId} not found`);
      return;
    }

    const userData = userDoc.data();
    const tokens = userData.tokens || {};

    console.log(`\n📊 Token info for user: ${userId}`);
    console.log(`   Email: ${userData.email || 'N/A'}`);
    console.log(`   Current balance: ${tokens.balance || 0}`);
    console.log(`   Total earned: ${tokens.totalEarned || 0}`);
    console.log(`   Total spent: ${tokens.totalSpent || 0}`);
    console.log(`   Total purchased: ${tokens.totalPurchased || 0}`);
    console.log(`   Tier: ${tokens.tier || 'free'}`);
    console.log(`   Monthly allocation: ${tokens.monthlyAllocation || 100}`);
  } catch (error) {
    console.error('❌ Error getting token balance:', error);
  }
}

async function resetAllUsersTo15() {
  try {
    console.log('🔄 Resetting all users to 15 tokens...');

    const usersSnapshot = await db.collection('users').get();
    let count = 0;

    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      const userData = doc.data();
      const currentBalance = userData.tokens?.balance || 0;

      if (currentBalance !== 15) {
        await db.collection('users').doc(userId).update({
          'tokens.balance': 15,
          'updatedAt': admin.firestore.FieldValue.serverTimestamp()
        });

        // Log the transaction
        await db.collection('tokenTransactions').add({
          userId: userId,
          type: 'admin_set',
          action: 'admin_reset_to_15',
          amount: 15 - currentBalance,
          balanceBefore: currentBalance,
          balanceAfter: 15,
          metadata: {
            description: 'Admin reset all users to 15 tokens'
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`   ✓ Reset ${userData.email || userId}: ${currentBalance} → 15`);
        count++;
      }
    }

    console.log(`\n✅ Reset ${count} user(s) to 15 tokens`);
  } catch (error) {
    console.error('❌ Error resetting users:', error);
  }
}

async function listAllUsers() {
  try {
    console.log('📋 Listing all users and their token balances:\n');

    const usersSnapshot = await db.collection('users').get();

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const tokens = userData.tokens || {};
      console.log(`${userData.email || doc.id}`);
      console.log(`   Balance: ${tokens.balance || 0} | Earned: ${tokens.totalEarned || 0} | Spent: ${tokens.totalSpent || 0}`);
      console.log('');
    }

    console.log(`Total users: ${usersSnapshot.size}`);
  } catch (error) {
    console.error('❌ Error listing users:', error);
  }
}

// Main execution
async function main() {
  try {
    switch (command) {
      case 'set':
        if (args.length < 2) {
          console.error('Usage: node scripts/manage-tokens.js set <userId> <amount>');
          process.exit(1);
        }
        await setTokenBalance(args[0], parseInt(args[1]));
        break;

      case 'award':
        if (args.length < 2) {
          console.error('Usage: node scripts/manage-tokens.js award <userId> <amount> [reason]');
          process.exit(1);
        }
        await awardTokens(args[0], parseInt(args[1]), args[2] || 'admin_award');
        break;

      case 'get':
        if (args.length < 1) {
          console.error('Usage: node scripts/manage-tokens.js get <userId>');
          process.exit(1);
        }
        await getTokenBalance(args[0]);
        break;

      case 'reset-all-to-15':
        await resetAllUsersTo15();
        break;

      case 'list':
        await listAllUsers();
        break;

      default:
        console.log(`
Token Management Script
=======================

Usage:
  node scripts/manage-tokens.js <command> [arguments]

Commands:
  set <userId> <amount>              Set a user's token balance to a specific amount
  award <userId> <amount> [reason]   Award tokens to a user (adds to current balance)
  get <userId>                       Get a user's token balance and stats
  reset-all-to-15                    Reset all users' token balances to 15
  list                               List all users and their token balances

Examples:
  node scripts/manage-tokens.js set abc123 15
  node scripts/manage-tokens.js award abc123 50 "bonus_reward"
  node scripts/manage-tokens.js get abc123
  node scripts/manage-tokens.js reset-all-to-15
  node scripts/manage-tokens.js list
        `);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    process.exit(0);
  }
}

main();
