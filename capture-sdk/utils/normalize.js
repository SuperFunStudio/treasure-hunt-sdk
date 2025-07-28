// capture-sdk/utils/normalize.js
export function normalizeResponse(rawResponse, provider) {
    // Ensure consistent structure regardless of AI provider
    const normalized = {
      category: '',
      brand: 'Unknown',
      model: 'Unknown',
      condition: {
        rating: 'fair',
        description: '',
        usableAsIs: false,
        issues: []
      },
      resale: {
        recommendation: 'evaluate',
        priceRange: {
          low: 0,
          high: 0,
          currency: 'USD'
        },
        justification: ''
      },
      salvageable: [],
      confidence: 5
    };
  
    try {
      // Handle different response formats
      const data = typeof rawResponse === 'string' 
        ? JSON.parse(rawResponse) 
        : rawResponse;
  
      // Map fields with fallbacks
      normalized.category = data.category || data.itemCategory || 'Unknown';
      normalized.brand = data.brand || data.manufacturer || 'Unknown';
      normalized.model = data.model || data.modelNumber || data.productName || 'Unknown';
  
      // Normalize condition
      if (data.condition) {
        normalized.condition = {
          rating: normalizeRating(data.condition.rating || data.condition),
          description: data.condition.description || data.conditionAssessment || '',
          usableAsIs: data.condition.usableAsIs ?? data.usable ?? true,
          issues: Array.isArray(data.condition.issues) 
            ? data.condition.issues 
            : parseIssues(data.condition.description)
        };
      }
  
      // Normalize resale data
      if (data.resale || data.resalePotential) {
        const resaleData = data.resale || data.resalePotential;
        normalized.resale = {
          recommendation: normalizeRecommendation(resaleData.recommendation),
          priceRange: {
            low: resaleData.priceRange?.low || resaleData.minPrice || 0,
            high: resaleData.priceRange?.high || resaleData.maxPrice || 0,
            currency: resaleData.priceRange?.currency || 'USD'
          },
          justification: resaleData.justification || resaleData.reasoning || ''
        };
      }
  
      // Normalize salvageable components
      if (data.salvageable || data.componentSalvage || data.parts) {
        const salvageData = data.salvageable || data.componentSalvage || data.parts;
        normalized.salvageable = Array.isArray(salvageData) 
          ? salvageData.map(normalizeSalvageComponent)
          : [];
      }
  
      // Confidence score
      normalized.confidence = data.confidence || data.confidenceRating || 5;
  
    } catch (error) {
      console.error('Error normalizing response:', error);
      // Return base normalized structure on error
    }
  
    return normalized;
  }
  function normalizeRating(rating) {
    // Handle numeric ratings (1-10 scale)
    if (typeof rating === 'number') {
      if (rating >= 8) return 'good';
      if (rating >= 5) return 'fair';
      return 'poor';
    }
    
    // Handle string ratings
    const ratingMap = {
      'excellent': 'good',
      'very good': 'good',
      'good': 'good',
      'fair': 'fair',
      'poor': 'poor',
      'broken': 'poor',
      'for parts': 'poor'
    };
  
    const normalized = rating?.toLowerCase() || 'fair';
    return ratingMap[normalized] || 'fair';
  }
  
  function normalizeRecommendation(recommendation) {
    const recMap = {
      'sell': 'resell',
      'resell': 'resell',
      'donate': 'donate',
      'repair': 'repair-resell',
      'repair and resell': 'repair-resell',
      'recycle': 'recycle',
      'parts': 'parts',
      'scrap': 'parts'
    };
  
    const normalized = recommendation?.toLowerCase() || 'evaluate';
    return recMap[normalized] || 'evaluate';
  }
  
  function parseIssues(description) {
    if (!description) return [];
    
    // Simple issue extraction from description
    const issueKeywords = [
      'broken', 'cracked', 'missing', 'damaged', 
      'worn', 'stained', 'scratched', 'dented'
    ];
    
    const issues = [];
    const desc = description.toLowerCase();
    
    issueKeywords.forEach(keyword => {
      if (desc.includes(keyword)) {
        issues.push(keyword);
      }
    });
    
    return issues;
  }
  
  function normalizeSalvageComponent(component) {
    if (typeof component === 'string') {
      return {
        component: component,
        value: 'Unknown',
        disposal: 'Check local recycling'
      };
    }
    
    return {
      component: component.component || component.part || 'Unknown',
      value: component.value || component.estimatedValue || 'Unknown',
      disposal: component.disposal || component.recycling || 'Check local recycling'
    };
  }
  