# Database Migration Scripts

## fix-geohashes.js

Fixes the geohash bug that caused pins to have invalid geohashes like `800000` instead of proper geohashes like `9mudkv`.

### Prerequisites

1. **Service account key**: You need a Firebase service account key JSON file at:
   ```
   functions/service-account-key.json
   ```

2. **Get the service account key:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to **Project Settings** > **Service Accounts**
   - Click **"Generate New Private Key"**
   - Save as `service-account-key.json` in the `functions/` directory

   ⚠️ **IMPORTANT**: Add this file to `.gitignore` - never commit it!

### Running the Script

```bash
cd functions
node scripts/fix-geohashes.js
```

### What It Does

1. Connects to your Firestore database
2. Reads all pins
3. Recalculates correct geohashes for each pin's location
4. Updates pins that have incorrect geohashes
5. Shows a summary of changes

### Expected Output

```
🔧 Starting geohash fix...

Found 54 pins in database

🔄 Pin BILJIto78LdJ9DdhHbwx:
   Old geohash: 800000
   New geohash: 9mudkv3
   Location: 32.8401, -117.2144
   Category: electronics
   Status: active

...

📝 Committing 5 updates to Firestore...
✅ Batch update successful!

═══════════════════════════════════════
📊 SUMMARY
═══════════════════════════════════════
Total pins processed: 54
Pins fixed: 5
Already correct: 49
═══════════════════════════════════════
```

### After Running

1. **Reload your pin map** in the browser
2. **Click the Debug button** to verify all geohashes are now correct
3. You should now see all active pins on the map!

### Troubleshooting

**Error: "Cannot find module '../service-account-key.json'"**
- You need to download the service account key from Firebase Console
- Place it at `functions/service-account-key.json`

**Error: "Permission denied"**
- Make sure the service account has Firestore read/write permissions
- Check that you're using the correct Firebase project

**Script hangs or times out**
- If you have thousands of pins, the batch update might take a while
- The script will show progress as it processes each pin
- Wait for the "✅ Batch update successful!" message

### Safety

- The script uses batch writes (transactional)
- If any update fails, none of the changes are applied
- Original data is preserved if script fails
- Only updates the `location.geohash` field and `updatedAt` timestamp
- Does not modify any other pin data

### Re-running

It's safe to run this script multiple times:
- Pins with correct geohashes will be skipped
- Only broken geohashes will be updated
- The summary will show "Already correct: X"
