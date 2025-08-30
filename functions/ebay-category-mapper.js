
// Global database references
let db = null;
let admin = null;
let isInitialized = false;

// Category mapping keywords for better matching
const CATEGORY_KEYWORDS = {
  'electronics': ['electronic', 'computer', 'phone', 'tablet', 'camera', 'audio', 'video', 'gadget'],
  'furniture': ['furniture', 'chair', 'table', 'desk', 'sofa', 'cabinet', 'shelf', 'storage'],
  'clothing': ['clothing', 'shirt', 'dress', 'pants', 'jacket', 'sweater', 'apparel', 'fashion'],
  'footwear': ['shoes', 'boots', 'sneakers', 'sandals', 'footwear', 'athletic shoes'],
  'tools': ['tools', 'hardware', 'wrench', 'drill', 'saw', 'equipment', 'construction'],
  'books': ['books', 'magazines', 'literature', 'textbook', 'novel', 'manual'],
  'automotive': ['automotive', 'car', 'vehicle', 'parts', 'accessories', 'motorcycle'],
  'toys': ['toys', 'games', 'dolls', 'action figures', 'puzzles', 'educational'],
  'sporting goods': ['sports', 'athletic', 'fitness', 'outdoor', 'exercise', 'recreation'],
  'jewelry': ['jewelry', 'watches', 'rings', 'necklaces', 'earrings', 'bracelets'],
  'home & garden': ['home', 'garden', 'kitchen', 'bathroom', 'decor', 'appliances', 'yard'],
  'collectibles': ['collectibles', 'antiques', 'vintage', 'memorabilia', 'coins', 'stamps']
};

// eBay Category Mapping Service (REST API Version)

// Your internal categories to map
const INTERNAL_CATEGORIES = [
  'electronics', 'furniture', 'clothing', 'footwear', 'tools', 
  'books', 'automotive', 'toys', 'sporting goods', 'jewelry', 
  'home & garden', 'collectibles'
];


// ADDED: Initialize database function
function initializeDatabase(dbInstance, adminInstance) {
  try {
    db = dbInstance;
    admin = adminInstance;
    isInitialized = true;
    console.log('✅ Category mapper database initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize category mapper database:', error);
    return false;
  }
}


// ADDED: Get fallback mapping function
function getFallbackMapping() {
  const fallbackMapping = {};
  INTERNAL_CATEGORIES.forEach(cat => {
    fallbackMapping[cat] = { 
      categoryId: '99', 
      categoryName: 'Everything Else', 
      score: 0,
      source: 'fallback'
    };
  });
  return fallbackMapping;
}

