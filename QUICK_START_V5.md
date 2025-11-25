# ThriftSpot v5 - Quick Start Guide

## 🚀 Getting Started

### View the New Design

Simply open the new v5 files in your browser:

1. **Main App**: `public/index-v5.html`
2. **Sign In**: `public/signin-v5.html`
3. **Dashboard**: `public/dashboard-v5.html`
4. **Profile**: `public/profile-v5.html`

### Testing Locally

```bash
# If using Firebase hosting emulator
firebase serve

# Or use any local server
python -m http.server 8000
# Then visit: http://localhost:8000/public/index-v5.html
```

## 📋 Configuration Checklist

### 1. Stripe Setup (Required for Checkout)
Edit `public/js/app-v5.js` line 695:
```javascript
this.stripe = Stripe('pk_test_YOUR_STRIPE_PUBLIC_KEY');
```

Get your key from: https://dashboard.stripe.com/apikeys

### 2. Weather Widget (Optional)
Edit `public/js/app-v5.js` line 730:
```javascript
const API_KEY = 'your_openweathermap_key';
```

Get a free key from: https://openweathermap.org/api

### 3. Backend API (Already Configured)
The app expects these endpoints to exist:
- ✅ `/api/analyze-json` - Already implemented
- ✅ `/api/pins` - Already implemented
- ✅ `/api/purchases` - Already implemented
- ✅ `/api/stripe-webhooks` - Already implemented

## 🎯 Key Features to Test

### 1. Camera Capture (Mobile)
- Open `index-v5.html` on your phone
- Grant camera permission
- Point at an item and capture

### 2. Image Analysis
- Upload photos (desktop) or capture (mobile)
- Watch the telescope loading animation
- See 5 stages: Upload → AI → Category → Pricing → Complete

### 3. eBay Listings Display
- After analysis completes, scroll down in results
- View recent eBay sold items
- Builds trust in pricing estimates

### 4. Listing Preview
- Click "Preview Listing"
- Edit any field inline
- Toggle listing options (offers, locality, eBay)
- Add/remove photos
- **Try adding new photos** - you'll see the re-analysis prompt!

### 5. Map View
- Click "Thrift" in bottom navigation
- View pins on map
- Click a pin to see details
- Try the "Show Grid" toggle

### 6. Purchase Flow
- Click a non-SOLD pin on map
- Click "Purchase"
- Fill out payment form
- See checkout total

### 7. Dashboard
- View your active and sold listings
- Filter by status
- See earnings stats

## 🎨 Customization

### Change Colors
Edit `public/css/thriftspot-mobile.css`:
```css
:root {
    --primary-500: #6366f1;  /* Your brand color */
    --telescope-blue: #3b82f6;  /* Loading ring color */
    --sold-red: #dc2626;  /* SOLD badge color */
}
```

### Adjust Animations
Edit animation speeds:
```css
:root {
    --transition-fast: 150ms;
    --transition-base: 250ms;
    --transition-slow: 400ms;
}
```

## 🐛 Troubleshooting

### Camera Not Working
**Issue**: "Camera access denied" error

**Solutions**:
1. Ensure you're on HTTPS (not HTTP)
2. Check browser permissions
3. Try a different browser
4. Fallback to file upload will appear automatically

### Analysis Stuck at 0%
**Issue**: Image analysis doesn't progress

**Solutions**:
1. Check browser console for errors
2. Verify Firebase connection
3. Check backend API is running
4. Verify `/api/analyze-json` endpoint is accessible

### Map Not Loading
**Issue**: Blank map or tiles not appearing

**Solutions**:
1. Check internet connection
2. Verify Leaflet CDN is accessible
3. Check browser console for errors
4. Ensure Firebase has pins data

### Stripe Not Working
**Issue**: "Stripe is not defined" error

**Solutions**:
1. Add Stripe public key in `app-v5.js`
2. Ensure Stripe script loads (check network tab)
3. Use test keys for development

## 📱 Mobile Testing

### iOS Safari
1. Connect iPhone via USB
2. Enable Web Inspector in Safari settings
3. Open `index-v5.html`
4. Test camera, bottom nav, touch interactions

