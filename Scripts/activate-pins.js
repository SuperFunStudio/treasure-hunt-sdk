// activate-pins.js
// Script to activate some expired pins for testing yard sale grouping

const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function activatePins() {
  console.log('🔧 Activating some pins for testing...\n');

  try {
    // Get some expired pins at the same location
    const snapshot = await db.collection('pins')
      .where('status', '==', 'expired')
      .where('location.geohash', '==', 'dr5rkw')
      .limit(4)
      .get();

    console.log(`Found ${snapshot.size} expired pins to activate\n`);

    const batch = db.batch();
    const now = new Date();
    const futureDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now

    snapshot.forEach(doc => {
      const pin = doc.data();
      console.log(`Activating pin ${doc.id}:`);
      console.log(`  Category: ${pin.item?.category || 'unknown'}`);
      console.log(`  Location: ${pin.location?.latitude}, ${pin.location?.longitude}\n`);

      batch.update(doc.ref, {
        status: 'active',
        expiresAt: admin.firestore.Timestamp.fromDate(futureDate)
      });
    });

    await batch.commit();
    console.log('✅ Pins activated successfully!\n');
    console.log(`Expiration set to: ${futureDate.toISOString()}\n`);

  } catch (error) {
    console.error('❌ Error activating pins:', error);
    process.exit(1);
  }

  process.exit(0);
}

activatePins();
