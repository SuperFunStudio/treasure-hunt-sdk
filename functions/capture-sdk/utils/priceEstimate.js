// functions/capture-sdk/utils/priceEstimate.js
// Enhanced price estimation with better shipping calculations
function getEnhancedManualEstimate(itemData, condition) {
  console.log('Using enhanced category-based pricing...');
  const categoryPricing = {
    'electronics': { base: 45, brandMultipliers: { 'Apple': 2.5, 'Samsung': 1.8, 'Sony': 1.6, 'Microsoft': 1.7, 'Nintendo': 1.9, 'HP': 1.2, 'Dell': 1.1, 'Generic': 0.6 } },
    'tools': { base: 25, brandMultipliers: { 'DeWalt': 1.8, 'Milwaukee': 1.7, 'Makita': 1.6, 'Craftsman': 1.3, 'Ryobi': 1.1, 'Generic': 0.7 } },
    'furniture': { base: 35, brandMultipliers: { 'West Elm': 1.5, 'IKEA': 0.8, 'Pottery Barn': 1.6, 'Restoration Hardware': 2.0, 'CB2': 1.4, 'Generic': 0.9 } },
    'clothing': { base: 15, brandMultipliers: { 'Nike': 1.8, 'Adidas': 1.7, 'Levi\'s': 1.4, 'Gucci': 3.0, 'Coach': 2.2, 'Generic': 0.8 } },
    'footwear': { base: 25, brandMultipliers: { 'Nike': 2.0, 'Jordan': 2.5, 'Adidas': 1.8, 'Converse': 1.3, 'Vans': 1.2, 'Generic': 0.7 } },
    'automotive': { base: 40, brandMultipliers: { 'OEM': 1.5, 'AC Delco': 1.3, 'Bosch': 1.4, 'Motorcraft': 1.3, 'Generic': 0.8 } },
    'automobile': { base: 5000, brandMultipliers: {} },
    'car': { base: 5000, brandMultipliers: {} },
    'vehicle': { base: 5000, brandMultipliers: {} },
    'books': { base: 8, brandMultipliers: {} },
    'sporting goods': { base: 20, brandMultipliers: {} },
    'toys': { base: 12, brandMultipliers: {} },
    'jewelry': { base: 35, brandMultipliers: {} },
    'home & garden': { base: 18, brandMultipliers: {} },
    'collectibles': { base: 25, brandMultipliers: {} },
    'art': { base: 50, brandMultipliers: {} },
    'musical instruments': { base: 75, brandMultipliers: {} }
  };
  
  const category = itemData.category?.toLowerCase() || 'unknown';
  const pricing = categoryPricing[category] || { base: 20, brandMultipliers: {} };
  let basePrice = pricing.base;
  if (itemData.brand && pricing.brandMultipliers[itemData.brand]) { basePrice *= pricing.brandMultipliers[itemData.brand]; }
  
  let conditionRating = condition;
  if (typeof condition === 'number') {
    if (condition >= 8) conditionRating = 'excellent';
    else if (condition >= 6) conditionRating = 'good';
    else if (condition >= 4) conditionRating = 'fair';
    else conditionRating = 'poor';
  }
  
  const conditionMultipliers = {
    'excellent': 1.0, 'good': 0.85, 'fair': 0.65, 'poor': 0.35
  };
  const conditionMultiplier = conditionMultipliers[conditionRating] || 0.75;
  basePrice *= conditionMultiplier;
  
  if (itemData.condition?.usableAsIs === false) { basePrice *= 0.6; }
  if (itemData.model && itemData.model !== 'Unknown') { basePrice *= 1.1; }
  
  if (['automobile', 'car', 'vehicle'].includes(category)) {
    const currentYear = new Date().getFullYear();
    const description = itemData.description?.toLowerCase() || '';
    const yearMatch = description.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      const age = currentYear - year;
      if (age <= 1) basePrice *= 0.85; else if (age <= 3) basePrice *= 0.7; else if (age <= 5) basePrice *= 0.55;
      else if (age <= 10) basePrice *= 0.35; else if (age <= 20) basePrice *= 0.2;
      else basePrice *= 0.15;
      if (age >= 25 && conditionRating === 'excellent') { basePrice *= 1.5; }
    }
  }

  const suggestedPrice = Math.round(basePrice);
  const shippingCost = estimateShippingByCategory(category, itemData);
  const ebayFees = calculateEbayFees(suggestedPrice);
  const netProfit = suggestedPrice - ebayFees - shippingCost;

  return {
    suggested: suggestedPrice, confidence: 'medium',
    priceRange: { low: Math.round(suggestedPrice * 0.7), high: Math.round(suggestedPrice * 1.4), median: suggestedPrice },
    shippingCost, ebayFees, netProfit, source: 'enhanced_manual',
    factors: { category: pricing.base, brand: itemData.brand, condition: conditionRating, usableAsIs: itemData.condition?.usableAsIs !== false },
    note: category === 'automobile' ? 'Vehicle pricing - typically local pickup only' : 'Based on enhanced category analysis and brand recognition'
  };
}

