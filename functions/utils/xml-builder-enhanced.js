// utils/xml-builder-enhanced.js
// Enhanced XML generation with dynamic item specifics based on category requirements

/**
 * Escape XML special characters
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
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
    return '<PictureURL>https://placehold.co/400x300/e0e0e0/333?text=No+Image</PictureURL>';
  }
  
  const maxPictures = Math.min(images.length, 12);
  let pictureXml = '';
  
  for (let i = 0; i < maxPictures; i++) {
    if (images[i] && images[i].startsWith('http')) {
      pictureXml += `<PictureURL>${escapeXml(images[i])}</PictureURL>\n      `;
    }
  }
  
  return pictureXml.trim() || '<PictureURL>https://placehold.co/400x300/e0e0e0/333?text=No+Image</PictureURL>';
}

/**
 * Enhanced ItemSpecifics generator with category requirements
 */
function generateItemSpecificsXml(category, listingData, categoryRequirements = null) {
  console.log('Generating ItemSpecifics for category:', category);
  console.log('Category requirements:', categoryRequirements?.success ? 'API data' : 'fallback/none');
  
  const itemSpecifics = [];
  const processedFields = new Set();

  // Import the category requirements service for intelligent defaults
  const CategoryRequirementsService = require('../services/ebay/categoryRequirementsService');
  const categoryService = new CategoryRequirementsService();

  try {
    // Process requirements-based specifics first
    if (categoryRequirements?.requiredAspects) {
      categoryRequirements.requiredAspects.forEach(aspect => {
        const fieldName = categoryService.mapAspectToField(aspect.name);
        let value = listingData[fieldName];

        // Generate intelligent default if missing
        if (!value || value === 'Unknown' || value === '') {
          value = categoryService.getDefaultValue(aspect, listingData);
          console.log(`Generated default for ${aspect.name}: ${value}`);
        }

        // Validate value against allowed values
        if (aspect.values && aspect.values.length > 0) {
          if (!aspect.values.includes(value)) {
            // Use first allowed value as fallback
            value = aspect.values[0];
            console.log(`Using fallback value for ${aspect.name}: ${value}`);
          }
        }

        if (value) {
          itemSpecifics.push(`<NameValueList>
      <Name>${escapeXml(aspect.name)}</Name>
      <Value>${escapeXml(value)}</Value>
    </NameValueList>`);
          processedFields.add(fieldName);
        }
      });

      // Process optional aspects that have values
      if (categoryRequirements.optionalAspects) {
        categoryRequirements.optionalAspects.forEach(aspect => {
          const fieldName = categoryService.mapAspectToField(aspect.name);
          const value = listingData[fieldName];

          if (value && value !== 'Unknown' && !processedFields.has(fieldName)) {
            // Validate against allowed values if provided
            let finalValue = value;
            if (aspect.values && aspect.values.length > 0 && !aspect.values.includes(value)) {
              finalValue = aspect.values[0];
            }

            itemSpecifics.push(`<NameValueList>
      <Name>${escapeXml(aspect.name)}</Name>
      <Value>${escapeXml(finalValue)}</Value>
    </NameValueList>`);
            processedFields.add(fieldName);
          }
        });
      }
    } else {
      console.warn('No category requirements provided, using fallback logic');
    }

    // Add category-specific fallback specifics
    addCategorySpecificFallbacks(category, listingData, itemSpecifics, processedFields);

    // Add universal specifics that haven't been processed
    addUniversalSpecifics(listingData, itemSpecifics, processedFields);

    // Log final specifics for debugging
    console.log(`Generated ${itemSpecifics.length} item specifics for category: ${category}`);

    return itemSpecifics.length > 0 ? 
      `<ItemSpecifics>\n    ${itemSpecifics.join('\n    ')}\n  </ItemSpecifics>` : 
      '';

  } catch (error) {
    console.error('Error generating ItemSpecifics:', error);
    // Return basic specifics as fallback
    return generateBasicItemSpecifics(listingData);
  }
}

/**
 * Add category-specific fallback specifics when requirements are unavailable
 */
function addCategorySpecificFallbacks(category, listingData, itemSpecifics, processedFields) {
  const normalizedCategory = category?.toLowerCase() || '';

  if (normalizedCategory.includes('footwear') || normalizedCategory.includes('shoes')) {
    addFootwearSpecifics(listingData, itemSpecifics, processedFields);
  } else if (normalizedCategory.includes('electronics') || normalizedCategory.includes('headphones')) {
    addElectronicsSpecifics(listingData, itemSpecifics, processedFields);
  } else if (normalizedCategory.includes('clothing') || normalizedCategory.includes('apparel')) {
    addClothingSpecifics(listingData, itemSpecifics, processedFields);
  } else if (normalizedCategory.includes('furniture')) {
    addFurnitureSpecifics(listingData, itemSpecifics, processedFields);
  }
}

