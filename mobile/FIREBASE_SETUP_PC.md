# Firebase Setup for PC (Android Only)

Since you're on a PC, you'll build the Android version of the app.

## Step 1: Get Firebase Config File

### Open Firebase Console

1. Go to: **https://console.firebase.google.com/**
2. Sign in with your Google account
3. Click on your **treasure-hunt-sdk** project

### Add/Download Android App Config

1. Click the **⚙️ gear icon** (top left, next to "Project Overview")
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Look for an **Android app** with the green robot icon

   **If you see an Android app:**
   - Click on it
   - Scroll down and click **"Download google-services.json"**
   - Save it to your Downloads folder

   **If you DON'T see an Android app:**
   - Click **"Add app"** button
   - Click the **Android icon** (green robot)
   - Fill in:
     - **Android package name:** `com.treasurehunt.app`
     - **App nickname (optional):** Treasure Hunt Android
     - **Debug signing certificate (optional):** Leave blank for now
   - Click **"Register app"**
   - Click **"Download google-services.json"**
   - Save it to your Downloads folder

### Move the File

5. Open File Explorer
6. Navigate to your Downloads folder
7. Find **google-services.json**
8. Copy it to:
   ```
   C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\
   ```

   The final path should be:
   ```
   C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\google-services.json
   ```

## Step 2: Verify File Location

In PowerShell, run:

```powershell
ls C:\Users\kenny\treasure-hunt-sdk\mobile\android\app\google-services.json
```

You should see the file listed. ✅

## Step 3: Enable Firebase Services

Back in Firebase Console:

1. Go to **Build** → **Authentication**
2. Click **"Get Started"**
3. Enable **"Email/Password"** sign-in method
4. Click **Save**

5. Go to **Build** → **Firestore Database**
   - If not created, click **"Create database"**
   - Choose **"Start in test mode"** (for now)
   - Select a region (us-central1 recommended)
   - Click **Enable**

6. Go to **Build** → **Storage**
   - If not created, click **"Get started"**
   - Choose **"Start in test mode"**
   - Click **Next** → **Done**

## Step 4: Update Your Cloud Functions URL

1. In Firebase Console, go to **Build** → **Functions**
2. Find your deployed functions
3. Copy the base URL (something like: `https://us-central1-yourproject.cloudfunctions.net`)

4. Edit this file in your code editor:
   ```
   C:\Users\kenny\treasure-hunt-sdk\mobile\src\screens\AnalysisResultScreen.tsx
   ```

5. Find line 23 and update:
   ```typescript
   const baseUrl = 'https://YOUR-ACTUAL-URL.cloudfunctions.net';
   ```

## Step 5: Check Everything

Checklist:
- [ ] google-services.json is in `mobile/android/app/`
- [ ] Firebase Authentication is enabled
- [ ] Firestore Database is created
- [ ] Storage is enabled
- [ ] Cloud Functions URL is updated in code

## Next Steps

Once all files are in place, you can:

```powershell
# Start Metro bundler
npm start

# In another PowerShell window, build and run on Android
npm run android
```

## Troubleshooting

**"No matching version found for react-native-vision-camera"**
- This is already fixed! The package has been removed.

**"SDK location not found"**
- Make sure `android/local.properties` exists with correct SDK path
- Already created for you at: `mobile/android/local.properties`

**"google-services.json missing"**
- Make sure you downloaded it from Firebase Console
- Must be in: `mobile/android/app/google-services.json`
- NOT in `mobile/android/` (wrong location)

**Build fails with Java errors**
- Install JDK 17: https://adoptium.net/
- Make sure JAVA_HOME is set in environment variables

## Important Notes

⚠️ **You can ONLY build Android on PC**
- iOS apps require macOS with Xcode
- For iOS, you'd need to partner with someone who has a Mac
- Or use a cloud Mac service (expensive)

✅ **Android works great on PC**
- Full features available
- Can test on emulator or real device
- Can publish to Google Play Store

✅ **Same App, Two Platforms**
- The code works for both iOS and Android
- When someone with a Mac builds iOS, it uses the same code
- You just build the Android version
