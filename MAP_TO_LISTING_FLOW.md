# Map Pin to Listing Page Connection

## How It Works

### User Journey:
1. User opens the map at [index.html](public/index.html)
2. User sees pins on the map showing available items
3. User clicks on a pin marker
4. A popup appears showing item details + "View Details →" button
5. User clicks "View Details →"
6. Browser navigates to `/listing.html?id={pinId}`
7. Listing page loads with full item details and "Buy Now" button
8. User can purchase the item via Stripe

---

## Technical Implementation

### 1. Map Pins ([public/index.html](public/index.html))

#### Single Item Pin Popup:
```javascript
const popupContent = `
    <div style="min-width: 180px; padding: 8px;">
        <strong>${pin.item?.title || 'Item'}</strong><br>
        <span style="color: #666;">${pin.item?.category || ''}</span><br>
        <span style="color: #2e7d32; font-weight: bold;">$${pin.price || pin.item.estimatedValue}</span>

        <!-- THIS IS THE KEY LINK -->
        <a href="/listing.html?id=${pin.id}"
           style="display: inline-block; margin-top: 8px; padding: 8px 16px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white; text-decoration: none; border-radius: 8px;">
            View Details →
        </a>
    </div>
`;
```

#### Yard Sale (Multi-Item) Popup:
```javascript
group.pins.forEach((pin, idx) => {
    popupContent += `
        <div style="padding: 10px; background: #f9f9f9; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between;">
                <div>${itemIcon} <strong>${pin.item?.title}</strong></div>
                <div style="color: #2e7d32; font-weight: bold;">$${price}</div>
            </div>

            <!-- INDIVIDUAL LISTING LINK FOR EACH ITEM -->
            <a href="/listing.html?id=${pin.id}"
               style="display: inline-block; padding: 6px 12px;
                      background: #667eea; color: white; border-radius: 6px;">
                View →
            </a>
        </div>
    `;
});
```

---

### 2. Pin Data Structure

Each pin has an `id` field that uniquely identifies it:

```javascript
{
  id: "unique-pin-id",              // Used in URL: /listing.html?id=THIS
  location: {
    latitude: 40.678888,
    longitude: -73.964179
  },
  item: {
    title: "Apple MacBook Pro",
    category: "electronics",
    estimatedValue: 179
  },
  price: 179,                        // Actual sale price
  userId: "seller-user-id",
  status: "active"
}
```

---

### 3. Listing Page ([public/listing.html](public/listing.html))

The listing page extracts the ID from the URL and loads the full details:

```javascript
// Get listing ID from URL
const urlParams = new URLSearchParams(window.location.search);
listingId = urlParams.get('id');  // Gets the "unique-pin-id"

// Load listing data from Firestore
const pinsQuery = await db.collection('pins')
    .where('id', '==', listingId)
    .limit(1)
    .get();

const listingData = pinsQuery.docs[0].data();
```

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      MAP VIEW (index.html)                  │
│                                                             │
│  🗺️ Map with pins showing locations                        │
│                                                             │
│       📍 [Pin Marker]                                       │
│          └─ Click                                           │
│             └─ Popup appears:                               │
│                                                             │
│     ┌────────────────────────────────────┐                 │
│     │  Apple MacBook Pro                 │                 │
│     │  Electronics                       │                 │
│     │  $179                              │                 │
│     │                                    │                 │
│     │  [View Details →]  ← Click this    │                 │
│     └────────────────────────────────────┘                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Navigate to: /listing.html?id=xyz123
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              LISTING PAGE (listing.html?id=xyz123)          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  [Large Item Photos]                               │   │
│  │                                                     │   │
│  │  Apple MacBook Pro                                 │   │
│  │  Electronics • Excellent Condition • Apple         │   │
│  │                                                     │   │
│  │  Description:                                      │   │
│  │  Lightly used MacBook Pro in excellent condition...│   │
│  │                                                     │   │
│  │  Location: Brooklyn, NY                            │   │
│  │  [Map showing location]                            │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────┐                                   │
│  │   Price: $179       │                                   │
│  │                     │                                   │
│  │  [💳 Buy Now]       │  ← Stripe checkout                │
│  │  [💬 Make Offer]    │                                   │
│  └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## URL Structure

### Map View:
```
https://treasurehunter-sdk.web.app/
https://treasurehunter-sdk.web.app/index.html
```

