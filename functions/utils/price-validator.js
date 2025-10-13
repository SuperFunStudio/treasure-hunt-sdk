// utils/price-validator.js
// Validate pricing estimates against real market data

const marketDataService = require('../services/ebay/marketDataService');
const { mapConditionToEbay } = require('./condition-mapper');

class PriceValidator {
  constructor() {
    this.thresholds = {
      // Percentage thresholds for flagging price issues
      majorOverpriced: 2.0,    // 200% of market value
      overpriced: 1.5,         // 150% of market value  
      reasonable: 0.8,         // 80% of market value
      underpriced: 0.5,        // 50% of market value
      majorUnderpriced: 0.25   // 25% of market value
    };

    this.conditionDepreciation = {
      'new': 0.0,
      'like_new': 0.1,
      'excellent': 0.2,
      'very_good': 0.25,
      'good': 0.35,
      'acceptable': 0.5,
      'fair': 0.6,
      'poor': 0.75
    };
  }

  /**
   * Main validation function - compares AI estimate against market data
   */
  async validatePrice(analysisResult, routes, itemData = {}) {
    const validation = {
      isValid: true,
      confidence: 'unknown',
      issues: [],
      warnings: [],
      recommendations: [],
      marketData: null,
      comparison: null,
      enhancedPricing: null
    };

    try {
      console.log('Starting price validation for item:', {
        category: analysisResult.category,
        brand: analysisResult.brand,
        condition: analysisResult.condition,
        aiEstimate: routes?.marketAnalysis?.estimatedValue?.suggested
      });

      // Step 1: Get market data
      const marketResult = await this.getMarketData(analysisResult, itemData);
      validation.marketData = marketResult;

      if (!marketResult.success) {
        validation.warnings.push('Could not fetch market data for price validation');
        validation.confidence = 'low';
        return validation;
      }

      // Step 2: Compare AI estimate with market data
      const aiEstimate = this.extractAIEstimate(routes);
      if (!aiEstimate) {
        validation.warnings.push('No AI price estimate found to validate');
        return validation;
      }

      validation.comparison = this.compareWithMarket(
        aiEstimate, 
        marketResult.recommendation,
        analysisResult.condition
      );

      // Step 3: Validate and flag issues
      this.flagPricingIssues(validation);

      // Step 4: Generate enhanced pricing recommendations
      validation.enhancedPricing = this.generateEnhancedPricing(
        aiEstimate,
        marketResult.recommendation,
        analysisResult,
        validation.comparison
      );

      // Step 5: Set overall validation status
      validation.isValid = validation.issues.length === 0;
      validation.confidence = this.calculateOverallConfidence(validation);

      console.log('Price validation complete:', {
        isValid: validation.isValid,
        confidence: validation.confidence,
        issues: validation.issues.length,
        warnings: validation.warnings.length
      });

      return validation;

    } catch (error) {
      console.error('Price validation error:', error);
      validation.isValid = false;
      validation.issues.push(`Price validation failed: ${error.message}`);
      validation.confidence = 'low';
      return validation;
    }
  }

  /**
   * Get market data for the item
   */
  async getMarketData(analysisResult, itemData = {}) {
    try {
      const searchData = {
        title: itemData.title || this.buildTitleFromAnalysis(analysisResult),
        brand: analysisResult.brand,
        model: analysisResult.model,
        category: analysisResult.category,
        condition: analysisResult.condition,
        categoryId: itemData.categoryId
      };

      return await marketDataService.getMarketDataForItem(searchData);
    } catch (error) {
      console.error('Error fetching market data:', error);
      return {
        success: false,
        error: error.message,
        marketData: null,
        recommendation: null,
        confidence: 0
      };
    }
  }

