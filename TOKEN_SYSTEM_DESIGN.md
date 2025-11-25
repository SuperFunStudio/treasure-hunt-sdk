# ThriftSpot Token Economy System

## Overview
ThriftSpot uses a token-based economy to monetize the marketplace while keeping it accessible. Users receive a monthly token allocation and can earn more by contributing (pinning items) or purchase additional tokens.

## Token Model

### Core Concept
- **Tokens** are the primary currency in ThriftSpot
- Users consume tokens to scan items and reserve/claim finds
- Users earn tokens by pinning items to the map
- Free monthly allocation keeps the platform accessible
- Premium users can purchase additional tokens

---

## Token Costs & Rewards

### Costs (Token Consumption)
| Action | Cost | Description |
|--------|------|-------------|
| **Scan Item** | 5 tokens | AI analysis of uploaded photos |
| **Reserve Item** | 3 tokens | 24-hour reservation on a find |
| **Claim Item** | 10 tokens | Purchase/claim a reserved item |
| **Create Listing** | FREE | Encourage content creation |

### Rewards (Token Earnings)
| Action | Reward | Description |
|--------|--------|-------------|
| **Pin Item** | 8 tokens | Successfully create a map pin |
| **Monthly Allocation** | 100 tokens | Free tokens each month |
| **Pin Gets Claimed** | 5 tokens | Bonus when your pin is claimed |
| **Referral** | 50 tokens | Invite a friend who joins |

### Token Packages (Purchase)
| Package | Tokens | Price | Value |
|---------|--------|-------|-------|
| **Starter** | 50 tokens | $4.99 | $0.10/token |
| **Standard** | 150 tokens | $12.99 | $0.09/token |
| **Premium** | 500 tokens | $39.99 | $0.08/token |
| **Pro** | 1,500 tokens | $99.99 | $0.07/token |

---

## Data Model

### User Document Schema
```javascript
{
  uid: string,
  email: string,
  displayName: string,
  photoURL: string,

  // Token System
  tokens: {
    balance: number,              // Current token balance
    totalEarned: number,          // Lifetime earned tokens
    totalSpent: number,           // Lifetime spent tokens
    totalPurchased: number,       // Lifetime purchased tokens
    monthlyAllocation: number,    // Tokens given per month (default: 100)
    lastMonthlyReset: Timestamp,  // When monthly tokens were last given
    tier: string                  // 'free', 'starter', 'premium', 'pro'
  },

  // Stats
  stats: {
    pinsCreated: number,
    pinsClaimed: number,
    itemsScanned: number,
    itemsReserved: number
  },

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Token Transaction Schema
```javascript
// Collection: tokenTransactions
{
  userId: string,
  type: 'earn' | 'spend' | 'purchase' | 'refund',
  action: string,              // 'scan', 'reserve', 'claim', 'pin_created', 'monthly_allocation', etc.
  amount: number,              // Positive for earn, negative for spend
  balanceBefore: number,
  balanceAfter: number,
  metadata: {
    pinId: string,             // Related pin (if applicable)
    stripeSessionId: string,   // Stripe checkout session (if purchase)
    packageType: string,       // Token package purchased
    description: string
  },
  createdAt: Timestamp
}
```

---

## Token Flow Examples

### Example 1: New User Journey
1. **User signs up** → Receives 100 monthly tokens
2. **User scans item** → Spends 5 tokens (95 remaining)
3. **User creates listing** → Earns 8 tokens (103 total)
4. **User reserves item** → Spends 3 tokens (100 remaining)
5. **User claims item** → Spends 10 tokens (90 remaining)

**Net Result**: 90 tokens after full cycle

### Example 2: Active Contributor
1. **Monthly reset** → 100 tokens allocated
2. **Pins 5 items** → Earns 40 tokens (140 total)
3. **1 pin claimed** → Earns 5 bonus tokens (145 total)
4. **Scans 3 items** → Spends 15 tokens (130 remaining)

**Net Result**: 130 tokens (more than started)

### Example 3: Power User
1. **Starts with** → 50 tokens
2. **Purchases Premium** → +500 tokens (550 total)
3. **Scans 20 items** → Spends 100 tokens (450 remaining)
4. **Claims 10 items** → Spends 100 tokens (350 remaining)
5. **Pins 10 items** → Earns 80 tokens (430 total)

**Net Result**: 430 tokens available for future use

---

## Implementation Plan

### Phase 1: Core Token System
- [x] Design token data model
- [ ] Create Firestore schema for users and transactions
- [ ] Implement backend token service (deduct, award, check balance)
- [ ] Add token balance to user documents
- [ ] Create transaction logging system

### Phase 2: UI Integration
- [ ] Add token balance display in header
- [ ] Show token costs before actions
- [ ] Display "Not enough tokens" warnings
- [ ] Add token transaction history page
- [ ] Create token purchase flow UI

### Phase 3: Action Integration
- [ ] Integrate with scan flow (deduct 5 tokens)
- [ ] Integrate with reserve flow (deduct 3 tokens)
- [ ] Integrate with claim flow (deduct 10 tokens)
- [ ] Integrate with pin creation (award 8 tokens)
- [ ] Implement monthly allocation system

### Phase 4: Monetization
- [ ] Set up Stripe integration
- [ ] Create token purchase API endpoint
- [ ] Implement webhook for successful payments
- [ ] Add purchase history tracking
- [ ] Create admin panel for token management

### Phase 5: Advanced Features
- [ ] Implement referral system (50 token bonus)
- [ ] Add pin claim bonus (5 tokens when your pin is claimed)
- [ ] Create token subscription tiers
- [ ] Implement token expiration (optional)
- [ ] Add promotional token campaigns

---

## Backend API Endpoints

### Token Management
```javascript
// Check token balance
GET /api/tokens/balance
Response: { balance: number, monthlyAllocation: number, tier: string }

