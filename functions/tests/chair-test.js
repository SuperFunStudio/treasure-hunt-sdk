// tests/cantilever-chair-test.js
// Test the specific cantilever armchair issue that was failing

const { categoryDetector } = require('../utils/category-detector');
const { itemSpecificsValidator } = require('../utils/item-specifics-validator');

/**
 * Test the exact data that was failing in your log
 */
function testCantileverArmchairIssue() {
  console.log('🧪 Testing Cantilever Armchair Issue Fix\n');
  
  // This is the exact data from your failing log
  const failingListingData = {
    title: 'IKEA POÄNG',
    description: 'Overall good condition with minor wear. Fabric shows some light soiling and possible minor pilling. Wood frame appears intact with good structural integrity. No visible tears or major damage.. Key features: cantilever bentwood frame, high back with integrated headrest, removable cushion covers, ergonomic curved design. Materials: bentwood birch veneer, polyester fabric upholstery',
    category: 'cantilever armchair with high back and headrest', // This was the problematic category
    brand: 'IKEA',
    model: 'POÄNG',
    condition: 'good',
    pricing: { buyItNowPrice: 39.00 },
    quantity: 1,
    images: [
      'https://firebasestorage.googleapis.com/v0/b/treasurehunter-sdk.firebasestorage.app/o/scans%2FQq51asaZdEQH9GxfCRUF5LgYkLf2%2F1757163188691-0.jpg',
      'https://firebasestorage.googleapis.com/v0/b/treasurehunter-sdk.firebasestorage.app/o/scans%2FQq51asaZdEQH9GxfCRUF5LgYkLf2%2F1757163190059-1.jpg'
    ]
  };

  // Test 1: Category Detection
  console.log('Test 1: Category Detection');
  console.log('Input category:', failingListingData.category);
  
  const detectedCategory = categoryDetector.detectCategory(failingListingData.category);
  console.log('Detected category:', detectedCategory);
  
  const isFurniture = categoryDetector.isFurnitureCategory(failingListingData.category);
  console.log('Is furniture category:', isFurniture);
  console.log('');

  // Test 2: Item Specifics Validation
  console.log('Test 2: Item Specifics Validation');
  
  const validationResult = itemSpecificsValidator.validateAndEnhanceListing(failingListingData);
  
  console.log('Validation Results:');
  console.log('- Is Valid:', validationResult.isValid);
  console.log('- Detected Category:', validationResult.detectedCategory);
  console.log('- Resolved Category:', validationResult.category);
  console.log('- Missing Fields:', validationResult.missingFields.map(f => f.name));
  console.log('- Enhancements Applied:', Object.keys(validationResult.enhancements));
  console.log('- Enhancement Values:', validationResult.enhancements);
  console.log('- Errors:', validationResult.errors);
  console.log('- Warnings:', validationResult.warnings);
  console.log('');

  // DEBUG: Check the enhanced listing data
  console.log('DEBUG: Enhanced listing data validation:');
  const enhancedData = validationResult.enhancedListingData;
  console.log('- Has numberOfItemsInSet:', !!enhancedData.numberOfItemsInSet, '(', enhancedData.numberOfItemsInSet, ')');
  console.log('- Has setIncludes:', !!enhancedData.setIncludes, '(', enhancedData.setIncludes, ')');
  
  // DEBUG: Manual critical validation check
  const testCriticalValidation = itemSpecificsValidator.validateCriticalFields(
    failingListingData, 
    validationResult.category, 
    validationResult.enhancements
  );
  console.log('- Manual critical validation result:', testCriticalValidation);
  console.log('');

  // Test 3: Furniture-Specific Validation
  console.log('Test 3: Furniture-Specific Validation');
  
  const furnitureCheck = itemSpecificsValidator.validateFurnitureRequirements(failingListingData);
  console.log('Furniture Requirements Check:');
  console.log('- Has Issues:', furnitureCheck.hasIssues);
  console.log('- Issues:', furnitureCheck.issues);
  console.log('- Suggested Fixes:', furnitureCheck.fixes);
  console.log('- Is Complete:', furnitureCheck.isComplete);
  console.log('');

  // Test 4: Enhanced Listing Data
  console.log('Test 4: Enhanced Listing Data');
  
  if (validationResult.enhancedListingData) {
    console.log('Enhanced listing now includes:');
    console.log('- numberOfItemsInSet:', validationResult.enhancedListingData.numberOfItemsInSet);
    console.log('- setIncludes:', validationResult.enhancedListingData.setIncludes);
    console.log('- brand:', validationResult.enhancedListingData.brand);
    console.log('- model:', validationResult.enhancedListingData.model);
    console.log('');
  }

  // Test 5: Mock XML Generation Test
  console.log('Test 5: Mock XML Generation Test');
  
  try {
    // Test the enhanced XML builder logic
    const { generateItemSpecificsXml } = require('../utils/xml-builder-enhanced');
    
    const mockCategoryRequirements = {
      success: false,
      fallback: true,
      requiredAspects: [
        { name: 'Number of Items in Set', required: true, values: ['1', '2', '3'] },
        { name: 'Set Includes', required: true, values: [] },
        { name: 'Brand', required: true, values: [] }
      ]
    };
    
    const itemSpecificsXml = generateItemSpecificsXml(
      validationResult.category || failingListingData.category,
      validationResult.enhancedListingData || failingListingData,
      mockCategoryRequirements
    );
    
    console.log('Generated XML Item Specifics:');
    console.log(itemSpecificsXml);
    
    // Check if the problematic fields are now included
    const hasNumberOfItems = itemSpecificsXml.includes('Number of Items in Set');
    const hasSetIncludes = itemSpecificsXml.includes('Set Includes');
    
    console.log('');
    console.log('Critical Fields Check:');
    console.log('- Contains "Number of Items in Set":', hasNumberOfItems);
    console.log('- Contains "Set Includes":', hasSetIncludes);
    console.log('- Both required fields present:', hasNumberOfItems && hasSetIncludes);
    
  } catch (error) {
    console.error('XML generation test failed:', error.message);
  }
  
  console.log('');
  
  // Test 6: Summary and Recommendations
  console.log('Test 6: Summary and Recommendations');
  
  const wouldHaveFailed = !validationResult.enhancedListingData.numberOfItemsInSet && 
                         !validationResult.enhancedListingData.setIncludes;
  
  // Check if enhancements were actually applied
  const enhancementsApplied = Object.keys(validationResult.enhancements).length > 0;
  const hasRequiredFields = validationResult.enhancedListingData.numberOfItemsInSet && 
                           validationResult.enhancedListingData.setIncludes;
  
  console.log('Analysis:');
  console.log('- Original data would have failed eBay submission:', wouldHaveFailed);
  console.log('- Category detection working:', validationResult.detectedCategory === 'furniture');
  console.log('- Enhancements were applied:', enhancementsApplied);
  console.log('- Required fields auto-generated:', hasRequiredFields);
  console.log('- Ready for eBay submission:', validationResult.isValid && hasRequiredFields);
  
  // Detailed debugging
  if (!hasRequiredFields) {
    console.log('');
    console.log('DEBUGGING: Why weren\'t required fields generated?');
    console.log('- Detected category:', validationResult.detectedCategory);
    console.log('- Resolved category:', validationResult.category);
    console.log('- Missing fields count:', validationResult.missingFields.length);
    console.log('- Enhancements count:', Object.keys(validationResult.enhancements).length);
    console.log('- Enhanced data keys:', Object.keys(validationResult.enhancedListingData || {}));
  }
  
  return {
    passed: validationResult.isValid && 
            validationResult.detectedCategory === 'furniture' &&
            hasRequiredFields,
    validationResult,
    furnitureCheck,
    hasRequiredFields,
    enhancementsApplied
  };
}

