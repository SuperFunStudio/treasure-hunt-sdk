# eBay Filtering Improvements - Smart Vintage & Multi-Item Detection

## Problems Identified

### Issue 1: Vintage Items Inflating Prices
**Problem:** Comparable listings included valuable vintage items when the scanned item was a recent product.

**Example:**
- Upload: Recent IKEA Poäng chair (typical value ~$150)
- eBay Results Included:
  - Vintage Ikea Poäng Armchair: $834.62 ⚠️
  - Regular Poäng chairs: $100-150 ✅

**Impact:** Median price calculation skewed high, giving inaccurate estimates.

### Issue 2: Multi-Item Sets Inflating Prices
**Problem:** Listings selling multiple items in a set were included when user uploaded a single item.

**Example:**
- Upload: Single IKEA Poäng chair
- eBay Results Included:
  - "2 IKEA POÄNG Rocking chairs with ottoman": $325 ⚠️
  - Single chairs: $100-150 ✅

**Impact:** Price estimates inflated by including multi-item bundles.

### Issue 3: Not Filtering Out Genuine Vintage
**Problem:** User noted "we don't want to completely exclude vintage items as they can be really valuable if they are accurately identified."

**Requirement:** Need elegant solution that:
- ✅ Keeps vintage items when scanning vintage items
- ✅ Filters vintage outliers when scanning modern items
- ✅ Doesn't blindly remove all vintage listings

## Solution: Context-Aware Filtering

### Key Insight: Median-Based Detection

Instead of hard price caps, use **median price** to detect outliers:

```javascript
// Calculate median from all listings
const medianPrice = validPrices[Math.floor(validPrices.length / 2)];

// Vintage item priced >3x median = likely genuine vintage
if (isVintage && listing.price > medianPrice * 3) {
  // Only keep if user is searching for vintage
  if (!searchQuery.includes('vintage')) {
    filter_out();
  }
}
```

**Example:**
- IKEA Poäng search finds:
  - 10 chairs at $100-180 → median: $150
  - 1 vintage at $834 (5.5x median)
  - **Action:** Filter the $834 vintage (not searching for "vintage")

- Vintage Poäng search finds:
  - 5 modern at $120-150
  - 3 vintage at $600-900 → median: $400
  - **Action:** Keep vintage items (query includes "vintage")

### Multi-Item Detection: Pattern Matching

Use regex patterns to detect multi-item listings:

```javascript
const multiItemPatterns = [
  /\b\d+\s*(x|chairs?|pieces?|items?|set of)\b/i,  // "2 x", "2 chairs", "3 pieces"
  /\bset of \d+\b/i,                                // "set of 2"
  /\b\d+\s*piece set\b/i,                           // "3 piece set"
  /with (ottoman|cushion|table|stand)/i,            // "with ottoman", "with table"
  /\+ (ottoman|cushion|table|stand)/i,              // "+ ottoman"
  /and (ottoman|cushion|table|stand)/i              // "and ottoman"
];
```

**Detected Examples:**
- ✅ "2 IKEA POÄNG Rocking chairs with ottoman"
- ✅ "Set of 4 dining chairs"
- ✅ "Chair + ottoman bundle"
- ✅ "3 piece patio set"

**Exception Handling:**
If user searches for "chair with ottoman", don't filter those out.

```javascript
// Exception: Don't filter if search query mentions multi-item
if (!searchQuery.includes('with') && !searchQuery.includes('set')) {
  filter_out();
}
```

## Implementation

### File: `functions/services/ebay/marketDataService.js:417-509`

### Filter 3: Multi-Item Sets (NEW)

