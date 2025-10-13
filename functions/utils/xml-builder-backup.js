// utils/xml-builder.js
// XML generation utilities for eBay Trading API with dynamic category requirements

/**
 * Escape XML special characters
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate picture URLs XML for eBay listing
 */
function generatePictureUrls(images) {
  if (!images || images.length === 0) {
    // Default placeholder if no images provided
    return '<PictureURL>https://placehold.co/400x300/e0e0e0/333?text=No+Image</PictureURL>';
  }
  
  // eBay allows up to 12 pictures
  const maxPictures = Math.min(images.length, 12);
  let pictureXml = '';
  
  for (let i = 0; i < maxPictures; i++) {
    pictureXml += `<PictureURL>${escapeXml(images[i])}</PictureURL>\n      `;
  }
  
  return pictureXml.trim();
}

/**
 * Generate default value for a required aspect
 */
function getDefaultValueForAspect(aspectName, listingData, aspectValues = []) {
  const aspectKey = aspectName.toLowerCase().replace(/\s+/g, '');
  
  // Check if listing data has a matching field
  const dataMapping = {
    'brand': listingData.brand,
    'model': listingData.model,
    'color': listingData.color,
    'material': listingData.material,
    'size': listingData.size,
    'gender': listingData.gender,
    'numberofitemsinset': listingData.numberOfItemsInSet,
    'setincludes': listingData.setIncludes,
    'processortype': listingData.processorType,
    'memorysize': listingData.memorySize,
    'storagecapacity': listingData.storageCapacity,
    'condition': listingData.condition,
    'conditiondescription': listingData.conditionDescription,
    'mpn': listingData.mpn,
    'upc': listingData.upc
  };
  
  // Return user-provided value if available
  if (dataMapping[aspectKey]) {
    return dataMapping[aspectKey];
  }
  
  // Smart defaults based on aspect name
  const smartDefaults = {
    'brand': 'Unbranded',
    'model': 'Unknown',
    'numberofitemsinset': '1',
    'setincludes': inferSetIncludes(listingData),
    'color': 'Multicolor',
    'material': 'Mixed Materials',
    'size': 'One Size',
    'gender': 'Unisex',
    'conditiondescription': 'Item is in the condition specified above.',
    'type': inferItemType(listingData),
    'style': 'Classic'
  };
  
  // Use smart default if available
  if (smartDefaults[aspectKey]) {
    return smartDefaults[aspectKey];
  }
  
  // Use first available value from eBay's suggestions
  if (aspectValues && aspectValues.length > 0) {
    return aspectValues[0];
  }
  
  // Final fallback
  return 'Not Specified';
}

/**
 * Infer set includes from listing data
 */
function inferSetIncludes(listingData) {
  const category = listingData.category?.toLowerCase() || '';
  const title = listingData.title?.toLowerCase() || '';
  const description = listingData.description?.toLowerCase() || '';
  
  // Check for furniture keywords
  if (title.includes('chair') || description.includes('chair')) return 'Chair';
  if (title.includes('table') || description.includes('table')) return 'Table';
  if (title.includes('desk') || description.includes('desk')) return 'Desk';
  if (title.includes('sofa') || description.includes('sofa')) return 'Sofa';
  if (title.includes('bed') || description.includes('bed')) return 'Bed';
  
  // Category-based inference
  if (category.includes('furniture')) return 'Chair';
  
  return 'Item';
}

/**
 * Infer item type from listing data
 */
function inferItemType(listingData) {
  const title = listingData.title?.toLowerCase() || '';
  const category = listingData.category?.toLowerCase() || '';
  
  if (category.includes('electronics')) {
    if (title.includes('phone')) return 'Phone';
    if (title.includes('computer') || title.includes('laptop')) return 'Computer';
    if (title.includes('tablet')) return 'Tablet';
    return 'Electronic Device';
  }
  
  if (category.includes('furniture')) {
    if (title.includes('chair')) return 'Chair';
    if (title.includes('table')) return 'Table';
    return 'Furniture';
  }
  
  return 'Other';
}

/**
 * Generate ItemSpecifics XML using dynamic category requirements
 */ 

