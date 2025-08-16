const admin = require('firebase-admin');

// Initialize with your project ID
admin.initializeApp({
  projectId: 'treasurehunter-sdk'
});

const db = admin.firestore();

const scanData = {
  scanId: 'scan_' + Date.now(),
  userId: 'test_brooklyn_hunter',
  scanData: {
    category: 'bamboo side table',
    brand: 'Unknown',
    model: 'Unknown',
    condition: {
      rating: 'good',
      description: 'Vintage bamboo side table with drawer, shows minor wear',
      usableAsIs: true,
      issues: ['minor scratches', 'slightly loose drawer']
    },
    confidence: 8,
    estimatedValue: {
      suggested: 45,
      range: {low: 35, high: 60}
    }
  },
  disposition: {
    chosen: 'sell',
    route: 'ebay', 
    estimatedReturn: 32
  },
  metadata: {
    scannedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    gptModel: 'gpt-4-vision'
  }
};

console.log('Creating scanned_items collection...');

db.collection('scanned_items').add(scanData)
  .then(docRef => {
    console.log('? Document created with ID:', docRef.id);
    console.log('?? scanned_items collection created successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('? Error:', error.message);
    process.exit(1);
  });
