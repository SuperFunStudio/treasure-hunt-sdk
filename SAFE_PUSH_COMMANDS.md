# 🚀 Safe Commands to Push Your Code to GitHub

## ⚠️ Security First!

I've updated `.gitignore` to protect these sensitive files:
- ✅ `service-account-key.json` (won't be uploaded)
- ✅ `secrets.txt` (won't be uploaded)
- ✅ Firebase configs in mobile folder (won't be uploaded)

## Step 1: Verify What Will Be Committed

```powershell
cd C:\Users\kenny\treasure-hunt-sdk

# See what will be added
git status

# Double-check no secrets will be committed
git add -n .
```

Look for these files - they should NOT appear:
- ❌ service-account-key.json
- ❌ secrets.txt
- ❌ google-services.json
- ❌ GoogleService-Info.plist

## Step 2: Add Your Changes

```powershell
# Add the .gitignore updates
git add .gitignore

# Add mobile app
git add mobile/

# Add documentation
git add MOBILE_APP_GUIDE.md GEOHASH_BUG_RESOLUTION.md IMPLEMENTATION_SUMMARY.md PIN_DEBUG_GUIDE.md PROGRESSIVE_ANALYSIS_API.md QUICK_START.md

# Add new backend code (be selective!)
git add functions/capture-sdk/pins/
git add functions/capture-sdk/utils/vehicle-detector.js
git add functions/config/endpoints.js
git add functions/models/PinModel.js
git add functions/routes/location.js
git add functions/routes/pins.js
git add functions/routes/subscription.js
git add functions/services/affiliate/
git add functions/services/ebay/categoryRequirementsService.js
git add functions/services/ebay/marketDataService.js
git add functions/services/location/
git add functions/services/subscription/
git add functions/utils/category-detector.js
git add functions/utils/categoryCache.js
git add functions/utils/firebase-storage-helper.js
git add functions/utils/item-specifics-validator.js
git add functions/utils/price-validator.js

# Add new public files
git add public/css/
git add public/ebay-oauth-callback.html
git add public/ebay-oauth-error.html
git add public/js/dashboard.js
git add public/js/global-fixes.js
git add public/js/image-gallery.js
git add public/js/listing-preview.js
git add public/js/pin-enhanced-display.js
git add public/js/pin-manager.js
git add public/js/progressive-analysis.js
git add public/js/scan-editor.js
git add public/js/scan-progressive.js
git add public/js/scan-redesign.js
git add public/js/scan-simple.js
git add public/pin-map.html
git add public/privacy-policy.html
git add public/shared/
```

## Step 3: Commit Modified Files

```powershell
# Add all modified files
git add -u
```

## Step 4: Create Commit

```powershell
git commit -m "Add React Native mobile app and latest features

Features added:
- React Native mobile app for iOS and Android
- Progressive analysis API
- Pin/location management
- Enhanced eBay integration
- Subscription service
- Category detection improvements
- Comprehensive documentation

Mobile app includes:
- Authentication screens
- Camera integration
- Progressive analysis with real-time updates
- eBay listing creation
- Cross-platform (iOS + Android)
- Full setup guides for PC and Mac"
```

## Step 5: Push to GitHub

```powershell
# Push to your existing repo
git push origin main
```

## ✅ Verify on GitHub

Go to: https://github.com/SuperFunStudio/treasure-hunt-sdk

Check:
- ✅ `mobile/` folder exists
- ✅ Documentation files are there
- ❌ NO `service-account-key.json` visible
- ❌ NO `secrets.txt` visible
- ❌ NO `google-services.json` visible

## 🆘 If You Accidentally Committed Secrets

**STOP! Don't push yet!**

```powershell
# Undo the last commit (keeps your changes)
git reset --soft HEAD~1

# Or completely undo (loses changes)
git reset --hard HEAD~1

# Remove file from git tracking
git rm --cached functions/service-account-key.json
git rm --cached secrets.txt

# Add to .gitignore (already done above)
# Then commit again without the secrets
```

## 📋 Quick Checklist

Before pushing:
- [ ] Updated `.gitignore` with sensitive files
- [ ] Ran `git status` to verify what's being committed
- [ ] NO service-account-key.json
- [ ] NO secrets.txt
- [ ] NO Firebase config files
- [ ] Mobile app folder is included
- [ ] Documentation is included
- [ ] Commit message is descriptive

## 🚀 All Good? Push It!

```powershell
git push origin main
```

## 📱 Then on Mac

```bash
git clone https://github.com/SuperFunStudio/treasure-hunt-sdk.git
cd treasure-hunt-sdk/mobile
npm install
cd ios && pod install && cd ..
open ios/TreasureHuntMobile.xcworkspace
```

---

**Remember:** Firebase config files (`google-services.json` and `GoogleService-Info.plist`) must be downloaded separately on each machine!