function generateItemSpecificsXml(category, listingData, categoryRequirements = null) {
  let itemSpecifics = [];
  
  console.log('Generating item specifics for category:', category);
  console.log('Category requirements:', categoryRequirements);
  
  // Process required aspects from eBay API first
  if (categoryRequirements?.success && categoryRequirements.requiredAspects) {
    console.log('Processing required aspects from API:', categoryRequirements.requiredAspects.length);
    
    for (const aspect of categoryRequirements.requiredAspects) {
      const value = getDefaultValueForAspect(aspect.name, listingData, aspect.values);
      
      itemSpecifics.push(`<NameValueList>
      <Name>${escapeXml(aspect.name)}</Name>
      <Value>${escapeXml(value)}</Value>
    </NameValueList>`);
      
      console.log(`Added required aspect: ${aspect.name} = ${value}`);
    }
  } else {
    console.log('No API requirements, using fallback logic');
    
    // Fallback: Always add brand
    itemSpecifics.push(`<NameValueList>
      <Name>Brand</Name>
      <Value>${escapeXml(listingData.brand || 'Unbranded')}</Value>
    </NameValueList>`);

    // Enhanced keyword detection for furniture
    if (category?.toLowerCase().match(/(chair|furniture|table|ottoman|sofa|desk|bed|dresser|cabinet|armchair|cantilever)/)) {
      console.log('Detected furniture by keywords, adding required specifics');
      
      itemSpecifics.push(`<NameValueList>
        <Name>Number of Items in Set</Name>
        <Value>${listingData.numberOfItemsInSet || '1'}</Value>
      </NameValueList>`);

      itemSpecifics.push(`<NameValueList>
        <Name>Set Includes</Name>
        <Value>${escapeXml(listingData.setIncludes || inferSetIncludes(listingData))}</Value>
      </NameValueList>`);
      
      console.log('Added furniture-specific required aspects');
    }
  }
  
  // Add recommended aspects if available and not already added
  if (categoryRequirements?.success && categoryRequirements.recommendedAspects) {
    const addedNames = new Set(itemSpecifics.map(spec => {
      const nameMatch = spec.match(/<Name>(.*?)<\/Name>/);
      return nameMatch ? nameMatch[1] : '';
    }));
    
    for (const aspect of categoryRequirements.recommendedAspects) {
      if (!addedNames.has(aspect.name)) {
        const value = getDefaultValueForAspect(aspect.name, listingData, aspect.values);
        
        // Only add if we have a meaningful value
        if (value && value !== 'Not Specified') {
          itemSpecifics.push(`<NameValueList>
        <Name>${escapeXml(aspect.name)}</Name>
        <Value>${escapeXml(value)}</Value>
      </NameValueList>`);
          
          console.log(`Added recommended aspect: ${aspect.name} = ${value}`);
        }
      }
    }
  }
  
  // Add additional fields from listing data that weren't covered
  const additionalFields = [
    { field: 'model', name: 'Model' },
    { field: 'conditionDescription', name: 'Condition Description' },
    { field: 'mpn', name: 'MPN' },
    { field: 'upc', name: 'UPC' }
  ];
  
  const addedNames = new Set(itemSpecifics.map(spec => {
    const nameMatch = spec.match(/<Name>(.*?)<\/Name>/);
    return nameMatch ? nameMatch[1] : '';
  }));
  
  for (const { field, name } of additionalFields) {
    if (listingData[field] && !addedNames.has(name)) {
      itemSpecifics.push(`<NameValueList>
      <Name>${name}</Name>
      <Value>${escapeXml(listingData[field])}</Value>
    </NameValueList>`);
    }
  }
  
  // Add any custom item specifics provided
  if (listingData.customSpecifics && Array.isArray(listingData.customSpecifics)) {
    for (const spec of listingData.customSpecifics) {
      if (spec.name && spec.value && !addedNames.has(spec.name)) {
        itemSpecifics.push(`<NameValueList>
      <Name>${escapeXml(spec.name)}</Name>
      <Value>${escapeXml(spec.value)}</Value>
    </NameValueList>`);
      }
    }
  }
  
  console.log(`Generated ${itemSpecifics.length} item specifics total`);
  
  return itemSpecifics.length > 0 ? 
    `<ItemSpecifics>\n    ${itemSpecifics.join('\n    ')}\n  </ItemSpecifics>` : 
    '';
}

/**
 * Build listing XML with business policies
 */