// Get transaction history
GET /api/tokens/transactions?limit=50&offset=0
Response: { transactions: [...], total: number }

// Deduct tokens (internal)
POST /api/tokens/deduct
Body: { action: 'scan' | 'reserve' | 'claim', amount: number, metadata: {} }
Response: { success: boolean, newBalance: number, transactionId: string }

// Award tokens (internal)
POST /api/tokens/award
Body: { action: 'pin_created' | 'pin_claimed' | 'referral', amount: number, metadata: {} }
Response: { success: boolean, newBalance: number, transactionId: string }

// Purchase tokens
POST /api/tokens/purchase
Body: { packageType: 'starter' | 'standard' | 'premium' | 'pro' }
Response: { checkoutUrl: string, sessionId: string }

// Stripe webhook
POST /api/tokens/webhook/stripe
Body: Stripe event payload
Response: { received: true }
```

---

## Frontend Integration

### Token Display Component
```html
<div class="token-display">
  <span class="token-icon">🪙</span>
  <span class="token-balance" id="tokenBalance">100</span>
  <button class="token-buy-btn" onclick="showTokenPurchase()">+</button>
</div>
```

### Pre-Action Token Check
```javascript
async function scanItem() {
  const tokenCost = 5;
  const balance = await getTokenBalance();

  if (balance < tokenCost) {
    showInsufficientTokensModal(tokenCost, balance);
    return;
  }

  // Proceed with scan
  const result = await deductTokens('scan', tokenCost);
  if (result.success) {
    performAnalysis();
  }
}
```

### Insufficient Tokens Modal
```html
<div class="modal insufficient-tokens-modal">
  <h2>⚠️ Insufficient Tokens</h2>
  <p>You need <strong>5 tokens</strong> to scan items.</p>
  <p>Your balance: <strong id="currentBalance">2</strong> tokens</p>

  <div class="token-options">
    <button onclick="earnMoreTokens()">📍 Earn by Pinning</button>
    <button onclick="purchaseTokens()">💳 Purchase Tokens</button>
  </div>
