// capture-sdk/core/routeDisposition.js
import { estimatePrice } from '../utils/priceEstimate.js';

export async function routeDisposition(itemData, userPreferences = {}) {

    const {
    preferInstantOffer = false,
    minResaleValue = 10,
    location,
    hasEbayAccount = false
  } = userPreferences;

  const routes = [];
  
  // Get market price estimate
  console.log('Getting market price estimate...');

  const marketPrice = await estimatePrice(itemData);
  console.log('Market price:', marketPrice);

  const instantOfferPrice = marketPrice * 0.65; // 65% of market value

  // Resale route (if valuable enough)
  if (marketPrice >= minResaleValue && itemData.condition.usableAsIs) {
    if (hasEbayAccount) {
      routes.push({
        type: 'ebay',
        priority: preferInstantOffer ? 2 : 1,
        estimatedReturn: marketPrice * 0.85, // After fees
        timeToMoney: '7-14 days',
        effort: 'medium'
      });
    }

    routes.push({
      type: 'instant-offer',
      priority: preferInstantOffer ? 1 : 2,
      estimatedReturn: instantOfferPrice,
      timeToMoney: '1-3 days',
      effort: 'low'
    });

    routes.push({
      type: 'local-pickup',
      priority: 3,
      estimatedReturn: 0,
      timeToMoney: 'immediate',
      effort: 'minimal',
      pinDuration: '4 hours'
    });
  }

  // Donation route
  console.log('Checking donation route...');

  if (itemData.condition.rating !== 'poor') {
    routes.push({
      type: 'donate',
      priority: routes.length + 1,
      organization: await findNearestDonationCenter(location, itemData.category),
      taxDeductible: marketPrice > 50
    });
  }

  // Recycling/Parts route
  console.log('Checking recycling route...');

  if (itemData.salvageable && itemData.salvageable.length > 0) {
    routes.push({
      type: 'recycle-parts',
      priority: routes.length + 1,
      components: itemData.salvageable,
      recyclingCenter: await findRecyclingCenter(location, itemData.category)
    });
  }
  console.log('Routes complete, returning results...');

  return {
    recommendedRoute: routes[0] || { type: 'dispose', reason: 'No viable routes' },
    allRoutes: routes.sort((a, b) => a.priority - b.priority),
    marketAnalysis: {
      estimatedValue: marketPrice,
      instantOffer: instantOfferPrice,
      demandLevel: calculateDemandLevel(itemData)
    }
  };
}

async function findNearestDonationCenter(location, category) {
  // Placeholder - would integrate with donation APIs
  return {
    name: 'Local Goodwill',
    distance: '2.3 miles',
    accepts: ['electronics', 'furniture', 'clothing']
  };
}

async function findRecyclingCenter(location, category) {
  // Placeholder - would integrate with recycling APIs
  return {
    name: 'City Recycling Center',
    distance: '5.1 miles',
    accepts: ['electronics', 'metal', 'plastic']
  };
}

function calculateDemandLevel(itemData) {
  // Simple heuristic based on category and condition
  const highDemandCategories = ['electronics', 'tools', 'sporting goods'];
  if (highDemandCategories.includes(itemData.category) && 
      itemData.condition.rating !== 'poor') {
    return 'high';
  }
  return 'medium';
}
