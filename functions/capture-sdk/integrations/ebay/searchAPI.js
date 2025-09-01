const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

class EbaySearchAPI {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.environment = config.environment || 'production';
    this.accessToken = null;
    this.debugMode = config.debug || false;
  }

  log(message, data = null) {
    if (this.debugMode) {
      console.log(`[EbaySearchAPI] ${message}`, data || '');
    }
  }

  async searchSimilarItems(itemData, options = {}) {
    const {
      includeSold = true,
      maxResults = 50,
      maxSoldResults = 30,
      conditionFilter = null,
      priceRange = null,
      sortBy = 'price',
      daysBack = 90,
      accessToken
    } = options;

    if (accessToken) {
      this.accessToken = accessToken;
    } else {
      await this.getApplicationToken();
    }

    try {
      const searchQueries = this.buildMultipleSearchQueries(itemData);
      this.log('Generated search queries:', searchQueries);

      let allActiveListings = [];
      let allSoldListings = [];

      for (const query of searchQueries.slice(0, 3)) {
        try {
          const activeListings = await this.searchActiveListings(query, {
            maxResults: Math.ceil(maxResults / searchQueries.length),
            conditionFilter, priceRange, sortBy
          });

          let soldListings = [];
          if (includeSold) {
            soldListings = await this.searchSoldListings(query, {
              maxResults: Math.ceil(maxSoldResults / searchQueries.length),
              conditionFilter, daysBack
            });
          }

          allActiveListings.push(...activeListings);
          allSoldListings.push(...soldListings);

          this.log(`Query "${query.query}" found:`, {
            active: activeListings.length, sold: soldListings.length
          });
        } catch (queryError) {
          this.log(`Query "${query.query}" failed:`, queryError.message);
          continue;
        }
      }

      allActiveListings = this.removeDuplicateItems(allActiveListings);
      allSoldListings = this.removeDuplicateItems(allSoldListings);

      const priceAnalysis = this.enhancedPriceAnalysis(allActiveListings, allSoldListings, { preferSold: true, daysBack });

      return {
        searchQueries: searchQueries.map(q => q.query),
        activeListings: allActiveListings.slice(0, maxResults),
        soldListings: allSoldListings.slice(0, maxSoldResults),
        priceAnalysis,
        searchMetadata: {
          totalActive: allActiveListings.length, totalSold: allSoldListings.length, queriesUsed: searchQueries.length,
          timestamp: new Date().toISOString(),
          coverage: this.calculateSearchCoverage(allActiveListings, allSoldListings)
        }
      };
    } catch (error) {
      console.error('eBay search error:', error);
      throw new Error(`eBay search failed: ${error.message}`);
    }
  }

  buildMultipleSearchQueries(itemData) {
    const queries = [];
    if (itemData.brand && itemData.brand !== 'Unknown' && itemData.model && itemData.model !== 'Unknown') {
      queries.push({ query: `${itemData.brand} ${itemData.model} ${itemData.category}`.trim(), priority: 1, type: 'specific' });
    }
    if (itemData.brand && itemData.brand !== 'Unknown') {
      queries.push({ query: `${itemData.brand} ${itemData.category}`.trim(), priority: 2, type: 'brand_category' });
    }
    if (itemData.model && itemData.model !== 'Unknown' && itemData.model.length > 3) {
      queries.push({ query: `${itemData.model} ${itemData.category}`.trim(), priority: 3, type: 'model_category' });
    }
    const enhancedCategory = this.enhanceCategory(itemData);
    if (enhancedCategory) {
      queries.push({ query: enhancedCategory, priority: 4, type: 'enhanced_category' });
    }
    if (itemData.category) {
      queries.push({ query: itemData.category, priority: 5, type: 'fallback' });
    }
    return queries.sort((a, b) => a.priority - b.priority);
  }

  enhanceCategory(itemData) {
    let enhanced = itemData.category || '';
    if (itemData.materials && itemData.materials.length > 0) {
      const material = itemData.materials[0];
      if (!enhanced.toLowerCase().includes(material.toLowerCase())) {
        enhanced = `${material} ${enhanced}`;
      }
    }
    if (itemData.style && itemData.style !== 'modern') {
      if (!enhanced.toLowerCase().includes(itemData.style.toLowerCase())) {
        enhanced = `${itemData.style} ${enhanced}`;
      }
    }
    if (itemData.keyFeatures && itemData.keyFeatures.length > 0) {
      const feature = itemData.keyFeatures[0];
      if (feature.length > 3 && !enhanced.toLowerCase().includes(feature.toLowerCase())) {
        enhanced = `${enhanced} ${feature}`;
      }
    }
    return enhanced.trim();
  }

  async searchActiveListings(query, options = {}) {
    const { maxResults = 25, conditionFilter, priceRange, sortBy = 'price' } = options;
    const url = `${this.getBrowseApiUrl()}/buy/browse/v1/item_summary/search`;
    const params = new URLSearchParams({ q: query.query, limit: Math.min(maxResults, 100).toString(), sort: sortBy });
    const filters = this.buildFilters(conditionFilter, priceRange);
    if (filters) { params.append('filter', filters); }
    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${this.accessToken}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', 'Accept': 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`eBay Browse API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return (data.itemSummaries || []).map(item => ({
      itemId: item.itemId, title: item.title, price: this.parsePrice(item.price), condition: item.condition,
      imageUrl: item.image?.imageUrl, itemWebUrl: item.itemWebUrl, seller: item.seller?.username,
      shippingCost: this.parsePrice(item.shippingOptions?.[0]?.shippingCost),
      listingType: 'active'
    }));
  }

  async searchSoldListings(query, options = {}) {
    const { maxResults = 25, conditionFilter, daysBack = 90 } = options;
    try {
      const soldResults = await this.searchSoldViaFilter(query, options);
      if (soldResults.length > 0) {
        return soldResults;
      }
      return [];
    } catch (error) {
      this.log('Sold listings search failed:', error.message);
      return [];
    }
  }

  async searchSoldViaFilter(query, options) {
    const { maxResults = 25, conditionFilter } = options;
    const url = `${this.getBrowseApiUrl()}/buy/browse/v1/item_summary/search`;
    const params = new URLSearchParams({ q: query.query + ' sold', limit: maxResults.toString(), sort: 'endingSoonest' });
    let filters = [];
    if (conditionFilter) {
      const conditionMap = {
        'new': '1000', 'like_new': '1500', 'excellent': '2000', 'very_good': '2500', 'good': '3000', 'acceptable': '4000', 'for_parts': '7000'
      };
      const conditionId = conditionMap[conditionFilter.toLowerCase()];
      if (conditionId) { filters.push(`conditionIds:{${conditionId}}`); }
    }
    filters.push('buyingOptions:{AUCTION,FIXED_PRICE}');
    if (filters.length > 0) { params.append('filter', filters.join(',')); }
    try {
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', 'Accept': 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`Filter search failed: ${response.status}`);
      }
      const data = await response.json();
      return (data.itemSummaries || []).map(item => ({
        itemId: item.itemId + '_sold', title: item.title, price: this.parsePrice(item.price), condition: item.condition,
        soldDate: new Date().toISOString(), imageUrl: item.image?.imageUrl, itemWebUrl: item.itemWebUrl,
        seller: item.seller?.username, listingType: 'sold'
      }));
    } catch (error) {
      this.log('Filter method failed:', error.message);
      return [];
    }
  }

  enhancedPriceAnalysis(activeListings, soldListings, options = {}) {
    const { preferSold = true, daysBack = 90 } = options;
    if (activeListings.length === 0 && soldListings.length === 0) {
      return { suggested: null, confidence: 'low', reason: 'No comparable items found' };
    }
    const activePrices = activeListings.map(item => item.price).filter(p => p > 0);
    const soldPrices = soldListings.map(item => item.price).filter(p => p > 0);
    let finalPrice, confidence, priceSource;
    if (soldPrices.length >= 3 && preferSold) {
      finalPrice = this.calculateWeightedPrice(soldPrices, 'sold');
      confidence = soldPrices.length >= 10 ? 'high' : 'medium';
      priceSource = 'sold_listings';
    } else if (activePrices.length >= 3) {
      const activePrice = this.calculateWeightedPrice(activePrices, 'active');
      finalPrice = Math.round(activePrice * 0.92);
      confidence = activePrices.length >= 10 ? 'medium' : 'low';
      priceSource = 'active_adjusted';
    } else if (soldPrices.length > 0 && activePrices.length > 0) {
      const combinedPrices = [...soldPrices, ...activePrices.map(p => p * 0.92)];
      finalPrice = this.calculateWeightedPrice(combinedPrices, 'combined');
      confidence = 'medium';
      priceSource = 'combined';
    } else {
      const allPrices = [...activePrices, ...soldPrices];
      if (allPrices.length > 0) {
        finalPrice = Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);
        confidence = 'low';
        priceSource = 'limited_data';
      } else {
        return { suggested: null, confidence: 'low', reason: 'No valid prices found' };
      }
    }
    const allPrices = [...activePrices, ...soldPrices].sort((a, b) => a - b);
    const stats = this.calculatePriceStatistics(allPrices);
    return {
      suggested: finalPrice, confidence, priceSource,
      priceRange: { min: Math.round(stats.min), max: Math.round(stats.max), median: Math.round(stats.median), average: Math.round(stats.average) },
      sampleSize: { total: allPrices.length, sold: soldPrices.length, active: activePrices.length },
      variance: Math.round(stats.stdDev),
      reason: `Based on ${soldPrices.length} sold + ${activePrices.length} active listings`
    };
  }

  calculateWeightedPrice(prices, source) {
    if (prices.length === 0) return 0;
    const sorted = [...prices].sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const variance = sorted.reduce((a, p) => a + Math.pow(p - mean, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);
    const filtered = sorted.filter(p => Math.abs(p - mean) <= 2 * stdDev);
    if (filtered.length === 0) return Math.round(mean);
    const median = filtered[Math.floor(filtered.length / 2)];
    switch (source) {
      case 'sold': return Math.round(median);
      case 'active': return Math.round(median * 0.92);
      case 'combined': return Math.round(median * 0.96);
      default: return Math.round(median);
    }
  }

  calculatePriceStatistics(prices) {
    if (prices.length === 0) { return { min: 0, max: 0, median: 0, average: 0, stdDev: 0 }; }
    const sorted = [...prices].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    const average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const variance = sorted.reduce((a, p) => a + Math.pow(p - average, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);
    return { min, max, median, average, stdDev };
  }

  removeDuplicateItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const id = item.itemId?.replace(/_sold$|_estimated_sold$/, '');
      if (seen.has(id)) { return false; }
      seen.add(id);
      return true;
    });
  }

  calculateSearchCoverage(activeListings, soldListings) {
    const total = activeListings.length + soldListings.length;
    const soldRatio = soldListings.length / Math.max(total, 1);
    let coverage = 'poor';
    if (total >= 20) coverage = 'excellent';
    else if (total >= 10) coverage = 'good';
    else if (total >= 5) coverage = 'fair';
    return { level: coverage, totalItems: total, soldRatio: Math.round(soldRatio * 100) / 100, confidence: total >= 15 && soldRatio >= 0.3 ? 'high' : 'medium' };
  }

  escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;'; case '>': return '&gt;'; case '&': return '&amp;'; case '\'': return '&apos;'; case '"': return '&quot;';
      }
    });
  }

  parseFindingAPIResponse(xmlText) {
    const items = [];
    try {
      const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
      itemMatches.forEach((itemXml, index) => {
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const priceMatch = itemXml.match(/<convertedCurrentPrice currencyId="USD">([\d.]+)<\/convertedCurrentPrice>/);
        const endTimeMatch = itemXml.match(/<endTime>(.*?)<\/endTime>/);
        const urlMatch = itemXml.match(/<viewItemURL><!\[CDATA\[(.*?)\]\]><\/viewItemURL>/);
        if (titleMatch && priceMatch) {
          items.push({
            itemId: `finding_${index}_${Date.now()}`, title: titleMatch[1], price: parseFloat(priceMatch[1]),
            soldDate: endTimeMatch ? endTimeMatch[1] : new Date().toISOString(), itemWebUrl: urlMatch ? urlMatch[1] : '',
            listingType: 'sold', source: 'finding_api'
          });
        }
      });
    } catch (error) { this.log('XML parsing error:', error.message); }
    return items;
  }

  buildFilters(conditionFilter, priceRange) {
    const filters = [];
    if (conditionFilter) {
      const conditionMap = {
        'new': '1000', 'like_new': '1500', 'excellent': '2000', 'very_good': '2500', 'good': '3000', 'acceptable': '4000', 'for_parts': '7000'
      };
      const conditionId = conditionMap[conditionFilter.toLowerCase()];
      if (conditionId) { filters.push(`conditionIds:{${conditionId}}`); }
    }
    if (priceRange) {
      if (priceRange.min) filters.push(`price:[${priceRange.min}..]`);
      if (priceRange.max) filters.push(`price:[..${priceRange.max}]`);
    }
    return filters.join(',');
  }

  parsePrice(priceObj) {
    if (!priceObj || !priceObj.value) return 0;
    return parseFloat(priceObj.value);
  }

  async getApplicationToken() {
    if (this.accessToken) { return this.accessToken; }
    const response = await fetch(`${this.getTokenUrl()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${this.getBasicAuth()}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebayapis.com/oauth/api_scope/buy.item.feed'
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('eBay token error:', errorText);
      throw new Error(`Token request failed: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    this.accessToken = data.access_token;
    setTimeout(() => { this.accessToken = null; }, (data.expires_in - 60) * 1000);
    return this.accessToken;
  }

  getBrowseApiUrl() {
    return this.environment === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
  }

  getTokenUrl() {
    return this.environment === 'sandbox' ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token' : 'https://api.ebay.com/identity/v1/oauth2/token';
  }

  getBasicAuth() {
    return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
  }
}

module.exports = { EbaySearchAPI };
