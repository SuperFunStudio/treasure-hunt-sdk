// utils/xml-builder.js
// XML generation utilities for eBay Trading API

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
 * Generate ItemSpecifics XML based on category and listing data
 */
function generateItemSpecificsXml(category, listingData) {
  let itemSpecifics = [];
  
  // Always add brand
  itemSpecifics.push(`<NameValueList>
      <Name>Brand</Name>
      <Value>${escapeXml(listingData.brand || 'Unbranded')}</Value>
    </NameValueList>`);

  // Add required specifics for furniture category
  if (category?.toLowerCase() === 'furniture') {
    // Required "Number of Items in Set" for furniture
    itemSpecifics.push(`<NameValueList>
      <Name>Number of Items in Set</Name>
      <Value>${listingData.numberOfItemsInSet || '1'}</Value>
    </NameValueList>`);

    // Required "Set Includes" for furniture
    itemSpecifics.push(`<NameValueList>
      <Name>Set Includes</Name>
      <Value>${escapeXml(listingData.setIncludes || 'Chair')}</Value>
    </NameValueList>`);

    if (listingData.material) {
      itemSpecifics.push(`<NameValueList>
        <Name>Material</Name>
        <Value>${escapeXml(listingData.material)}</Value>
      </NameValueList>`);
    }

    if (listingData.color) {
      itemSpecifics.push(`<NameValueList>
        <Name>Color</Name>
        <Value>${escapeXml(listingData.color)}</Value>
      </NameValueList>`);
    }
  }
  
  // Add model if provided
  if (listingData.model) {
    itemSpecifics.push(`<NameValueList>
      <Name>Model</Name>
      <Value>${escapeXml(listingData.model)}</Value>
    </NameValueList>`);
  }

  // Add condition description
  if (listingData.conditionDescription) {
    itemSpecifics.push(`<NameValueList>
      <Name>Condition Description</Name>
      <Value>${escapeXml(listingData.conditionDescription)}</Value>
    </NameValueList>`);
  }

  // Add MPN if provided
  if (listingData.mpn) {
    itemSpecifics.push(`<NameValueList>
      <Name>MPN</Name>
      <Value>${escapeXml(listingData.mpn)}</Value>
    </NameValueList>`);
  }

  // Add UPC if provided
  if (listingData.upc) {
    itemSpecifics.push(`<NameValueList>
      <Name>UPC</Name>
      <Value>${escapeXml(listingData.upc)}</Value>
    </NameValueList>`);
  }

  // Category-specific item specifics
  const normalizedCategory = category?.toLowerCase() || '';
  
  if (normalizedCategory === 'clothing' || normalizedCategory === 'footwear') {
    if (listingData.size) {
      itemSpecifics.push(`<NameValueList>
        <Name>Size</Name>
        <Value>${escapeXml(listingData.size)}</Value>
      </NameValueList>`);
    }
    
    if (listingData.color) {
      itemSpecifics.push(`<NameValueList>
        <Name>Color</Name>
        <Value>${escapeXml(listingData.color)}</Value>
      </NameValueList>`);
    }
    
    if (listingData.gender) {
      itemSpecifics.push(`<NameValueList>
        <Name>Gender</Name>
        <Value>${escapeXml(listingData.gender)}</Value>
      </NameValueList>`);
    }
    
  } else if (normalizedCategory === 'electronics') {
    if (listingData.processorType) {
      itemSpecifics.push(`<NameValueList>
        <Name>Processor Type</Name>
        <Value>${escapeXml(listingData.processorType)}</Value>
      </NameValueList>`);
    }
    
    if (listingData.memorySize) {
      itemSpecifics.push(`<NameValueList>
        <Name>Memory Size</Name>
        <Value>${escapeXml(listingData.memorySize)}</Value>
      </NameValueList>`);
    }
    
    if (listingData.storageCapacity) {
      itemSpecifics.push(`<NameValueList>
        <Name>Storage Capacity</Name>
        <Value>${escapeXml(listingData.storageCapacity)}</Value>
      </NameValueList>`);
    }
  }
  
  // Add any custom item specifics provided
  if (listingData.customSpecifics && Array.isArray(listingData.customSpecifics)) {
    for (const spec of listingData.customSpecifics) {
      if (spec.name && spec.value) {
        itemSpecifics.push(`<NameValueList>
      <Name>${escapeXml(spec.name)}</Name>
      <Value>${escapeXml(spec.value)}</Value>
    </NameValueList>`);
      }
    }
  }
  
  return itemSpecifics.length > 0 ? 
    `<ItemSpecifics>\n    ${itemSpecifics.join('\n    ')}\n  </ItemSpecifics>` : 
    '';
}

/**
 * Build listing XML with business policies
 */
function buildListingXmlWithPolicies(listingData, categoryId, conditionId, location, policyIds, accessToken) {
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
    
    ${generateItemSpecificsXml(listingData.category, listingData)}
  </Item>
</AddItemRequest>`;
}

/**
 * Build listing XML with inline policies (fallback)
 */
function buildListingXmlInline(listingData, categoryId, conditionId, location, accessToken) {
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
    
    ${generateItemSpecificsXml(listingData.category, listingData)}
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