function buildListingXmlWithPolicies(listingData, categoryId, conditionId, location, policyIds, accessToken, categoryRequirements = null) {
  return `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <Title>${escapeXml(listingData.title?.substring(0, 80) || 'Item for Sale')}</Title>
    <Description>${escapeXml(listingData.description || 'Please see photos for details')}</Description>
    <PrimaryCategory>
      <CategoryID>${categoryId}</CategoryID>
    </PrimaryCategory>
    <ConditionID>${conditionId}</ConditionID>
    <Location>${escapeXml(location.city)}, ${escapeXml(location.state)}</Location>
    <Country>${location.country.toUpperCase()}</Country>
    <PostalCode>${escapeXml(location.postalCode)}</PostalCode>
    <Currency>USD</Currency>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <StartPrice>${(listingData.pricing?.buyItNowPrice || 9.99).toFixed(2)}</StartPrice>
    <Quantity>${listingData.quantity || 1}</Quantity>
    <DispatchTimeMax>${listingData.handlingTime || 1}</DispatchTimeMax>
    
    <!-- Business Policies -->
    <SellerProfiles>
      <SellerShippingProfile>
        <ShippingProfileID>${policyIds.fulfillmentPolicyId}</ShippingProfileID>
      </SellerShippingProfile>
      <SellerPaymentProfile>
        <PaymentProfileID>${policyIds.paymentPolicyId}</PaymentProfileID>
      </SellerPaymentProfile>
      <SellerReturnProfile>
        <ReturnProfileID>${policyIds.returnPolicyId}</ReturnProfileID>
      </SellerReturnProfile>
    </SellerProfiles>
    
    <PictureDetails>
      ${generatePictureUrls(listingData.images)}
    </PictureDetails>
    
    ${generateItemSpecificsXml(listingData.category, listingData, categoryRequirements)}
  </Item>
</AddItemRequest>`;
}

/**
 * Build listing XML with inline policies (fallback)
 */
function buildListingXmlInline(listingData, categoryId, conditionId, location, accessToken, categoryRequirements = null) {
  return `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <Title>${escapeXml(listingData.title?.substring(0, 80) || 'Item for Sale')}</Title>
    <Description>${escapeXml(listingData.description || 'Please see photos for details')}</Description>
    <PrimaryCategory>
      <CategoryID>${categoryId}</CategoryID>
    </PrimaryCategory>
    <ConditionID>${conditionId}</ConditionID>
    <Location>${escapeXml(location.city)}, ${escapeXml(location.state)}</Location>
    <Country>${location.country.toUpperCase()}</Country>
    <PostalCode>${escapeXml(location.postalCode)}</PostalCode>
    <Currency>USD</Currency>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <StartPrice>${(listingData.pricing?.buyItNowPrice || 9.99).toFixed(2)}</StartPrice>
    <Quantity>${listingData.quantity || 1}</Quantity>
    <DispatchTimeMax>${listingData.handlingTime || 1}</DispatchTimeMax>
    
    <!-- Inline Shipping -->
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>USPSPriority</ShippingService>
        <ShippingServiceCost currencyID="USD">9.99</ShippingServiceCost>
        <ShippingServiceAdditionalCost currencyID="USD">5.00</ShippingServiceAdditionalCost>
      </ShippingServiceOptions>
      <ShippingServiceOptions>
        <ShippingServicePriority>2</ShippingServicePriority>
        <ShippingService>USPSFirstClass</ShippingService>
        <ShippingServiceCost currencyID="USD">5.99</ShippingServiceCost>
        <ShippingServiceAdditionalCost currencyID="USD">3.00</ShippingServiceAdditionalCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    
    <!-- Inline Return Policy -->
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <RefundOption>MoneyBack</RefundOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
      <Description>30-day returns. Buyer pays return shipping.</Description>
    </ReturnPolicy>
    
    <PictureDetails>
      ${generatePictureUrls(listingData.images)}
    </PictureDetails>
    
    ${generateItemSpecificsXml(listingData.category, listingData, categoryRequirements)}
  </Item>
</AddItemRequest>`;
}

module.exports = {
  escapeXml,
  generatePictureUrls,
  generateItemSpecificsXml,
  buildListingXmlWithPolicies,
  buildListingXmlInline
};