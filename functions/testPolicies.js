/**
 * eBay Policy Validation and Retrieval System
 * Fetches and validates all policies from your connected eBay account
 */

// Main function to validate and retrieve all policies
async function validateEbayPolicies(accessToken, marketplaceId = 'EBAY_US') {
  console.log('🔍 Starting eBay policy validation...');
  
  const results = {
    success: false,
    policies: {
      fulfillment: [],
      payment: [],
      return: []
    },
    validation: {
      hasValidFulfillment: false,
      hasValidPayment: false,
      hasValidReturn: false,
      errors: [],
      warnings: []
    },
    recommendedPolicies: {
      fulfillmentPolicyId: null,
      paymentPolicyId: null,
      returnPolicyId: null
    }
  };

  try {
    // Fetch all policy types
    const [fulfillmentPolicies, paymentPolicies, returnPolicies] = await Promise.all([
      fetchFulfillmentPolicies(accessToken, marketplaceId),
      fetchPaymentPolicies(accessToken, marketplaceId),
      fetchReturnPolicies(accessToken, marketplaceId)
    ]);

    results.policies.fulfillment = fulfillmentPolicies;
    results.policies.payment = paymentPolicies;
    results.policies.return = returnPolicies;

    // Validate each policy type
    validateFulfillmentPolicies(fulfillmentPolicies, results);
    validatePaymentPolicies(paymentPolicies, results);
    validateReturnPolicies(returnPolicies, results);

    // Set recommended policies (first valid one of each type)
    setRecommendedPolicies(results);

    // Overall success check
    results.success = results.validation.hasValidFulfillment && 
                     results.validation.hasValidPayment && 
                     results.validation.hasValidReturn;

    console.log('✅ Policy validation completed');
    logValidationResults(results);
    
    return results;

  } catch (error) {
    console.error('❌ Policy validation failed:', error);
    results.validation.errors.push(`Policy validation failed: ${error.message}`);
    return results;
  }
}

// Fetch fulfillment policies from eBay
async function fetchFulfillmentPolicies(accessToken, marketplaceId) {
  console.log('📋 Fetching fulfillment policies...');
  
  try {
    const response = await fetch(`https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        'Accept-Language': 'en-US'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`📦 Found ${data.fulfillmentPolicies?.length || 0} fulfillment policies`);
    
    return data.fulfillmentPolicies || [];
  } catch (error) {
    console.error('❌ Failed to fetch fulfillment policies:', error);
    throw error;
  }
}

// Fetch payment policies from eBay
async function fetchPaymentPolicies(accessToken, marketplaceId) {
  console.log('💳 Fetching payment policies...');
  
  try {
    const response = await fetch(`https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        'Accept-Language': 'en-US'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`💰 Found ${data.paymentPolicies?.length || 0} payment policies`);
    
    return data.paymentPolicies || [];
  } catch (error) {
    console.error('❌ Failed to fetch payment policies:', error);
    throw error;
  }
}

