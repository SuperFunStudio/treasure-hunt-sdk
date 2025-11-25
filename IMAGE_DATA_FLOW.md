# Image Data Flow & Missing Images Fix

## Issue Identified

The listing page loads successfully but shows "No Image" placeholder instead of the actual item photos.

## Root Cause

### Data Structure Mismatch

According to [PinModel.js](functions/models/PinModel.js), images are stored in `item.imageUrls`:

```javascript
// PinModel.js - Line 123
item: {
    id: item.id || null,
    category: broadCategory,
    title: item.title || PinModel.generateTitle(item),
    description: item.description || '',
    brand: item.brand || 'Unknown',
    model: item.model || '',
    condition: PinModel.normalizeCondition(item.condition),
    estimatedValue: item.estimatedValue || 0,
    confidence: Math.min(Math.max(item.confidence || 0, 0), 10),
    imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls.slice(0, 5) : [],  // ← HERE!
    // ...
}
```

But the listing page was looking in the wrong places:

```javascript
// OLD CODE (BROKEN)
const images = listingData.images || listingData.item?.images || [];
//             ^^^^^^^^^^^^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^
//             Wrong field names!
```

### Where Images Come From

When a user scans an item:

1. **Scan captures photos** → Base64 data URLs
2. **Pin creation** → Uploads to Firebase Storage
3. **Storage returns public URLs** → Saved in `item.imageUrls`
4. **Firestore stores** → `pins/{docId}/item/imageUrls: [...]`

### Image Upload Process

From [pins.js](functions/routes/pins.js):

```javascript
// Line 62-122: Image upload handling
if (item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
    const uploadPromises = item.imageUrls.map(async (imageUrl, index) => {
        if (imageUrl.startsWith('data:image/')) {
            // Extract base64 data
            const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
            const [, extension, base64Data] = matches;
            const buffer = Buffer.from(base64Data, 'base64');

            // Generate unique filename
            const filename = `pins/${userId}/${timestamp}_${index}.${extension}`;
            const file = bucket.file(filename);

            // Upload to Firebase Storage
            await file.save(buffer, {
                metadata: { contentType: `image/${extension}` }
            });

            // Make file publicly readable
            await file.makePublic();

            // Get public URL
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
            return publicUrl;
        }
    });

    processedImageUrls = (await Promise.all(uploadPromises)).filter(url => url);
}

// Update item with processed URLs
const processedItem = {
    ...item,
    imageUrls: processedImageUrls  // ← Stored here!
};
```

## The Fix

### Frontend Fix ([listing.html](public/listing.html))

Updated `displayImages()` function to check multiple possible locations:

```javascript
// NEW CODE - Line 696-702
function displayImages() {
    // Check multiple possible locations for images
    const images = listingData.item?.imageUrls ||  // ← Correct location!
                  listingData.imageUrls ||
                  listingData.images ||
                  listingData.item?.images ||
                  [];

    console.log('📸 Images found:', images.length, images);

    if (!images || images.length === 0) {
        console.warn('No images available for listing');
        // Show "No Image" placeholder
    }

    mainImage.src = images[0];
    console.log('Main image set to:', images[0]);
}
```

### Backend Fix ([purchases.js](functions/routes/purchases.js))

Also updated the Stripe checkout to properly pass images:

```javascript
// Line 87
images: pinData.item?.imageUrls?.slice(0, 1) || [],
//      ^^^^^^^^^^^^^^^^^^^^^^^
//      Correct field for images
```

## Complete Image Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. USER SCANS ITEM                                      │
│    - Camera captures photos                             │
│    - Converts to base64 data URLs                       │
│    - Sends to backend                                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 2. BACKEND PROCESSES (pins.js)                          │
│    FOR EACH IMAGE:                                      │
│      - Decode base64 → Buffer                           │
│      - Generate unique filename                         │
│      - Upload to Firebase Storage                       │
│      - Make publicly readable                           │
│      - Get public URL                                   │
│                                                          │
│    RESULT: Array of public URLs                         │
│    ['https://storage.googleapis.com/.../img1.jpg',      │
│     'https://storage.googleapis.com/.../img2.jpg']      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 3. SAVE TO FIRESTORE (PinModel)                         │
│    pins/{docId}:                                        │
│      item:                                              │
│        imageUrls: [                                     │
│          "https://storage.googleapis.com/.../img1.jpg", │
│          "https://storage.googleapis.com/.../img2.jpg"  │
│        ]                                                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 4. DISPLAY ON LISTING PAGE (listing.html)              │
│    - Load pin document from Firestore                   │
│    - Extract: listingData.item.imageUrls               │
│    - Set main image: <img src="imageUrls[0]">          │
│    - Create thumbnails for remaining images             │
└─────────────────────────────────────────────────────────┘
```

## Why Images Might Be Missing

### Scenario 1: Images Never Uploaded
**Symptom:** `item.imageUrls` is empty array `[]`

**Possible Causes:**
- Base64 images not sent from frontend
- Upload to Firebase Storage failed
- Storage bucket permissions issue
- Network error during upload

**Debug:**
```javascript
// Check pin document in Firestore
console.log('imageUrls:', listingData.item?.imageUrls);
// Expected: ['https://storage.googleapis.com/...']
// If empty: Images never uploaded
```

### Scenario 2: Images Uploaded But URLs Wrong
**Symptom:** `item.imageUrls` contains URLs but images don't load

**Possible Causes:**
- Storage bucket not public
- URLs expired (if using signed URLs - not the case here)
- CORS issues
- Files deleted

**Debug:**
```javascript
// Try to load image directly
const imageUrl = listingData.item?.imageUrls[0];
console.log('Image URL:', imageUrl);
// Try opening URL in browser - does it load?
```

### Scenario 3: Wrong Field Name (THIS WAS THE BUG)
**Symptom:** Images exist but listing page shows "No Image"

**Cause:** Code looking in wrong location
```javascript
// WRONG
const images = listingData.images;  // ❌ Field doesn't exist