  /**
   * Build title from analysis result if not provided
   */
  buildTitleFromAnalysis(analysisResult) {
    const parts = [];
    
    if (analysisResult.brand && analysisResult.brand !== 'Unknown') {
      parts.push(analysisResult.brand);
    }
    
    if (analysisResult.model && analysisResult.model !== 'Unknown') {
      parts.push(analysisResult.model);
    }
    
    if (analysisResult.category && analysisResult.category !== 'unknown') {
      parts.push(analysisResult.category);
    }

    return parts.join(' ') || 'Item';
  }

  /**
   * Extract AI price estimate from routes
   */
  extractAIEstimate(routes) {
    if (!routes || !routes.marketAnalysis) {
      return null;
    }

    const estimatedValue = routes.marketAnalysis.estimatedValue;
    if (!estimatedValue) {
      return null;
    }

    return {
      suggested: estimatedValue.suggested,
      confidence: estimatedValue.confidence,
      source: estimatedValue.source,
      range: estimatedValue.range || null
    };
  }

  /**
   * Compare AI estimate with market data
   */
  compareWithMarket(aiEstimate, marketRecommendation, itemCondition) {
    if (!aiEstimate || !marketRecommendation) {
      return null;
    }

    const aiPrice = aiEstimate.suggested;
    const marketPrice = marketRecommendation.suggested;
    const ratio = aiPrice / marketPrice;

    return {
      aiEstimate: aiPrice,
      marketEstimate: marketPrice,
      difference: aiPrice - marketPrice,
      ratio: ratio,
      percentageDiff: ((aiPrice - marketPrice) / marketPrice) * 100,
      marketRange: marketRecommendation.range,
      marketSampleSize: marketRecommendation.sampleSize,
      marketConfidence: marketRecommendation.confidence,
      conditionAdjustment: marketRecommendation.conditionAdjustment,
      classification: this.classifyPriceDifference(ratio)
    };
  }

  /**
   * Classify price difference
   */
  classifyPriceDifference(ratio) {
    if (ratio >= this.thresholds.majorOverpriced) return 'major_overpriced';
    if (ratio >= this.thresholds.overpriced) return 'overpriced';
    if (ratio >= this.thresholds.reasonable) return 'reasonable';
    if (ratio >= this.thresholds.underpriced) return 'underpriced';
    if (ratio >= this.thresholds.majorUnderpriced) return 'major_underpriced';
    return 'severely_underpriced';
  }

  /**
   * Flag pricing issues based on comparison
   */
  flagPricingIssues(validation) {
    const comparison = validation.comparison;
    if (!comparison) return;

    const { classification, percentageDiff, marketSampleSize, marketConfidence } = comparison;

    // Flag major pricing issues
    if (classification === 'major_overpriced') {
      validation.issues.push({
        type: 'major_overpriced',
        message: `Price estimate is ${Math.abs(percentageDiff).toFixed(0)}% higher than market data suggests`,
        severity: 'high',
        recommendation: 'Consider lowering price estimate significantly'
      });
    }

    if (classification === 'major_underpriced' || classification === 'severely_underpriced') {
      validation.issues.push({
        type: 'major_underpriced',
        message: `Price estimate is ${Math.abs(percentageDiff).toFixed(0)}% lower than market data suggests`,
        severity: 'medium',
        recommendation: 'Consider raising price estimate - may be missing value'
      });
    }

    // Flag moderate pricing issues as warnings
    if (classification === 'overpriced') {
      validation.warnings.push({
        type: 'overpriced',
        message: `Price estimate is ${Math.abs(percentageDiff).toFixed(0)}% higher than market average`,
        recommendation: 'Consider adjusting price estimate downward'
      });
    }

    if (classification === 'underpriced') {
      validation.warnings.push({
        type: 'underpriced',
        message: `Price estimate is ${Math.abs(percentageDiff).toFixed(0)}% lower than market average`,
        recommendation: 'Consider if item has additional value not captured'
      });
    }

    // Flag data quality issues
    if (marketSampleSize < 5) {
      validation.warnings.push({
        type: 'low_sample_size',
        message: `Only ${marketSampleSize} market samples found - estimate may be less reliable`,
        recommendation: 'Use pricing estimate with caution'
      });
    }

    if (marketConfidence < 50) {
      validation.warnings.push({
        type: 'low_market_confidence',
        message: `Market data confidence is low (${marketConfidence}%)`,
        recommendation: 'Consider manual price research'
      });
    }
  }

