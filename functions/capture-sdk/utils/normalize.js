// functions/capture-sdk/utils/normalize.js (CommonJS - FIXED)

/** Case-insensitive shallow getter. */
function ciGet(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  const map = new Map(Object.keys(obj).map(k => [k.toLowerCase(), k]));
  for (const k of keys.flat()) {
    const hit = map.get(String(k).toLowerCase());
    if (hit != null) return obj[hit];
  }
  return undefined;
}

/** Parse price ranges like "$15–$35", "$15-35", "USD 15 to 35". */
function parseCurrencyRange(input) {
  if (!input) return null;
  const s = String(input).replace(/[, ]/g, '');
  const currency = 'USD';
  const nums = s.replace(/[^\d\-–.]/g, '')
    .split(/[–-]/)
    .map(x => parseFloat(x))
    .filter(n => !isNaN(n));
  if (nums.length === 1) return { low: nums[0], high: nums[0], currency };
  if (nums.length >= 2) {
    const low = Math.min(nums[0], nums[1]);
    const high = Math.max(nums[0], nums[1]);
    return { low, high, currency };
  }
  return null;
}

/** Map ratings to good/fair/poor. */
function normalizeRating(rating) {
  if (typeof rating === 'number') {
    if (rating >= 8) return 'good';
    if (rating >= 5) return 'fair';
    return 'poor';
  }
  const map = {
    'excellent': 'good',
    'very good': 'good',
    'good': 'good',
    'fair': 'fair',
    'poor': 'poor',
    'broken': 'poor',
    'for parts': 'poor'
  };
  const n = String(rating ?? 'fair').toLowerCase();
  return map[n] || 'fair';
}

/** Normalize action text to internal enum. */
function normalizeRecommendation(recRaw) {
  if (!recRaw) return 'evaluate';
  const s = String(recRaw).toLowerCase();
  if (s.includes('donate')) return 'donate';
  if ((s.includes('repair') && s.includes('sell')) || s.includes('repair and resell') || s.includes('repair & resell')) return 'repair-resell';
  if (s.includes('resell') || s.includes('sell')) return 'resell';
  if (s.includes('recycle')) return 'recycle';
  if (s.includes('scrap') || s.includes('parts')) return 'parts';
  if (s.includes('local pickup')) return 'local-pickup';
  return 'evaluate';
}

/** Extract simple issue keywords. */
function parseIssues(description) {
  if (!description) return [];
  const kws = [
    'broken','cracked','missing','damaged','worn','stained','scratched','dented',
    'fray','fraying','tear','torn','loose','scuff','scuffed','chip','chipped','sag'
  ];
  const d = description.toLowerCase();
  return Array.from(new Set(kws.filter(k => d.includes(k))));
}

/** Turn { Frame: "...", Cushion: "..." } into "Frame: ... | Cushion: ...". */
function condObjectToText(obj) {
  return Object.entries(obj)
    .filter(([, v]) => typeof v === 'string' && v.trim().length)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');
}

/** Normalize salvage entry shapes. */
function normalizeSalvageComponent(component) {
  if (!component) return { component: 'Unknown', value: 'Unknown', disposal: 'Check local recycling' };
  if (typeof component === 'string') {
    const m = component.split(/[-–—:]/);
    if (m.length >= 2) {
      return {
        component: m[0].trim() || 'Unknown',
        value: m.slice(1).join('-').trim() || 'Unknown',
        disposal: 'Check local recycling'
      };
    }
    return { component, value: 'Unknown', disposal: 'Check local recycling' };
  }
  return {
    component: component.component || component.part || 'Unknown',
    value: component.value || component.estimatedValue || 'Unknown',
    disposal: component.disposal || component.recycling || 'Check local recycling'
  };
}

function pickFirstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
}

/** 
 * ENHANCED: Brand-preserving normalizer with better IKEA detection
 * Maps either SDK shape or "circular economy assistant" shape.
 */
