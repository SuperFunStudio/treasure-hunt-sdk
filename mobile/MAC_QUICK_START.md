# 🍎 Mac Quick Start Guide

> **Give this file to whoever has the Mac!**

## Overview

Your React Native app is on GitHub. This guide shows how to build the iOS version on a Mac.

**Time needed:** ~1 hour first time, ~15 min for updates

---

## Prerequisites Checklist

Install these on the Mac (one-time setup):

### 1. Xcode (Required)
- Open **App Store**
- Search "Xcode"
- Install (free, ~12GB, 30-60 min)
- Open Xcode once → Accept license

### 2. Command Line Tools
```bash
xcode-select --install
```
Click "Install" in the popup.

### 3. Homebrew (Package Manager)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Follow the instructions to add Homebrew to PATH.

### 4. Node.js
```bash
brew install node
```

### 5. Watchman
```bash
brew install watchman
```

### 6. CocoaPods
```bash
sudo gem install cocoapods
```

---

## Build iOS App (First Time)

### Step 1: Clone from GitHub

```bash
# Navigate to Documents folder
cd ~/Documents

# Clone the repository
git clone https://github.com/YOUR_USERNAME/treasure-hunt-mobile.git

# Enter project
cd treasure-hunt-mobile
```

### Step 2: Install Dependencies

```bash
# Install Node packages
npm install

# Install iOS dependencies
cd ios
pod install
cd ..
```

### Step 3: Download Firebase Config

1. Go to https://console.firebase.google.com/
2. Select the treasure-hunt project
3. Click ⚙️ → Project settings
4. Scroll to "Your apps" → iOS app
   - If no iOS app, click "Add app" → iOS icon
   - Bundle ID: `com.treasurehunt.app`
   - Register app
5. Download `GoogleService-Info.plist`
6. Move file to: `ios/TreasureHuntMobile/GoogleService-Info.plist`

**Via Finder:**
- Open: `Documents/treasure-hunt-mobile/ios/TreasureHuntMobile/`
- Drag downloaded `GoogleService-Info.plist` here

### Step 4: Open in Xcode

```bash
# Open the workspace (NOT the .xcodeproj!)
open ios/TreasureHuntMobile.xcworkspace
```

⚠️ **Always open `.xcworkspace`, not `.xcodeproj`**

### Step 5: Configure Signing

**In Xcode:**

1. Click **TreasureHuntMobile** project (top of left sidebar)
2. Click **TreasureHuntMobile** target
3. **Signing & Capabilities** tab
4. **Team:** Add your Apple ID if needed
   - Click dropdown → Add Account
   - Sign in with Apple ID
   - Select your account
5. ✅ Check **"Automatically manage signing"**

### Step 6: Add Firebase File to Xcode

**Important:** Xcode needs to know about the Firebase file!

1. In Xcode left sidebar, right-click **TreasureHuntMobile** folder
2. Click **"Add Files to TreasureHuntMobile..."**
3. Navigate to `ios/TreasureHuntMobile/`
4. Select `GoogleService-Info.plist`
5. ✅ Check **"Copy items if needed"**
6. ✅ Under "Add to targets", check **TreasureHuntMobile**
7. Click **Add**

### Step 7: Build & Run

**On Simulator:**
1. Device dropdown (top) → Select "iPhone 15 Pro" (or any)
2. Click ▶️ **Play** button (or press Cmd+R)
3. Wait 2-5 minutes for first build
4. Simulator opens with your app! 🎉

**On Real iPhone:**
1. Connect iPhone via USB cable
2. Unlock iPhone
3. Trust computer if prompted
4. Device dropdown → Select your iPhone
5. Click ▶️ **Play** button
6. **First time:** May say "Untrusted Developer"
   - iPhone: Settings → General → VPN & Device Management
   - Tap your Apple ID → Trust
7. Run again → App installs! 🎉

---

## Update to Latest Code

When there are new changes on GitHub:

```bash
cd ~/Documents/treasure-hunt-mobile

# Get latest code
git pull

# Update dependencies (if package.json changed)
npm install

# Update iOS pods (if needed)
cd ios && pod install && cd ..

# Open and run
open ios/TreasureHuntMobile.xcworkspace
```

Click ▶️ in Xcode to build & run.

---

## Upload to TestFlight (Beta Testing)

### Prerequisites
- Apple Developer Program membership ($99/year)
- App created in App Store Connect

### Step 1: Archive

**In Xcode:**
1. Device dropdown → Select **"Any iOS Device"** (not a specific device!)
2. **Product** menu → **Archive**
3. Wait 5-10 minutes
4. Organizer window opens

### Step 2: Upload to App Store Connect

