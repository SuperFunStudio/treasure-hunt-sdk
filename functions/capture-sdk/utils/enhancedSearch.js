// functions/capture-sdk/utils/enhancedSearch.js - ES Modules version
// Universal Enhanced Search Query Builder

/**
 * Build enhanced eBay search query from detailed item analysis
 */
export function buildEnhancedSearchQuery(itemData) {
    console.log('🔍 Building enhanced search query for:', {
      category: itemData.category,
      brand: itemData.brand,
      materials: itemData.materials,
      keyFeatures: itemData.keyFeatures
    });
    
    const queryParts = [];
    const excludeGeneric = ['unknown', 'generic', 'see photos', 'item', 'object'];
    
    // 1. Use specific category (most important)
    if (itemData.category && 
        !excludeGeneric.some(term => itemData.category.toLowerCase().includes(term))) {
      queryParts.push(itemData.category);
    }
    
    // 2. Add primary material if distinctive and not already in category
    if (itemData.materials && itemData.materials.length > 0) {
      const primaryMaterial = itemData.materials[0];
      if (primaryMaterial && 
          !['unknown', 'generic'].includes(primaryMaterial.toLowerCase()) &&
          !queryParts.some(part => part.toLowerCase().includes(primaryMaterial.toLowerCase()))) {
        queryParts.push(primaryMaterial);
      }
    }
    
    // 3. Add style if meaningful and distinctive
    if (itemData.style && 
        !excludeGeneric.some(term => itemData.style.toLowerCase().includes(term)) &&
        itemData.style.length > 3 &&
        !queryParts.some(part => part.toLowerCase().includes(itemData.style.toLowerCase()))) {
      queryParts.push(itemData.style);
    }
    
    // 4. Add most distinctive key feature
    if (itemData.keyFeatures && itemData.keyFeatures.length > 0) {
      const bestFeature = itemData.keyFeatures.find(feature => 
        feature && 
        feature.length > 3 && 
        !['color', 'used', 'old', 'good', 'condition'].includes(feature.toLowerCase()) &&
        !queryParts.some(part => part.toLowerCase().includes(feature.toLowerCase()))
      );
      if (bestFeature) {
        queryParts.push(bestFeature);
      }
    }
    
    // 5. Add brand if specific and meaningful
    if (itemData.brand && 
        !excludeGeneric.some(term => itemData.brand.toLowerCase().includes(term)) &&
        itemData.brand.length > 2 &&
        !queryParts.some(part => part.toLowerCase().includes(itemData.brand.toLowerCase()))) {
      queryParts.push(itemData.brand);
    }
    
    // 6. Add functional type if different from category
    if (itemData.functionalType && 
        !queryParts.some(part => part.toLowerCase().includes(itemData.functionalType.toLowerCase()))) {
      const functionalWords = itemData.functionalType.split(' ');
      const newWords = functionalWords.filter(word => 
        word.length > 3 && 
        !queryParts.some(part => part.toLowerCase().includes(word.toLowerCase()))
      );
      if (newWords.length > 0) {
        queryParts.push(newWords[0]);
      }
    }
    
    let query = queryParts.join(' ').trim();
    
    // Apply category-specific refinements
    query = addCategoryRefinements(query, itemData);
    
    console.log('🎯 Enhanced query built:', `"${query}"`);
    
    return query;
  }
  
  /**
   * Add category-specific refinements to improve search accuracy
   */
  export function addCategoryRefinements(query, itemData) {
    const category = itemData.category?.toLowerCase() || '';
    const materials = itemData.materials?.join(' ').toLowerCase() || '';
    const style = itemData.style?.toLowerCase() || '';
    
    // Furniture refinements
    if (category.includes('table') || category.includes('chair') || category.includes('desk')) {
      if (materials.includes('bamboo')) return query + ' bamboo furniture';
      if (style.includes('mid-century')) return query + ' mid century';
      if (style.includes('vintage')) return query + ' vintage';
      if (category.includes('side table')) return query + ' end table';
    }
    
    // Military/tactical refinements
    if (category.includes('military') || category.includes('tactical') || category.includes('flight suit')) {
      if (category.includes('flight suit')) return query + ' surplus authentic';
      if (category.includes('uniform')) return query + ' original surplus';
      return query + ' military surplus';
    }
    
    // Electronics refinements
    if (category.includes('phone') || category.includes('laptop') || category.includes('electronic')) {
      return query + ' used working';
    }
    
    // Clothing refinements  
    if (category.includes('shirt') || category.includes('jacket') || 
        (category.includes('clothing') && !category.includes('military'))) {
      if (style.includes('vintage')) return query + ' vintage';
      if (itemData.brand && !['unknown', 'generic'].includes(itemData.brand.toLowerCase())) {
        return query; // Brand already included
      }
    }
    
    // Tools refinements
    if (category.includes('tool') || category.includes('drill') || category.includes('saw')) {
      return query + ' used tool';
    }
    
    return query;
  }
  
  /**
   * Validate search query quality
   */
  export function validateSearchQuery(query, itemData) {
    const validation = {
      isValid: true,
      issues: [],
      confidence: 'high'
    };
    
    // Check if query is too generic
    const genericTerms = ['furniture', 'clothing', 'electronics', 'item', 'object', 'thing'];
    if (genericTerms.some(term => query.toLowerCase().trim() === term)) {
      validation.isValid = false;
      validation.confidence = 'low';
      validation.issues.push('Query too generic - needs more specific details');
    }
    
    // Check if query has enough detail
    if (query.split(' ').length < 2) {
      validation.confidence = 'medium';
      validation.issues.push('Query could be more specific');
    }
    
    // Check if query is too long
    if (query.split(' ').length > 6) {
      validation.confidence = 'medium';
      validation.issues.push('Query may be too specific for broad results');
    }
    
    return validation;
  }