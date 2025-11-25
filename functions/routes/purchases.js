// routes/purchases.js
// Handle listing purchases with Stripe integration

const express = require('express');
const router = express.Router();

// Dependencies (injected)
let db = null;
let admin = null;
let stripe = null;
let verifyAuth = null;

function injectDependencies(dependencies) {
  db = dependencies.db;
  admin = dependencies.admin;
  stripe = dependencies.stripe;
  verifyAuth = dependencies.verifyAuth;
}

// ========== CREATE CHECKOUT SESSION FOR LISTING PURCHASE ==========
router.post('/create-checkout', async (req, res) => {
  try {
    // Verify authentication
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const { pinId } = req.body;

    if (!pinId) {
      return res.status(400).json({ error: 'Pin ID required' });
    }

    if (!stripe) {
      return res.status(503).json({ error: 'Payment processing not configured' });
    }

    // Get the pin/listing data directly by document ID
    const pinDoc = await db.collection('pins').doc(pinId).get();

    if (!pinDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const pinData = pinDoc.data();
    const pinDocId = pinDoc.id;

    // Validate listing is available for purchase
    if (pinData.status !== 'active') {
      return res.status(400).json({ error: 'Listing is no longer available' });
    }

    // Check if user is trying to buy their own listing
    if (pinData.userId === userId) {
      return res.status(400).json({ error: 'Cannot purchase your own listing' });
    }

    // Get price
    const price = pinData.price || pinData.item?.price || pinData.item?.estimatedValue || 25;
    const priceInCents = Math.round(price * 100);

    if (priceInCents < 50) { // Stripe minimum is $0.50
      return res.status(400).json({ error: 'Price too low for payment processing' });
    }

    // Get user details for receipt
    const buyerDoc = await db.collection('users').doc(userId).get();
    const buyerEmail = buyerDoc.exists ? buyerDoc.data().email : null;

    // Create item title
    const itemTitle = pinData.item?.title ||
                      `${pinData.item?.brand || ''} ${pinData.item?.category || 'Item'}`.trim();

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: itemTitle,
              description: pinData.item?.description?.substring(0, 200) || 'ThriftSpot listing',
              images: pinData.item?.imageUrls?.slice(0, 1) || [],
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin || 'https://treasurehunter-sdk.web.app'}/purchase-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'https://treasurehunter-sdk.web.app'}/listing.html?id=${pinId}`,
      customer_email: buyerEmail,
      client_reference_id: userId,
      metadata: {
        purpose: 'listing_purchase',
        pinId: pinId,
        pinDocId: pinDocId,
        buyerId: userId,
        sellerId: pinData.userId,
        itemTitle: itemTitle
      },
      payment_intent_data: {
        metadata: {
          purpose: 'listing_purchase',
          pinId: pinId,
          buyerId: userId,
          sellerId: pinData.userId
        }
      }
    });

    console.log(`✅ Checkout session created for pin ${pinId}: ${session.id}`);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
});

// ========== GET PURCHASE DETAILS ==========
router.get('/order/:orderId', async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const { orderId } = req.params;

    const orderDoc = await db.collection('orders').doc(orderId).get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();

    // Verify user is buyer or seller
    if (orderData.buyerId !== userId && orderData.sellerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      order: {
        id: orderDoc.id,
        ...orderData,
        createdAt: orderData.createdAt?.toDate(),
        updatedAt: orderData.updatedAt?.toDate()
      }
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ========== GET USER'S PURCHASES ==========
router.get('/my-purchases', async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const ordersSnapshot = await db.collection('orders')
      .where('buyerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));

    res.json({
      success: true,
      orders
    });

  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// ========== GET USER'S SALES ==========
router.get('/my-sales', async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const ordersSnapshot = await db.collection('orders')
      .where('sellerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));

    res.json({
      success: true,
      orders
    });

  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// ========== UPDATE ORDER STATUS ==========
router.post('/order/:orderId/status', async (req, res) => {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const { orderId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();

    // Only seller can update status
    if (orderData.sellerId !== userId) {
      return res.status(403).json({ error: 'Only seller can update order status' });
    }

    await orderRef.update({
      status: status,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: status,
        notes: notes || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userId
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Order ${orderId} status updated to ${status}`);

    res.json({
      success: true,
      message: 'Order status updated'
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = {
  router,
  injectDependencies
};
