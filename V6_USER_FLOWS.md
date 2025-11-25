# ThriftSpot V6 - User Flow Diagrams

## Main User Flows

### Flow 1: Scan to Sale (Local Map)
```
┌─────────────────────────────────────────────────────────────────┐
│                         SPOT MODE                                │
└─────────────────────────────────────────────────────────────────┘

    [index.html]
    📷 Telescope Scan Interface
    ├─ Upload photos (desktop) or Camera (mobile)
    ├─ Add multiple photos to gallery
    └─ Click "Scan Items"
         │
         ▼
    [Analysis Stage] (7 stages with progress)
    1. Uploading images
    2. AI Vision Analysis (Claude)
    3. Category Detection
    4. Condition Assessment
    5. Checking Market Prices (eBay)
    6. Price Validation
    7. Finalizing Results
         │
         ▼
    [Results Screen]
    ├─ Show AI-generated item name
    ├─ Display estimated price
    ├─ Show condition assessment
    ├─ List eBay comparable items
    └─ Click "Preview Listing"
         │
         ▼
    [listing-preview-v6.html]
    Preview & Edit Listing
    ├─ Review AI-generated fields
    ├─ Choose: ⚪ For Sale / ⚪ For Rent
    ├─ Select platforms: ✓ Local Map / ☐ eBay
    ├─ Capture geolocation automatically
    ├─ Edit title, description, price
    └─ Click "Create Listing"
         │
         ▼
    [Firebase Operations]
    1. Upload images → Firebase Storage
    2. Create document → Firestore /pins
    3. Include: lat/lng/geohash
         │
         ▼
    [pin-map.html]
    📍 Redirect to map with new pin highlighted
```

### Flow 2: Browse & Reserve Items (Thrift Mode)
```
┌─────────────────────────────────────────────────────────────────┐
│                        THRIFT MODE                               │
└─────────────────────────────────────────────────────────────────┘

    [pin-map.html]
    🗺️ Interactive Map
    ├─ View color-coded pins:
    │  ├─ 🟢 Green = Available
    │  ├─ 🟡 Yellow = Reserved
    │  └─ 🔴 Red = Claimed
    └─ Click any pin
         │
         ▼
    [Pin Detail Panel] (slides up from bottom)
    ├─ View images (gallery)
    ├─ See title, price, description
    ├─ Check condition & category
    └─ View location notes
         │
         ├─────────────────┬─────────────────┬─────────────────┐
         ▼                 ▼                 ▼                 ▼
    [Available]      [Your Pin]       [Reserved]      [Someone's Res]
    Actions:         Actions:         (by you):       Actions:
    - Reserve        - Edit           - Claim         - (View only)
    - Message        - Delete         - Cancel
         │                                │
         │                                ▼
         ▼                           [CLAIMED!]
    [RESERVED 24h]                  ✅ Item marked
    ⏰ Timer starts                    as claimed
    Email notification                 Removed from
                                       active listings
```

### Flow 3: Create Rental Listing
```
    [index.html]
    Scan item (same as Flow 1)
         │
         ▼
    [listing-preview-v6.html]
    ├─ Select: ⚪ For Sale / ⚫ For Rent  ← Choose Rent
    │
    └─ Rental fields appear:
       ├─ Rental Period: [Daily ▼]
       │  (Hourly/Daily/Weekly/Monthly)
       └─ Security Deposit: [$50]
         │
         ▼
    [Create Listing]
    → Pin shows "📅 For Rent" badge on map
```

## Navigation Structure

### Top Navigation Bar (All Pages)
```
┌──────────────────────────────────────────────────────────────┐
│  🔍 ThriftSpot          [User Avatar ▼]                      │
│                         ├─ Profile                            │
│                         ├─ Dashboard                          │
│                         └─ Sign Out                           │
└──────────────────────────────────────────────────────────────┘
```

### Bottom Mode Toggle (Main Pages)
```
┌──────────────────────────────────────────────────────────────┐
│                     [📷 Spot] [🗺️ Thrift]                    │
│                       ↑          ↑                            │
│                    index.html  pin-map.html                   │
└──────────────────────────────────────────────────────────────┘
```

## Page Transitions

### From Any Page to Any Page
```
Header Navigation:
├─ Logo → index.html
├─ Dashboard → dashboard.html
└─ Profile → profile.html

Mode Toggle (if visible):
├─ 📷 Spot → index.html
└─ 🗺️ Thrift → pin-map.html

Auth States:
├─ Not signed in → signin.html
└─ Sign out → back to current page
```

## Data Flow (Firebase)

### Create Listing Flow
```
[Browser] → [listing-preview-v6.html]
    │
    ├─ Get geolocation (navigator.geolocation)
    ├─ Convert photos to Blob
    └─ Upload images
         │
         ▼
    [Firebase Storage]
    /listings/{userId}/{timestamp}_{index}.jpg
         │
         ▼ (get download URLs)
         │
    [Firebase Firestore]
    /pins/{pinId}
    {
      title, description, price,
      listingType: 'sale' | 'rent',
      images: [url1, url2, ...],
      lat, lng, geohash,
      status: 'active',
      claimedBy: null,
      reservedBy: null,
      ...
    }
         │
         ▼
    [Redirect]
    pin-map.html?pin={pinId}
```