/**
 * Add footwear-specific item specifics
 */
function addFootwearSpecifics(listingData, itemSpecifics, processedFields) {
  // US Shoe Size - critical for footwear
  if (!processedFields.has('size') && listingData.size) {
    itemSpecifics.push(`<NameValueList>
      <Name>US Shoe Size</Name>
      <Value>${escapeXml(listingData.size)}</Value>
    </NameValueList>`);
    processedFields.add('size');
  } else if (!processedFields.has('size')) {
    // Default size if missing
    itemSpecifics.push(`<NameValueList>
      <Name>US Shoe Size</Name>
      <Value>10</Value>
    </NameValueList>`);
    processedFields.add('size');
  }

  // Style - required for many footwear categories
  if (!processedFields.has('style') && listingData.style) {
    itemSpecifics.push(`<NameValueList>
      <Name>Style</Name>
      <Value>${escapeXml(listingData.style)}</Value>
    </NameValueList>`);
    processedFields.add('style');
  } else if (!processedFields.has('style')) {
    itemSpecifics.push(`<NameValueList>
      <Name>Style</Name>
      <Value>Athletic</Value>
    </NameValueList>`);
    processedFields.add('style');
  }

  // Width if available
  if (!processedFields.has('width') && listingData.width) {
    itemSpecifics.push(`<NameValueList>
      <Name>Width</Name>
      <Value>${escapeXml(listingData.width)}</Value>
    </NameValueList>`);
    processedFields.add('width');
  }
}

/**
 * Add electronics-specific item specifics
 */
function addElectronicsSpecifics(listingData, itemSpecifics, processedFields) {
  // Type - critical for headphones and many electronics
  if (!processedFields.has('type')) {
    let type = listingData.type || listingData.subcategory;
    
    if (!type) {
      // Intelligent guessing based on description
      const description = (listingData.description || '').toLowerCase();
      if (description.includes('over-ear') || description.includes('over ear')) {
        type = 'Over-Ear';
      } else if (description.includes('on-ear') || description.includes('on ear')) {
        type = 'On-Ear';
      } else if (description.includes('in-ear') || description.includes('earbud')) {
        type = 'In-Ear';
      } else {
        type = 'Over-Ear'; // Default for headphones
      }
    }

    itemSpecifics.push(`<NameValueList>
      <Name>Type</Name>
      <Value>${escapeXml(type)}</Value>
    </NameValueList>`);
    processedFields.add('type');
  }

  // Connectivity if available
  if (!processedFields.has('connectivity') && listingData.connectivity) {
    itemSpecifics.push(`<NameValueList>
      <Name>Connectivity</Name>
      <Value>${escapeXml(listingData.connectivity)}</Value>
    </NameValueList>`);
    processedFields.add('connectivity');
  } else if (!processedFields.has('connectivity')) {
    // Guess from description
    const description = (listingData.description || '').toLowerCase();
    const title = (listingData.title || '').toLowerCase();
    
    if (description.includes('wireless') || title.includes('wireless') || 
        description.includes('bluetooth') || title.includes('bluetooth')) {
      itemSpecifics.push(`<NameValueList>
        <Name>Connectivity</Name>
        <Value>Wireless</Value>
      </NameValueList>`);
      processedFields.add('connectivity');
    }
  }
}

/**
 * Add clothing-specific item specifics
 */
function addClothingSpecifics(listingData, itemSpecifics, processedFields) {
  // Size - critical for clothing
  if (!processedFields.has('size') && listingData.size) {
    itemSpecifics.push(`<NameValueList>
      <Name>Size</Name>
      <Value>${escapeXml(listingData.size)}</Value>
    </NameValueList>`);
    processedFields.add('size');
  } else if (!processedFields.has('size')) {
    itemSpecifics.push(`<NameValueList>
      <Name>Size</Name>
      <Value>M</Value>
    </NameValueList>`);
    processedFields.add('size');
  }

  // Gender if available
  if (!processedFields.has('gender') && listingData.gender) {
    itemSpecifics.push(`<NameValueList>
      <Name>Gender</Name>
      <Value>${escapeXml(listingData.gender)}</Value>
    </NameValueList>`);
    processedFields.add('gender');
  }

  // Material if available
  if (!processedFields.has('material') && listingData.material) {
    itemSpecifics.push(`<NameValueList>
      <Name>Material</Name>
      <Value>${escapeXml(listingData.material)}</Value>
    </NameValueList>`);
    processedFields.add('material');
  }
}

/**
 * Add furniture-specific item specifics
 */
