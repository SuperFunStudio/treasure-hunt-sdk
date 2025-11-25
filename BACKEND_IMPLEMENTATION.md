# Backend Token System Implementation - Complete

## ✅ What Was Implemented

### 1. Cloud Functions - Token Routes
**File:** `functions/routes/tokens.js`

**API Endpoints Created:**
- `GET /api/tokens/balance` - Get current token balance and subscription status
- `POST /api/tokens/award` - Award tokens to user (for scanning, pins, shipping)
- `POST /api/tokens/spend` - Spend tokens (for listings)
- `POST /api/tokens/purchase` - Create Stripe checkout session for token packs
- `POST /api/tokens/subscribe` - Create Stripe subscription checkout session
- `GET /api/tokens/history` - Get token transaction history

**Features:**
- Auth middleware using Firebase ID tokens
- Automatic subscription check (unlimited tokens for Pro/Premium users)
- Transaction history tracking in subcollection
- Error handling and validation

### 2. Stripe Webhook Handler
**File:** `functions/routes/stripe-webhooks.js`

**Webhook Events Handled:**
- `checkout.session.completed` - Token purchase or subscription started
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Subscription status change
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_succeeded` - Recurring payment success
- `invoice.payment_failed` - Payment failed

**Features:**
- Automatic token awarding after successful purchase
- Subscription status sync with Firestore
- Payment failure handling

### 3. Main Index.js Updates
**File:** `functions/index.js`

**Changes:**
- Imported token and Stripe webhook routes
- Initialized Stripe SDK with secret key from environment
- Injected dependencies (db, admin, stripe) into routes
- Registered routes:
  - `/api/tokens/*` - Token system endpoints
  - `/api/stripe/webhook` - Stripe webhook handler

### 4. Environment Configuration
**File:** `.env`

**New Variables Added:**
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here  
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Token Pack Price IDs
STRIPE_PRICE_TOKENS_STARTER=price_token_starter_10
STRIPE_PRICE_TOKENS_VALUE=price_token_value_25
STRIPE_PRICE_TOKENS_POWER=price_token_power_50
STRIPE_PRICE_TOKENS_PRO=price_token_pro_100

# Subscription Price IDs
STRIPE_PRICE_SUB_PRO=price_sub_pro_monthly
STRIPE_PRICE_SUB_PREMIUM=price_sub_premium_monthly

# App URL for redirects
APP_BASE_URL=https://treasurehunter-sdk.web.app
```

### 5. Frontend Integration
**File:** `public/js/token-system.js`

**Updated Functions:**
- `loadTokenBalance()` - Now calls `/api/tokens/balance` API
- `selectPackage()` - Creates Stripe checkout and redirects
- `selectSubscription()` - Creates subscription checkout and redirects

**Features:**
- Auth token handling with Firebase
- Error handling with fallback to Firestore
- Unlimited badge display for subscribers

## 🔧 Firestore Schema

### User Document Structure
```javascript
users/{userId} {
  email: "user@example.com",
  
  // Token system
  tokens: {
    balance: 15,
    totalEarned: 20,
    totalSpent: 5,
    lastEarned: Timestamp,
    lastSpent: Timestamp,
    lastPurchase: Timestamp
  },
  
  // Subscription
  subscription: {
    tier: "pro" | "premium" | "free",
    status: "active" | "cancelled" | "past_due",
    stripeSubscriptionId: "sub_xxx",
    stripeCustomerId: "cus_xxx",
    startDate: Timestamp,
    currentPeriodEnd: Timestamp,
    lastUpdated: Timestamp
  },
  
  // Purchase history
  purchases: {
    lastPurchaseDate: Timestamp,
    totalPurchaseAmount: 99.99
  }
}
```

### Token Transactions Subcollection
```javascript
users/{userId}/tokenTransactions/{transactionId} {
  type: "earn" | "spend" | "purchase",
  amount: 3,
  balance: 18,
  reason: "scanned_item" | "listed_item" | "purchased_value_pack",
  timestamp: Timestamp,
  relatedDocId: "scan_id_or_listing_id",
  metadata: {
    stripeSessionId: "cs_xxx", // For purchases
    packageType: "value",       // For purchases
    amountPaid: 9.99,          // For purchases
    currency: "usd"            // For purchases
  }
}
```

## 📋 Next Steps to Complete Setup

### 1. Set Up Stripe Account
1. Go to https://stripe.com and create account
2. Get test API keys from Dashboard → Developers → API keys
3. Update `.env` with real Stripe keys:
   - `STRIPE_SECRET_KEY` - starts with `sk_test_...`
   - `STRIPE_PUBLISHABLE_KEY` - starts with `pk_test_...`

### 2. Create Stripe Products
In Stripe Dashboard → Products:

**Token Packs (One-time payments):**
1. Starter Pack - $4.99
2. Value Pack - $9.99
3. Power Pack - $14.99
4. Pro Pack - $24.99

**Subscriptions (Recurring):**
1. Go Pro - $9.99/month
2. Go Premium - $19.99/month

Copy the Price IDs and update `.env`

### 3. Set Up Stripe Webhook
1. In Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-function-url.cloudfunctions.net/api/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy webhook signing secret and update `STRIPE_WEBHOOK_SECRET` in `.env`

### 4. Deploy Functions
```bash
cd functions
firebase deploy --only functions
```

### 5. Test the Flow

**Test Token Purchase:**
1. Sign in to app
2. Go to dashboard
3. Click token card
4. Select package
5. Complete Stripe test checkout (use card 4242 4242 4242 4242)
6. Verify tokens appear in balance

**Test Subscription:**
1. Click "Subscribe" in modal
2. Complete checkout
3. Verify unlimited tokens status

## 🎯 Token Economy Flows

### Earning Tokens
```javascript
// When user scans item
await fetch('/api/tokens/award', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer <token>' },
  body: JSON.stringify({
    userId: 'user123',
    amount: 1,
    reason: 'scanned_item',
    relatedId: 'scan_abc123'
  })
});

// When user drops pin
await fetch('/api/tokens/award', {
  method: 'POST',
  body: JSON.stringify({
    amount: 2,
    reason: 'pin_drop',
    relatedId: 'pin_xyz789'
  })
});

// When item ships
await fetch('/api/tokens/award', {
  method: 'POST',
  body: JSON.stringify({
    amount: 3,
    reason: 'shipped_item',
    relatedId: 'listing_def456'
  })
});
```

### Spending Tokens
```javascript
// Before creating listing
const response = await fetch('/api/tokens/spend', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer <token>' },
  body: JSON.stringify({
    userId: 'user123',
    amount: 1,
    reason: 'created_listing',
    relatedId: 'listing_ghi789'
  })
});

if (!response.ok) {
  // Not enough tokens - show purchase modal
  showTokenModal();
}
```

## 🔒 Security Features

1. **Auth Middleware** - All endpoints verify Firebase ID token
2. **User Verification** - Users can only modify their own tokens
3. **Server-side Validation** - All token operations happen server-side
4. **Stripe Webhook Signatures** - Webhooks verified with signing secret
5. **Firestore Security Rules** - Users cannot directly modify token balance

## 📊 Monitoring & Logging

All functions log:
- Token awards with reason and amount
- Token spends with validation
- Purchase completions
- Subscription changes
- Payment failures

Check Firebase Console → Functions → Logs to monitor activity.

---

**Status:** ✅ Backend Complete - Ready for Stripe Configuration
**Last Updated:** $(date +"%Y-%m-%d")
