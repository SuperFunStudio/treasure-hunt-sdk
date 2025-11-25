# eBay Search Improvements & AI Description Display

## Problems Identified

### Issue 1: eBay Search Too Broad
**Problem:** When uploading a glass table, comparable listings included wood tables. Search was matching only on category ("table") without considering materials.

**Example:**
- Upload: Glass dining table
- Search query: "table" (brand unknown)
- Results: Wood tables, metal tables, glass tables (all mixed together)

**Root Cause:** `buildStandardQuery()` in `vehicle-detector.js` only used:
```javascript
// OLD - Too generic
query = `${brand} ${category}`  // e.g., "table" or "Unknown table"
```

### Issue 2: Missing AI Description
**Problem:** Claude AI generates detailed descriptions during analysis, but they weren't displayed or used for listing creation.

**Example Analysis:**
```javascript
analysis.condition.description = "Black Doona car seat/stroller combo in good condition with minor fabric wear on seat cushion. All safety labels intact, base mechanism appears functional with yellow accent pieces visible."
```

This valuable data was being discarded!

## Fixes Applied

### Fix 1: Enhanced eBay Search Query Builder

**File:** `functions/capture-sdk/utils/vehicle-detector.js:169-199`

**Before:**
```javascript
function buildStandardQuery(itemData) {
  const parts = [];

  if (itemData.brand && itemData.brand !== 'Unknown') {
    parts.push(itemData.brand);
  }

  if (itemData.category && !itemData.category.includes('Unknown')) {
    parts.push(itemData.category);
  }

  return parts.join(' ').trim() || 'item';
}
```

**After:**
```javascript
function buildStandardQuery(itemData) {
  const parts = [];

  // Brand is most important for non-vehicles
  if (itemData.brand && itemData.brand !== 'Unknown') {
    parts.push(itemData.brand);
  }

  // Materials are critical for furniture/home goods (glass table vs wood table)
  if (itemData.materials && Array.isArray(itemData.materials) && itemData.materials.length > 0) {
    const primaryMaterial = itemData.materials[0];
    if (primaryMaterial && primaryMaterial.toLowerCase() !== 'unknown') {
      parts.push(primaryMaterial);
    }
  }

  // Category provides context
  if (itemData.category && !itemData.category.includes('Unknown')) {
    parts.push(itemData.category);
  }

  // Model adds specificity (for electronics, appliances, etc.)
  if (itemData.model && itemData.model !== 'Unknown' && itemData.model.length > 2) {
    parts.push(itemData.model);
  }

  const query = parts.join(' ').trim();
  console.log(`Standard search query: "${query}" (brand: ${itemData.brand}, materials: ${itemData.materials?.join(', ')}, category: ${itemData.category})`);

  return query || 'item';
}
```

**New Query Building Logic:**
1. **Brand** - Most important for brand recognition
2. **Materials** - Critical for furniture/home goods differentiation
3. **Category** - Provides general context
4. **Model** - Adds specificity for electronics/appliances

**Example Results:**

| Item | Old Query | New Query | Improvement |
|------|-----------|-----------|-------------|
| Glass table | "table" | "glass table" | ✅ Material specified |
| IKEA glass table | "IKEA table" | "IKEA glass table" | ✅ Brand + material |
| Doona car seat | "infant car seat" | "Doona infant car seat" | ✅ Brand added |
| iPhone 12 | "Apple electronics" | "Apple electronics iPhone 12" | ✅ Model added |

### Fix 2: AI Description Display & Storage

**Files Changed:**

**1. HTML** (`public/index-v6.html:134-140`)
Added description section in results:
```html
<!-- AI Description -->
<div class="ai-description-section">
    <h4>AI-Generated Description</h4>
    <p class="ai-description-text" id="aiDescription">
        Loading description...
    </p>
</div>
```

**2. JavaScript** (`public/js/app-v6.js`)

**Lines 425-435:** Extract and store description
```javascript
// Store description for listing creation
const description = analysis.condition?.description ||
                  analysis.description ||
                  `${itemName} in ${analysis.condition?.rating || 'good'} condition`;

// Store the full analysis data for listing creation
this.listingDescription = description;
this.listingBrand = analysis.brand || 'Unknown';
this.listingModel = analysis.model || '';
this.listingMaterials = analysis.materials || [];
this.listingCondition = analysis.condition || {};
```

**Lines 472-476:** Display description
```javascript
// Display AI-generated description
const descriptionElement = document.getElementById('aiDescription');
if (descriptionElement) {
    descriptionElement.textContent = description;
}
```

**Lines 594-634:** Pass to listing editor
```javascript
async createListing() {
    // Prepare comprehensive listing data
    const listingData = {
        ...this.analysisData,
        prepopulatedData: {
            description: this.listingDescription || '',
            brand: this.listingBrand || '',
            model: this.listingModel || '',
            materials: this.listingMaterials || [],
            condition: this.listingCondition || {},
            estimatedPrice: this.analysisData?.routes?.marketAnalysis?.estimatedValue?.suggested || 0,
            category: this.analysisData?.analysis?.category || '',
            itemName: this.analysisData?.analysis?.category || 'Unknown Item'
        }
    };

    // Save to localStorage for scan-editor.html
    localStorage.setItem('pendingAnalysis', JSON.stringify(listingData));

    // Convert photo files to base64 for transfer
    const photoPromises = this.photoFiles.map(file => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    });

    const photoDataUrls = await Promise.all(photoPromises);
    localStorage.setItem('pendingImages', JSON.stringify(photoDataUrls));

    window.location.href = 'scan-editor.html';
}
```