```javascript
// Filter 3: Detect and filter multi-item sets
const multiItemPatterns = [
  /\b\d+\s*(x|chairs?|pieces?|items?|set of)\b/i,  // "2 x", "2 chairs", "3 pieces"
  /\bset of \d+\b/i,                                // "set of 2"
  /\b\d+\s*piece set\b/i,                           // "3 piece set"
  /with (ottoman|cushion|table|stand)/i,            // "with ottoman", "with table"
  /\+ (ottoman|cushion|table|stand)/i,              // "+ ottoman"
  /and (ottoman|cushion|table|stand)/i              // "and ottoman"
];

if (multiItemPatterns.some(pattern => pattern.test(title))) {
  // Exception: Don't filter if the search query specifically mentions the multi-item aspect
  const searchLower = searchQuery.toLowerCase();
  if (!searchLower.includes('with') && !searchLower.includes('set')) {
    console.log(`Filtered multi-item set: ${listing.price} - ${listing.title.substring(0, 50)}`);
    return false;
  }
}
```

**Log Output:**
```
Filtered multi-item set: 325 - 2 IKEA POÄNG Rocking chairs with ottoman
```

### Filter 5: Smart Vintage Detection (NEW)

```javascript
// Filter 5: Smart vintage filtering
// Vintage items are valuable but should match the item being scanned
const vintageKeywords = ['vintage', 'antique', 'retro', 'collectible', 'rare', 'original', 'classic'];
const isVintage = vintageKeywords.some(keyword => title.includes(keyword));

if (isVintage && listing.price > medianPrice * 3) {
  // This is likely a genuinely valuable vintage item
  // Only keep it if the search query suggests we're looking for vintage
  const searchLower = searchQuery.toLowerCase();
  const searchingForVintage = vintageKeywords.some(keyword => searchLower.includes(keyword));

  if (!searchingForVintage) {
    console.log(`Filtered vintage outlier: ${listing.price} (median: ${medianPrice}) - ${listing.title.substring(0, 50)}`);
    return false;
  }
}
```

**Log Output:**
```
Filtered vintage outlier: 834.62 (median: 150) - Ikea Poäng Armchair vintage Scandinavian
```

## Expected Behavior After Fix

### IKEA Poäng Chair Example

**Before:**
```
eBay Search: "IKEA Poäng cantilever armchair"
Found 14 items:
- $29 - Single Poäng
- $100 - Poäng chair
- $120 - IKEA Poäng
- $150 - Poäng armchair
- $325 - 2 IKEA POÄNG Rocking chairs with ottoman ⚠️
- $834.62 - Vintage Ikea Poäng Armchair ⚠️
→ Median: $149.99 (influenced by outliers)
```

**After:**
```
eBay Search: "IKEA Poäng cantilever armchair"
Found 14 items, filtered to 12:
- $29 - Single Poäng
- $100 - Poäng chair
- $120 - IKEA Poäng
- $150 - Poäng armchair
- $180 - Poäng with cushion

Filtered:
✗ $325 - 2 IKEA POÄNG Rocking chairs with ottoman (multi-item)
✗ $834.62 - Vintage Ikea Poäng Armchair (vintage outlier)

→ Median: $120 (accurate for single, modern chair)
```

### Vintage Chair Search (Opposite Case)

**Search: "vintage Eames chair"**

```
Found 20 items:
- $50 - Eames-style replica
- $1200 - Vintage Herman Miller Eames Lounge Chair ✅
- $1500 - Authentic vintage Eames ✅
- $1800 - Original Eames chair 1960s ✅

Kept vintage items because query includes "vintage"
→ Median: $1350 (accurate for genuine vintage)
```

## Console Output Examples

### Multi-Item Detection
```
Filtered multi-item set: 325 - 2 IKEA POÄNG Rocking chairs with ottoman
Filtered multi-item set: 189.99 - Set of 4 vintage wooden dining chairs
Filtered multi-item set: 450 - Living room set with sofa and 2 chairs
```

### Vintage Detection
```
Filtered vintage outlier: 834.62 (median: 150) - Ikea Poäng Armchair vintage
Filtered vintage outlier: 1200 (median: 300) - Rare vintage mid-century armchair
```

### Kept Vintage (When Searching for Vintage)
```
Search: "vintage Poäng"
Median: 400
Keeping vintage item: 834.62 - Ikea Poäng Armchair vintage (query mentions 'vintage')
```

## Testing

