// utils/category-detector.js
// Robust category detection for eBay item specifics generation

/**
 * Enhanced furniture keywords including specific furniture types
 */
const FURNITURE_KEYWORDS = [
  'furniture', 'chair', 'table', 'desk', 'sofa', 'cabinet', 'shelf', 'storage',
  'armchair', 'cantilever', 'recliner', 'ottoman', 'stool', 'bench', 'dresser',
  'nightstand', 'bookshelf', 'wardrobe', 'credenza', 'sideboard', 'hutch',
  'headboard', 'footboard', 'bed frame', 'mattress', 'couch', 'loveseat',
  'sectional', 'futon', 'daybed', 'dining set', 'coffee table', 'end table',
  'console table', 'vanity', 'mirror', 'lamp', 'chandelier', 'sconce',
  'entertainment center', 'tv stand', 'computer desk', 'office chair',
  'ergonomic chair', 'gaming chair', 'bar stool', 'counter stool',
  'rocking chair', 'glider', 'swing', 'patio furniture', 'outdoor furniture',
  'poäng', 'ikea chair', 'accent chair', 'lounge chair', 'dining chair'
];

const ELECTRONICS_KEYWORDS = [
  'electronic', 'computer', 'phone', 'tablet', 'camera', 'audio', 'video', 
  'gadget', 'headphones', 'earbuds', 'speaker', 'soundbar', 'amplifier',
  'receiver', 'turntable', 'cd player', 'dvd player', 'blu-ray', 'gaming',
  'console', 'laptop', 'desktop', 'monitor', 'keyboard', 'mouse', 'printer',
  'scanner', 'router', 'modem', 'smart tv', 'streaming device', 'cable box',
  'satellite', 'antenna', 'radio', 'bluetooth', 'wireless', 'usb', 'hdmi',
  'charger', 'battery', 'power bank', 'solar panel', 'drone', 'smartwatch',
  'fitness tracker', 'virtual reality', 'vr headset', 'gopro', 'dashcam'
];

const CLOTHING_KEYWORDS = [
  'clothing', 'shirt', 'dress', 'pants', 'jacket', 'sweater', 'apparel', 
  'fashion', 'blouse', 'skirt', 'shorts', 'jeans', 'trousers', 'suit',
  'blazer', 'coat', 'hoodie', 'sweatshirt', 'cardigan', 'vest', 'tank top',
  'camisole', 'leggings', 'tights', 'underwear', 'bra', 'panties', 'boxers',
  'briefs', 'socks', 'stockings', 'pajamas', 'nightgown', 'robe', 'swimwear',
  'bikini', 'swimsuit', 'coverup', 'activewear', 'workout clothes', 'yoga pants',
  'sports bra', 'athletic wear', 'uniform', 'scrubs', 'coveralls', 'jumpsuit',
  'romper', 'overalls', 'kimono', 'poncho', 'scarf', 'shawl', 'hat', 'cap',
  'beanie', 'headband', 'gloves', 'mittens', 'belt', 'suspenders', 'tie',
  'bow tie', 'cufflinks', 'pocket square'
];

const FOOTWEAR_KEYWORDS = [
  'shoes', 'boots', 'sneakers', 'sandals', 'footwear', 'athletic shoes',
  'running shoes', 'walking shoes', 'cross training', 'basketball shoes',
  'tennis shoes', 'golf shoes', 'cleats', 'spikes', 'hiking boots',
  'work boots', 'safety shoes', 'steel toe', 'dress shoes', 'oxfords',
  'loafers', 'moccasins', 'boat shoes', 'slip-ons', 'high heels', 'pumps',
  'stilettos', 'wedges', 'platforms', 'flats', 'ballet flats', 'mary janes',
  'ankle boots', 'knee boots', 'cowboy boots', 'rain boots', 'snow boots',
  'winter boots', 'flip flops', 'slides', 'clogs', 'crocs', 'espadrilles',
  'slippers', 'house shoes', 'mules', 'thongs', 'gladiator sandals'
];

/**
 * Enhanced category detection with comprehensive keyword matching
 */
class CategoryDetector {
  constructor() {
    this.categoryKeywords = {
      'furniture': FURNITURE_KEYWORDS,
      'electronics': ELECTRONICS_KEYWORDS,
      'clothing': CLOTHING_KEYWORDS,
      'footwear': FOOTWEAR_KEYWORDS,
      'tools': ['tools', 'hardware', 'wrench', 'drill', 'saw', 'equipment', 'construction'],
      'books': ['books', 'magazines', 'literature', 'textbook', 'novel', 'manual'],
      'automotive': ['automotive', 'car', 'vehicle', 'parts', 'accessories', 'motorcycle'],
      'toys': ['toys', 'games', 'dolls', 'action figures', 'puzzles', 'educational'],
      'sporting goods': ['sports', 'athletic', 'fitness', 'outdoor', 'exercise', 'recreation'],
      'jewelry': ['jewelry', 'watches', 'rings', 'necklaces', 'earrings', 'bracelets'],
      'home & garden': ['home', 'garden', 'kitchen', 'bathroom', 'decor', 'appliances', 'yard'],
      'collectibles': ['collectibles', 'antiques', 'vintage', 'memorabilia', 'coins', 'stamps']
    };
  }

