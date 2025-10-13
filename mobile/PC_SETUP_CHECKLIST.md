# PC Setup Checklist for Android Development

## ✅ Completed Steps

- [x] npm install successful (906 packages installed)
- [x] `android/local.properties` created with SDK path

## 📋 Next Steps

### 1. Install Android Studio (if not installed)

**Download:** https://developer.android.com/studio

**During installation, make sure to check:**
- ✅ Android SDK
- ✅ Android SDK Platform
- ✅ Android Virtual Device
- ✅ Performance (Intel HAXM or AMD Hypervisor)

**After installation:**
- Open Android Studio
- Go through the setup wizard
- It will download SDK components

### 2. Download Firebase Config

**Follow this guide:** [FIREBASE_SETUP_PC.md](FIREBASE_SETUP_PC.md)

**Quick version:**
1. Go to https://console.firebase.google.com/
2. Select your project
3. Settings ⚙️ → Project settings
4. Scroll to "Your apps" → Android app
5. Download `google-services.json`
6. Move to: `C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\google-services.json`

### 3. Update API URL

Edit: `mobile\src\screens\AnalysisResultScreen.tsx`

Line 23:
```typescript
const baseUrl = 'https://YOUR-PROJECT.cloudfunctions.net';
```

Find your URL in Firebase Console → Functions

### 4. Create Android Emulator

**In Android Studio:**
1. Tools → Device Manager (or AVD Manager)
2. Click "Create Virtual Device"
3. Choose a phone (e.g., Pixel 5)
4. Download a system image (e.g., Android 13 - API 33)
5. Click Finish

### 5. Run the App

**In PowerShell:**

```powershell
# Terminal 1: Start Metro bundler
cd C:\Users\kenny\treasure-hunt-sdk\mobile
npm start

# Terminal 2: Build and run Android
cd C:\Users\kenny\treasure-hunt-sdk\mobile
npm run android
```

**First run takes 5-10 minutes to build!**

## 🔧 Troubleshooting

### If `npm run android` fails:

**Check Java is installed:**
```powershell
java -version
```
Should show version 17 or higher. If not:
- Download JDK 17: https://adoptium.net/

**Check Android SDK path:**
```powershell
ls C:\Users\kenny\AppData\Local\Android\Sdk
```
Should show folders like `platform-tools`, `platforms`, etc.

**Check emulator is running:**
```powershell
adb devices
```
Should show a device listed.

### If Metro bundler fails:

**Clear cache:**
```powershell
npm start -- --reset-cache
```

### If build succeeds but app crashes:

**Check Firebase config:**
```powershell
ls C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\google-services.json
```
Must exist!

**Check logs:**
```powershell
npx react-native log-android
```

## 📱 Testing on Real Android Device

Instead of emulator, you can use a real phone:

1. **Enable Developer Options on phone:**
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back → Developer Options now visible

2. **Enable USB Debugging:**
   - In Developer Options
   - Turn on "USB Debugging"

3. **Connect phone via USB:**
   - Plug in phone
   - Accept "Allow USB debugging?" prompt
   - In PowerShell: `adb devices` should show your device

4. **Run app:**
   ```powershell
   npm run android
   ```
   It will install on your phone instead of emulator!

## 🚀 For Beta Testing (Google Play)

Once your app works:

1. **Generate release keystore:**
   ```powershell
   cd android\app
   keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Build release APK:**
   ```powershell
   cd android
   .\gradlew assembleRelease
   ```
   Output: `app\build\outputs\apk\release\app-release.apk`

3. **Share APK for testing:**
   - Send APK file to testers
   - They install it on their Android phones
   - No Play Store needed for testing!

4. **Or upload to Google Play Console:**
   - Create account: https://play.google.com/console ($25 one-time)
   - Upload APK to Internal Testing track
   - Add tester emails
   - They get link to download

## ✨ What You Get

Once running, you'll have:
- 📱 Native Android app
- 🔐 Firebase authentication
- 📸 Camera for item scanning
- 🤖 AI analysis with your backend
- 💰 Price estimates
- 📦 eBay listing creation

All using your existing Firebase backend!

## 💡 Pro Tips

**Development Speed:**
- Use real device instead of emulator (faster)
- Keep Metro bundler running between builds
- Enable Fast Refresh in app (shake device → Enable Fast Refresh)

**Debugging:**
- Shake device → "Debug" → Opens Chrome DevTools
- `console.log()` appears in debugger
- Or use `npx react-native log-android` to see logs

**Hot Reload:**
- Save file → See changes instantly
- No need to rebuild for code changes
- Rebuilding only needed for native changes

## 📚 Resources

- **React Native Docs:** https://reactnative.dev/docs/environment-setup
- **Android Setup:** https://reactnative.dev/docs/environment-setup?platform=android
- **Firebase Android:** https://firebase.google.com/docs/android/setup
- **Troubleshooting:** https://reactnative.dev/docs/troubleshooting

## Need Help?

Common issues and solutions in [mobile/README.md](README.md)

Firebase setup in [FIREBASE_SETUP_PC.md](FIREBASE_SETUP_PC.md)
