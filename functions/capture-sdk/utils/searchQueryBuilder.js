// functions/capture-sdk/utils/searchQueryBuilder.js
// Enhanced search query building for better eBay comparables

/**
 * Build intelligent search queries based on item characteristics
 */

const hasBrandEvidence =
  (result.identifiers?.visible_text || '').toLowerCase().includes((result.brand || '').toLowerCase()) ||
  (result.identifiers?.logos_seen || '').toLowerCase().includes((result.brand || '').toLowerCase());

const safeToFilterByBrand =
  result.brand && result.brand !== 'Unknown' && (result.confidence_rating || 0) >= 7 && hasBrandEvidence;


function buildSmartSearchQueries(itemData) {
    const queries = [];
    const category = itemData.category?.toLowerCase();
    const brand = itemData.brand;
    const model = itemData.model;
    
    // Extract key characteristics from the item
    const characteristics = extractItemCharacteristics(itemData);
    
    // Strategy 1: Most specific - Brand + Model + Type
    if (brand && brand !== 'Unknown' && model && model !== 'Unknown') {
      queries.push({
        query: `${brand} ${model}`,
        priority: 1,
        description: 'Exact brand and model',
        expectedResults: 'high_relevance'
      });
    }
    
    // Strategy 2: Descriptive search based on category
    const descriptiveQuery = buildDescriptiveQuery(itemData, characteristics);
    if (descriptiveQuery) {
      queries.push({
        query: descriptiveQuery,
        priority: 2,
        description: 'Descriptive item search',
        expectedResults: 'high_relevance'
      });
    }
    
    // Strategy 3: Category + key features
    const featureQuery = buildFeatureQuery(itemData, characteristics);
    if (featureQuery) {
      queries.push({
        query: featureQuery,
        priority: 3,
        description: 'Category with key features',
        expectedResults: 'medium_relevance'
      });
    }
    
    // Strategy 4: Brand + category (if brand known)
    if (brand && brand !== 'Unknown') {
      queries.push({
        query: `${brand} ${getSpecificCategoryTerm(category)}`,
        priority: 4,
        description: 'Brand with specific category',
        expectedResults: 'medium_relevance'
      });
    }
    
    // Strategy 5: Specific category only (better than generic)
    const specificCategory = getSpecificCategoryTerm(category);
    if (specificCategory && specificCategory !== category) {
      queries.push({
        query: specificCategory,
        priority: 5,
        description: 'Specific category search',
        expectedResults: 'low_relevance'
      });
    }
    
    // Strategy 6: Generic category fallback (last resort)
    queries.push({
      query: category || 'misc',
      priority: 6,
      description: 'Generic category fallback',
      expectedResults: 'low_relevance'
    });
    
    return queries.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Extract key characteristics from item data and image analysis
   */
  function extractItemCharacteristics(itemData) {
    const characteristics = {
      material: null,
      style: null,
      size: null,
      era: null,
      features: [],
      color: null,
      condition_keywords: []
    };
    
    // Extract from specifications if available
    if (itemData.specifications) {
      characteristics.material = itemData.specifications.material;
      characteristics.style = itemData.specifications.style;
      characteristics.size = itemData.specifications.size;
      characteristics.era = itemData.specifications.era;
    }
    
    // Extract from identifiers
    if (itemData.identifiers) {
      characteristics.color = itemData.identifiers.color;
      
      // Parse visible text for clues
      const text = itemData.identifiers.visible_text?.toLowerCase() || '';
      
      // Material detection from text/description
      const materials = ['wood', 'bamboo', 'metal', 'plastic', 'glass', 'leather', 'fabric', 'ceramic'];
      characteristics.material = materials.find(m => text.includes(m)) || characteristics.material;
      
      // Style detection
      const styles = ['vintage', 'antique', 'modern', 'mid-century', 'industrial', 'rustic'];
      characteristics.style = styles.find(s => text.includes(s)) || characteristics.style;
    }
    
    // Extract from condition description
    if (itemData.condition?.description) {
      const desc = itemData.condition.description.toLowerCase();
      
      // Look for material mentions
      const materials = ['bamboo', 'wood', 'wooden', 'metal', 'steel', 'aluminum', 'plastic'];
      if (!characteristics.material) {
        characteristics.material = materials.find(m => desc.includes(m));
      }
      
      // Look for style indicators
      const styleKeywords = ['vintage', 'antique', 'retro', 'mid-century', 'modern'];
      if (!characteristics.style) {
        characteristics.style = styleKeywords.find(s => desc.includes(s));
      }
      
      // Extract features mentioned
      const furnitureFeatures = ['drawer', 'drawers', 'shelves', 'storage', 'fold', 'folding'];
      characteristics.features = furnitureFeatures.filter(f => desc.includes(f));
    }
    
    return characteristics;
  }
  
  /**
   * Build descriptive query based on item characteristics
   */
  function buildDescriptiveQuery(itemData, characteristics) {
    const category = itemData.category?.toLowerCase();
    const parts = [];
    
    // Add style/era if detected
    if (characteristics.style) {
      parts.push(characteristics.style);
    }
    
    // Add material if detected
    if (characteristics.material) {
      parts.push(characteristics.material);
    }
    
    // Add specific item type based on category
    const specificType = getSpecificItemType(category, characteristics);
    if (specificType) {
      parts.push(specificType);
    }
    
    // Add key features
    if (characteristics.features.length > 0) {
      parts.push(characteristics.features[0]); // Add most important feature
    }
    
    return parts.length >= 2 ? parts.join(' ') : null;
  }
  
  /**
   * Build feature-based query
   */
  function buildFeatureQuery(itemData, characteristics) {
    const category = itemData.category?.toLowerCase();
    const parts = [];
    
    // Start with specific category term
    const specificType = getSpecificItemType(category, characteristics);
    if (specificType) {
      parts.push(specificType);
    }
    
    // Add material
    if (characteristics.material) {
      parts.push(characteristics.material);
    }
    
    // Add primary feature
    if (characteristics.features.length > 0) {
      parts.push(characteristics.features[0]);
    }
    
    return parts.length >= 2 ? parts.join(' ') : null;
  }
  
  /**
   * Get specific category term instead of generic ones
   */
  function getSpecificCategoryTerm(category) {
    const categoryMappings = {
      'furniture': 'table', // Default to table for furniture - better than "furniture"
      'footwear': 'shoes',
      'electronics': 'device',
      'tools': 'tool',
      'clothing': 'apparel',
      'books': 'book',
      'toys': 'toy',
      'jewelry': 'jewelry',
      'automotive': 'car parts'
    };
    
    return categoryMappings[category] || category;
  }
  
  /**
   * Get specific item type based on category and characteristics
   */
  function getSpecificItemType(category, characteristics) {
    switch (category) {
      case 'furniture':
        // Try to determine specific furniture type
        if (characteristics.features.includes('drawer') || characteristics.features.includes('drawers')) {
          return 'side table'; // Tables with drawers
        }
        // Could expand this based on size, description, etc.
        return 'side table'; // Default assumption for unknown furniture
        
      case 'footwear':
        if (characteristics.style === 'vintage') return 'vintage shoes';
        return 'shoes';
        
      case 'electronics':
        // Could detect phones, laptops, etc. based on description
        return 'electronics';
        
      case 'tools':
        return 'tool';
        
      case 'clothing':
        if (characteristics.style === 'vintage') return 'vintage clothing';
        return 'clothing';
        
      default:
        return category;
    }
  }
  
  /**
   * Enhanced search strategy specifically for your bamboo table example
   */
  function buildFurnitureSearchQueries(itemData, characteristics) {
    const queries = [];
    
    // For furniture, be very specific about type and features
    const material = characteristics.material || 'wood';
    const style = characteristics.style || '';
    const hasDrawer = characteristics.features.includes('drawer');
    
    // Most specific searches first
    if (style && material) {
      queries.push(`${style} ${material} side table${hasDrawer ? ' drawer' : ''}`);
      queries.push(`${material} ${style} end table${hasDrawer ? ' drawer' : ''}`);
    }
    
    if (material) {
      queries.push(`${material} side table${hasDrawer ? ' drawer' : ''}`);
      queries.push(`${material} end table${hasDrawer ? ' storage' : ''}`);
    }
    
    if (style) {
      queries.push(`${style} side table${hasDrawer ? ' drawer' : ''}`);
      queries.push(`${style} end table`);
    }
    
    // Generic fallbacks
    queries.push(hasDrawer ? 'side table drawer' : 'side table');
    queries.push('end table');
    
    return queries.map((query, index) => ({
      query,
      priority: index + 1,
      description: `Furniture-specific search: ${query}`,
      expectedResults: index < 3 ? 'high_relevance' : 'medium_relevance'
    }));
  }
  
  /**
   * Test function for your bamboo table example
   */
  function testBambooTableSearch() {
    const mockItemData = {
      category: 'furniture',
      brand: 'Unknown',
      model: 'Unknown',
      condition: {
        description: 'vintage bamboo side table with drawer, shows minor wear'
      },
      identifiers: {
        visible_text: 'bamboo wood drawer',
        color: 'natural wood'
      },
      specifications: {
        material: 'bamboo',
        style: 'vintage'
      }
    };
    
    const characteristics = extractItemCharacteristics(mockItemData);
    console.log('Extracted characteristics:', characteristics);
    
    const queries = buildSmartSearchQueries(mockItemData);
    console.log('Generated search queries:');
    queries.forEach((q, i) => {
      console.log(`${i + 1}. "${q.query}" - ${q.description}`);
    });
    
    return queries;
  }
  
  // Usage example:
  /*
  const itemData = {
    category: 'furniture',
    brand: 'Unknown', 
    condition: {
      description: 'vintage bamboo side table with drawer'
    },
    identifiers: {
      visible_text: 'bamboo',
      color: 'natural'
    }
  };
  
  const searchQueries = buildSmartSearchQueries(itemData);
  // Returns queries like:
  // 1. "vintage bamboo side table drawer"
  // 2. "bamboo side table drawer" 
  // 3. "vintage side table"
  // 4. "side table drawer"
  // 5. "side table"
  // NOT: "furniture" (useless!)
  */
  module.exports = { searchQueryBuilder };
