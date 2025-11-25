# Listing Purchase System Implementation

## Overview
Complete Stripe-integrated purchase system for ThriftSpot listings. Users can purchase items directly from individual listing pages, with full order tracking and seller notifications.

---

## Components Implemented

### 1. Backend Routes ([functions/routes/purchases.js](functions/routes/purchases.js))

#### Endpoints:
- `POST /api/purchases/create-checkout` - Create Stripe checkout session
- `GET /api/purchases/order/:orderId` - Get order details
- `GET /api/purchases/my-purchases` - Get buyer's purchase history
- `GET /api/purchases/my-sales` - Get seller's sales history
- `POST /api/purchases/order/:orderId/status` - Update order status (seller only)

#### Features:
- User authentication required for all endpoints
- Validates listing availability before purchase
- Prevents users from buying their own listings
- Stripe minimum price validation ($0.50)
- Comprehensive order metadata tracking

---

### 2. Webhook Handler ([functions/routes/stripe-webhooks.js](functions/routes/stripe-webhooks.js))

#### New Handler: `handleListingPurchaseCompleted()`

When a purchase is completed, the webhook:
1. Creates an order record in `orders` collection
2. Updates pin status to `sold`
3. Records buyer and seller information
4. Updates user purchase/sales statistics
5. Tracks full payment history

#### Order Document Structure:
```javascript
{
  orderId: "auto-generated-id",
  stripeSessionId: "cs_...",
  stripePaymentIntentId: "pi_...",
  pinId: "listing-id",
  pinDocId: "firestore-doc-id",
  itemTitle: "Item name",
  buyerId: "buyer-user-id",
  sellerId: "seller-user-id",
  amount: 25.00,
  currency: "usd",
  paymentStatus: "paid",
  status: "paid",
  statusHistory: [...],
  createdAt: timestamp,
  paidAt: timestamp,
  buyerEmail: "buyer@email.com"
}
```

---

### 3. Frontend Integration

#### Updated Files:

**[public/listing.html](public/listing.html)**
- Updated `handlePurchase()` function
- Calls backend API instead of Firebase Functions
- Shows loading states during checkout
- Proper error handling and user feedback
- Redirects to Stripe Checkout page

**[public/purchase-success.html](public/purchase-success.html)** (NEW)
- Beautiful success confirmation page
- Displays order details
- Shows next steps for buyer
- Links to dashboard and browse more items

---

### 4. Registration ([functions/index.js](functions/index.js))

Added purchases routes:
```javascript
const { router: purchasesRoutes, injectDependencies: injectPurchasesDeps }
  = require('./routes/purchases');

injectPurchasesDeps({ db, admin, stripe, verifyAuth });

app.use('/api/purchases', purchasesRoutes);
```

---

## How It Works

### Purchase Flow:

1. **User clicks "Buy Now" on listing page**
   - Checks authentication
   - Validates user is not purchasing own item

2. **Frontend calls backend API**
   ```javascript
   POST /api/purchases/create-checkout
   {
     pinId: "listing-id"
   }
   ```

3. **Backend creates Stripe session**
   - Fetches listing data from Firestore
   - Validates listing is active
   - Calculates price
   - Creates Stripe checkout session with metadata

4. **User redirected to Stripe Checkout**
   - Secure payment processing
   - Card information handled by Stripe

5. **Payment completed**
   - Stripe sends webhook to backend
   - Backend processes webhook
   - Creates order record
   - Updates listing status to "sold"
   - Updates buyer/seller statistics

6. **User redirected to success page**
   - Shows order confirmation
   - Displays next steps

---

## Database Structure

### Orders Collection (`orders`)
```javascript
{
  orderId: string,
  stripeSessionId: string,
  stripePaymentIntentId: string,
  pinId: string,
  pinDocId: string,
  itemTitle: string,
  buyerId: string,
  sellerId: string,
  amount: number,
  currency: string,
  paymentStatus: string,
  status: string,  // paid, processing, shipped, delivered, completed
  statusHistory: array,
  createdAt: timestamp,
  paidAt: timestamp,
  buyerEmail: string
}
```

### Updated Pin Fields
```javascript
{
  status: "sold",  // changed from "active"
  soldTo: "buyer-user-id",
  soldAt: timestamp,
  orderId: "order-id"
}
```

