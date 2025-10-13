# 📥 How to Download Firebase Config File (Visual Guide)

## Quick Summary

You need to download **`google-services.json`** from Firebase Console and put it here:
```
C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\google-services.json
```

## Step-by-Step Instructions

### Step 1: Open Firebase Console

1. Open browser and go to: **https://console.firebase.google.com/**
2. Sign in with your Google account (the one you use for Firebase)
3. You'll see a list of your Firebase projects
4. Click on your **treasure-hunt-sdk** project (or whatever it's named)

### Step 2: Go to Project Settings

```
Firebase Console
    ↓
[Click the ⚙️ gear icon] (top-left, next to "Project Overview")
    ↓
[Click "Project settings"]
```

### Step 3: Find Your Apps Section

1. You're now in Project Settings
2. Scroll down past "General" tab
3. Look for section called **"Your apps"**

You'll see icons for different platforms:
- 🌐 Web (</> icon)
- 🤖 Android (green robot)
- 🍎 iOS (apple icon)

### Step 4: Download Android Config

**OPTION A: If you already see an Android app**

```
Your apps section
    ↓
Look for: 🤖 Android app with package name "com.treasurehunt.app"
    ↓
Click on it to expand
    ↓
Scroll down in the expanded section
    ↓
Find: "google-services.json"
    ↓
Click: "Download google-services.json" button
    ↓
File downloads to your Downloads folder
```

**OPTION B: If you DON'T see an Android app yet**

```
Your apps section
    ↓
Click: "Add app" button
    ↓
Click: Android icon (🤖)
    ↓
Fill in the form:
   - Android package name: com.treasurehunt.app
   - App nickname: Treasure Hunt Android (optional)
   - Debug signing certificate: Leave blank (optional)
    ↓
Click: "Register app"
    ↓
You'll see: "Add Firebase to your Android app"
    ↓
Click: "Download google-services.json" button
    ↓
Click: "Next" → "Continue to console"
    ↓
File is now in your Downloads folder
```

### Step 5: Move File to Correct Location

1. Open **File Explorer** (Windows key + E)
2. Go to **Downloads** folder
3. Find **`google-services.json`** file
4. **Right-click** → **Copy** (or Ctrl+C)
5. Navigate to: `C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\`
6. **Right-click** in the folder → **Paste** (or Ctrl+V)

**Final location must be:**
```
C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\google-services.json
```

### Step 6: Verify It's There

In PowerShell:
```powershell
ls C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\google-services.json
```

Should show:
```
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a---          10/10/2025  2:15 PM           xxxx google-services.json
```

✅ Success! File is in the right place.

## What This File Contains

`google-services.json` includes:
- Your Firebase project ID
- API keys for Android
- Client IDs
- Database URLs

**Security Note:**
- These keys are safe to include in mobile apps
- Google's security model expects them to be in the app
- Don't commit to public GitHub (already in `.gitignore`)

## Common Mistakes

❌ **Wrong location:** `mobile\android\google-services.json`
✅ **Correct location:** `mobile\android\app\google-services.json`

❌ **Wrong file:** Downloaded iOS file (`GoogleService-Info.plist`)
✅ **Correct file:** Android file (`google-services.json`)

❌ **File not found:** Didn't download from Firebase Console
✅ **File exists:** Downloaded and moved to correct location

## What the Package Name Means

When you created the Android app in Firebase, you entered:
```
Package name: com.treasurehunt.app
```

This MUST match in 3 places:

1. ✅ **Firebase Console** (what you just entered)
2. ✅ **mobile/app.json** (already set)
   ```json
   "package": "com.treasurehunt.app"
   ```
3. ✅ **mobile/android/app/build.gradle** (already set)
   ```gradle
   applicationId "com.treasurehunt.app"
   ```

If they don't match, the app won't connect to Firebase!

## Enable Firebase Services

While you're in Firebase Console, enable these services:

### 1. Authentication
```
Build → Authentication → Get Started
    ↓
Sign-in method tab
    ↓
Click "Email/Password"
    ↓
Enable it → Save
```

### 2. Firestore Database
```
Build → Firestore Database
    ↓
Create database
    ↓
Start in "test mode" → Next
    ↓
Choose location: us-central1 → Enable
```

### 3. Storage
```
Build → Storage
    ↓
Get started
    ↓
Start in "test mode" → Next → Done
```

### 4. Find Your Cloud Functions URL
```
Build → Functions
    ↓
Look at your deployed functions
    ↓
Copy the base URL (before "/api/...")
Example: https://us-central1-yourproject.cloudfunctions.net
    ↓
Use this URL in your code (Step 7 below)
```

## Next Steps After Download

Once `google-services.json` is in place:

1. ✅ File downloaded and in correct location
2. ⬜ Install Android Studio (if not done)
3. ⬜ Create Android emulator
4. ⬜ Update Cloud Functions URL in code
5. ⬜ Run `npm run android`

See: [PC_SETUP_CHECKLIST.md](PC_SETUP_CHECKLIST.md) for complete setup!

## Need Help?

**File won't download:**
- Check your internet connection
- Try a different browser
- Make sure you're signed into Firebase Console

**Can't find the file after download:**
- Check your Downloads folder
- Search Windows for "google-services.json"
- Try downloading again

**Wrong Firebase project:**
- Make sure you selected the right project in Firebase Console
- Check the project name at the top of the page
- If wrong project, go back and select the correct one

**Package name already in use:**
- Someone else used `com.treasurehunt.app`
- Change to: `com.yourname.treasurehunt`
- Update in Firebase, app.json, and build.gradle

---

**🎯 Success Criteria:**

File exists here: ✅
```
C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\google-services.json
```

Ready for next step: **Install Android Studio & create emulator!**