### Android Chrome
1. Enable USB debugging on phone
2. Connect via USB
3. Open chrome://inspect
4. Test camera, responsive design

## 🔄 Migration to Production

### Option A: Replace Current Files
```bash
# Backup originals
cp public/index.html public/index-backup.html
cp public/signin.html public/signin-backup.html
cp public/dashboard.html public/dashboard-backup.html
cp public/profile.html public/profile-backup.html

# Replace with v5
mv public/index-v5.html public/index.html
mv public/signin-v5.html public/signin.html
mv public/dashboard-v5.html public/dashboard.html
mv public/profile-v5.html public/profile.html
```

### Option B: Gradual Rollout
Add a banner to existing pages:
```html
<div class="beta-banner">
  🎉 <a href="index-v5.html">Try our new beta design!</a>
</div>
```

### Update Internal Links
Search and replace in all files:
- `href="index.html"` → `href="index-v5.html"`
- `href="signin.html"` → `href="signin-v5.html"`
- `href="dashboard.html"` → `href="dashboard-v5.html"`
- `href="profile.html"` → `href="profile-v5.html"`

## 🎬 Demo Flow

Perfect walkthrough for showcasing the new design:

1. **Start**: Open `index-v5.html`
2. **Camera**: Grant permission and show circular viewfinder
3. **Capture**: Take photo of an item (or upload)
4. **Analyze**: Watch telescope animation progress through stages
5. **Results**: Show item details and eBay recent sales
6. **Edit**: Open listing preview, add photo, trigger re-analysis prompt
7. **Publish**: Toggle options, publish listing
8. **Success**: Show success modal
9. **Map**: Switch to Thrift mode, show pin on map
10. **Purchase**: Click pin (different item), show checkout flow
11. **SOLD**: Show SOLD badge on purchased item
12. **Profile**: Navigate to profile, show stats and settings

## 📊 Performance Tips

### Optimize Images
Already included! Images auto-compress to:
- Max size: 800KB
- Max dimension: 1200px
- Using web worker for faster processing

### Lazy Loading
Already implemented:
- Map loads only when entering Thrift mode
- Stripe loads only when opening checkout
- Firebase modules load as needed

### Caching
Add to improve performance:
```javascript
// In app-v5.js, cache analysis results
localStorage.setItem(`analysis_${imageHash}`, JSON.stringify(result));
```

## 🎯 Next Steps

1. **Configure Stripe** - Add your public key
2. **Test on mobile** - iPhone and Android
3. **Gather feedback** - Show to beta users
4. **Monitor performance** - Check Lighthouse scores
5. **Plan dark mode** - If desired
6. **Add notifications** - Push notifications for offers

## 📚 Documentation

- **Full details**: See `FRONTEND_REDESIGN_V5.md`
- **Code examples**: Check inline comments in source files
- **API reference**: See existing backend documentation

## 🆘 Need Help?

### Common Questions

**Q: Can I use the old design alongside v5?**
A: Yes! Keep both and link between them.

**Q: Will this work without Firebase?**
A: No, Firebase Auth and Firestore are required.

**Q: Can I customize the telescope animation?**
A: Yes! Edit `telescope-loader.js` and adjust colors/speeds.

**Q: How do I enable dark mode?**
A: Toggle exists in profile, but dark theme CSS needs implementation.

**Q: Is this production-ready?**
A: Almost! Just add Stripe key and test thoroughly.

## ✅ Pre-Launch Checklist

- [ ] Configure Stripe public key
- [ ] Test camera on iOS and Android
- [ ] Test full flow: spot → analyze → list → purchase
- [ ] Verify eBay listings display correctly
- [ ] Test photo re-analysis prompt
- [ ] Check SOLD badges appear correctly
- [ ] Test on multiple browsers
- [ ] Run Lighthouse audit (target >90)
- [ ] Check accessibility with screen reader
- [ ] Verify all links work
- [ ] Test error states (network offline, etc.)
- [ ] Load test with multiple pins on map
- [ ] Verify Firebase security rules
- [ ] Set up Stripe webhooks
- [ ] Configure production domains

---

**Ready to launch!** 🚀

For detailed technical documentation, see `FRONTEND_REDESIGN_V5.md`
