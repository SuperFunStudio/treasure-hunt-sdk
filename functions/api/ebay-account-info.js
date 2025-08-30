
async function getEbayAccountInfo(req, res) {
  try {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }

    // Verify authentication
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Get user's eBay connection
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userData = userDoc.data();
    const ebayData = userData.ebay;

    if (!ebayData?.isConnected) {
      return res.status(400).json({ success: false, error: 'eBay not connected' });
    }

    // Return account information
    res.json({
      success: true,
      accountInfo: {
        username: ebayData.username,
        displayName: ebayData.displayName,
        email: ebayData.email,
        ebayUserId: ebayData.ebayUserId,
        sellerAccount: ebayData.sellerAccount,
        canList: ebayData.canList,
        connectedAt: ebayData.connectedAt,
        environment: ebayData.environment
      }
    });

  } catch (error) {
    console.error('❌ Error getting eBay account info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

exports.ebayAccountInfo = functions.https.onRequest(getEbayAccountInfo);