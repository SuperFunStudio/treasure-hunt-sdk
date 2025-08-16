
// functions/capture-sdk/integrations/instantOffer/offerCalculator.js
async function calculateOffer(itemData) {
    const marketPrice = itemData.resale.priceRange.high;
    const baseOfferRate = 0.65; // 65% of market value
    
    // Adjust based on condition
    let conditionMultiplier = 1.0;
    switch (itemData.condition.rating) {
      case 'good':
        conditionMultiplier = 1.0;
        break;
      case 'fair':
        conditionMultiplier = 0.85;
        break;
      case 'poor':
        conditionMultiplier = 0.5;
        break;
    }
  
    // Category demand multiplier
    const demandMultiplier = getCategoryDemandMultiplier(itemData.category);
    
    const offerAmount = Math.round(marketPrice * baseOfferRate * conditionMultiplier * demandMultiplier);
    
    // Minimum offer threshold
    const minimumOffer = 5;
    
    if (offerAmount < minimumOffer) {
      return {
        isEligible: false,
        reason: 'Item value below minimum threshold',
        suggestedAlternative: 'donation'
      };
    }
  
    // Maximum offer cap
    const maximumOffer = 500;
    
    return {
      isEligible: true,
      amount: Math.min(offerAmount, maximumOffer),
      breakdown: {
        marketPrice,
        baseRate: baseOfferRate,
        conditionMultiplier,
        demandMultiplier
      }
    };
  }
  
  function getCategoryDemandMultiplier(category) {
    const demandMap = {
      'electronics': 1.2,
      'tools': 1.15,
      'sporting goods': 1.1,
      'furniture': 0.9,
      'clothing': 0.85
    };
    
    return demandMap[category.toLowerCase()] || 1.0;
  }

  module.exports = { calculateOffer };
