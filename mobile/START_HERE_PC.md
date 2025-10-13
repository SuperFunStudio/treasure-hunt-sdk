# 🚀 START HERE - PC Setup for Android App

> **You're on Windows PC, so you can build Android only (iOS needs Mac)**

## ✅ What's Already Done

- [x] React Native project created
- [x] npm install successful (906 packages)
- [x] Android SDK path configured
- [x] All code files ready

## 📋 What You Need To Do (In Order)

### 1. Install Android Studio (30 min)

**Download:** https://developer.android.com/studio

**Install with these options:**
- ✅ Android SDK
- ✅ Android SDK Platform
- ✅ Android Virtual Device
- ✅ Performance (HAXM/Hypervisor)

After install, open Android Studio and complete setup wizard.

---

### 2. Download Firebase Config (5 min)

**Visual guide:** [FIREBASE_DOWNLOAD_GUIDE.md](FIREBASE_DOWNLOAD_GUIDE.md)

**Quick steps:**
1. Go to https://console.firebase.google.com/
2. Select your project
3. Settings ⚙️ → Project settings
4. Your apps → Android app → Download `google-services.json`
5. Move file to: `C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\`

**Verify:**
```powershell
ls C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\google-services.json
```

---

### 3. Create Android Emulator (10 min)

**In Android Studio:**
1. Tools → Device Manager (or AVD Manager)
2. Create Virtual Device
3. Select: Pixel 5 (or any phone)
4. Download system image: Android 13 (API 33)
5. Finish

---

### 4. Update API URL (2 min)

**Edit:** `mobile\src\screens\AnalysisResultScreen.tsx`

**Line 23:** Change this:
```typescript
const baseUrl = 'https://YOUR-PROJECT.cloudfunctions.net';
```

**Find your URL:**
- Firebase Console → Functions
- Copy base URL (before `/api/...`)

---

### 5. Run the App! (5 min first time)

**Open TWO PowerShell windows:**

**Window 1 - Start Metro:**
```powershell
cd C:\Users\kenny\treasure-hunt-sdk\mobile
npm start
```

**Window 2 - Build & Run:**
```powershell
cd C:\Users\kenny\treasure-hunt-sdk\mobile
npm run android
```

**First build takes 5-10 minutes!** ⏳

App should open in emulator! 🎉

---

## 🆘 Common Issues

### "ANDROID_HOME not set"
```powershell
# Set it (PowerShell as Admin)
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\kenny\AppData\Local\Android\Sdk', 'User')
# Restart PowerShell
```

### "No devices found"
- Open Android Studio → Device Manager
- Click ▶️ on your emulator to start it
- Wait for it to boot (1-2 min)
- Try `npm run android` again

### "google-services.json missing"
- Follow [FIREBASE_DOWNLOAD_GUIDE.md](FIREBASE_DOWNLOAD_GUIDE.md)
- Must be in: `mobile\android\app\google-services.json`
- NOT in: `mobile\android\` (wrong location!)

### "Build failed" errors
- Check you have JDK 17+: `java -version`
- If not, download: https://adoptium.net/
- Clean build: `cd android && .\gradlew clean`

### App crashes on startup
- Check Firebase config is in place
- Check Firebase Auth is enabled in console
- Check logs: `npx react-native log-android`

---

## 📱 Test on Real Phone (Optional)

Instead of emulator:

1. **Phone settings:**
   - Settings → About → Tap "Build number" 7 times
   - Developer options → Enable USB debugging

2. **Connect & run:**
   ```powershell
   adb devices  # Should show your phone
   npm run android  # Installs on phone!
   ```

---

## 🧪 Beta Testing (After It Works)

### Quick Testing (No Play Store)

**Build APK:**
```powershell
cd android
.\gradlew assembleRelease
```

**Share file:**
`app\build\outputs\apk\release\app-release.apk`

Testers install directly on Android phones!

### Google Play Internal Testing

1. Create account: https://play.google.com/console ($25 one-time)
2. Upload APK to Internal Testing
3. Add tester emails
4. They get Play Store link

**Full guide:** [PC_SETUP_CHECKLIST.md](PC_SETUP_CHECKLIST.md)

---

## 📚 All Documentation

Created for you:

| File | What It's For |
|------|---------------|
| **START_HERE_PC.md** (this file) | Quick start overview |
| [FIREBASE_DOWNLOAD_GUIDE.md](FIREBASE_DOWNLOAD_GUIDE.md) | How to get google-services.json |
| [PC_SETUP_CHECKLIST.md](PC_SETUP_CHECKLIST.md) | Complete setup checklist |
| [FIREBASE_SETUP_PC.md](FIREBASE_SETUP_PC.md) | Firebase configuration |
| [README.md](README.md) | Full technical docs |

---

## ✨ What You're Building

A mobile app that:
- 🔐 Signs users in with Firebase
- 📸 Captures photos of items
- 🤖 Analyzes them with AI (your backend)
- 💰 Shows market price estimates
- 📦 Creates eBay listings

All connected to your existing Firebase backend!

---

## 🎯 Success Path

```
Install Android Studio
    ↓
Download google-services.json from Firebase
    ↓
Create Android emulator
    ↓
Update API URL in code
    ↓
npm run android
    ↓
✅ App running!
    ↓
Test features
    ↓
Build release APK
    ↓
Share with testers
    ↓
🚀 Launch!
```

---

## 💡 Pro Tips

**Speed up development:**
- Use real device (faster than emulator)
- Keep Metro running between builds
- Use Fast Refresh (shake → enable)

**Debugging:**
- Shake device → Debug → Chrome DevTools
- Or: `npx react-native log-android`
- `console.log()` shows in debugger

**Hot reload:**
- Edit code → Save → See changes instantly
- No rebuild needed for most changes!

---

## ❓ Questions?

1. **Can't find something?** Check [PC_SETUP_CHECKLIST.md](PC_SETUP_CHECKLIST.md)
2. **Firebase issues?** Check [FIREBASE_SETUP_PC.md](FIREBASE_SETUP_PC.md)
3. **Download help?** Check [FIREBASE_DOWNLOAD_GUIDE.md](FIREBASE_DOWNLOAD_GUIDE.md)
4. **Technical details?** Check [README.md](README.md)

---

## 🚀 Ready? Start Here:

```powershell
# You already did this! ✅
cd C:\Users\kenny\treasure-hunt-sdk\mobile
npm install

# Next: Download google-services.json
# Guide: FIREBASE_DOWNLOAD_GUIDE.md
```

**Let's build your app! 🎉**
