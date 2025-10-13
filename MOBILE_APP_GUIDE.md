# Treasure Hunt Mobile App - Complete Guide

## Overview

This guide covers creating a **React Native mobile app** for iOS and Android that connects to your existing Treasure Hunt SDK Firebase backend.

## What We've Created

A complete React Native app with:

✅ **Authentication** - Sign in/sign up with Firebase Auth
✅ **Camera Integration** - Capture photos or choose from gallery
✅ **Progressive Analysis** - Fast preliminary results, then market pricing
✅ **Results Display** - Beautiful analysis results with pricing
✅ **eBay Integration** - Create listings from analyzed items
✅ **Cross-platform** - Same code runs on iOS and Android

## Quick Start

### Prerequisites

You'll need:

1. **Development Machine:**
   - Windows (for Android) or macOS (for iOS + Android)
   - Node.js 18+ (you have v20.16.0 ✅)
   - Git

2. **For iOS Development (macOS only):**
   - Xcode 15+
   - CocoaPods
   - Apple Developer Account ($99/year)

3. **For Android Development:**
   - Android Studio
   - Android SDK
   - JDK 17+

### Installation Steps

```bash
# Navigate to the mobile folder
cd mobile

# Install dependencies
npm install

# For iOS (macOS only)
cd ios && pod install && cd ..

# Run on iOS (macOS only)
npm run ios

# Run on Android
npm run android
```

## File Structure

```
mobile/
├── src/
│   ├── screens/
│   │   ├── SignInScreen.tsx          # Login/signup
│   │   ├── DashboardScreen.tsx       # Main screen
│   │   ├── CameraScreen.tsx          # Photo capture
│   │   ├── AnalysisResultScreen.tsx  # Results with pricing
│   │   └── ListingPreviewScreen.tsx  # eBay listing creator
│   └── services/
│       ├── FirebaseService.ts        # Firebase integration
│       └── AnalysisService.ts        # Progressive analysis
├── App.tsx                           # Navigation setup
├── package.json                      # Dependencies
└── README.md                         # Detailed setup instructions
```

## How It Works

### 1. Authentication Flow
- User signs in/up with email & password
- Firebase Auth creates/validates account
- Token stored for API calls

### 2. Image Capture Flow
- User taps "Scan New Item"
- Chooses camera or gallery
- Selects 1-10 photos
- Proceeds to analysis

### 3. Analysis Flow (Progressive)
```
Upload Images (2s)
    ↓
Preliminary Analysis (3-4s) ← User sees results here!
    ↓
Market Pricing (4-6s)
    ↓
Final Results (Complete)
```

### 4. Listing Creation Flow
- Review AI-generated title/description
- Adjust price if needed
- Publish to eBay (via your Cloud Function)

## Configuration Required

### 1. Firebase Setup

You need to download Firebase config files:

**For iOS:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Your project → Project Settings → iOS apps
3. Download `GoogleService-Info.plist`
4. Place in `mobile/ios/TreasureHuntMobile/`

**For Android:**
1. Same Firebase Console
2. Android apps section
3. Download `google-services.json`
4. Place in `mobile/android/app/`

### 2. Update API Endpoint

Edit `mobile/src/screens/AnalysisResultScreen.tsx`:

```typescript
// Line 23: Change this URL
const baseUrl = 'https://YOUR-FIREBASE-PROJECT.cloudfunctions.net';
```

Find your URL:
- Firebase Console → Functions
- Copy the base URL (before `/api/...`)

### 3. Bundle ID Configuration

Update these to match your Apple/Google accounts:

**File: `mobile/app.json`**
```json
{
  "bundleId": "com.yourcompany.treasurehunt",  // Change this
  "package": "com.yourcompany.treasurehunt"     // Change this
}
```

Then update in:
- **iOS:** Xcode project settings
- **Android:** `android/app/build.gradle`

## Beta Testing Distribution

### Option 1: TestFlight (iOS) ⭐ Recommended

**Steps:**

