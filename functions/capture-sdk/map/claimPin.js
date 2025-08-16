// capture-sdk/map/claimPin.js

const calculateDistance = require('../utils/locationUtils.js').calculateDistance;

async function claimPin(pinId, claimData) {
    const {
      userId,
      userLocation,
      claimType = 'pickup', // pickup, interested, report
      message = '',
      estimatedPickupTime = null
    } = claimData;
  
    // Get pin from database
    const pin = await getPinById(pinId);
    
    if (!pin) {
      throw new Error('Pin not found');
    }
  
    // Validate pin status
    if (pin.status !== 'active') {
      throw new Error('Pin is no longer active');
    }
  
    if (new Date(pin.expiresAt) < new Date()) {
      throw new Error('Pin has expired');
    }
  
    // Validate user is within claim radius
    if (userLocation) {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        pin.location.lat,
        pin.location.lng
      );
  
      if (distance > (pin.claimRadius || 0.5)) {
        throw new Error(`You must be within ${pin.claimRadius} miles to claim this item`);
      }
    }
  
    // Create claim record
    const claim = {
      id: generateClaimId(),
      pinId: pinId,
      userId: userId,
      type: claimType,
      message: message,
      userLocation: userLocation,
      estimatedPickupTime: estimatedPickupTime,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
  
    // Add claim to pin
    pin.claims.push(claim);
  
    // Update pin status based on claim type
    if (claimType === 'pickup' && pin.claims.filter(c => c.type === 'pickup').length === 1) {
      pin.status = 'claimed';
      pin.claimedAt = new Date().toISOString();
      pin.claimedBy = userId;
    }
  
    // Save updates
    await updatePin(pin);
  
    // Notify pin creator
    await notifyPinCreator(pin, claim);
  
    // If item was picked up, trigger any rewards/points
    if (claimType === 'pickup') {
      await processRewards(userId, pin);
    }
  
    return {
      success: true,
      claimId: claim.id,
      pinStatus: pin.status,
      message: claimType === 'pickup' 
        ? 'Item claimed! The pin creator has been notified.' 
        : 'Interest registered!'
    };
  }
  
  async function getPinById(pinId) {
    // Database fetch
    console.log('Fetching pin:', pinId);
    return {
      id: pinId,
      status: 'active',
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      location: { lat: 40.7128, lng: -74.0060 },
      claimRadius: 0.5,
      claims: [],
      itemData: { category: 'electronics', value: 75 },
      userId: 'creator123'
    }; // Mock pin data
  }
  
  async function updatePin(pin) {
    // Database update
    console.log('Updating pin:', pin.id);
  }
  
  async function notifyPinCreator(pin, claim) {
    // Send notification to pin creator
    console.log('Notifying creator of pin:', pin.id, 'about claim:', claim.id);
    
    const notification = {
      type: 'pin_claimed',
      userId: pin.userId,
      title: `Your ${pin.itemData.category} has been claimed!`,
      body: claim.message || `Someone is interested in picking up your item.`,
      data: {
        pinId: pin.id,
        claimId: claim.id,
        claimType: claim.type
      }
    };
    
    // Send push notification (mock)
    console.log('Push notification sent:', notification);
  }
  
  async function processRewards(userId, pin) {
    // Award points for successful pickup
    const points = calculatePoints(pin);
    console.log(`Awarding ${points} points to user ${userId}`);
    
    // Update user's points/achievements (mock)
  }
  
  function calculatePoints(pin) {
    // Base points for any pickup
    let points = 10;
    
    // Bonus for valuable items
    if (pin.itemData.value > 50) points += 5;
    if (pin.itemData.value > 100) points += 10;
    
    // Category bonuses
    const categoryBonus = {
      'electronics': 5,
      'furniture': 8,
      'tools': 3
    };
    
    points += categoryBonus[pin.itemData.category] || 0;
    
    return points;
  }
  
  function generateClaimId() {
    return `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

// THIS WAS MISSING! Export the function so other files can import it
module.exports = { claimPin };