  /**
   * Generate enhanced pricing recommendations
   */
  generateEnhancedPricing(aiEstimate, marketRecommendation, analysisResult, comparison) {
    const enhanced = {
      recommended: null,
      range: null,
      confidence: 'medium',
      reasoning: [],
      alternatives: [],
      marketContext: null
    };

    try {
      // Determine which estimate to trust more
      const useMarketData = marketRecommendation && 
                           marketRecommendation.confidence > 50 && 
                           marketRecommendation.sampleSize >= 3;

      if (useMarketData) {
        // Use market data as primary source
        enhanced.recommended = marketRecommendation.suggested;
        enhanced.range = marketRecommendation.range;
        enhanced.confidence = this.mapMarketConfidenceToOverall(marketRecommendation.confidence);
        enhanced.reasoning.push('Based on market data from sold listings');
        
        if (comparison && Math.abs(comparison.percentageDiff) > 20) {
          enhanced.reasoning.push(`AI estimate was ${comparison.percentageDiff > 0 ? 'higher' : 'lower'} than market data`);
        }
      } else {
        // Use AI estimate with adjustments
        enhanced.recommended = aiEstimate.suggested;
        enhanced.confidence = aiEstimate.confidence || 'medium';
        enhanced.reasoning.push('Based on AI analysis (limited market data available)');
        
        // Apply condition adjustments if not already applied
        if (analysisResult.condition) {
          const conditionAdjustment = this.getConditionAdjustment(analysisResult.condition);
          if (conditionAdjustment < 1.0) {
            enhanced.recommended = enhanced.recommended * conditionAdjustment;
            enhanced.reasoning.push(`Adjusted for ${analysisResult.condition} condition`);
          }
        }
      }

      // Generate range if not provided
      if (!enhanced.range) {
        const basePrice = enhanced.recommended;
        enhanced.range = {
          low: Math.round(basePrice * 0.8 * 100) / 100,
          high: Math.round(basePrice * 1.2 * 100) / 100
        };
      }

      // Add market context
      if (marketRecommendation) {
        enhanced.marketContext = {
          marketMedian: marketRecommendation.market?.median,
          marketAverage: marketRecommendation.market?.average,
          sampleSize: marketRecommendation.sampleSize,
          recentSales: marketRecommendation.recentSales || 'unknown'
        };
      }

      // Generate alternative pricing strategies
      enhanced.alternatives = this.generateAlternatives(enhanced.recommended, marketRecommendation);

    } catch (error) {
      console.error('Error generating enhanced pricing:', error);
      enhanced.recommended = aiEstimate?.suggested || 25;
      enhanced.confidence = 'low';
      enhanced.reasoning.push('Error in pricing calculation - using fallback');
    }

    return enhanced;
  }

  /**
   * Get condition-based price adjustment factor
   */
  getConditionAdjustment(condition) {
    const conditionString = typeof condition === 'object' 
      ? (condition.rating || condition.condition || 'good')
      : String(condition || 'good');

    const normalized = conditionString.toLowerCase().trim();
    return 1.0 - (this.conditionDepreciation[normalized] || 0.35);
  }

  /**
   * Map market confidence to overall confidence
   */
  mapMarketConfidenceToOverall(marketConfidence) {
    if (marketConfidence >= 80) return 'high';
    if (marketConfidence >= 60) return 'medium';
    if (marketConfidence >= 40) return 'low';
    return 'very_low';
  }

