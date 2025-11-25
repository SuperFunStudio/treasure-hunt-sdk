# Token System Documentation

## Overview
The ThriftSpot token system allows users to list items for sale/trade. Users earn tokens through various activities and can purchase additional tokens or subscribe to unlimited access.

## Token Economy

### Starting Balance
- New users: **5 free tokens** upon registration
- Guest users: **0 tokens** (must sign up to list)

### How to Earn Tokens

1. **Scan Items** - Earn 1 token per successful scan (encourages engagement)
2. **Add Items to Map** - Earn 2 tokens per pin dropped (encourages community sharing)
3. **Ship eBay Items** - Earn 3 tokens when item ships (reward for completing sales)
4. **Referrals** - Earn 5 tokens per referred user who lists an item
5. **Daily Login Bonus** - Earn 1 token for logging in on consecutive days

### How Tokens are Used

- **List Item for Sale** - Costs 1 token per listing
- **Featured Listing** - Costs 3 tokens (listing appears at top of search)
- **Bulk Listing (5+ items)** - Costs 4 tokens (discount for bulk)

### Token Packages (Purchase)

- **Starter Pack**: 10 tokens for $4.99
- **Value Pack**: 25 tokens for $9.99 (save 20%)
- **Power Pack**: 50 tokens for $14.99 (save 40%)
- **Pro Pack**: 100 tokens for $24.99 (save 50%)

### Subscription Tiers

#### Go Pro - $9.99/month
- Unlimited listing tokens
- Priority customer support
- Advanced analytics dashboard
- Featured listings (2 per month)
- Early access to new features

#### Go Premium - $19.99/month
- Everything in Pro
- Unlimited featured listings
- Bulk upload tools
- API access for automation
- Custom branding options

## Firestore Schema

### User Document
```javascript
{
  uid: "user123",
  email: "user@example.com",
  profile: {
    displayName: "John Doe",
    // ... other profile fields
  },
  tokens: {
    balance: 15,
    totalEarned: 20,
    totalSpent: 5,
    lastEarned: Timestamp,
    lastSpent: Timestamp,
    history: [
      {
        type: "earn" | "spend" | "purchase",
        amount: 3,
        reason: "shipped_item" | "listed_item" | "scanned_item" | "pin_drop" | "purchase_pack",
        timestamp: Timestamp,
        relatedId: "scan_id_or_listing_id" // optional
      }
    ]
  },
  subscription: {
    tier: "free" | "pro" | "premium",
    status: "active" | "cancelled" | "expired",
    startDate: Timestamp,
    endDate: Timestamp,
    stripeSubscriptionId: "sub_xxx"
  },
  stats: {
    totalScans: 25,
    totalListings: 10,
    totalShipped: 5,
    pinsCreated: 3
  }
}
```

### Token Transaction Collection
```javascript
collection: users/{userId}/tokenTransactions/{transactionId}
{
  type: "earn" | "spend" | "purchase",
  amount: 3,
  balance: 18, // Balance after transaction
  reason: "shipped_item",
  description: "Earned for shipping eBay item #12345",
  timestamp: Timestamp,
  relatedDocId: "listing_xyz", // optional
  metadata: {
    // Additional context
  }
}
```

## Implementation Notes

### Backend Functions
Create Cloud Functions for:
- `awardTokens(userId, amount, reason)` - Award tokens to user
- `spendTokens(userId, amount, reason)` - Deduct tokens from user
- `purchaseTokens(userId, packageId)` - Handle token purchase via Stripe
- `checkSubscription(userId)` - Verify subscription status
- `getTokenBalance(userId)` - Get current token balance

### Frontend Integration
- Dashboard displays token balance prominently
- Show token cost before actions
- Token purchase modal
- Transaction history view
- Subscription management page

### Security Rules
```javascript
// Firestore security rules
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow update: if request.auth.uid == userId
    && !request.resource.data.tokens.balance // Prevent direct token manipulation
    && !request.resource.data.subscription; // Prevent subscription manipulation
}

match /users/{userId}/tokenTransactions/{transactionId} {
  allow read: if request.auth.uid == userId;
  allow create, update, delete: if false; // Only backend can modify
}
```

## User Flow Examples

### Example 1: New User Journey
1. User signs up → Gets 5 free tokens
2. User scans 3 items → Earns 3 tokens (total: 8)
3. User lists 2 items → Spends 2 tokens (total: 6)
4. User drops 1 pin on map → Earns 2 tokens (total: 8)
5. User ships 1 item via eBay → Earns 3 tokens (total: 11)

### Example 2: Power User Journey
1. User has 2 tokens remaining
2. User wants to list 10 items
3. User purchases Value Pack (25 tokens) for $9.99
4. User has 27 tokens
5. User lists 10 items → Spends 10 tokens (total: 17)

### Example 3: Subscription User
1. User subscribes to Go Pro ($9.99/month)
2. User has unlimited listing tokens
3. User can still earn tokens for other features (featured listings)
4. Token balance increases but listing doesn't consume tokens
