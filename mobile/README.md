# Treasure Hunt Mobile App

React Native mobile app for iOS and Android that connects to your existing Firebase backend.

## Features

- 📸 Camera & photo gallery integration
- 🤖 AI-powered item analysis
- 💰 Market pricing estimates
- 📦 eBay listing creation
- 🔐 Firebase authentication
- ⚡ Progressive analysis (fast preliminary results)

## Prerequisites

- **Node.js** 18+ (you have v20.16.0 ✅)
- **npm** or **yarn**
- **For iOS:**
  - macOS with Xcode 15+
  - CocoaPods (`sudo gem install cocoapods`)
  - Apple Developer Account ($99/year for TestFlight distribution)
- **For Android:**
  - Android Studio
  - Android SDK
  - Java Development Kit (JDK) 17+

## Setup Instructions

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure Firebase

You need to add your Firebase configuration files:

#### iOS Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → iOS apps
4. Download `GoogleService-Info.plist`
5. Place it in `mobile/ios/TreasureHuntMobile/`

#### Android Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → Android apps
4. Download `google-services.json`
5. Place it in `mobile/android/app/`

### 3. Update API URL

Edit `src/screens/AnalysisResultScreen.tsx` and update the Firebase Cloud Functions URL:

```typescript
const baseUrl = 'https://YOUR-PROJECT-ID.cloudfunctions.net';
```

Replace with your actual Firebase project URL.

### 4. iOS Specific Setup

```bash
cd ios
pod install
cd ..
```

### 5. Run the App

#### iOS (macOS only)

```bash
npm run ios
```

Or open `ios/TreasureHuntMobile.xcworkspace` in Xcode and click Run.

#### Android

```bash
npm run android
```

Make sure you have an Android emulator running or a device connected.

## Project Structure

```
mobile/
├── src/
│   ├── screens/           # UI screens
│   │   ├── SignInScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── CameraScreen.tsx
│   │   ├── AnalysisResultScreen.tsx
│   │   └── ListingPreviewScreen.tsx
│   └── services/          # Business logic
│       ├── FirebaseService.ts
│       └── AnalysisService.ts
├── App.tsx               # Main navigation
├── package.json
└── README.md
```

## Building for Production

### iOS - TestFlight Distribution

1. **Open Xcode**
   ```bash
   cd ios
   open TreasureHuntMobile.xcworkspace
   ```

2. **Configure Signing**
   - Select the project in Xcode
   - Go to Signing & Capabilities
   - Select your team
   - Ensure "Automatically manage signing" is checked

3. **Archive the App**
   - Select "Any iOS Device" as the destination
   - Product → Archive
   - Wait for archive to complete

4. **Upload to App Store Connect**
   - Window → Organizer
   - Select your archive
   - Click "Distribute App"
   - Choose "App Store Connect"
   - Follow the prompts

5. **Configure TestFlight**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Select your app
   - Go to TestFlight tab
   - Add internal/external testers
   - Submit for Beta App Review (external only)

6. **Invite Testers**
   - Add tester emails in TestFlight
   - Or create a public link
   - Testers download TestFlight app
   - They receive invitation to test

### Android - Google Play Internal Testing

1. **Generate Signing Key**
   ```bash
   cd android/app
   keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure Gradle**
   Edit `android/gradle.properties`:
   ```
   RELEASE_STORE_FILE=release.keystore
   RELEASE_KEY_ALIAS=release
   RELEASE_STORE_PASSWORD=your-password
   RELEASE_KEY_PASSWORD=your-password
   ```

3. **Build Release APK/AAB**
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`

4. **Upload to Google Play Console**
   - Go to [Google Play Console](https://play.google.com/console)
   - Create an app
   - Go to Testing → Internal testing
   - Create a new release
   - Upload the AAB file
   - Add testers by email or create a link

## Troubleshooting

### iOS Build Errors

**Error: "No bundle URL present"**
```bash
npm start -- --reset-cache
```

**Error: CocoaPods issues**
```bash
cd ios
pod deintegrate
pod install
```

### Android Build Errors

**Error: "SDK location not found"**
Create `android/local.properties`:
```
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

**Error: "Duplicate class"**
```bash
cd android
./gradlew clean
```

### Firebase Connection Issues

- Verify `GoogleService-Info.plist` (iOS) is in the correct location
- Verify `google-services.json` (Android) is in the correct location
- Check Firebase project settings match your bundle ID
- Ensure Firebase Authentication is enabled in console

## Next Steps

1. **Customize Branding**
   - Update app name in `app.json`
   - Add app icon and splash screen
   - Customize colors in screen styles

2. **Add Features**
   - Push notifications for listing updates
   - Offline mode with local storage
   - Share listings to social media
   - In-app purchases for premium features

3. **Testing**
   - Write unit tests with Jest
   - Add E2E tests with Detox
   - Test on multiple devices

4. **Performance**
   - Enable Hermes engine (Android)
   - Optimize image sizes
   - Add caching for API calls

## Resources

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Firebase iOS Setup](https://firebase.google.com/docs/ios/setup)
- [Firebase Android Setup](https://firebase.google.com/docs/android/setup)
- [TestFlight Guide](https://developer.apple.com/testflight/)
- [Google Play Console](https://support.google.com/googleplay/android-developer)

## Support

For issues specific to:
- **React Native**: Check [React Native GitHub](https://github.com/facebook/react-native)
- **Firebase**: Check [Firebase Support](https://firebase.google.com/support)
- **This App**: Contact your development team

## License

Private - All rights reserved