function addFurnitureSpecifics(listingData, itemSpecifics, processedFields) {
  // Number of Items in Set - required for furniture
  if (!processedFields.has('numberOfItemsInSet')) {
    const count = listingData.numberOfItemsInSet || '1';
    itemSpecifics.push(`<NameValueList>
      <Name>Number of Items in Set</Name>
      <Value>${escapeXml(count)}</Value>
    </NameValueList>`);
    processedFields.add('numberOfItemsInSet');
  }

  // Set Includes - required for furniture
  if (!processedFields.has('setIncludes')) {
    const includes = listingData.setIncludes || 
                    listingData.subcategory || 
                    'Furniture Item';
    itemSpecifics.push(`<NameValueList>
      <Name>Set Includes</Name>
      <Value>${escapeXml(includes)}</Value>
    </NameValueList>`);
    processedFields.add('setIncludes');
  }

  // Material if available
  if (!processedFields.has('material') && listingData.material) {
    itemSpecifics.push(`<NameValueList>
      <Name>Material</Name>
      <Value>${escapeXml(listingData.material)}</Value>
    </NameValueList>`);
    processedFields.add('material');
  }

  // Color if available
  if (!processedFields.has('color') && listingData.color) {
    itemSpecifics.push(`<NameValueList>
      <Name>Color</Name>
      <Value>${escapeXml(listingData.color)}</Value>
    </NameValueList>`);
    processedFields.add('color');
  }
}

/**
 * Add universal item specifics that apply to all categories
 */
function addUniversalSpecifics(listingData, itemSpecifics, processedFields) {
  // Brand - almost always required
  if (!processedFields.has('brand')) {
    const brand = listingData.brand && listingData.brand !== 'Unknown' ? 
                  listingData.brand : 'Unbranded';
    itemSpecifics.push(`<NameValueList>
      <Name>Brand</Name>
      <Value>${escapeXml(brand)}</Value>
    </NameValueList>`);
    processedFields.add('brand');
  }

  // Model if available and not processed
  if (!processedFields.has('model') && listingData.model && listingData.model !== 'Unknown') {
    itemSpecifics.push(`<NameValueList>
      <Name>Model</Name>
      <Value>${escapeXml(listingData.model)}</Value>
    </NameValueList>`);
    processedFields.add('model');
  }

  // UPC if available
  if (!processedFields.has('upc') && listingData.upc) {
    itemSpecifics.push(`<NameValueList>
      <Name>UPC</Name>
      <Value>${escapeXml(listingData.upc)}</Value>
    </NameValueList>`);
    processedFields.add('upc');
  }

  // MPN if available
  if (!processedFields.has('mpn') && listingData.mpn) {
    itemSpecifics.push(`<NameValueList>
      <Name>MPN</Name>
      <Value>${escapeXml(listingData.mpn)}</Value>
    </NameValueList>`);
    processedFields.add('mpn');
  }

  // Country/Region of Manufacture - good fallback
  if (!processedFields.has('countryOfManufacture')) {
    itemSpecifics.push(`<NameValueList>
      <Name>Country/Region of Manufacture</Name>
      <Value>United States</Value>
    </NameValueList>`);
    processedFields.add('countryOfManufacture');
  }
}

/**
 * Generate basic item specifics as absolute fallback
 */
function generateBasicItemSpecifics(listingData) {
  const brand = listingData.brand && listingData.brand !== 'Unknown' ? 
                listingData.brand : 'Unbranded';
  
  return `<ItemSpecifics>
    <NameValueList>
      <Name>Brand</Name>
      <Value>${escapeXml(brand)}</Value>
    </NameValueList>
    <NameValueList>
      <Name>Type</Name>
      <Value>Other</Value>
    </NameValueList>
  </ItemSpecifics>`;
}

/**
 * Build listing XML with business policies and enhanced item specifics
 */
function buildListingXmlWithPolicies(listingData, categoryId, conditionId, location, policyIds, accessToken, categoryRequirements) {
  const itemSpecificsXml = generateItemSpecificsXml(listingData.category, listingData, categoryRequirements);
  
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
    
    ${itemSpecificsXml}
  </Item>
</AddItemRequest>`;
}

/**
 * Build listing XML with inline policies and enhanced item specifics
 */
function buildListingXmlInline(listingData, categoryId, conditionId, location, accessToken, categoryRequirements) {
  const itemSpecificsXml = generateItemSpecificsXml(listingData.category, listingData, categoryRequirements);
  
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
    
    <!-- Inline Policies -->
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>USPSPriority</ShippingService>
        <ShippingServiceCost currencyID="USD">9.99</ShippingServiceCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <RefundOption>MoneyBack</RefundOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
    </ReturnPolicy>
    
    <PictureDetails>
      ${generatePictureUrls(listingData.images)}
    </PictureDetails>
    
    ${itemSpecificsXml}
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