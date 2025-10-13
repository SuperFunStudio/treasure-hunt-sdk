/**
 * Script to fix incorrect geohashes in existing pins
 *
 * The geohash generation had a bug that caused it to generate '800000' instead of proper geohashes.
 * This script recalculates and updates all pins with correct geohashes.
 *
 * Usage:
 *   node functions/scripts/fix-geohashes.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Correct geohash generation (matching geoService)
 */
function generateGeohash(lat, lng, precision = 6) {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let geohash = '';
  let bit = 0;
  let ch = 0;
  let even = true;

  while (geohash.length < precision) {
    if (even) {
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

    even = !even;
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
 * Fix all pins with incorrect geohashes
 */
async function fixGeohashes() {
  try {
    console.log('🔧 Starting geohash fix...\n');

    // Get all pins
    const snapshot = await db.collection('pins').get();
    console.log(`Found ${snapshot.size} pins in database\n`);

    const batch = db.batch();
    let fixedCount = 0;
    let alreadyCorrect = 0;
    const updates = [];

    snapshot.forEach(doc => {
      const pin = doc.data();
      const pinId = doc.id;

      if (!pin.location || !pin.location.latitude || !pin.location.longitude) {
        console.log(`⚠️  Pin ${pinId}: Missing location coordinates, skipping`);
        return;
      }

      const currentGeohash = pin.location.geohash;
      const correctGeohash = generateGeohash(
        pin.location.latitude,
        pin.location.longitude,
        6
      );

      if (currentGeohash !== correctGeohash) {
        console.log(`🔄 Pin ${pinId}:`);
        console.log(`   Old geohash: ${currentGeohash}`);
        console.log(`   New geohash: ${correctGeohash}`);
        console.log(`   Location: ${pin.location.latitude}, ${pin.location.longitude}`);
        console.log(`   Category: ${pin.item?.category || 'unknown'}`);
        console.log(`   Status: ${pin.status}\n`);

        batch.update(doc.ref, {
          'location.geohash': correctGeohash,
          'updatedAt': admin.firestore.FieldValue.serverTimestamp()
        });

        updates.push({
          id: pinId,
          oldGeohash: currentGeohash,
          newGeohash: correctGeohash,
          location: `${pin.location.latitude}, ${pin.location.longitude}`
        });

        fixedCount++;
      } else {
        alreadyCorrect++;
      }
    });

    if (fixedCount > 0) {
      console.log(`\n📝 Committing ${fixedCount} updates to Firestore...`);
      await batch.commit();
      console.log('✅ Batch update successful!\n');
    } else {
      console.log('\n✅ All geohashes are already correct!\n');
    }

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total pins processed: ${snapshot.size}`);
    console.log(`Pins fixed: ${fixedCount}`);
    console.log(`Already correct: ${alreadyCorrect}`);
    console.log('═══════════════════════════════════════\n');

    if (updates.length > 0) {
      console.log('📋 Updated pins:');
      updates.forEach((update, index) => {
        console.log(`${index + 1}. ${update.id.substring(0, 12)}... ${update.oldGeohash} → ${update.newGeohash}`);
      });
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing geohashes:', error);
    process.exit(1);
  }
}

// Run the fix
fixGeohashes();