  /**
   * Generate alternative pricing strategies
   */
  generateAlternatives(recommendedPrice, marketRecommendation) {
    const alternatives = [];

    if (marketRecommendation) {
      // Conservative pricing (lower end of range)
      alternatives.push({
        strategy: 'conservative',
        price: marketRecommendation.range?.low || recommendedPrice * 0.85,
        description: 'Quick sale pricing - lower end of market range',
        pros: ['Faster sale', 'Attracts more buyers'],
        cons: ['Lower profit margin']
      });

      // Aggressive pricing (higher end of range) 
      alternatives.push({
        strategy: 'aggressive',
        price: marketRecommendation.range?.high || recommendedPrice * 1.15,
        description: 'Premium pricing - higher end of market range',
        pros: ['Higher profit margin', 'Room for negotiation'],
        cons: ['May take longer to sell', 'Fewer interested buyers']
      });

      // Market median pricing
      if (marketRecommendation.market?.median) {
        alternatives.push({
          strategy: 'market_median',
          price: marketRecommendation.market.median,
          description: 'Median market price - balanced approach',
          pros: ['Based on actual sales', 'Balanced risk/reward'],
          cons: ['May not account for item specifics']
        });
      }
    }

    return alternatives;
  }

  /**
   * Calculate overall confidence score
   */
  calculateOverallConfidence(validation) {
    let confidenceScore = 50; // Base confidence

    // Market data quality factors
    if (validation.marketData?.success) {
      const marketConfidence = validation.marketData.confidence || 0;
      const sampleSize = validation.marketData.recommendation?.sampleSize || 0;
      
      confidenceScore += marketConfidence * 0.3; // Up to 30 points
      
      if (sampleSize >= 10) confidenceScore += 15;
      else if (sampleSize >= 5) confidenceScore += 10;
      else if (sampleSize >= 3) confidenceScore += 5;
    }

    // Price comparison factors
    if (validation.comparison) {
      const classification = validation.comparison.classification;
      
      if (classification === 'reasonable') confidenceScore += 10;
      else if (classification === 'overpriced' || classification === 'underpriced') confidenceScore -= 5;
      else if (classification === 'major_overpriced' || classification === 'major_underpriced') confidenceScore -= 15;
    }

    // Issue penalties
    confidenceScore -= validation.issues.length * 10;
    confidenceScore -= validation.warnings.length * 3;

    // Ensure bounds
    confidenceScore = Math.max(0, Math.min(100, confidenceScore));

    if (confidenceScore >= 80) return 'high';
    if (confidenceScore >= 60) return 'medium';
    if (confidenceScore >= 40) return 'low';
    return 'very_low';
  }

  /**
   * Quick price validation for specific scenarios
   */
  async quickValidatePrice(itemTitle, brand, category, condition, estimatedPrice) {
    try {
      const searchData = {
        title: itemTitle,
        brand: brand,
        category: category,
        condition: condition
      };

      const marketResult = await marketDataService.getMarketDataForItem(searchData);
      
      if (!marketResult.success || !marketResult.recommendation) {
        return {
          isValid: false,
          message: 'Could not validate against market data',
          confidence: 'low'
        };
      }

      const marketPrice = marketResult.recommendation.suggested;
      const ratio = estimatedPrice / marketPrice;
      const classification = this.classifyPriceDifference(ratio);

      return {
        isValid: classification === 'reasonable' || classification === 'underpriced',
        classification: classification,
        marketPrice: marketPrice,
        estimatedPrice: estimatedPrice,
        difference: estimatedPrice - marketPrice,
        percentageDiff: ((estimatedPrice - marketPrice) / marketPrice) * 100,
        confidence: this.mapMarketConfidenceToOverall(marketResult.confidence),
        message: this.getValidationMessage(classification, Math.abs((estimatedPrice - marketPrice) / marketPrice) * 100)
      };

    } catch (error) {
      console.error('Quick price validation error:', error);
      return {
        isValid: false,
        message: `Validation error: ${error.message}`,
        confidence: 'low'
      };
    }
  }

