# Car Seat Misidentification Fix

## Problem
A Doona infant car seat was being:
1. Misidentified as a vehicle (automobile)
2. Priced at $6000 using vehicle pricing logic
3. Brand "Doona" was not recognized

## Root Causes

### Issue 1: Vehicle Detector False Positive
**File:** `functions/capture-sdk/utils/vehicle-detector.js`

The vehicle detector was matching "car" in "car seat" and triggering vehicle pricing.

**Line 18 (old):**
```javascript
'automobile': [
  'car', 'sedan', 'suv', 'truck', ...  // 'car' matches "car seat" ❌
]
```

**Fix Applied:**
Added exclusion patterns that run BEFORE vehicle detection:
```javascript
// EXCLUSIONS: Items that contain vehicle keywords but are NOT vehicles
const excludePatterns = [
  'car seat', 'carseat', 'infant seat', 'child seat', 'baby seat',
  'booster seat', 'doona', 'graco', 'chicco', 'britax', 'evenflo',
  'safety 1st', 'baby jogger', 'uppababy', 'nuna', 'cybex',
  'stroller', 'bassinet', 'carrier', 'infant', 'toddler', 'baby',
  'toy car', 'remote control car', 'rc car', 'matchbox', 'hot wheels',
  'die cast', 'model car', 'toy truck', 'toy vehicle'
];

// Check exclusions first - if matched, not a vehicle
if (excludePatterns.some(pattern => allText.includes(pattern))) {
  console.log(`Excluded from vehicle detection: matched pattern in "${allText}"`);
  return category; // Return original category, not a vehicle
}
```

Also removed standalone `'car'` from automobile patterns (now only matches full vehicle types like 'sedan', 'suv', 'truck').

### Issue 2: Claude Vision Prompt Didn't Prevent False Positives
**File:** `functions/capture-sdk/core/analyzeItem.js`

The AI vision prompt was heavily focused on vehicles but didn't warn about baby products.

**Fix Applied:**
Added explicit false positive prevention at the top of the prompt:
```javascript
CRITICAL: FALSE POSITIVE PREVENTION
Some items contain vehicle-related words but are NOT vehicles:
- "Car seat" / "Carseat" = BABY PRODUCT (Brands: Doona, Graco, Chicco, Britax, Evenflo, Safety 1st, UPPAbaby, Nuna, Cybex)
- "Toy car" / "Remote control car" = TOY (Brands: Hot Wheels, Matchbox, RC brands)
- "Stroller" / "Baby carrier" / "Bassinet" = BABY PRODUCT
DO NOT classify these as vehicles. They are baby/child products or toys.

BRAND RECOGNITION - READ ALL VISIBLE TEXT:
- Look carefully for brand names, logos, and text on the item
- Common baby product brands: Doona, Graco, Chicco, Britax, Evenflo, Safety 1st, Baby Jogger, UPPAbaby, Nuna, Cybex, Maxi-Cosi
- If you see these brands, the item is a BABY PRODUCT, not a vehicle
- Always include visible brand text in the "visible_text" field
```

## Expected Behavior After Fix

### Before (Incorrect)
```javascript
{
  category: "infant car seat",
  brand: "Unknown",
  detectedCategory: "automobile",  // ❌ Wrong!
  pricingTier: {
    min: 2000,
    max: 15000,
    base: 6000  // ❌ Vehicle pricing
  },
  marketAnalysis: {
    estimatedValue: {
      suggested: 6000  // ❌ Way too high
    }
  }
}
```

### After (Correct)
```javascript
{
  category: "infant car seat",
  brand: "Doona",  // ✅ Recognized from visible text
  detectedCategory: "infant car seat",  // ✅ No vehicle override
  pricingTier: {
    min: 30,
    max: 300,
    base: 150  // ✅ Baby product pricing
  },
  marketAnalysis: {
    estimatedValue: {
      suggested: 150-200  // ✅ Realistic for used car seat
    }
  }
}
```

## Testing

### Test Case 1: Doona Car Seat
1. Upload photo of Doona infant car seat
2. Expected: Category = "infant car seat", Brand = "Doona", Price = $100-$250
3. Console should show: `Excluded from vehicle detection: matched pattern in "infant car seat"`

### Test Case 2: Graco Car Seat
1. Upload photo of Graco car seat
2. Expected: Category = "car seat", Brand = "Graco", Price = $50-$150
3. Should NOT trigger vehicle pricing

### Test Case 3: Actual Car (Control)
1. Upload photo of Toyota Camry
2. Expected: Still correctly detected as vehicle with proper pricing
3. Should trigger vehicle detection as before

## Files Changed
1. `functions/capture-sdk/utils/vehicle-detector.js` (lines 16-30, 34)
   - Added exclusion patterns for baby/child products
   - Removed standalone 'car' from automobile patterns

2. `functions/capture-sdk/core/analyzeItem.js` (lines 267-278)
   - Added false positive prevention instructions
   - Added baby product brand recognition guidance

## Deploy
```bash
cd functions
firebase deploy --only functions
```

## Related Issues
- Price display bug (fixed in PRICE_DISPLAY_FIX.md)
- Vehicle detection needs refinement for edge cases
- Consider adding more baby/child product brands to exclusion list

## Future Improvements
1. Add machine learning-based category detection
2. Create dedicated baby product pricing tiers
3. Add more brand databases for better recognition
4. Consider using separate analysis prompts for different product categories