### Reserve/Claim Flow
```
[pin-map.html] → Click "Reserve"
    │
    ▼
[Firebase Firestore Update]
/pins/{pinId}
{
  reservedBy: userId,
  reservedByEmail: email,
  reservedAt: timestamp,
  reservedUntil: timestamp + 24h
}
    │
    ▼
[Email Notification] (optional)
"You reserved {itemName} for 24 hours"
    │
    ▼
[Map Updates]
Pin color changes: 🟢 → 🟡
    │
    ▼ (Later, user returns)
    │
Click "Claim"
    │
    ▼
[Firebase Firestore Update]
/pins/{pinId}
{
  claimedBy: userId,
  claimedAt: timestamp,
  status: 'claimed'
}
    │
    ▼
[Map Updates]
Pin color changes: 🟡 → 🔴
Pin removed from active listings
```

## State Management

### Pin Status States
```
┌──────────────┐
│   CREATED    │
│  (status:    │
│   active)    │
└──────┬───────┘
       │
       ├─────────────────┬──────────────────┐
       ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  AVAILABLE   │  │   RESERVED   │  │   DELETED    │
│              │  │  (by user)   │  │ (by owner)   │
│ reservedBy:  │  │              │  │              │
│    null      │  │ Timer: 24h   │  │ status:      │
└──────────────┘  └──────┬───────┘  │  'deleted'   │
                         │          └──────────────┘
                         ▼
                  ┌──────────────┐
                  │   CLAIMED    │
                  │              │
                  │  claimedBy:  │
                  │   userId     │
                  │              │
                  │  status:     │
                  │  'claimed'   │
                  └──────────────┘
```

### Listing Type Variants
```
Listing Creation:
    │
    ├─── For Sale
    │    ├─ price: $X
    │    └─ Platform: eBay / Local
    │
    └─── For Rent
         ├─ price: $X per [period]
         ├─ rentalPeriod: hourly|daily|weekly|monthly
         ├─ securityDeposit: $Y
         └─ Platform: Local only (for now)
```

## Mobile vs Desktop Experience

### Desktop (>768px)
```
[index.html]
├─ Shows upload button in center
├─ Larger telescope rings
└─ Side-by-side layouts

[listing-preview-v6.html]
├─ 2-column form layouts
└─ Wider max-width (800px)

[pin-map.html]
├─ Full-width map
└─ Floating control panels
```

### Mobile (<768px)
```
[index.html]
├─ Shows camera viewfinder (if permitted)
├─ Capture button below rings
└─ Stacked layouts

[listing-preview-v6.html]
├─ Single-column forms
└─ Full-width inputs

[pin-map.html]
├─ Full-screen map
├─ Bottom sheet panels
└─ Touch-optimized pins
```

## Error Handling

### Common Error Flows
```
Camera Permission Denied
├─ Fall back to file upload
└─ Show upload button

Geolocation Denied
├─ Continue without coordinates
└─ Can be added manually later

Upload Failed
├─ Show error message
├─ Keep form data
└─ Retry button

Analysis API Error
├─ Show error message
└─ "Scan Another" button to retry

Auth Required
└─ Redirect to signin.html
```

## Future Enhancements

### Planned Flows

#### eBay Integration Flow
```
[listing-preview-v6.html]
└─ Select: ✓ eBay
    │
    ▼
[OAuth Flow] (if not connected)
├─ Redirect to eBay
├─ Get authorization
└─ Return with token
    │
    ▼
[Create eBay Listing]
├─ Call eBay API
├─ Upload images to eBay
└─ Create listing
    │
    ▼
[Store eBay URL]
/pins/{pinId}
{
  ebayListingId: '...',
  ebayUrl: 'https://...'
}
```

#### Messaging Flow
```
[pin-map.html]
└─ Click "Message Seller"
    │
    ▼
[Chat Interface]
├─ Real-time messaging
├─ Firebase Realtime DB
└─ Push notifications
```

#### Search & Filter Flow
```
[pin-map.html]
└─ Open filter panel
    │
    ├─ Category checkboxes
    ├─ Price range slider
    ├─ Distance radius
    └─ Apply filters
         │
         ▼
    [Filter Query]
    ├─ Geohash query (nearby)
    ├─ Where category in [...]
    └─ Where price between X-Y
         │
         ▼
    [Update Map]
    Show only matching pins
```

---

## Summary

The V6 integration provides two main user flows:

1. **Spot Mode** (📷): Scan items → Get AI analysis → Create listings
2. **Thrift Mode** (🗺️): Browse map → Reserve items → Claim items

Both flows are fully functional with:
- Complete Firebase integration
- Geolocation support
- Image management
- Sale and rental options
- Reserve/claim system
- Responsive design
- Error handling

The application is ready for end-to-end testing and deployment.