</div>
```

---

## Security Considerations

### Token Transaction Rules
1. **All token operations must be server-side** (prevent client manipulation)
2. **Use Firestore transactions** for balance updates (prevent race conditions)
3. **Log every token change** (audit trail)
4. **Validate user ownership** before awarding tokens
5. **Prevent double-spending** with transaction IDs

### Firestore Security Rules
```javascript
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow update: if request.auth.uid == userId
                && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['tokens']);
  // Tokens can only be modified by Cloud Functions
}

match /tokenTransactions/{transactionId} {
  allow read: if request.auth.uid == resource.data.userId;
  allow create: if false; // Only Cloud Functions can create
}
```

---

## Monitoring & Analytics

### Key Metrics to Track
- Average tokens per user
- Token purchase conversion rate
- Most common token-earning actions
- Most common token-spending actions
- Monthly active users by token tier
- Token balance distribution
- Churn rate by token balance

### Admin Dashboard Queries
```javascript
// Users with low balances (potential churn)
db.collection('users')
  .where('tokens.balance', '<', 10)
  .get();

// High-value users (frequent purchasers)
db.collection('users')
  .where('tokens.totalPurchased', '>', 1000)
  .get();

// Token transaction volume by day
db.collection('tokenTransactions')
  .where('createdAt', '>=', startOfDay)
  .where('createdAt', '<', endOfDay)
  .get();
```

---

## Future Enhancements

### Token Subscriptions
- $9.99/month: 200 tokens + 20% bonus on purchases
- $19.99/month: 500 tokens + 30% bonus on purchases
- $49.99/month: 1500 tokens + 50% bonus on purchases

### Token Gifting
- Send tokens to other users
- Gift cards for token packages
- Promotional codes

### Token Achievements
- "First Pin" - 10 bonus tokens
- "10 Pins Created" - 50 bonus tokens
- "Community Contributor" - 100 bonus tokens
- "Power Seller" - 200 bonus tokens

### Dynamic Pricing
- Adjust token costs based on demand
- Surge pricing for popular areas
- Discount tokens during off-peak hours

---

## Migration Plan

### Existing Users
1. All existing users receive 100 tokens immediately
2. Retroactively award tokens for existing pins (8 tokens per pin)
3. Announce token system via email/notification
4. Provide 30-day grace period with free actions

### Gradual Rollout
1. **Week 1**: Token balance display only (no costs)
2. **Week 2**: Token costs shown but not enforced
3. **Week 3**: Token costs enforced for new users only
4. **Week 4**: Token costs enforced for all users
5. **Week 5**: Token purchase enabled
6. **Week 6**: Full token economy live

---

## Success Criteria

### Adoption Metrics
- 80%+ of users have positive token balance
- 20%+ of users purchase tokens within 30 days
- Average user completes 2+ scans per month
- 50%+ of users pin at least 1 item per month

### Revenue Metrics
- $5,000 MRR from token purchases by month 3
- $20,000 MRR by month 6
- $50,000 MRR by month 12

### Engagement Metrics
- Average session duration increases 20%
- Return user rate increases 30%
- Pin creation rate doubles

---

## Token System Rules Summary

| Rule | Description |
|------|-------------|
| **Monthly Reset** | 100 free tokens on the 1st of each month |
| **Balance Cap** | Free users: 500 max; Paid users: unlimited |
| **Expiration** | Free tokens expire after 90 days; Purchased tokens never expire |
| **Refunds** | Unused purchased tokens refundable within 30 days |
| **Minimum Balance** | Users must maintain positive balance to perform paid actions |
| **Fraud Prevention** | Suspicious activity flags account for manual review |

---

**Token System Version**: 1.0
**Last Updated**: 2025-11-22
**Status**: Ready for Implementation