// Fetch return policies from eBay
async function fetchReturnPolicies(accessToken, marketplaceId) {
  console.log('🔄 Fetching return policies...');
  
  try {
    const response = await fetch(`https://api.ebay.com/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        'Accept-Language': 'en-US'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`🔙 Found ${data.returnPolicies?.length || 0} return policies`);
    
    return data.returnPolicies || [];
  } catch (error) {
    console.error('❌ Failed to fetch return policies:', error);
    throw error;
  }
}

// Validate fulfillment policies
function validateFulfillmentPolicies(policies, results) {
  console.log('🔍 Validating fulfillment policies...');
  
  if (!policies || policies.length === 0) {
    results.validation.errors.push('No fulfillment policies found');
    return;
  }

  let hasValid = false;
  
  policies.forEach(policy => {
    const validation = validateSingleFulfillmentPolicy(policy);
    
    if (validation.isValid) {
      hasValid = true;
      console.log(`✅ Valid fulfillment policy: "${policy.name}" (${policy.fulfillmentPolicyId})`);
    } else {
      console.log(`❌ Invalid fulfillment policy: "${policy.name}" - ${validation.errors.join(', ')}`);
      results.validation.errors.push(`Fulfillment policy "${policy.name}": ${validation.errors.join(', ')}`);
    }
    
    // Add validation info to policy object
    policy._validation = validation;
  });

  results.validation.hasValidFulfillment = hasValid;
}

// Validate a single fulfillment policy
function validateSingleFulfillmentPolicy(policy) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check if policy has shipping options
  if (!policy.shippingOptions || policy.shippingOptions.length === 0) {
    validation.isValid = false;
    validation.errors.push('No shipping options defined');
  } else {
    // Check each shipping option
    policy.shippingOptions.forEach((option, index) => {
      if (!option.shippingServices || option.shippingServices.length === 0) {
        validation.isValid = false;
        validation.errors.push(`Shipping option ${index + 1} has no shipping services`);
      } else {
        // Validate shipping services
        option.shippingServices.forEach((service, serviceIndex) => {
          if (!service.shippingServiceCode) {
            validation.isValid = false;
            validation.errors.push(`Shipping service ${serviceIndex + 1} in option ${index + 1} missing service code`);
          }
          if (!service.shippingCost || (!service.shippingCost.value && service.shippingCost.value !== 0)) {
            validation.warnings.push(`Shipping service ${serviceIndex + 1} in option ${index + 1} has no cost defined`);
          }
        });
      }
    });
  }

  // Check handling time
  if (!policy.handlingTime || !policy.handlingTime.value) {
    validation.warnings.push('No handling time specified');
  }

  return validation;
}

// Validate payment policies
function validatePaymentPolicies(policies, results) {
  console.log('🔍 Validating payment policies...');
  
  if (!policies || policies.length === 0) {
    results.validation.errors.push('No payment policies found');
    return;
  }

  let hasValid = false;
  
  policies.forEach(policy => {
    const validation = validateSinglePaymentPolicy(policy);
    
    if (validation.isValid) {
      hasValid = true;
      console.log(`✅ Valid payment policy: "${policy.name}" (${policy.paymentPolicyId})`);
    } else {
      console.log(`❌ Invalid payment policy: "${policy.name}" - ${validation.errors.join(', ')}`);
      results.validation.errors.push(`Payment policy "${policy.name}": ${validation.errors.join(', ')}`);
    }
    
    policy._validation = validation;
  });

  results.validation.hasValidPayment = hasValid;
}

// Validate a single payment policy
function validateSinglePaymentPolicy(policy) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check if payment methods are defined
  if (!policy.paymentMethods || policy.paymentMethods.length === 0) {
    validation.isValid = false;
    validation.errors.push('No payment methods defined');
  }

  // Check immediate payment requirement for certain categories
  if (!policy.immediatePay) {
    validation.warnings.push('Immediate payment not required (may limit some categories)');
  }

  return validation;
}

// Validate return policies
function validateReturnPolicies(policies, results) {
  console.log('🔍 Validating return policies...');
  
  if (!policies || policies.length === 0) {
    results.validation.errors.push('No return policies found');
    return;
  }

  let hasValid = false;
  
  policies.forEach(policy => {
    const validation = validateSingleReturnPolicy(policy);
    
    if (validation.isValid) {
      hasValid = true;
      console.log(`✅ Valid return policy: "${policy.name}" (${policy.returnPolicyId})`);
    } else {
      console.log(`❌ Invalid return policy: "${policy.name}" - ${validation.errors.join(', ')}`);
      results.validation.errors.push(`Return policy "${policy.name}": ${validation.errors.join(', ')}`);
    }
    
    policy._validation = validation;
  });

  results.validation.hasValidReturn = hasValid;
}

// Validate a single return policy
function validateSingleReturnPolicy(policy) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Basic validation - return policies are generally simpler
  if (!policy.returnsAccepted !== undefined) {
    if (policy.returnsAccepted && (!policy.returnPeriod || !policy.returnPeriod.value)) {
      validation.warnings.push('Returns accepted but no return period specified');
    }
  }

  return validation;
}

// Set recommended policies (first valid one of each type)
function setRecommendedPolicies(results) {
  // Find first valid fulfillment policy
  const validFulfillment = results.policies.fulfillment.find(p => p._validation?.isValid);
  if (validFulfillment) {
    results.recommendedPolicies.fulfillmentPolicyId = validFulfillment.fulfillmentPolicyId;
  }

  // Find first valid payment policy
  const validPayment = results.policies.payment.find(p => p._validation?.isValid);
  if (validPayment) {
    results.recommendedPolicies.paymentPolicyId = validPayment.paymentPolicyId;
  }

  // Find first valid return policy
  const validReturn = results.policies.return.find(p => p._validation?.isValid);
  if (validReturn) {
    results.recommendedPolicies.returnPolicyId = validReturn.returnPolicyId;
  }
}

// Log validation results in a readable format
function logValidationResults(results) {
  console.log('\n📊 POLICY VALIDATION SUMMARY');
  console.log('=====================================');
  
  console.log(`Overall Status: ${results.success ? '✅ READY TO LIST' : '❌ ISSUES FOUND'}`);
  
  console.log(`\n📦 Fulfillment Policies: ${results.policies.fulfillment.length} found`);
  console.log(`   Valid: ${results.validation.hasValidFulfillment ? '✅' : '❌'}`);
  console.log(`   Recommended ID: ${results.recommendedPolicies.fulfillmentPolicyId || 'None'}`);
  
  console.log(`\n💳 Payment Policies: ${results.policies.payment.length} found`);
  console.log(`   Valid: ${results.validation.hasValidPayment ? '✅' : '❌'}`);
  console.log(`   Recommended ID: ${results.recommendedPolicies.paymentPolicyId || 'None'}`);
  
  console.log(`\n🔄 Return Policies: ${results.policies.return.length} found`);
  console.log(`   Valid: ${results.validation.hasValidReturn ? '✅' : '❌'}`);
  console.log(`   Recommended ID: ${results.recommendedPolicies.returnPolicyId || 'None'}`);

  if (results.validation.errors.length > 0) {
    console.log('\n❌ ERRORS TO FIX:');
    results.validation.errors.forEach(error => console.log(`   • ${error}`));
  }

  if (results.validation.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    results.validation.warnings.forEach(warning => console.log(`   • ${warning}`));
  }

  console.log('\n=====================================\n');
}

// Helper function to get policy details for debugging
function getPolicyDetails(results, policyType, policyId) {
  const policies = results.policies[policyType];
  return policies.find(p => p[`${policyType}PolicyId`] === policyId);
}

// Export for use in your Firebase functions
module.exports = {
  validateEbayPolicies,
  getPolicyDetails
};

// Example usage:
/*
const accessToken = 'your-ebay-access-token';
const validationResults = await validateEbayPolicies(accessToken);

if (validationResults.success) {
  // Use the recommended policy IDs in your listing
  const listingData = {
    fulfillmentPolicyId: validationResults.recommendedPolicies.fulfillmentPolicyId,
    paymentPolicyId: validationResults.recommendedPolicies.paymentPolicyId,
    returnPolicyId: validationResults.recommendedPolicies.returnPolicyId,
    // ... rest of your listing data
  };
} else {
  console.error('Fix policy issues before creating listings:', validationResults.validation.errors);
}
*/