# 📦 How to Port Your App from PC to Mac via GitHub

## Overview

This is the **standard workflow** for React Native development between PC and Mac:

```
PC (Windows) → GitHub → Mac → Xcode → iPhone
```

## ✅ What Gets Shared via GitHub

Your repository will include:
- ✅ All source code (`src/` folder)
- ✅ React Native configuration
- ✅ iOS project files (`.xcodeproj`, `.xcworkspace`)
- ✅ Android project files
- ✅ Package dependencies list (`package.json`)
- ✅ Documentation

## ❌ What Doesn't Get Shared (Security)

These are excluded via `.gitignore`:
- ❌ `node_modules/` (too large, reinstall on Mac)
- ❌ `google-services.json` (download separately)
- ❌ `GoogleService-Info.plist` (download separately)
- ❌ Build artifacts
- ❌ `local.properties`

## 🚀 Step-by-Step Process

### **PART 1: On Your PC (Windows)**

#### 1. Initialize Git Repository

```powershell
cd C:\Users\kenny\treasure-hunt-sdk\mobile

# Initialize git
git init

# Add all files (respects .gitignore)
git add .

# Create first commit
git commit -m "Initial React Native app for iOS and Android"
```

#### 2. Create GitHub Repository

**Option A: Via GitHub Website (Easier)**

1. Go to https://github.com/new
2. Repository name: `treasure-hunt-mobile`
3. Description: "React Native mobile app for Treasure Hunt SDK"
4. Choose **Private** (recommended for now)
5. **DON'T** initialize with README/gitignore (you already have them)
6. Click "Create repository"

**Option B: Via GitHub CLI (If Installed)**

```powershell
# Install GitHub CLI first: https://cli.github.com/
gh repo create treasure-hunt-mobile --private --source=. --remote=origin --push
```

#### 3. Push to GitHub

After creating the repo on GitHub, you'll see commands like:

```powershell
# Add remote
git remote add origin https://github.com/YOUR_USERNAME/treasure-hunt-mobile.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username!**

✅ Your code is now on GitHub!

---

### **PART 2: On Mac**

#### 1. Install Prerequisites

**Install Xcode (Required):**
1. Open App Store on Mac
2. Search "Xcode"
3. Install (free, ~12GB, takes 30-60 min)
4. Open Xcode once to accept license

**Install Homebrew (Package Manager):**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Install Node.js:**
```bash
brew install node
```

**Install Watchman (File watcher):**
```bash
brew install watchman
```

**Install CocoaPods (iOS dependency manager):**
```bash
sudo gem install cocoapods
```

#### 2. Clone Repository from GitHub

```bash
# Navigate to where you want the project
cd ~/Documents

# Clone your repository
git clone https://github.com/YOUR_USERNAME/treasure-hunt-mobile.git

# Enter the project
cd treasure-hunt-mobile
```

#### 3. Install Dependencies

```bash
# Install Node.js packages
npm install

# Install iOS native dependencies
cd ios
pod install
cd ..
```

This creates the `.xcworkspace` file needed for Xcode.

#### 4. Download Firebase Config (iOS)

**Just like you did for Android, but for iOS:**

1. Go to https://console.firebase.google.com/
2. Select your project
3. Settings ⚙️ → Project settings
4. Your apps → **iOS app** (not Android this time)
   - If no iOS app exists, click "Add app" → iOS
   - iOS bundle ID: `com.treasurehunt.app`
   - Register app
5. Download `GoogleService-Info.plist`
6. Move to: `mobile/ios/TreasureHuntMobile/GoogleService-Info.plist`

**Using Finder:**
- Open Finder
- Navigate to project: `Documents/treasure-hunt-mobile/ios/TreasureHuntMobile/`
- Drag `GoogleService-Info.plist` into this folder

#### 5. Open in Xcode

```bash
# From the mobile folder, open Xcode workspace
open ios/TreasureHuntMobile.xcworkspace
```

**Important:** Always open `.xcworkspace`, NOT `.xcodeproj`!

#### 6. Configure Xcode Project

**In Xcode:**

1. **Select project** (TreasureHuntMobile) in left sidebar
2. **General tab:**
   - Bundle Identifier: Should be `com.treasurehunt.app`
   - Display Name: `Treasure Hunt`
   - Version: `1.0.0`

3. **Signing & Capabilities tab:**
   - Team: Select your Apple ID (add if needed)
   - Check "Automatically manage signing"
   - Signing Certificate: Should auto-select

4. **Add Firebase Config to Xcode:**
   - Right-click `TreasureHuntMobile` folder in Xcode
   - "Add Files to TreasureHuntMobile"
   - Select `GoogleService-Info.plist`
   - ✅ Check "Copy items if needed"
   - ✅ Check "TreasureHuntMobile" under targets
   - Click Add

#### 7. Connect iPhone & Test

**Prepare iPhone:**
1. Settings → General → VPN & Device Management
2. Trust your developer certificate (after first build)

**In Xcode:**
1. Connect iPhone via USB
2. Select your iPhone from device dropdown (top toolbar)
3. Click ▶️ Play button (or Cmd+R)
4. Wait 2-5 minutes for first build
5. App installs on your iPhone! 🎉

**If you get "Untrusted Developer" error on iPhone:**
1. Settings → General → VPN & Device Management
2. Tap your Apple ID
3. Tap "Trust"

---

### **PART 3: Build for TestFlight (Optional)**

Once app works on your iPhone, share with testers:

#### 1. Archive the App

**In Xcode:**
1. Select "Any iOS Device" (not a specific device)
2. Product → Archive
3. Wait 5-10 minutes
4. Organizer window opens

#### 2. Upload to App Store Connect

1. In Organizer, select your archive
2. Click "Distribute App"
3. Select "App Store Connect"
4. Upload
5. Wait 10-60 minutes for processing

#### 3. Configure TestFlight

1. Go to https://appstoreconnect.apple.com
2. My Apps → Your app
3. TestFlight tab
4. Select the build that just uploaded
5. Add internal/external testers
6. For external: Submit for Beta App Review (24-48 hrs)

#### 4. Invite Testers

- Add tester email addresses
- They get invitation email
- Download TestFlight app from App Store
- Accept invite → Install your app
- Test and provide feedback!

---

## 🔄 Ongoing Development Workflow

### Making Changes on PC

```powershell
# Edit code on PC
# Test on Android