### Updated User Fields
```javascript
// Buyer
{
  purchases: {
    totalPurchases: number,
    totalSpent: number,
    lastPurchaseDate: timestamp
  }
}

// Seller
{
  sales: {
    totalSales: number,
    totalRevenue: number,
    lastSaleDate: timestamp
  }
}
```

---

## Testing Checklist

### Before Going Live:

- [ ] Test Stripe webhook endpoint is accessible
- [ ] Configure Stripe webhook secret in environment
- [ ] Test with Stripe test mode cards
- [ ] Verify order creation in Firestore
- [ ] Verify pin status updates correctly
- [ ] Test user can't buy own listing
- [ ] Test authentication requirement
- [ ] Verify email receipts are sent
- [ ] Test success page displays correctly
- [ ] Test error handling for failed payments

### Stripe Test Cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

---

## Configuration Required

### Environment Variables:
```bash
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Stripe Dashboard Setup:
1. Create webhook endpoint: `https://your-domain.com/api/stripe/webhook`
2. Subscribe to event: `checkout.session.completed`
3. Copy webhook secret to environment variables

---

## API Endpoints Reference

### Create Checkout Session
```bash
POST /api/purchases/create-checkout
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "pinId": "listing-id"
}

Response:
{
  "success": true,
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Get Order
```bash
GET /api/purchases/order/:orderId
Authorization: Bearer <firebase-id-token>

Response:
{
  "success": true,
  "order": { ... }
}
```

### Get My Purchases
```bash
GET /api/purchases/my-purchases
Authorization: Bearer <firebase-id-token>

Response:
{
  "success": true,
  "orders": [ ... ]
}
```

### Get My Sales
```bash
GET /api/purchases/my-sales
Authorization: Bearer <firebase-id-token>

Response:
{
  "success": true,
  "orders": [ ... ]
}
```

### Update Order Status
```bash
POST /api/purchases/order/:orderId/status
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "status": "shipped",
  "notes": "Tracking number: 123456"
}
```

---

## Future Enhancements

### Potential Additions:
1. **Email Notifications**
   - Send email to seller when item is purchased
   - Send confirmation email to buyer
   - Shipping update notifications

2. **In-App Messaging**
   - Buyer/seller communication
   - Order-specific chat

3. **Shipping Integration**
   - Generate shipping labels
   - Tracking number integration
   - Delivery confirmation

4. **Ratings & Reviews**
   - Buyer can rate seller after delivery
   - Seller can rate buyer
   - Review system for items

5. **Dispute Resolution**
   - Report issues with orders
   - Refund requests
   - Admin intervention system

6. **Analytics Dashboard**
   - Sales statistics
   - Revenue tracking
   - Popular items

---

## Security Considerations

### Implemented:
- Firebase Authentication required
- Stripe webhook signature verification
- User can't purchase own listings
- Price validation (minimum $0.50)
- Order access restricted to buyer/seller only

### Additional Recommendations:
- Rate limiting on purchase endpoints
- Fraud detection integration
- IP-based restrictions for suspicious activity
- Maximum purchase amount limits

---

## Support & Maintenance

### Monitoring:
- Track webhook delivery success rate in Stripe dashboard
- Monitor order creation failures
- Check for abandoned checkouts
- Review payment disputes

### Logs to Watch:
```javascript
console.log(`✅ Checkout session created for pin ${pinId}`)
console.log(`✅ Created order ${orderId} for listing ${pinId}`)
console.log(`✅ Updated pin ${pinId} status to sold`)
console.log(`✅ Listing purchase completed: Order ${orderId}`)
```

---

## URLs

### Production:
- Listing page: `https://treasurehunter-sdk.web.app/listing.html?id={pinId}`
- Success page: `https://treasurehunter-sdk.web.app/purchase-success.html?session_id={CHECKOUT_SESSION_ID}`

### API Base URL:
- `https://us-central1-treasurehunter-sdk.cloudfunctions.net/app`

---

## Quick Start Guide

1. **Set up Stripe webhook** in Stripe dashboard
2. **Add environment variables** to Firebase Functions config
3. **Deploy backend changes**: `firebase deploy --only functions`
4. **Deploy frontend changes**: `firebase deploy --only hosting`
5. **Test with Stripe test cards**
6. **Switch to live mode** when ready

---

## Contact

For questions or issues with the purchase system, check:
- Stripe Dashboard for payment issues
- Firebase Console for order data
- Function logs for webhook processing errors