1. In Organizer, select your archive
2. Click **"Distribute App"**
3. Select **"App Store Connect"** → Next
4. **Upload** → Next
5. Select signing options → Upload
6. Wait 10-60 minutes for Apple to process

### Step 3: Configure TestFlight

1. Go to https://appstoreconnect.apple.com
2. **My Apps** → Select your app (or create new app)
3. **TestFlight** tab
4. Click on the build that just appeared
5. **Test Information:** Fill in "What to Test" notes

### Step 4: Add Testers

**Internal Testing (instant):**
- Add up to 100 users with App Store Connect access
- They get instant access

**External Testing (requires review):**
- Add up to 10,000 testers by email
- Submit for **Beta App Review** (24-48 hours)
- Once approved, testers get invitations

### Step 5: Testers Install

Testers:
1. Download **TestFlight** app from App Store
2. Check email for invitation
3. Accept invitation
4. Install and test your app
5. Can provide feedback via TestFlight

---

## Common Issues & Solutions

### "No bundle URL present"
```bash
# Reset Metro cache
npm start -- --reset-cache

# In new terminal
npm run ios
```

### "Unable to boot simulator"
```bash
# List simulators
xcrun simctl list devices

# Erase and reset
xcrun simctl erase all
```

### "Command PhaseScriptExecution failed"
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### "Signing for TreasureHuntMobile requires a development team"
- Xcode → Settings → Accounts → Add Apple ID
- Project → Signing & Capabilities → Select Team

### "GoogleService-Info.plist not found"
- Make sure file is in `ios/TreasureHuntMobile/`
- Add to Xcode: Right-click folder → Add Files
- Must check "Add to targets"

### App crashes immediately on launch
- Check Firebase config is properly added
- Check logs: Xcode → View → Debug Area → Show Debug Area
- Look for error messages in console

### Changes not showing
- Cmd+R to rebuild
- Or shake simulator → Reload

---

## Quick Reference

### Run on Simulator
```bash
cd ~/Documents/treasure-hunt-mobile
open ios/TreasureHuntMobile.xcworkspace
# Click ▶️ in Xcode
```

### Run on iPhone
1. Connect iPhone via USB
2. Select iPhone in device dropdown
3. Click ▶️

### View Logs
- Xcode → View → Debug Area → Activate Console (Cmd+Shift+C)

### Clean Build
- Xcode → Product → Clean Build Folder (Cmd+Shift+K)
- Then Product → Build (Cmd+B)

---

## File Structure

```
treasure-hunt-mobile/
├── src/                    # React Native source code
│   ├── screens/           # UI screens
│   └── services/          # Business logic
├── ios/
│   ├── TreasureHuntMobile.xcworkspace  ← Open this!
│   ├── TreasureHuntMobile.xcodeproj
│   ├── TreasureHuntMobile/
│   │   ├── GoogleService-Info.plist   ← Put Firebase config here
│   │   ├── Info.plist
│   │   └── AppDelegate.mm
│   └── Podfile            # iOS dependencies
├── android/               # Android project
└── package.json           # Node dependencies
```

---

## Tips for Smooth Development

### Hot Reload (Fast Refresh)
- Save file → See changes instantly
- No rebuild needed for most changes
- Shake device → Enable Fast Refresh

### Debugging
- Shake device → Debug Menu
- Open JS Debugger in Chrome
- `console.log()` shows in Chrome console

### Simulator Shortcuts
- Cmd+D: Open dev menu
- Cmd+R: Reload
- Cmd+Shift+H: Home button
- Cmd+K: Toggle keyboard

### Multiple Simulators
- Window → Devices and Simulators
- Create different iPhone models
- Test different screen sizes

---

## Success Checklist

- [ ] Xcode installed
- [ ] Node.js installed
- [ ] CocoaPods installed
- [ ] Repository cloned from GitHub
- [ ] `npm install` completed
- [ ] `pod install` completed
- [ ] Firebase config downloaded
- [ ] Firebase config added to Xcode
- [ ] Apple ID added for signing
- [ ] App builds successfully
- [ ] App runs on simulator/iPhone
- [ ] (Optional) Uploaded to TestFlight

---

## Need Help?

**Check other guides:**
- [GITHUB_TO_XCODE_GUIDE.md](GITHUB_TO_XCODE_GUIDE.md) - Detailed walkthrough
- [README.md](README.md) - Full technical documentation

**Common resources:**
- React Native Docs: https://reactnative.dev
- Xcode Help: https://developer.apple.com/xcode/
- TestFlight: https://developer.apple.com/testflight/

---

**You're all set!** This React Native app works on both iOS and Android with the same codebase. 🎉