# Commit changes
git add .
git commit -m "Added new feature"
git push
```

### Updating on Mac

```bash
# Pull latest changes
git pull

# Reinstall dependencies if package.json changed
npm install

# Update iOS pods if needed
cd ios && pod install && cd ..

# Run on iPhone
# Xcode will hot-reload most changes
```

### Syncing Back

Any changes made on Mac:
```bash
git add .
git commit -m "iOS-specific fixes"
git push
```

Then on PC:
```powershell
git pull
```

---

## 📱 What You Can Do on Each Platform

### **On PC (Windows):**
- ✅ Write all React Native code
- ✅ Build & test Android version
- ✅ Push to GitHub
- ✅ Most development work
- ❌ Can't build iOS
- ❌ Can't test on iPhone

### **On Mac:**
- ✅ Pull from GitHub
- ✅ Build & test iOS version
- ✅ Test on iPhone
- ✅ Upload to TestFlight
- ✅ Also build Android if needed
- ✅ Full development capabilities

---

## 🎯 Minimum Mac Time Needed

If you have limited Mac access:

**First time setup: ~1 hour**
- Install Xcode, Node, CocoaPods
- Clone repo
- Configure project
- Build & test

**Each update: ~15 minutes**
- Pull latest code
- Build
- Test
- Upload to TestFlight (optional)

**You can do 90% of development on PC!**

---

## 💡 Alternative: Using GitHub Codespaces

If you don't have Mac access but want to test occasionally:

**GitHub Codespaces** (cloud development environment):
- Runs Linux (can't build iOS either)
- But can develop and test web version
- 60 hours/month free

**Better alternatives for iOS:**
- Borrow friend's Mac for 1 hour
- Apple Store (use display Macs briefly)
- Mac lab at university/library
- MacStadium cloud Mac rental (~$79/month)

---

## 🔐 Security Notes

### Safe to Commit:
- ✅ Source code
- ✅ Project configuration
- ✅ iOS `.xcodeproj` files
- ✅ Documentation

### Never Commit:
- ❌ `google-services.json`
- ❌ `GoogleService-Info.plist`
- ❌ `.env` files with secrets
- ❌ Signing certificates/keys
- ❌ `node_modules/`

**These are already in `.gitignore`** ✅

You'll need to download Firebase configs separately on each machine.

---

## 🆘 Common Issues

### "xcworkspace not found" on Mac
```bash
cd ios
pod install
cd ..
```

### "Command not found: pod"
```bash
sudo gem install cocoapods
```

### "No provisioning profile" in Xcode
- Add your Apple ID: Xcode → Settings → Accounts
- Select Team in Signing & Capabilities

### "Untrusted Developer" on iPhone
- Settings → General → Device Management
- Trust your developer certificate

### Changes not showing on iPhone
- Shake iPhone → Reload
- Or: Cmd+R in Xcode to rebuild

---

## 📋 Quick Reference Commands

### **On PC:**
```powershell
# Make changes
git add .
git commit -m "Description"
git push
```

### **On Mac:**
```bash
# Get changes
git pull

# Run iOS
open ios/TreasureHuntMobile.xcworkspace
# Click ▶️ in Xcode
```

---

## ✨ Summary

1. **PC:** Push code to GitHub ✅ (You can do this now)
2. **Mac:** Clone from GitHub ✅ (Next time you have Mac)
3. **Mac:** Open `.xcworkspace` in Xcode ✅
4. **Mac:** Build & test on iPhone ✅
5. **Mac:** Upload to TestFlight ✅
6. **Both:** Pull/push changes as needed ✅

**Your code is ready for both platforms!** Just need Mac access to compile iOS version.

---

Ready to push to GitHub from your PC? I can help with the git commands!
