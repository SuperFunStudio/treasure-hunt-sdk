function generateListing(itemData, route, options = {}) {
    const {
      platform = 'ebay',
      includeShipping = true,
      returnPolicy = '30-day',
      template = 'default'
    } = options;
  
    const baseListingData = {
      title: generateTitle(itemData),
      description: generateDescription(itemData, template),
      category: mapToMarketplaceCategory(itemData.category, platform),
      condition: mapCondition(itemData.condition.rating, platform),
      images: [], // Will be populated by app
      pricing: {
        startingPrice: route.estimatedReturn || itemData.resale.priceRange.low,
        buyItNowPrice: itemData.resale.priceRange.high,
        acceptOffers: true,
        minimumOffer: itemData.resale.priceRange.low * 0.8
      }
    };
  
    // Platform-specific formatting
    switch (platform) {
      case 'ebay':
        return {
          ...baseListingData,
          itemSpecifics: extractItemSpecifics(itemData),
          shippingOptions: includeShipping ? getShippingOptions() : [],
          returnPolicy: {
            returnsAccepted: returnPolicy !== 'no-returns',
            refundMethod: 'money back',
            returnPeriod: returnPolicy
          }
        };
      
      case 'facebook':
        return {
          title: baseListingData.title,
          price: baseListingData.pricing.buyItNowPrice,
          description: baseListingData.description,
          category: baseListingData.category,
          condition: baseListingData.condition
        };
      
      default:
        return baseListingData;
    }
  }
  
  function generateTitle(itemData) {
    const parts = [];
    
    if (itemData.brand && itemData.brand !== 'Unknown') {
      parts.push(itemData.brand);
    }
    
    if (itemData.model && itemData.model !== 'Unknown') {
      parts.push(itemData.model);
    }
    
    parts.push(itemData.category);
    
    if (itemData.condition.rating === 'poor') {
      parts.push('For Parts/Repair');
    } else if (itemData.condition.rating === 'good') {
      parts.push('Excellent Condition');
    }
    
    return parts.join(' - ').substring(0, 80); // eBay title limit
  }
  
  function generateDescription(itemData, template) {
    const templates = {
      default: `
  ${itemData.condition.description}
  
  Category: ${itemData.category}
  Brand: ${itemData.brand || 'Unbranded'}
  Model: ${itemData.model || 'See photos'}
  
  Condition Notes:
  ${itemData.condition.issues.map(issue => `• ${issue}`).join('\n')}
  
  ${itemData.salvageable && itemData.salvageable.length > 0 ? 
    `\nSalvageable Parts:\n${itemData.salvageable.map(s => `• ${s.component}: ${s.value}`).join('\n')}` : ''}
  
  Found item - selling as-is. Please review all photos carefully before purchasing.
  `,
      minimal: `${itemData.condition.description}\n\nSelling as-is. See photos for condition.`,
      
      detailed: `
  ITEM OVERVIEW
  ============
  ${generateTitle(itemData)}
  
  DETAILED CONDITION
  =================
  ${itemData.condition.description}
  
  Known Issues:
  ${itemData.condition.issues.length > 0 ? itemData.condition.issues.map(issue => `• ${issue}`).join('\n') : '• None noted'}
  
  SPECIFICATIONS
  =============
  • Category: ${itemData.category}
  • Brand: ${itemData.brand || 'Unbranded'}
  • Model: ${itemData.model || 'Not specified'}
  • Usable As-Is: ${itemData.condition.usableAsIs ? 'Yes' : 'No - needs repair'}
  
  ${itemData.resale.justification}
  
  IMPORTANT: This is a found/secondhand item being sold as-is with no warranty. 
  All sales final. Please examine photos carefully and ask questions before bidding.
  `
    };
  
    return templates[template] || templates.default;
  }
  
  function mapToMarketplaceCategory(category, platform) {
    // Simplified mapping - would be much more comprehensive
    const categoryMappings = {
      ebay: {
        'electronics': '58058', // Consumer Electronics
        'furniture': '3197',   // Furniture
        'tools': '631',        // Tools
        'sporting goods': '382', // Sporting Goods
        'clothing': '11450'    // Clothing
      }
    };
  
    return categoryMappings[platform]?.[category.toLowerCase()] || '0';
  }
  
  function mapCondition(rating, platform) {
    const conditionMappings = {
      ebay: {
        'good': '3000',  // Used
        'fair': '3000',  // Used
        'poor': '7000'   // For Parts or Not Working
      }
    };
  
    return conditionMappings[platform]?.[rating] || '3000';
  }
  
  function extractItemSpecifics(itemData) {
    const specifics = {};
    
    if (itemData.brand) specifics.Brand = itemData.brand;
    if (itemData.model) specifics.Model = itemData.model;
    
    // Add more based on category
    return specifics;
  }
  
  function getShippingOptions() {
    return [{
      shippingService: 'USPS Priority Mail',
      shippingCost: 0, // Calculated based on location
      dispatchTime: 2
    }];
  }

  module.exports = { generateListing };