function estimateShippingByCategory(category, itemData = {}) {
  const categoryLower = category?.toLowerCase() || 'unknown';
  const shippingEstimates = {
    'electronics': () => {
      const model = itemData.model?.toLowerCase();
      if (model?.includes('phone') || model?.includes('iphone') || model?.includes('galaxy')) return 8;
      if (model?.includes('macbook') || model?.includes('laptop')) return 15;
      if (model?.includes('nintendo') || model?.includes('playstation') || model?.includes('xbox')) return 18;
      return 12;
    },
    'books': () => 5, 'clothing': () => 8, 'footwear': () => 12,
    'tools': () => {
      const desc = itemData.description?.toLowerCase() || '';
      if (desc.includes('drill') || desc.includes('saw') || desc.includes('power')) return 20;
      return 15;
    },
    'furniture': () => {
      const desc = itemData.description?.toLowerCase() || '';
      if (desc.includes('side table') || desc.includes('end table') || desc.includes('nightstand')) return 25;
      if (desc.includes('chair') || desc.includes('coffee table')) return 35;
      if (desc.includes('sofa') || desc.includes('couch') || desc.includes('dining')) return 75;
      return 35;
    },
    'sporting goods': () => 18, 'toys': () => 10, 'jewelry': () => 5,
    'automotive': () => {
      const desc = itemData.description?.toLowerCase() || '';
      if (desc.includes('filter') || desc.includes('bulb') || desc.includes('sensor')) return 10;
      if (desc.includes('alternator') || desc.includes('starter') || desc.includes('radiator')) return 35;
      if (desc.includes('bumper') || desc.includes('hood') || desc.includes('door')) return 85;
      if (desc.includes('wheel') || desc.includes('tire')) return 45;
      return 25;
    },
    'automobile': () => 0, 'car': () => 0, 'vehicle': () => 0, 'motorcycle': () => 0, 'boat': () => 0,
    'home & garden': () => 15, 'collectibles': () => 10, 'art': () => 15,
    'musical instruments': () => {
      const desc = itemData.description?.toLowerCase() || '';
      if (desc.includes('piano') || desc.includes('keyboard') || desc.includes('drum')) return 45;
      if (desc.includes('guitar') || desc.includes('bass')) return 25;
      return 15;
    },
    'unknown': () => 12, 'other': () => 12, 'misc': () => 12, 'miscellaneous': () => 12
  };
  const estimator = shippingEstimates[categoryLower] || shippingEstimates['unknown'];
  return typeof estimator === 'function' ? estimator() : estimator;
}

function calculateEbayFees(salePrice) {
  if (!salePrice) return 0;
  let finalValueFee;
  if (salePrice > 1000) { finalValueFee = Math.min(salePrice * 0.035, 900); }
  else { finalValueFee = salePrice * 0.1325; }
  const paymentFee = (salePrice * 0.029) + 0.30;
  return Math.round((finalValueFee + paymentFee) * 100) / 100;
}

module.exports = {
  getEnhancedManualEstimate,
  estimateShippingByCategory,
  calculateEbayFees
};