function normalizeResponse(rawResponse /*, provider */) {
  console.log('🔄 Normalizing response - preserving brand data...');
  
  const normalized = {
    category: 'Unknown',
    brand: 'Unknown',
    model: 'Unknown',
    condition: { rating: 'fair', description: '', usableAsIs: false, issues: [] },
    resale: { recommendation: 'evaluate', priceRange: { low: 0, high: 0, currency: 'USD' }, justification: '' },
    salvageable: [],
    confidence: 5
  };

  try {
    const data = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : (rawResponse || {});
    
    console.log('📋 Raw data keys:', Object.keys(data));

    // ✅ ENHANCED: More aggressive brand detection
    const rawBrand = pickFirstDefined(
      ciGet(data, 'brand','manufacturer','Brand / Manufacturer','Brand','brandName'),
      data.brand, // Direct access as backup
      data.manufacturer,
      data['Brand / Manufacturer']
    );
    
    console.log('🏷️ Raw brand detected:', rawBrand);
    
    // Don't normalize brand to "Unknown" if we have any non-empty string
    if (rawBrand && typeof rawBrand === 'string' && rawBrand.trim() && rawBrand.trim().toLowerCase() !== 'unknown') {
      normalized.brand = rawBrand.trim();
      console.log('✅ Brand preserved:', normalized.brand);
    } else {
      console.log('⚠️ No valid brand found, using Unknown');
    }

    // Category / Model (case-insensitive across both schemas)
    normalized.category = pickFirstDefined(ciGet(data, 'category','itemCategory','Item Category'), 'Unknown');
    normalized.model    = pickFirstDefined(ciGet(data, 'model','modelNumber','productName','Model / Product Name','Model'), 'Unknown');

    console.log('📊 Normalized so far:', {
      category: normalized.category,
      brand: normalized.brand,
      model: normalized.model
    });

    // Condition (object or simple)
    let conditionBlock = ciGet(data, 'condition','Condition Assessment');
    if (conditionBlock && typeof conditionBlock === 'object' && !Array.isArray(conditionBlock)) {
      const ratingRaw = ciGet(conditionBlock, 'rating','numeric_rating');
      const descRaw   = ciGet(conditionBlock, 'description') ?? condObjectToText(conditionBlock);
      normalized.condition = {
        rating: normalizeRating(ratingRaw ?? descRaw),
        description: String(descRaw || '').trim(),
        usableAsIs: (ciGet(conditionBlock,'usableAsIs','usable') ?? true),
        issues: Array.isArray(ciGet(conditionBlock,'issues')) ? ciGet(conditionBlock,'issues') : parseIssues(descRaw || '')
      };
    } else if (conditionBlock !== undefined) {
      normalized.condition = {
        rating: normalizeRating(conditionBlock),
        description: typeof conditionBlock === 'string' ? conditionBlock : '',
        usableAsIs: true,
        issues: typeof conditionBlock === 'string' ? parseIssues(conditionBlock) : []
      };
    }

    // Resale / Resale Potential
    let resaleBlock = pickFirstDefined(ciGet(data, 'resale','resalePotential'), ciGet(data, 'Resale Potential'));
    if (resaleBlock && typeof resaleBlock === 'object') {
      const recRaw = pickFirstDefined(
        ciGet(resaleBlock, 'recommendation','Recommended action','Recommended Action','Recommend'),
        ciGet(resaleBlock, 'action')
      );
      const recommendation = normalizeRecommendation(recRaw);

      let priceRaw = pickFirstDefined(
        ciGet(resaleBlock, 'priceRange','Estimated Resale Price Range (USD)','Estimated Resale Price Range'),
        ''
      );
      let parsedRange;
      if (priceRaw && typeof priceRaw === 'object') {
        parsedRange = {
          low: Number(priceRaw.low ?? priceRaw.min ?? 0),
          high: Number(priceRaw.high ?? priceRaw.max ?? 0),
          currency: priceRaw.currency || 'USD'
        };
      } else if (typeof priceRaw === 'string') {
        parsedRange = parseCurrencyRange(priceRaw) || { low: 0, high: 0, currency: 'USD' };
      } else {
        parsedRange = { low: 0, high: 0, currency: 'USD' };
      }

      const justification = pickFirstDefined(
        ciGet(resaleBlock, 'justification','reasoning','Brief justification','Justification'),
        ''
      );

      normalized.resale = { recommendation, priceRange: parsedRange, justification };
    }

    // Salvage / Component Salvage
    const salvageRaw = pickFirstDefined(ciGet(data, 'salvageable','componentSalvage','parts'), ciGet(data, 'Component Salvage'));
    if (Array.isArray(salvageRaw)) normalized.salvageable = salvageRaw.map(normalizeSalvageComponent);

    // Confidence
    const confRaw = pickFirstDefined(ciGet(data,'confidence','confidenceRating','Confidence Rating'), undefined);
    if (confRaw != null && Number.isFinite(Number(confRaw))) normalized.confidence = Number(confRaw);

    // ✅ ENHANCED: Preserve additional fields that might contain brand info
    const materials = ciGet(data,'materials');
    if (Array.isArray(materials)) normalized.materials = materials;
    
    const identifiers = ciGet(data,'identifiers');
    if (identifiers && typeof identifiers === 'object') {
      normalized.identifiers = identifiers;
      
      // Check if brand info is hidden in identifiers
      if (normalized.brand === 'Unknown' && identifiers.visible_text) {
        const visibleText = identifiers.visible_text.toLowerCase();
        if (visibleText.includes('ikea')) {
          normalized.brand = 'IKEA';
          console.log('🔍 Found IKEA in visible_text, correcting brand!');
        }
      }
    }

    console.log('✅ Final normalized result:', {
      category: normalized.category,
      brand: normalized.brand,
      model: normalized.model,
      confidence: normalized.confidence
    });

  } catch (e) {
    console.error('❌ Error normalizing response:', e);
    console.error('Raw response that failed:', rawResponse);
  }

  return normalized;
}

// ✅ FIXED: Proper CommonJS export
module.exports = { normalizeResponse };