**3. CSS** (`public/css/thriftspot-v6.css:508-530`)
Styled description section:
```css
.ai-description-section {
    margin-top: var(--space-6);
    padding-top: var(--space-6);
    border-top: 1px solid var(--gray-200);
}

.ai-description-section h4 {
    font-size: var(--font-lg);
    font-weight: 700;
    margin-bottom: var(--space-3);
    color: var(--gray-900);
}

.ai-description-text {
    font-size: var(--font-base);
    line-height: 1.6;
    color: var(--gray-700);
    background: var(--gray-50);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    border-left: 4px solid var(--primary);
}
```

## Expected Behavior After Fix

### Glass Table Example

**Before:**
```
eBay Search: "table"
Results:
- Wood dining table ($150)
- Metal coffee table ($80)
- Glass table ($120)
```

**After:**
```
eBay Search: "glass table"
Results:
- Glass dining table ($120)
- Glass coffee table with metal frame ($95)
- Tempered glass side table ($75)
```

### Results Screen Display

**Before:**
- No description shown
- Only price and condition visible

**After:**
```
Thrift Spotted!

[Glass Dining Table]

Estimated Value: $120    Condition: Good

AI-Generated Description
┌────────────────────────────────────────────┐
│ Modern glass dining table with chrome      │
│ legs in good condition. Minor scratches    │
│ on surface, all legs stable and intact.   │
│ Measures approximately 60" x 36".          │
└────────────────────────────────────────────┘

Comparable eBay Listings
[$120] Glass Dining Table - Good
[$95] Tempered Glass Table with Metal Base
[$135] Glass Top Dining Table Chrome Legs
```

### Listing Creation Flow

**Before:**
```
User clicks "Create Listing"
    ↓
Redirects to scan-editor.html
    ↓
User sees empty form (has to type everything)
```

**After:**
```
User clicks "Create Listing"
    ↓
Redirects to scan-editor.html with prepopulated data:
    ↓
Form pre-filled with:
- Description: "Modern glass dining table with chrome legs..."
- Brand: "Unknown" (or detected brand)
- Category: "glass table"
- Materials: ["glass", "chrome"]
- Price: $120
- Condition: Good
- Photos: All uploaded images attached
    ↓
User can edit/refine before publishing
```

## Testing

### Test Case 1: Glass Table
1. Upload photo of glass table
2. Expected backend search: `"glass table"` or `"[Brand] glass table"`
3. Check console: `Standard search query: "glass table" (brand: Unknown, materials: glass, category: table)`
4. Verify eBay results are all glass tables
5. Verify description appears in results
6. Click "Create Listing" → verify scan-editor pre-filled

### Test Case 2: IKEA Furniture
1. Upload photo of IKEA bookshelf
2. Expected search: `"IKEA wood bookshelf"` (if materials detected)
3. Results should prioritize IKEA items
4. Description should mention IKEA and wood

### Test Case 3: Electronics
1. Upload photo of iPhone
2. Expected search: `"Apple electronics iPhone [model]"`
3. Should find specific iPhone models, not all Apple products

## Console Output Examples

### Improved Search Query Building
```
Standard search query: "glass table" (brand: Unknown, materials: glass, category: table)
```

### Description Storage
```
📝 Populated results: {
  itemName: "glass table",
  price: 120,
  condition: "good",
  description: "Modern glass dining table with chrome legs in good condition...",
  brand: "Unknown",
  materials: ["glass", "chrome"],
  ...
}
```

### Listing Creation
```
📦 Listing data prepared: {
  description: "Modern glass dining table with chrome legs...",
  brand: "Unknown",
  materials: ["glass", "chrome"],
  photos: 3
}
```

## Benefits

### 1. More Accurate eBay Comparables
- **Glass tables** find glass tables (not wood)
- **Brand-specific items** find same brand
- **Electronics** match specific models
- Better price accuracy from relevant comparisons

### 2. Better Listing Creation UX
- Pre-filled descriptions save time
- AI-generated descriptions are detailed and professional
- Users can edit rather than write from scratch
- All analysis data available for listing optimization

### 3. Transparency
- Users see exactly what Claude AI detected
- Can verify accuracy before creating listing
- Builds trust in AI analysis

## Future Enhancements

### 1. Smart Query Refinement
If initial search returns no results, try fallback strategies:
```javascript
Strategies:
1. Brand + Material + Category  // "IKEA glass table"
2. Material + Category           // "glass table"
3. Brand + Category              // "IKEA table"
4. Category only                 // "table"
```

### 2. User Feedback Loop
Allow users to flag incorrect comparables:
```javascript
{
  "userFeedback": {
    "accurateComparables": true/false,
    "suggestedQuery": "user's better search term"
  }
}
```

### 3. eBay Category Filtering
Include eBay category ID in search:
```javascript
searchParams: {
  q: "glass table",
  category: "3197" // Furniture > Tables category
}
```

## Deployment

```bash
# Deploy backend changes
cd functions
firebase deploy --only functions

# Frontend changes are static - no deployment needed
# Just refresh the page
```

## Related Fixes
- Price display fix (PRICE_DISPLAY_FIX.md)
- Car seat misidentification fix (CAR_SEAT_FIX.md)
- eBay listings display fix (EBAY_LISTINGS_DISPLAY_FIX.md)
