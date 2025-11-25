# Listing Page Data Type Fix

## Issue
The listing page was loading but showing a JavaScript error:
```
TypeError: item.condition.toLowerCase is not a function
```

## Root Cause

According to the [PinModel.js](functions/models/PinModel.js), the `condition` field is stored as an **object**, not a string:

```javascript
// PinModel.js - Line 228
static normalizeCondition(condition) {
    if (!condition) {
        return { rating: 'unknown', description: '', issues: [] };
    }

    if (typeof condition === 'string') {
        return { rating: condition, description: '', issues: [] };
    }

    return {
        rating: condition.rating || 'unknown',
        description: (condition.description || '').substring(0, 200),
        issues: Array.isArray(condition.issues) ? condition.issues.slice(0, 5) : [],
        usableAsIs: condition.usableAsIs || false
    };
}
```

So `item.condition` is:
```javascript
{
    rating: 'good',           // ← The actual condition value
    description: '...',
    issues: [],
    usableAsIs: true
}
```

But the listing page was treating it as a string:
```javascript
// BROKEN CODE
item.condition.toLowerCase()  // ❌ Can't call toLowerCase on an object!
```

## Fix

Updated [listing.html](public/listing.html) to handle both object and string formats:

```javascript
// NEW CODE - Lines 661-669
if (item.condition) {
    // Handle both object format {rating: 'good', description: '...'} and string format
    const conditionRating = typeof item.condition === 'object'
        ? (item.condition.rating || 'unknown')
        : item.condition;
    const conditionClass = conditionRating.toLowerCase().replace(' ', '-');
    const conditionDisplay = conditionRating.charAt(0).toUpperCase() + conditionRating.slice(1);
    metaContainer.innerHTML += `<div class="meta-badge condition-${conditionClass}">${conditionDisplay}</div>`;
}
```

This code:
1. Checks if `condition` is an object or string
2. Extracts the `rating` property if it's an object
3. Uses the string directly if it's already a string
4. Converts to lowercase for CSS class name
5. Capitalizes for display

## Additional Fix

Also updated the price extraction to check multiple possible locations:

```javascript
// OLD
const price = item.price || listingData.value || 25;

// NEW - Line 650
const price = listingData.price || item.price || item.estimatedValue || listingData.value || 25;
```

This checks:
1. `listingData.price` - Top-level price field
2. `item.price` - Item-specific price
3. `item.estimatedValue` - Estimated value from analysis
4. `listingData.value` - Legacy value field
5. `25` - Default fallback

## Files Modified

| File | Lines | Change | Status |
|------|-------|--------|--------|
| [public/listing.html](public/listing.html) | 661-669 | Handle condition object | ✅ DEPLOYED |
| [public/listing.html](public/listing.html) | 650 | Fix price extraction | ✅ DEPLOYED |

## Testing

After deployment:
1. Hard refresh: `Ctrl+Shift+R`
2. Open any listing page
3. Check console - should show no errors
4. Verify condition badge displays correctly (e.g., "Good", "Excellent")
5. Verify price displays correctly

## Example Data Structure

```javascript
// Pin document in Firestore
{
    id: "ABC123",
    status: "active",
    isPublic: true,
    userId: "user_xyz",

    // Top-level fields
    price: 25,                    // ← Sale price

    item: {
        title: "wireless over-ear headphones",
        category: "electronics",
        brand: "Unknown",

        // Condition is an OBJECT
        condition: {
            rating: "good",       // ← String: 'excellent', 'good', 'fair', 'poor', 'unknown'
            description: "Minor wear on ear cushions",
            issues: ["scratches"],
            usableAsIs: true
        },

        estimatedValue: 25,       // ← From AI analysis
        imageUrls: [...]
    },

    location: { ... }
}
```

## Why This Happened

The pin data structure evolved over time:
- Early versions stored `condition` as a simple string
- Later versions normalized it to an object with more details
- The listing page was written for the string format
- When it encountered the object format, it crashed

The fix makes the listing page compatible with both formats for backward compatibility.

## Related

This is similar to how other complex fields are stored:
- `location` is an object with `latitude`, `longitude`, `geohash`, etc.
- `item.analysisData` is flattened to avoid nested limits
- `statusHistory` is an array of objects

All of these need careful handling when displaying in the UI.

## Future Prevention

Consider:
1. TypeScript or JSDoc type definitions
2. Schema validation on write
3. Data migration scripts for format changes
4. Better error boundaries in frontend

## Status

✅ **FIXED AND DEPLOYED**

The listing page now correctly handles:
- Condition objects with rating/description/issues
- Multiple price field locations
- Backward compatibility with string conditions
- Proper capitalization and CSS classes
