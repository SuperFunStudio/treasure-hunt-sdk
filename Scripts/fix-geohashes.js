// fix-geohashes.js
// Script to fix malformed geohashes in the database

const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Generate correct geohash
 */
function generateGeohash(lat, lng, precision = 6) {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let geohash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        ch |= (1 << (4 - bit));
        lngRange[0] = mid;
      } else {
        lngRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        latRange[0] = mid;
      } else {
        latRange[1] = mid;
      }
    }

    isEven = !isEven;
    bit++;

    if (bit === 5) {
      geohash += base32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Check if geohash is malformed (contains only zeros after first char)
 */
function isMalformedGeohash(geohash) {
  if (!geohash || geohash.length !== 6) return true;
  // Check for patterns like "d00000", "900000", "800000" etc
  const lastFiveChars = geohash.substring(1);
  return lastFiveChars === '00000';
}

/**
 * Fix all pins with malformed geohashes
 */
async function fixGeohashes() {
  console.log('🔧 Starting geohash fix...\n');

  try {
    // Get all pins
    const pinsRef = db.collection('pins');
    const snapshot = await pinsRef.get();

    console.log(`📊 Found ${snapshot.size} pins in database\n`);

    let fixedCount = 0;
    let errorCount = 0;
    let alreadyCorrectCount = 0;

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const pin = doc.data();
      const currentGeohash = pin.location?.geohash;
      const lat = pin.location?.latitude;
      const lng = pin.location?.longitude;

      if (!lat || !lng) {
        console.log(`⚠️  Pin ${doc.id}: Missing coordinates, skipping`);
        errorCount++;
        continue;
      }

      // Generate correct geohash
      const correctGeohash = generateGeohash(lat, lng, 6);

      if (currentGeohash === correctGeohash) {
        alreadyCorrectCount++;
        continue;
      }

      if (isMalformedGeohash(currentGeohash)) {
        console.log(`🔧 Fixing pin ${doc.id}:`);
        console.log(`   Old geohash: ${currentGeohash}`);
        console.log(`   New geohash: ${correctGeohash}`);
        console.log(`   Location: ${lat}, ${lng}\n`);

        // Update the pin
        batch.update(doc.ref, {
          'location.geohash': correctGeohash
        });

        fixedCount++;
        batchCount++;

        // Commit batch every 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`💾 Committed batch of ${batchCount} updates\n`);
          batchCount = 0;
        }
      } else {
        alreadyCorrectCount++;
      }
    }

    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`💾 Committed final batch of ${batchCount} updates\n`);
    }

    console.log('✅ Geohash fix complete!\n');
    console.log('📊 Summary:');
    console.log(`   Fixed: ${fixedCount}`);
    console.log(`   Already correct: ${alreadyCorrectCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total: ${snapshot.size}\n`);

  } catch (error) {
    console.error('❌ Error fixing geohashes:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the fix
fixGeohashes();
