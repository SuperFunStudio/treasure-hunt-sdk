// capture-sdk/core/routeDisposition.js
import { estimatePrice } from '../utils/priceEstimate.js';

export async function routeDisposition(itemData, userPreferences = {}, ebayConfig = null) {
  const {
    preferInstantOffer = false,
    minResaleValue = 10,
    location,
    hasEbayAccount = false
  } = userPreferences;

  const routes = [];
  
  // Get market price estimate
  console.log('Getting market price estimate...');

  let marketPricing;
  try {
    marketPricing = await estimatePrice(itemData, {
      source: 'ebay',
      includeShipping: true,
      ebayConfig: ebayConfig // Pass the eBay config here
    });
  } catch (error) {
    console.error('Pricing estimation failed:', error);
    // Fallback to manual pricing
    marketPricing = await estimatePrice(itemData, {
      source: 'manual',
      condition: getConditionString(itemData.condition?.rating)
    });
  }
  
  console.log('Market pricing result:', marketPricing);

  const marketPrice = marketPricing.suggested || 0;
  const instantOfferPrice = marketPrice * 0.65; // 65% of market value

  // Helper function to get condition as string
  function getConditionString(rating) {
    if (typeof rating === 'number') {
      if (rating >= 8) return 'excellent';
      if (rating >= 6) return 'good';
      if (rating >= 4) return 'fair';
      return 'poor';
    }
    return rating || 'fair';
  }

  const conditionString = getConditionString(itemData.condition?.rating);
  const isUsable = itemData.condition?.usableAsIs !== false;

  // Resale route (if valuable enough)
  if (marketPrice >= minResaleValue && isUsable) {
    if (hasEbayAccount) {
      routes.push({
        type: 'ebay',
        priority: preferInstantOffer ? 2 : 1,
        estimatedReturn: marketPricing.netProfit || (marketPrice * 0.85), // Use calculated net profit
        timeToMoney: '7-14 days',
        effort: 'medium',
        details: {
          listingPrice: marketPrice,
          fees: marketPricing.ebayFees || (marketPrice * 0.13),
          shipping: marketPricing.shippingCost || 12,
          netProfit: marketPricing.netProfit || (marketPrice * 0.85)
        }
      });
    }

    routes.push({
      type: 'instant-offer',
      priority: preferInstantOffer ? 1 : 2,
      estimatedReturn: instantOfferPrice,
      timeToMoney: '1-3 days',
      effort: 'low',
      details: {
        offerPrice: instantOfferPrice,
        marketValue: marketPrice,
        percentage: '65%'
      }
    });

    routes.push({
      type: 'local-pickup',
      priority: 3,
      estimatedReturn: 0,
      timeToMoney: 'immediate',
      effort: 'minimal',
      pinDuration: '4 hours',
      details: {
        description: 'Drop pin for local treasure hunters'
      }
    });
  }

  // Donation route
  console.log('Checking donation route...');
  if (conditionString !== 'poor') {
    routes.push({
      type: 'donate',
      priority: routes.length + 1,
      estimatedReturn: 0,
      organization: await findNearestDonationCenter(location, itemData.category),
      taxDeductible: marketPrice > 50,
      details: {
        taxDeduction: marketPrice > 50 ? marketPrice * 0.6 : 0,
        condition: conditionString
      }
    });
  }

  // Recycling/Parts route
  console.log('Checking recycling route...');
  if (itemData.salvageable && itemData.salvageable.length > 0) {
    routes.push({
      type: 'recycle-parts',
      priority: routes.length + 1,
      estimatedReturn: 0,
      components: itemData.salvageable,
      recyclingCenter: await findRecyclingCenter(location, itemData.category),
      details: {
        salvageableComponents: itemData.salvageable.length,
        environmentalBenefit: true
      }
    });
  }

  // If no routes found, add disposal option
  if (routes.length === 0) {
    routes.push({
      type: 'dispose',
      priority: 1,
      estimatedReturn: 0,
      reason: `Item value ($${marketPrice}) below minimum threshold ($${minResaleValue}) or poor condition`,
      details: {
        itemValue: marketPrice,
        condition: conditionString,
        minimumThreshold: minResaleValue
      }
    });
  }

  console.log('Routes complete, returning results...');

  return {
    recommendedRoute: routes[0] || { 
      type: 'dispose', 
      reason: 'No viable routes found',
      estimatedReturn: 0
    },
    allRoutes: routes.sort((a, b) => a.priority - b.priority),
    marketAnalysis: {
      estimatedValue: marketPricing, // Include the full pricing object
      instantOffer: instantOfferPrice,
      demandLevel: calculateDemandLevel(itemData),
      confidence: marketPricing.confidence,
      dataSource: marketPricing.source,
      priceRange: marketPricing.priceRange,
      fees: {
        ebay: marketPricing.ebayFees || 0,
        shipping: marketPricing.shippingCost || 0
      }
    }
  };
}

async function findNearestDonationCenter(location, category) {
  // Placeholder - would integrate with donation APIs
  const donationCenters = {
    'electronics': {
      name: 'Best Buy Electronics Recycling',
      distance: '1.8 miles',
      accepts: ['electronics', 'computers', 'phones']
    },
    'clothing': {
      name: 'Local Goodwill',
      distance: '2.3 miles',
      accepts: ['clothing', 'shoes', 'accessories']
    },
    'furniture': {
      name: 'Habitat for Humanity ReStore',
      distance: '4.1 miles',
      accepts: ['furniture', 'home goods', 'appliances']
    }
  };

  return donationCenters[category] || {
    name: 'Local Goodwill',
    distance: '2.3 miles',
    accepts: ['general items']
  };
}

async function findRecyclingCenter(location, category) {
  // Placeholder - would integrate with recycling APIs
  const recyclingCenters = {
    'electronics': {
      name: 'E-Waste Recycling Center',
      distance: '3.2 miles',
      accepts: ['electronics', 'batteries', 'cables'],
      paymentOffered: true
    },
    'metal': {
      name: 'Scrap Metal Yard',
      distance: '5.8 miles',
      accepts: ['metal', 'aluminum', 'copper'],
      paymentOffered: true
    }
  };

  return recyclingCenters[category] || {
    name: 'City Recycling Center',
    distance: '5.1 miles',
    accepts: ['general recyclables'],
    paymentOffered: false
  };
}

function calculateDemandLevel(itemData) {
  // Enhanced demand calculation
  const highDemandCategories = ['electronics', 'tools', 'sporting goods'];
  const mediumDemandCategories = ['furniture', 'clothing', 'jewelry'];
  
  let demandScore = 0;
  
  // Category demand
  if (highDemandCategories.includes(itemData.category)) {
    demandScore += 3;
  } else if (mediumDemandCategories.includes(itemData.category)) {
    demandScore += 2;
  } else {
    demandScore += 1;
  }
  
  // Brand premium
  const premiumBrands = ['Apple', 'Samsung', 'DeWalt', 'Milwaukee', 'Nike', 'Adidas'];
  if (premiumBrands.includes(itemData.brand)) {
    demandScore += 2;
  }
  
  // Condition impact
  const conditionRating = typeof itemData.condition?.rating === 'number' 
    ? itemData.condition.rating 
    : 5; // Default to middle rating
    
  if (conditionRating >= 8) {
    demandScore += 2;
  } else if (conditionRating >= 6) {
    demandScore += 1;
  } else if (conditionRating <= 3) {
    demandScore -= 1;
  }
  
  // Return demand level
  if (demandScore >= 6) return 'high';
  if (demandScore >= 4) return 'medium';
  return 'low';
}