// ADDED: Validate category mapping function
async function validateCategoryMapping() {
  try {
    const mapping = await getCategoryMapping(false);
    const validation = {
      isValid: true,
      totalCategories: Object.keys(mapping).length,
      missingCategories: [],
      invalidCategories: [],
      scores: {},
      timestamp: new Date().toISOString()
    };

    // Check all internal categories are mapped
    INTERNAL_CATEGORIES.forEach(category => {
      if (!mapping[category]) {
        validation.missingCategories.push(category);
        validation.isValid = false;
      } else {
        validation.scores[category] = mapping[category].score || 0;
        
        // Check if category ID is valid
        if (!mapping[category].categoryId || mapping[category].categoryId === '99') {
          validation.invalidCategories.push(category);
        }
      }
    });

    console.log('Category mapping validation:', validation);
    return validation;
    
  } catch (error) {
    console.error('Category mapping validation failed:', error);
    return {
      isValid: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Get eBay access token (reuse your existing function)
async function getEbayAccessToken(ebayConfig) {
  try {
    if (!ebayConfig || !ebayConfig.clientId || !ebayConfig.clientSecret) {
      throw new Error('eBay configuration missing clientId or clientSecret');
    }

    // Use client credentials flow for app-level access
    const fetch = (await import('node-fetch')).default;
    
    const credentials = Buffer.from(`${ebayConfig.clientId}:${ebayConfig.clientSecret}`).toString('base64');
    
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eBay token request failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
    
  } catch (error) {
    console.error('Failed to get eBay access token:', error);
    throw error;
  }
}


// Fetch category tree using Taxonomy API
async function fetchEbayCategoryTree(ebayConfig) {
  try {
    const fetch = (await import('node-fetch')).default;
    const accessToken = await getEbayAccessToken(ebayConfig);
    
    // Get default category tree ID
    const treeResponse = await fetch('https://api.ebay.com/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_US', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!treeResponse.ok) {
      throw new Error(`Failed to get category tree ID: ${treeResponse.status}`);
    }
    
    const treeData = await treeResponse.json();
    const categoryTreeId = treeData.categoryTreeId;
    
    console.log(`Using eBay category tree ID: ${categoryTreeId}`);
    
    // Get full category tree
    const categoriesResponse = await fetch(`https://api.ebay.com/commerce/taxonomy/v1/category_tree/${categoryTreeId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!categoriesResponse.ok) {
      throw new Error(`Failed to fetch categories: ${categoriesResponse.status}`);
    }
    
    const categoriesData = await categoriesResponse.json();
    return categoriesData;
    
  } catch (error) {
    console.error('Failed to fetch eBay category tree:', error);
    throw error;
  }
}

// Extract leaf categories from tree structure
function extractLeafCategories(node, ancestors = []) {
  const leafCategories = [];
  const currentPath = [...ancestors, node.category.categoryName];
  
  // If this node has no children, it's a leaf
  if (!node.childCategoryTreeNodes || node.childCategoryTreeNodes.length === 0) {
    leafCategories.push({
      id: node.category.categoryId,
      name: node.category.categoryName,
      fullPath: currentPath.join(' > ').toLowerCase(),
      level: currentPath.length
    });
  } else {
    // Recursively process children
    node.childCategoryTreeNodes.forEach(child => {
      leafCategories.push(...extractLeafCategories(child, currentPath));
    });
  }
  
  return leafCategories;
}


// Fetch all eBay leaf categories
async function fetchEbayLeafCategories(ebayConfig) {
  console.log('Fetching eBay leaf categories using Taxonomy API...');
  
  try {
    const categoryTree = await fetchEbayCategoryTree(ebayConfig);
    const leafCategories = extractLeafCategories(categoryTree.rootCategoryNode);
    
    console.log(`Found ${leafCategories.length} eBay leaf categories`);
    return leafCategories;
  } catch (error) {
    console.error('Failed to fetch eBay categories:', error);
    throw error;
  }
}


// Score category match based on keywords
function scoreCategoryMatch(internalCategory, ebayCategory) {
  const keywords = CATEGORY_KEYWORDS[internalCategory] || [];
  const ebayCategoryLower = ebayCategory.name.toLowerCase();
  const ebayPathLower = ebayCategory.fullPath.toLowerCase();
  
  let score = 0;
  
  // Direct keyword matches in category name
  keywords.forEach(keyword => {
    if (ebayCategoryLower.includes(keyword)) {
      score += 10;
    }
    if (ebayPathLower.includes(keyword)) {
      score += 5;
    }
  });
  
  // Bonus for exact category name matches
  if (ebayCategoryLower.includes(internalCategory)) {
    score += 15;
  }
  
  // Prefer more specific categories (higher level)
  score += ebayCategory.level;
  
  return score;
}


// Build mapping from internal categories to eBay leaf categories
function buildCategoryMapping(leafCategories) {
  const mapping = {};
  
  INTERNAL_CATEGORIES.forEach(internalCategory => {
    let bestMatch = null;
    let bestScore = 0;
    
    leafCategories.forEach(ebayCategory => {
      const score = scoreCategoryMatch(internalCategory, ebayCategory);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ebayCategory;
      }
    });
    
    if (bestMatch && bestScore > 0) {
      mapping[internalCategory] = {
        categoryId: bestMatch.id,
        categoryName: bestMatch.name,
        score: bestScore,
        source: 'ebay_api'
      };
    } else {
      // Fallback to safe general categories
      mapping[internalCategory] = {
        categoryId: '99', // Everything Else
        categoryName: 'Everything Else',
        score: 0,
        source: 'fallback'
      };
    }
  });
  
  return mapping;
}


// Save mapping to Firestore
async function saveCategoryMapping(mapping) {
  try {
    if (!isInitialized || !db || !admin) {
      console.warn('Database not initialized, skipping save to Firestore');
      return false;
    }

    await db.collection('system').doc('ebay_category_mapping').set({
      mapping: mapping,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      version: Date.now()
    });
    
    console.log('Category mapping saved to Firestore');
    return true;
  } catch (error) {
    console.error('Failed to save category mapping:', error);
    return false;
  }
}


// Load mapping from Firestore
async function loadCategoryMapping() {
  try {
    if (!isInitialized || !db) {
      console.warn('Database not initialized, cannot load from Firestore');
      return null;
    }

    const doc = await db.collection('system').doc('ebay_category_mapping').get();
    
    if (!doc.exists) {
      console.log('No existing category mapping found');
      return null;
    }
    
    const data = doc.data();
    console.log('Loaded category mapping from Firestore');
    return data.mapping;
  } catch (error) {
    console.error('Failed to load category mapping:', error);
    return null;
  }
}


// Check if mapping needs refresh (quarterly)
function shouldRefreshMapping(lastUpdated) {
  if (!lastUpdated) return true;
  
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  return lastUpdated.toDate() < threeMonthsAgo;
}


// Main function to get/refresh category mapping
async function getCategoryMapping(forceRefresh = false, ebayConfig = null) {
  try {
    // Try to load existing mapping first
    if (!forceRefresh) {
      const existingMapping = await loadCategoryMapping();
      if (existingMapping) {
        return existingMapping;
      }
    }
    
    // Check if we have eBay configuration
    if (!ebayConfig || !ebayConfig.clientId || !ebayConfig.clientSecret) {
      console.warn('No eBay configuration provided, using fallback mapping');
      return getFallbackMapping();
    }
    
    console.log('Building new eBay category mapping...');
    
    // Fetch fresh data from eBay
    const leafCategories = await fetchEbayLeafCategories(ebayConfig);
    
    // Build the mapping
    const mapping = buildCategoryMapping(leafCategories);
    
    // Save for future use
    await saveCategoryMapping(mapping);
    
    // Log the results
    console.log('Category mapping completed:');
    Object.entries(mapping).forEach(([internal, ebay]) => {
      console.log(`  ${internal} -> ${ebay.categoryId} (${ebay.categoryName}) [score: ${ebay.score}]`);
    });
    
    return mapping;
    
  } catch (error) {
    console.error('Failed to get category mapping:', error);
    return getFallbackMapping();
  }
}


// Updated mapCategoryToEbayId function
async function mapCategoryToEbayId(category, ebayConfig = null) {
  try { 
    const mapping = await getCategoryMapping(false, ebayConfig);
    let normalizedCategory = category?.toLowerCase()?.trim();

    // Check for a direct mapping from the AI's raw category first
    if (mapping[normalizedCategory]) {
      console.log(`Mapped AI category "${category}" to eBay ID: ${mapping[normalizedCategory].categoryId}`);
      return mapping[normalizedCategory].categoryId;
    }
    
    // Apply intelligent category detection from Claude's detailed descriptions
    // This logic runs only if a direct match for the raw category fails
    if (normalizedCategory.includes('suit') || 
        normalizedCategory.includes('coverall') || 
        normalizedCategory.includes('uniform') ||
        normalizedCategory.includes('jacket') ||
        normalizedCategory.includes('shirt') ||
        normalizedCategory.includes('pants')) {
      normalizedCategory = 'clothing';
    } else if (normalizedCategory.includes('chair') || 
               normalizedCategory.includes('table') || 
               normalizedCategory.includes('desk')) {
      normalizedCategory = 'furniture';
    } else if (normalizedCategory.includes('phone') || 
               normalizedCategory.includes('computer') || 
               normalizedCategory.includes('tablet')) {
      normalizedCategory = 'electronics';
    }
    // Add more keyword detection as needed

    // Check the mapping again with the newly normalized category
    if (mapping[normalizedCategory]) {
      console.log(`Mapped category "${category}" to eBay ID: ${mapping[normalizedCategory].categoryId}`);
      return mapping[normalizedCategory].categoryId;
    }
    
    console.log(`No mapping found for category "${category}", using fallback`);
    return '99'; // Everything Else fallback
    
  } catch (error) {
    console.error('Error in mapCategoryToEbayId:', error);
    return '99'; // Safe fallback
  }
}

//Export all required functions
module.exports = {
  initializeDatabase,
  getCategoryMapping,
  mapCategoryToEbayId,
  validateCategoryMapping,
  getFallbackMapping,
  fetchEbayLeafCategories,
  buildCategoryMapping
};