// RIGHT
const images = listingData.item.imageUrls;  // ✅ Correct location
```

## Data Structure Reference

### Pin Document in Firestore:

```javascript
{
    // Document ID (e.g., "JlW0fuaYyK2UgU4Kkias")
    id: "JlW0fuaYyK2UgU4Kkias",
    status: "active",
    isPublic: true,
    userId: "user_xyz",
    price: 346.8,

    item: {
        title: "bamboo side table with drawer",
        category: "furniture",
        brand: "Unknown",
        condition: {
            rating: "fair",
            description: "Natural bamboo construction showing age-appropriate patina...",
            issues: ["scratches", "wear"],
            usableAsIs: true
        },
        estimatedValue: 346.8,

        // ✅ IMAGES ARE HERE
        imageUrls: [
            "https://storage.googleapis.com/treasurehunter-sdk.firebasestorage.app/pins/user123/1234567890_0.jpg",
            "https://storage.googleapis.com/treasurehunter-sdk.firebasestorage.app/pins/user123/1234567890_1.jpg"
        ]
    },

    location: {
        latitude: 40.678,
        longitude: -73.964,
        geohash: "dr5ru7",
        // ...
    }
}
```

## Files Modified

| File | Change | Status |
|------|--------|--------|
| [public/listing.html](public/listing.html) | Fix image field lookup | ✅ DEPLOYED |
| [functions/routes/purchases.js](functions/routes/purchases.js) | Fix Stripe image passing | ✅ DEPLOYED |

## Testing Checklist

After deployment:

### 1. Check Console Logs
```javascript
// Should see:
📸 Images found: 2 ["https://storage.googleapis.com/...", "https://storage.googleapis.com/..."]
Main image set to: https://storage.googleapis.com/...
```

### 2. Verify Image URLs
```javascript
// In browser console on listing page:
console.log(listingData.item?.imageUrls);
// Should show array of HTTPS URLs
```

### 3. Test Image Loading
- Hard refresh: `Ctrl+Shift+R`
- Check if images appear
- Try clicking thumbnails to switch images
- Verify no "No Image" placeholder

### 4. Check Firebase Storage
- Go to Firebase Console → Storage
- Navigate to `pins/{userId}/` folder
- Verify image files exist
- Check they're publicly readable

### 5. Test Full Flow
1. Scan a new item with photos
2. Create a pin
3. View listing page
4. Verify images appear

## If Images Still Don't Appear

### Step 1: Check Firestore Data
```javascript
// Get pin document
db.collection('pins').doc('YOUR_PIN_ID').get().then(doc => {
    const data = doc.data();
    console.log('Item imageUrls:', data.item?.imageUrls);
    // Should be array of URLs
});
```

### Step 2: Test Image URL Directly
Copy image URL and open in new browser tab. Does it load?

- **YES** → Frontend issue with displaying
- **NO** → Storage permissions or upload issue

### Step 3: Check Storage Rules
```javascript
// storage.rules
service firebase.storage {
  match /b/{bucket}/o {
    match /pins/{userId}/{imageId} {
      allow read: if true;  // Public read
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Step 4: Verify Upload Process
Check function logs:
```bash
firebase functions:log --only app
```

Look for:
```
Processing 2 images for pin creation
Successfully uploaded 2 out of 2 images
```

## Related Issues

### Purchase Button Error
The console also showed:
```
Purchase error: Listing not found
```

This was fixed by updating [purchases.js](functions/routes/purchases.js) to use `.doc().get()` instead of `.where()` query (same issue as listing page).

## Summary

✅ **FIXED:** Image display on listing pages
✅ **FIXED:** Purchase backend query method
✅ **DEPLOYED:** Both frontend and backend changes

**Key Takeaway:** Always check actual data structure in Firestore when debugging missing data. The field names must match exactly!

## Next Steps

If images are still not showing after this fix, the issue is likely:
1. Images were never uploaded to Storage (check during pin creation)
2. Storage permissions preventing public access
3. Image URLs are invalid or broken

Check the console logs for the 📸 emoji to see what's being found.