1. **Build Archive in Xcode**
   - Open `mobile/ios/TreasureHuntMobile.xcworkspace`
   - Select "Any iOS Device" as destination
   - Product → Archive
   - Wait 5-10 minutes

2. **Upload to App Store Connect**
   - Window → Organizer
   - Select your archive → Distribute App
   - Choose "App Store Connect"
   - Upload automatically = Yes
   - Wait 10-60 minutes for processing

3. **Configure TestFlight**
   - Log in to [App Store Connect](https://appstoreconnect.apple.com)
   - Select your app
   - TestFlight tab
   - Click on the build that just appeared

4. **Add Testers**

   **Internal Testing (instant, no review):**
   - Up to 100 testers
   - Add their App Store Connect accounts
   - They get instant access

   **External Testing (24-48hr review):**
   - Up to 10,000 testers
   - Add email addresses
   - Submit for "Beta App Review"
   - Apple reviews (usually 24-48hrs)
   - Creates public link option

5. **Testers Install**
   - Testers download "TestFlight" app from App Store
   - Accept email invitation
   - Install your app
   - Test and provide feedback

**TestFlight Benefits:**
- Professional beta testing platform
- Crash reporting built-in
- Easy updates (new builds auto-notify testers)
- 90 days per build
- FREE (just needs $99/year Developer Account)

### Option 2: Google Play Internal Testing (Android)

**Steps:**

1. **Generate Release Signing Key**
   ```bash
   cd mobile/android/app
   keytool -genkeypair -v -storetype PKCS12 \
     -keystore release.keystore \
     -alias release \
     -keyalg RSA \
     -keysize 2048 \
     -validity 10000
   ```

   - Enter password (remember this!)
   - Save `release.keystore` securely

2. **Configure Signing**

   Edit `mobile/android/gradle.properties`:
   ```properties
   RELEASE_STORE_FILE=release.keystore
   RELEASE_KEY_ALIAS=release
   RELEASE_STORE_PASSWORD=your-password
   RELEASE_KEY_PASSWORD=your-password
   ```

3. **Build Release Bundle**
   ```bash
   cd mobile/android
   ./gradlew bundleRelease
   ```

   Output: `app/build/outputs/bundle/release/app-release.aab`

4. **Upload to Google Play Console**
   - Go to [play.google.com/console](https://play.google.com/console)
   - Create app (one-time $25 fee)
   - Testing → Internal testing
   - Create new release
   - Upload AAB file

5. **Add Testers**
   - Create email list in Play Console
   - Add tester emails (up to 100)
   - Or create opt-in URL for anyone

6. **Testers Install**
   - Click the opt-in URL
   - Install from Google Play Store
   - Test the app

**Google Play Benefits:**
- Up to 100 internal testers
- Unlimited closed testing track
- Integrated with Play Store
- Crash reporting via Play Console

## Development Workflow

### Making Changes

1. **Edit Code**
   - Modify screens in `src/screens/`
   - Update styles in component StyleSheet
   - Hot reload shows changes instantly

2. **Test Locally**
   ```bash
   # iOS Simulator
   npm run ios

   # Android Emulator
   npm run android
   ```

3. **Build New Version**
   - Update version in `app.json`
   - Archive and upload to TestFlight/Play Console
   - Testers auto-notified of update

### Debugging

**React Native Debugger:**
- Shake device → "Debug" → Opens Chrome DevTools
- `console.log()` statements appear here

**iOS:**
- Xcode → Product → Run
- View logs in Xcode console

**Android:**
- `npx react-native log-android`
- View Metro bundler output

## Common Issues & Solutions

### "No Bundle URL Present" (iOS)

**Solution:**
```bash
# Reset Metro bundler
npm start -- --reset-cache

# In new terminal
npm run ios
```

### "Command PhaseScriptExecution failed" (iOS)

**Solution:**
```bash
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

### "SDK Location Not Found" (Android)

**Solution:**
Create `android/local.properties`:
```
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
# Or on Windows:
# sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
```

### Firebase Connection Fails

**Checklist:**
- [ ] `GoogleService-Info.plist` in correct location (iOS)
- [ ] `google-services.json` in correct location (Android)
- [ ] Bundle ID matches Firebase console
- [ ] Firebase Auth enabled in console
- [ ] Rebuild app after adding config files

### Camera Permissions Denied

**iOS:** Add to `Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to scan items</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need photo access to analyze items</string>
```

**Android:** Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

## Customization Ideas

### Branding
- Update colors in StyleSheet definitions
- Add your logo to assets
- Change app name in `app.json`

### Features to Add
- [ ] Push notifications for listing sales
- [ ] Offline mode (cache analyses)
- [ ] Social sharing
- [ ] Barcode scanning
- [ ] In-app eBay listing management
- [ ] Price alerts
- [ ] Sales analytics dashboard

### Performance Improvements
- Enable Hermes JavaScript engine (Android)
- Add image compression before upload
- Implement pagination for scan history
- Cache Firebase auth token

## Production Deployment

### iOS App Store

1. **Complete App Store Connect Setup**
   - App name, description, screenshots
   - Privacy policy URL
   - App categories and keywords
   - Pricing (free/paid)

2. **Submit for Review**
   - Upload final build via Xcode
   - Submit for App Review
   - Wait 1-7 days for approval

3. **Release**
   - Once approved, set release date
   - App goes live on App Store

### Google Play Store

1. **Complete Store Listing**
   - App description, screenshots
   - Privacy policy
   - Content rating questionnaire
   - Target age groups

2. **Production Release**
   - Promote internal test build → Production
   - Submit for review
   - Usually approved in 1-3 days

3. **Go Live**
   - App appears on Play Store
   - Can do staged rollout (10%, 25%, etc.)

## Cost Breakdown

### Development (One-time)
- ✅ React Native: **FREE**
- ✅ Firebase (Spark plan): **FREE** (for testing)
- ✅ Development tools: **FREE**

### Distribution (Annual)
- 💰 Apple Developer: **$99/year** (required for TestFlight + App Store)
- 💰 Google Play: **$25 one-time** (lifetime access)

### Running Costs (Monthly)
- Firebase Blaze plan: Pay-as-you-go
  - Free tier: 50K reads, 20K writes/day
  - Storage: $0.18/GB
  - Functions: 2M invocations free
- Estimated: **$0-50/month** for 100-1000 users

## Next Steps

### Week 1: Setup
- [ ] Install prerequisites (Xcode/Android Studio)
- [ ] Clone project and run `npm install`
- [ ] Add Firebase config files
- [ ] Run on simulator/emulator

### Week 2: Customize
- [ ] Update branding (colors, name, logo)
- [ ] Test all features with your backend
- [ ] Fix any API endpoint issues
- [ ] Add error handling

### Week 3: Beta Testing
- [ ] Create Apple Developer account
- [ ] Build and upload to TestFlight
- [ ] Invite 5-10 internal testers
- [ ] Gather feedback

### Week 4: Polish
- [ ] Fix bugs from beta testing
- [ ] Add analytics/crash reporting
- [ ] Create App Store screenshots
- [ ] Write store description

### Week 5: Launch
- [ ] Submit to App Store review
- [ ] Set up Play Store listing
- [ ] Prepare marketing materials
- [ ] Launch! 🚀

## Resources

- **React Native:** https://reactnative.dev
- **Firebase React Native:** https://rnfirebase.io
- **TestFlight Setup:** https://developer.apple.com/testflight/
- **Play Console:** https://play.google.com/console
- **App Store Connect:** https://appstoreconnect.apple.com

## Questions?

Check the detailed [mobile/README.md](mobile/README.md) for:
- Step-by-step installation
- Troubleshooting guide
- Advanced configuration
- Testing strategies

---

**Ready to build?** Start with:
```bash
cd mobile
npm install
```

Then follow the README setup instructions!