/**
 * Run additional category detection tests
 */
function runCategoryDetectionTests() {
  console.log('\n🧪 Additional Category Detection Tests\n');
  
  const testCases = [
    {
      input: 'cantilever armchair with high back and headrest',
      expected: 'furniture'
    },
    {
      input: 'IKEA POÄNG chair bentwood',
      expected: 'furniture'
    },
    {
      input: 'office chair ergonomic',
      expected: 'furniture'
    },
    {
      input: 'dining table wooden',
      expected: 'furniture'
    },
    {
      input: 'wireless bluetooth headphones',
      expected: 'electronics'
    },
    {
      input: 'nike running shoes size 10',
      expected: 'footwear'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    const detected = categoryDetector.detectCategory(testCase.input);
    const passed = detected === testCase.expected;
    
    console.log(`Test ${index + 1}: ${passed ? 'PASS' : 'FAIL'}`);
    console.log(`  Input: "${testCase.input}"`);
    console.log(`  Expected: ${testCase.expected}`);
    console.log(`  Detected: ${detected}`);
    console.log('');
  });
}

/**
 * Main test runner
 */
function runAllTests() {
  console.log('=' * 50);
  console.log('EBAY LISTING ISSUE FIX VALIDATION');
  console.log('=' * 50);
  console.log('');
  
  try {
    // Test the specific failing case
    const mainTestResult = testCantileverArmchairIssue();
    
    // Run additional category tests
    runCategoryDetectionTests();
    
    // Final summary
    console.log('\n' + '=' * 50);
    console.log('FINAL RESULTS');
    console.log('=' * 50);
    
    if (mainTestResult.passed) {
      console.log('✅ SUCCESS: Your cantilever armchair issue has been FIXED!');
      console.log('');
      console.log('The listing will now include:');
      console.log('- Number of Items in Set: ' + mainTestResult.validationResult.enhancedListingData.numberOfItemsInSet);
      console.log('- Set Includes: ' + mainTestResult.validationResult.enhancedListingData.setIncludes);
      console.log('');
      console.log('Next steps:');
      console.log('1. Deploy the new files to your functions');
      console.log('2. Update your routes/ebay.js with the enhanced integration');
      console.log('3. Test with a real eBay listing');
      
    } else {
      console.log('❌ FAILURE: The fix did not resolve the issue');
      console.log('Check the test output above for details');
    }
    
  } catch (error) {
    console.error('❌ TEST EXECUTION FAILED:', error.message);
    console.error('Make sure all required files are in place');
  }
}

// Export the test functions
module.exports = {
  testCantileverArmchairIssue,
  runCategoryDetectionTests,
  runAllTests
};

// If running this file directly, execute all tests
if (require.main === module) {
  runAllTests();
}