### Individual Listing:
```
https://treasurehunter-sdk.web.app/listing.html?id={pinId}

Examples:
https://treasurehunter-sdk.web.app/listing.html?id=pin_1234567890_abc
https://treasurehunter-sdk.web.app/listing.html?id=xyz789
```

---

## Key Components

### Map Pin Creation ([index.html:3999-4022](public/index.html))
- Creates Leaflet markers for each pin
- Binds popup with item info + link
- Uses `pin.id` in the href

### Listing Page Load ([listing.html:577-616](public/listing.html))
- Extracts `id` from URL query params
- Queries Firestore for matching pin
- Displays full item details
- Enables purchase flow

### Purchase Button ([listing.html:780-828](public/listing.html))
- Sends `pinId` to backend
- Creates Stripe checkout session
- Redirects to Stripe payment

---

## Data Flow

```
Pin Document in Firestore
  ├─ id: "pin_123"
  ├─ location: { lat, lng }
  ├─ item: { title, category, ... }
  ├─ price: 179
  ├─ userId: "seller_xyz"
  └─ status: "active"

         ▼

Map loads pins via API
  └─ Creates marker with popup
     └─ Popup contains link: /listing.html?id=pin_123

         ▼

User clicks "View Details →"
  └─ Browser navigates to: /listing.html?id=pin_123

         ▼

Listing page loads
  └─ Queries Firestore: where('id', '==', 'pin_123')
     └─ Displays full details
        └─ Shows "Buy Now" button

         ▼

User clicks "Buy Now"
  └─ Sends pinId to: POST /api/purchases/create-checkout
     └─ Backend fetches pin data
        └─ Creates Stripe session
           └─ Redirects to Stripe Checkout
```

---

## Visual Reference

### What the User Sees:

**Step 1: Map Pin Popup**
```
╔══════════════════════════╗
║ Apple MacBook Pro        ║
║ Electronics              ║
║ $179                     ║
║                          ║
║ ┌──────────────────────┐ ║
║ │  View Details →      │ ║
║ └──────────────────────┘ ║
╚══════════════════════════╝
```

**Step 2: Listing Page**
```
╔════════════════════════════════════════════════╗
║  ThriftSpot                          [User]    ║
╠════════════════════════════════════════════════╣
║                                                ║
║  ┌──────────────────────────────────────────┐ ║
║  │  [Large Product Images]                  │ ║
║  │                                          │ ║
║  │  Apple MacBook Pro                       │ ║
║  │  📱 Electronics • ⭐ Excellent • 🏷️ Apple│ ║
║  │                                          │ ║
║  │  Description:                            │ ║
║  │  Lightly used MacBook Pro...             │ ║
║  └──────────────────────────────────────────┘ ║
║                                                ║
║  ┌─────────────────┐                          ║
║  │  $179           │                          ║
║  │                 │                          ║
║  │  [💳 Buy Now]   │ ← Stripe checkout        ║
║  │  [💬 Make Offer]│                          ║
║  └─────────────────┘                          ║
╚════════════════════════════════════════════════╝
```

---

## Testing the Connection

### Manual Test:
1. Open map: `https://treasurehunter-sdk.web.app/`
2. Click on any pin marker
3. Verify popup shows "View Details →" button
4. Click the button
5. Verify you land on `/listing.html?id={pinId}`
6. Verify listing page loads correctly
7. Verify "Buy Now" button is visible

### Debugging:
```javascript
// In browser console on map page:
console.log('Pins loaded:', window.pinMarkers.length);

// Check pin data:
db.collection('pins').limit(1).get().then(snap => {
  console.log('Pin data:', snap.docs[0].data());
});

// On listing page:
console.log('Listing ID from URL:', new URLSearchParams(window.location.search).get('id'));
```

---

## Summary

The connection between map pins and listing pages is established through:

1. **Pin ID** - Each pin has a unique `id` field
2. **URL Parameter** - ID is passed via `?id={pinId}` query param
3. **Popup Link** - Map popup contains `<a href="/listing.html?id=${pin.id}">`
4. **Listing Query** - Listing page queries Firestore using the ID
5. **Purchase Flow** - Buy button sends the same ID to backend

This creates a seamless flow from discovery (map) → details (listing) → purchase (Stripe).
