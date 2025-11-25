# ThriftSpot V6 - Testing Guide

## Quick Start Testing

### Prerequisites
1. Firebase emulators running (or connected to Firebase project)
2. Web server running (Firebase hosting or local server)
3. Test user account created
4. Browser with camera/geolocation permissions

## Test Scenarios

### Scenario 1: Complete Scan-to-Sale Flow ✅

**Objective:** Test the entire flow from scanning an item to seeing it on the map.

**Steps:**
1. Open [http://localhost:5000](http://localhost:5000) (or your local URL)
2. Ensure you're signed in (create account if needed)
3. Click "Upload Photos" or use camera
4. Upload 1-3 photos of an item
5. Click "Scan Items"
6. Wait for analysis (7 stages, ~30 seconds)
7. Review results:
   - [ ] Item name is populated
   - [ ] Price is shown
   - [ ] Condition badge is displayed
   - [ ] eBay comparable listings are shown
8. Click "Preview Listing"
9. On listing preview page:
   - [ ] Images are displayed
   - [ ] AI-generated fields are populated
   - [ ] "For Sale" is selected by default
   - [ ] "Local Map" is checked
10. Edit the title if needed
11. Click "Create Listing"
12. Verify:
    - [ ] Browser asks for location permission (allow it)
    - [ ] Success message appears
    - [ ] Redirected to pin-map.html
    - [ ] New pin is visible on map

**Expected Result:** Item successfully created and visible on map.

---

### Scenario 2: Reserve and Claim Flow ✅

**Objective:** Test the reserve/claim system with two users.

**User A Steps:**
1. Create a listing (follow Scenario 1)
2. Note the pin location on map
3. Sign out

**User B Steps:**
1. Sign in with different account
2. Navigate to pin-map.html
3. Click the pin created by User A
4. Verify:
   - [ ] Pin panel slides up
   - [ ] "Available" badge is shown
   - [ ] "Reserve for 24h" button is visible
5. Click "Reserve for 24h"
6. Verify:
   - [ ] Success message appears
   - [ ] Pin color changes to yellow
   - [ ] Button changes to "Claim Item"
7. Click "Claim Item"
8. Confirm claim action
9. Verify:
   - [ ] Pin color changes to red
   - [ ] Status badge shows "Claimed"
   - [ ] Pin panel closes

**Expected Result:** User B successfully reserves and claims User A's item.

---

### Scenario 3: Rental Listing Creation ✅

**Objective:** Test creating a rental listing.

**Steps:**
1. Scan an item (follow steps 1-8 of Scenario 1)
2. On listing preview:
   - [ ] Select "For Rent" radio button
3. Verify:
   - [ ] Rental fields appear
   - [ ] Price label changes to "Rental Price *"
4. Set values:
   - Rental Period: Daily
   - Price: $25
   - Security Deposit: $50
5. Check "Local Map" only
6. Click "Create Listing"
7. On map:
   - [ ] Click the new pin
   - [ ] Verify "For Rent (daily)" is shown
   - [ ] Verify price is $25

**Expected Result:** Rental listing created with correct type and pricing.

---

### Scenario 4: Mobile Camera Flow ✅

**Objective:** Test camera capture on mobile device.

**Steps (Mobile Device):**
1. Open site on mobile browser
2. Ensure camera permission granted
3. Verify:
   - [ ] Camera viewfinder is shown in center
   - [ ] Capture button is visible below
4. Point camera at item
5. Click capture button
6. Verify:
   - [ ] Photo appears in gallery
   - [ ] Can capture multiple photos
   - [ ] Delete button works on each photo
7. Click "Scan Items"
8. Complete flow as in Scenario 1

**Expected Result:** Camera works smoothly on mobile.

---

### Scenario 5: Multi-Platform Listing ✅

**Objective:** Test listing to both Local and eBay.

**Steps:**
1. Scan an item
2. On listing preview:
   - [ ] Check "Local Map"
   - [ ] Check "eBay"
3. Fill in all fields
4. Click "Create Listing"
5. Verify:
   - [ ] Pin created on local map
   - [ ] Console shows "eBay listing creation pending" (not implemented yet)

**Expected Result:** Item listed to local map; eBay shows pending.

---

### Scenario 6: Error Handling ✅

**Objective:** Test error states and recovery.

**Steps:**

**6.1: No Photos**
1. Go to index.html
2. Click "Scan Items" without uploading photos
3. Verify:
   - [ ] Alert shows "Please add at least one photo first"

**6.2: Geolocation Denied**
1. Create a listing
2. Deny location permission
3. Verify:
   - [ ] Warning logged in console
   - [ ] Listing still created (without coordinates)
   - [ ] Pin may not show on map (expected)

**6.3: Offline/API Error**
1. Disconnect from internet
2. Try to scan item
3. Verify:
   - [ ] Error message appears
   - [ ] "Scan Another Item" button shown

**6.4: Unauthorized Actions**
1. Sign out
2. Try to reserve a pin
3. Verify:
   - [ ] Redirects to signin.html

**Expected Result:** All errors handled gracefully.

---

### Scenario 7: Owner Controls ✅

**Objective:** Test edit/delete for item owner.

**Steps:**
1. Create a listing
2. Click on your own pin
3. Verify:
   - [ ] "Edit Listing" button shown
   - [ ] "Delete" button shown
   - [ ] No "Reserve" button
4. Click "Delete"
5. Confirm deletion
6. Verify:
   - [ ] Pin removed from map
   - [ ] Panel closes

**Expected Result:** Owner can delete their own listings.

---

### Scenario 8: Navigation Flow ✅

**Objective:** Test all navigation paths.

**Steps:**
1. From index.html:
   - [ ] Click logo → stays on index.html
   - [ ] Click user avatar → dropdown appears
   - [ ] Click Profile → goes to profile.html
   - [ ] Click Dashboard → goes to dashboard.html
   - [ ] Click Thrift (🗺️) → goes to pin-map.html

2. From pin-map.html:
   - [ ] Click logo → goes to index.html
   - [ ] Click Spot (📷) → goes to index.html
   - [ ] Click Thrift (🗺️) → stays on pin-map.html

3. From listing-preview-v6.html:
   - [ ] Click "← Back to Results" → goes back
   - [ ] Click logo → goes to index.html

**Expected Result:** All navigation works correctly.

---

### Scenario 9: Responsive Design ✅

**Objective:** Test responsive behavior across devices.

**Desktop (>768px):**
- [ ] Telescope rings are large
- [ ] Upload button in center
- [ ] Form layouts are 2-column
- [ ] Map has floating panels

**Tablet (768px):**
- [ ] Layout adjusts smoothly
- [ ] Touch targets are adequate
- [ ] Images scale properly

**Mobile (<768px):**
- [ ] Camera viewfinder on index
- [ ] Forms are single-column
- [ ] Bottom sheet on map
- [ ] Mode toggle at bottom
- [ ] Touch-friendly buttons

**Expected Result:** Design is responsive across all breakpoints.

---

### Scenario 10: Data Persistence ✅

**Objective:** Verify Firebase data is correctly saved.

**Steps:**
1. Create a listing
2. Open Firebase Console
3. Navigate to Firestore → pins collection
4. Find your created document
5. Verify fields:
   - [ ] title, description, price
   - [ ] category, brand, condition
   - [ ] listingType (sale or rent)
   - [ ] images array with URLs
   - [ ] userId, userEmail
   - [ ] lat, lng, geohash (if location granted)
   - [ ] status: 'active'
   - [ ] createdAt, updatedAt timestamps
6. Reserve the pin (as different user)
7. Check Firestore:
   - [ ] reservedBy updated
   - [ ] reservedUntil set to +24h
8. Claim the pin
9. Check Firestore:
   - [ ] claimedBy updated
   - [ ] status: 'claimed'

**Expected Result:** All data correctly persisted to Firestore.

---

## Performance Testing

### Load Times
- [ ] Index page loads < 2 seconds
- [ ] Image upload completes < 3 seconds
- [ ] Analysis completes < 45 seconds
- [ ] Map loads with 50+ pins smoothly

### Image Optimization
- [ ] Images compressed before upload
- [ ] Thumbnails load quickly
- [ ] Full images lazy-load

### Map Performance
- [ ] Panning is smooth
- [ ] Zooming is responsive
- [ ] Markers render quickly
- [ ] No lag with 100+ pins

---

## Security Testing

### Authentication
- [ ] Unauthenticated users can't create listings
- [ ] Unauthenticated users can't reserve/claim
- [ ] Users can only delete their own listings
- [ ] Users can only edit their own listings

### Data Validation
- [ ] Required fields enforced
- [ ] Price must be positive number
- [ ] Image types validated
- [ ] File size limits enforced

### Firestore Rules (to be tested)
- [ ] Users can only write to their own listings
- [ ] Users can read all active listings
- [ ] Claimed items can't be re-reserved
- [ ] Deleted items don't show on map

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader announces states
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Alt text on images
- [ ] Form labels associated

---

## Edge Cases

### Empty States
- [ ] No pins on map → Show empty state
- [ ] No images on listing → Show placeholder
- [ ] No eBay results → Show message

### Expired Reservations
- [ ] Reservation expires after 24h (manual test)
- [ ] Pin returns to available state

### Concurrent Actions
- [ ] Two users reserve same pin simultaneously
- [ ] Owner deletes while someone reserves

### Long Content
- [ ] Very long descriptions
- [ ] Many images (10+)
- [ ] Very long item names

---

## Automated Testing (Future)

### Unit Tests
```javascript
// Example tests to implement
describe('ListingPreviewApp', () => {
  test('uploadImages() returns array of URLs', async () => {
    // Test implementation
  });

  test('encodeGeohash() returns valid geohash', () => {
    // Test implementation
  });

  test('createMapPin() creates Firestore document', async () => {
    // Test implementation
  });
});
```

### Integration Tests
```javascript
// Example tests to implement
describe('End-to-End Flow', () => {
  test('User can create listing from scan', async () => {
    // Test full flow
  });

  test('User can reserve and claim item', async () => {
    // Test reserve/claim flow
  });
});
```

---

## Bug Report Template

If you find a bug during testing:

```markdown
**Bug Title:** Clear, concise description

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Screenshots:**
Add screenshots if applicable

**Environment:**
- Browser: Chrome 120
- Device: iPhone 15 Pro
- OS: iOS 17.2
- Screen size: 390x844

**Console Errors:**
Paste any console errors here

**Additional Context:**
Any other relevant information
```

---

## Success Criteria

The V6 integration is considered successful when:

- [x] All core flows work end-to-end
- [ ] No critical bugs identified
- [ ] Performance meets targets
- [ ] Mobile experience is smooth
- [ ] Data persists correctly
- [ ] Error handling works properly
- [ ] Navigation is intuitive
- [ ] Design is consistent across pages

---

## Testing Checklist Summary

**Core Functionality:**
- [ ] Scan item with AI analysis
- [ ] Create listing (sale)
- [ ] Create listing (rent)
- [ ] Upload images to Firebase
- [ ] Capture geolocation
- [ ] View pins on map
- [ ] Reserve pin
- [ ] Claim pin
- [ ] Cancel reservation
- [ ] Delete listing

**User Experience:**
- [ ] Mobile camera works
- [ ] Responsive design
- [ ] Navigation flows
- [ ] Loading states
- [ ] Error messages
- [ ] Success feedback

**Technical:**
- [ ] Firestore integration
- [ ] Storage integration
- [ ] Authentication
- [ ] Geolocation
- [ ] Image optimization
- [ ] Performance

---

## Next Steps After Testing

1. Document all bugs found
2. Prioritize fixes (critical first)
3. Implement eBay integration
4. Add search/filter functionality
5. Implement messaging system
6. Add push notifications
7. Create mobile app version

---

**Happy Testing! 🚀**

Report any issues you find and we'll address them promptly.