  /**
   * Get validation message based on classification
   */
  getValidationMessage(classification, percentageDiff) {
    const messages = {
      'reasonable': 'Price estimate appears reasonable based on market data',
      'overpriced': `Price is ${percentageDiff.toFixed(0)}% higher than market average`,
      'major_overpriced': `Price is significantly higher (${percentageDiff.toFixed(0)}%) than market data suggests`,
      'underpriced': `Price is ${percentageDiff.toFixed(0)}% lower than market average - consider if you're missing value`,
      'major_underpriced': `Price is significantly lower (${percentageDiff.toFixed(0)}%) than market data suggests`,
      'severely_underpriced': `Price is extremely low compared to market data - double-check item details`
    };

    return messages[classification] || 'Price validation inconclusive';
  }

  /**
   * Generate price validation summary for UI display
   */
  generateValidationSummary(validation) {
    const summary = {
      status: validation.isValid ? 'valid' : 'invalid',
      confidence: validation.confidence,
      recommendedPrice: validation.enhancedPricing?.recommended,
      priceRange: validation.enhancedPricing?.range,
      marketContext: validation.enhancedPricing?.marketContext,
      issues: validation.issues.length,
      warnings: validation.warnings.length,
      dataQuality: this.assessDataQuality(validation),
      message: this.generateSummaryMessage(validation)
    };

    return summary;
  }

  /**
   * Assess data quality for summary
   */
  assessDataQuality(validation) {
    if (!validation.marketData?.success) {
      return 'no_market_data';
    }

    const sampleSize = validation.marketData.recommendation?.sampleSize || 0;
    const confidence = validation.marketData.confidence || 0;

    if (sampleSize >= 10 && confidence >= 70) return 'high';
    if (sampleSize >= 5 && confidence >= 50) return 'medium';
    if (sampleSize >= 3 && confidence >= 30) return 'low';
    return 'very_low';
  }

  /**
   * Generate user-friendly summary message
   */
  generateSummaryMessage(validation) {
    if (!validation.isValid && validation.issues.length > 0) {
      return `Price validation found ${validation.issues.length} issue(s) that need attention`;
    }

    if (validation.warnings.length > 0) {
      return `Price appears reasonable but has ${validation.warnings.length} warning(s) to consider`;
    }

    if (validation.enhancedPricing?.recommended) {
      return `Price validated successfully. Recommended: ${validation.enhancedPricing.recommended}`;
    }

    return 'Price validation completed';
  }

  /**
   * Test price validator with known examples
   */
  async testPriceValidator() {
    console.log('Running price validator tests...');

    const testCases = [
      {
        name: 'Baby Brezza Formula Pro',
        analysis: {
          category: 'baby formula maker and bottle warmer',
          brand: 'Baby Brezza',
          model: 'Formula Pro',
          condition: { rating: 'good' }
        },
        routes: {
          marketAnalysis: {
            estimatedValue: {
              suggested: 38,
              confidence: 'medium',
              source: 'ai_analysis'
            }
          }
        }
      },
      {
        name: 'Beats Studio3 Wireless Headphones',
        analysis: {
          category: 'wireless over-ear headphones', 
          brand: 'Beats',
          model: 'Studio3 Wireless',
          condition: { rating: 'good' }
        },
        routes: {
          marketAnalysis: {
            estimatedValue: {
              suggested: 17,
              confidence: 'medium',
              source: 'ai_analysis'
            }
          }
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\nTesting: ${testCase.name}`);
      const result = await this.validatePrice(testCase.analysis, testCase.routes);
      console.log('Result:', {
        isValid: result.isValid,
        confidence: result.confidence,
        issues: result.issues.length,
        recommendations: result.enhancedPricing?.recommended
      });
    }
  }
}

// Export singleton instance
module.exports = new PriceValidator();