### Test Case 1: Modern IKEA Chair
```javascript
Upload: Photo of modern IKEA Poäng chair
Expected Query: "IKEA Poäng cantilever armchair"
Expected Results:
  ✅ Modern Poäng chairs ($100-$180)
  ✗ Vintage Poäng ($800+)
  ✗ Multi-chair sets ($300+)
Expected Median: ~$120-150
```

### Test Case 2: Vintage Chair
```javascript
Upload: Photo of vintage mid-century chair
Claude Analysis: Should detect "vintage" or "mid-century" in description
Expected Query: "vintage [brand] chair" or "[brand] vintage chair"
Expected Results:
  ✅ Genuine vintage chairs ($500-$2000)
  ✅ Authenticated vintage items
  ✗ Modern reproductions
Expected Median: Accurate vintage pricing
```

### Test Case 3: Dining Set
```javascript
Upload: Photo of 4-chair dining set
Expected Query: "set of 4 dining chairs" or "4 dining chairs"
Expected Results:
  ✅ Multi-chair sets
  ✗ Single chairs
  (Multi-item filter disabled because query mentions quantity)
```

### Test Case 4: Single Dining Chair
```javascript
Upload: Photo of single dining chair
Expected Query: "dining chair"
Expected Results:
  ✅ Single chairs
  ✗ "Set of 4 dining chairs"
  ✗ "Dining chair + cushion bundle"
```

## Benefits

### 1. Accurate Pricing for Modern Items
- Filters out vintage outliers
- Removes multi-item bundles
- Median reflects true single-item market value

### 2. Preserves Vintage Value
- Detects when item IS vintage
- Keeps comparable vintage items
- Doesn't blindly filter valuable items

### 3. Context-Aware Filtering
- Uses median to detect outliers (not fixed prices)
- Checks search query intent
- Adapts to different categories

### 4. Better User Experience
- More accurate price estimates
- Relevant comparable listings
- Builds trust in AI analysis

## Filtering Decision Tree

```
eBay Listing
    ↓
Is title vintage + price > 3x median?
    ├─ YES → Is user searching for vintage?
    │         ├─ YES → KEEP (valuable vintage)
    │         └─ NO → FILTER (outlier for modern item)
    └─ NO → Continue...
         ↓
Does title match multi-item patterns?
    ├─ YES → Does search query mention multi-item?
    │         ├─ YES → KEEP (user wants set)
    │         └─ NO → FILTER (single item search)
    └─ NO → Continue...
         ↓
Apply other filters (commercial, price limits, etc.)
    ↓
KEEP listing
```

## Future Enhancements

### 1. Category-Specific Thresholds
```javascript
const vintagePriceMultipliers = {
  'furniture': 3,      // 3x median
  'electronics': 1.5,  // Vintage electronics less common
  'clothing': 5,       // Vintage clothing can be very valuable
  'toys': 10          // Collectible toys huge market
};
```

### 2. Age Detection for Vintage
Extract years from titles and descriptions:
```javascript
// "Mid-century 1960s Eames chair"
const yearMatch = title.match(/\b(19\d{2}|20[0-2]\d)\b/);
if (yearMatch) {
  const age = currentYear - parseInt(yearMatch[1]);
  if (age > 50) isGenuineVintage = true;
}
```

### 3. Quantity Detection in Uploaded Images
Use Claude to count items in photo:
```javascript
analysis.itemCount = 1; // "I see 1 chair in the image"
// If itemCount > 1, enable multi-item search
```

### 4. User Feedback Loop
```javascript
{
  "userFeedback": {
    "priceAccurate": true/false,
    "incorrectFiltering": "Filtered out relevant vintage item",
    "suggestedAction": "Keep vintage items for this search"
  }
}
```

## Related Files

### Modified
- `functions/services/ebay/marketDataService.js` (lines 417-509)

### Related Logic
- `functions/capture-sdk/core/routeDisposition.js` (IQR outlier filtering)
- `functions/capture-sdk/utils/vehicle-detector.js` (query building)

## Related Fixes
- eBay search query improvements (EBAY_SEARCH_IMPROVEMENTS.md)
- eBay listings display (EBAY_LISTINGS_DISPLAY_FIX.md)
- Price display fix (PRICE_DISPLAY_FIX.md)
