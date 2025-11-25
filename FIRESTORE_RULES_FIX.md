# Firestore Rules Fix for Listing Page

## Problem
The listing page was showing "Missing or insufficient permissions" error because:
1. Security rules required `resource.data.engagement.isActive` field that doesn't exist
2. Rules were too restrictive for public listing viewing

## Solution
Updated [firestore.rules](firestore.rules) to allow:
- **Authenticated users** to read active/public pins
- **Unauthenticated users** to read public active pins (for sharing listing links)
- Only **pin owners** can create/update/delete their pins
- **Buyers and sellers** can access their orders

## Updated Rules

```javascript
// Pins - public read for discovery, write only by owner
match /pins/{pinId} {
  // Allow public read of active pins (for listing pages and map)
  allow read: if request.auth != null
    && (resource.data.status == 'active' || resource.data.isPublic == true);

  // Allow unauthenticated read for public active pins (for public listing pages)
  allow read: if resource.data.isPublic == true && resource.data.status == 'active';

  // Write permissions - only owner
  allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
  allow update: if request.auth != null && request.auth.uid == resource.data.userId;
  allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
}

// Orders - buyers and sellers can read their own orders
match /orders/{orderId} {
  allow read: if request.auth != null
    && (request.auth.uid == resource.data.buyerId
        || request.auth.uid == resource.data.sellerId);
  allow create: if false; // Orders only created via backend
  allow update: if request.auth != null && request.auth.uid == resource.data.sellerId;
}
```

## Deploy Instructions

### Option 1: Deploy via Firebase CLI (Recommended)
```bash
# Make sure you're in the project directory
cd c:\Users\kenny\treasure-hunt-sdk

# Deploy only Firestore rules
firebase deploy --only firestore:rules
```

### Option 2: Deploy via Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `treasurehunter-sdk`
3. Navigate to **Firestore Database** → **Rules**
4. Copy the contents from [firestore.rules](firestore.rules)
5. Paste into the console editor
6. Click **Publish**

## Verify Deployment

After deploying, test by:
1. Opening a listing URL (logged out): `https://treasurehunter-sdk.web.app/listing.html?id={pinId}`
2. Opening browser console (F12)
3. Checking that no permission errors appear
4. Verifying listing data loads correctly

## What This Fixes

### Before (Broken):
```
User → Opens listing.html?id=xyz123
     → Firestore query for pin
     → ❌ ERROR: Missing or insufficient permissions
     → Shows "Listing Not Found" error
```

### After (Fixed):
```
User → Opens listing.html?id=xyz123
     → Firestore query for pin
     → ✅ SUCCESS: Pin data retrieved
     → Shows listing with Buy Now button
```

## Key Changes

1. **Removed invalid field check**: `resource.data.engagement.isActive` → doesn't exist on pins
2. **Added unauthenticated access**: Allows public users to view listing pages
3. **Aligned with PinModel**: Uses actual fields (`status`, `isPublic`, `userId`)
4. **Added Orders rules**: Buyers/sellers can access their order data
5. **Security maintained**: Only owners can modify pins

## Testing Checklist

- [ ] Deploy rules using one of the methods above
- [ ] Open map (authenticated) - should load pins
- [ ] Click on a pin - should show popup
- [ ] Click "View Details" - should load listing page
- [ ] Open listing URL directly (not logged in) - should still work
- [ ] Try to buy an item (not logged in) - should redirect to sign in
- [ ] Try to buy an item (logged in) - should create checkout session

## Related Files

- [firestore.rules](firestore.rules) - Updated security rules
- [functions/models/PinModel.js](functions/models/PinModel.js) - Pin data structure
- [public/listing.html](public/listing.html) - Listing page that queries pins
- [public/index.html](public/index.html) - Map that displays pins

## Security Notes

### What's Protected:
- Users can only modify their own pins
- Orders are read-only (created by backend webhooks)
- Personal user data requires authentication
- Only sellers can update order status

### What's Public:
- Active, public pins (for discovery and sharing)
- Pin locations and item details
- Pricing information

This is intentional for a marketplace app where listings need to be publicly viewable.