  /**
   * Detect category from item description with enhanced matching
   */
  detectCategory(input) {
    if (!input || typeof input !== 'string') {
      return 'unknown';
    }

    const normalizedInput = input.toLowerCase().trim();
    const scores = {};

    // Initialize scores
    Object.keys(this.categoryKeywords).forEach(category => {
      scores[category] = 0;
    });

    // Score each category based on keyword matches
    Object.entries(this.categoryKeywords).forEach(([category, keywords]) => {
      keywords.forEach(keyword => {
        if (normalizedInput.includes(keyword.toLowerCase())) {
          // Give higher score for exact matches
          if (normalizedInput === keyword.toLowerCase()) {
            scores[category] += 20;
          }
          // Give high score for word boundary matches
          else if (this.hasWordBoundaryMatch(normalizedInput, keyword)) {
            scores[category] += 15;
          }
          // Regular substring matches
          else {
            scores[category] += 10;
          }
        }
      });
    });

    // Apply category-specific bonuses
    this.applyCategoryBonuses(normalizedInput, scores);

    // Find the category with the highest score
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      return 'unknown';
    }

    const detectedCategory = Object.keys(scores).find(category => scores[category] === maxScore);
    
    console.log(`Category detection for "${input}":`, {
      detected: detectedCategory,
      score: maxScore,
      allScores: scores
    });

    return detectedCategory;
  }

  /**
   * Check for word boundary matches (more accurate than substring)
   */
  hasWordBoundaryMatch(text, keyword) {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
    return regex.test(text);
  }

  /**
   * Apply category-specific scoring bonuses
   */
  applyCategoryBonuses(input, scores) {
    // Furniture-specific patterns
    if (input.includes('cantilever') || input.includes('bentwood')) {
      scores['furniture'] += 25;
    }
    if (input.match(/\b(ikea|herman miller|steelcase|knoll)\b/i)) {
      scores['furniture'] += 20;
    }
    if (input.includes('high back') || input.includes('headrest')) {
      scores['furniture'] += 15;
    }
    if (input.includes('ergonomic') && input.includes('chair')) {
      scores['furniture'] += 20;
    }

    // Electronics-specific patterns
    if (input.includes('wireless') || input.includes('bluetooth')) {
      scores['electronics'] += 15;
    }
    if (input.match(/\b(sony|apple|samsung|bose|beats)\b/i)) {
      scores['electronics'] += 15;
    }
    if (input.includes('noise cancel') || input.includes('active noise')) {
      scores['electronics'] += 20;
    }

    // Footwear-specific patterns
    if (input.match(/size\s+\d+/i) && !input.includes('chair')) {
      scores['footwear'] += 15;
    }
    if (input.match(/\b(nike|adidas|puma|reebok|converse)\b/i)) {
      scores['footwear'] += 15;
    }

    // Clothing-specific patterns
    if (input.match(/\b(small|medium|large|xl|xxl)\b/i) && !input.includes('chair')) {
      scores['clothing'] += 15;
    }
    if (input.match(/\b(cotton|polyester|wool|silk|denim)\b/i)) {
      scores['clothing'] += 15;
    }
  }

  /**
   * Check if a category is furniture-related
   */
  isFurnitureCategory(category) {
    if (!category) return false;
    
    const normalizedCategory = category.toLowerCase().trim();
    
    // Direct category match
    if (normalizedCategory === 'furniture') {
      return true;
    }

    // Check if any furniture keywords are present
    return FURNITURE_KEYWORDS.some(keyword => 
      normalizedCategory.includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if a category is electronics-related
   */
  isElectronicsCategory(category) {
    if (!category) return false;
    
    const normalizedCategory = category.toLowerCase().trim();
    
    if (normalizedCategory === 'electronics') {
      return true;
    }

    return ELECTRONICS_KEYWORDS.some(keyword => 
      normalizedCategory.includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if a category is clothing-related
   */
  isClothingCategory(category) {
    if (!category) return false;
    
    const normalizedCategory = category.toLowerCase().trim();
    
    if (normalizedCategory === 'clothing') {
      return true;
    }

    return CLOTHING_KEYWORDS.some(keyword => 
      normalizedCategory.includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if a category is footwear-related
   */
  isFootwearCategory(category) {
    if (!category) return false;
    
    const normalizedCategory = category.toLowerCase().trim();
    
    if (normalizedCategory === 'footwear') {
      return true;
    }

    return FOOTWEAR_KEYWORDS.some(keyword => 
      normalizedCategory.includes(keyword.toLowerCase())
    );
  }

  /**
   * Get category-specific requirements hint
   */
  getCategoryRequirementsHint(category) {
    const hints = {
      'furniture': 'Required: Number of Items in Set, Set Includes',
      'footwear': 'Required: US Shoe Size, Style',
      'electronics': 'Required: Type, Brand',
      'clothing': 'Required: Size, Brand',
      'automotive': 'Required: Make, Model, Year',
      'books': 'Required: Format (e.g., Paperback, Hardcover)',
      'jewelry': 'Required: Type, Material',
      'toys': 'Required: Age Range, Brand',
      'sporting goods': 'Required: Sport, Brand',
      'tools': 'Required: Type, Brand',
      'home & garden': 'Required: Type, Brand',
      'collectibles': 'Required: Type, Year'
    };

    return hints[category] || 'Required: Brand, Type';
  }

  /**
   * Test the detector with sample inputs
   */
  runTests() {
    const testCases = [
      'cantilever armchair with high back and headrest',
      'IKEA POÄNG chair',
      'wireless bluetooth headphones',
      'nike running shoes size 10',
      'cotton t-shirt medium',
      'vintage coin collection',
      'power drill with bits',
      'children educational toy'
    ];

    console.log('Running category detection tests:');
    testCases.forEach(testCase => {
      const detected = this.detectCategory(testCase);
      console.log(`"${testCase}" -> ${detected}`);
    });
  }
}

// Export singleton instance
const categoryDetector = new CategoryDetector();

module.exports = {
  CategoryDetector,
  categoryDetector,
  FURNITURE_KEYWORDS,
  ELECTRONICS_KEYWORDS,
  CLOTHING_KEYWORDS,
  FOOTWEAR_KEYWORDS
};