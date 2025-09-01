// functions/capture-sdk/utils/searchQueryBuilder.js
// This file is now deprecated. Please use enhancedSearch.js instead.

/**
 * The logic from this file has been moved to enhancedSearch.js.
 * This file is kept here for reference, but is no longer used.
 */

console.warn("searchQueryBuilder.js is deprecated. Please use buildEnhancedSearchQuery from enhancedSearch.js instead.");

function buildSmartSearchQueries(itemData) {
  console.error('Deprecated function call: buildSmartSearchQueries. Please update your code to use the new enhancedSearch module.');
  return [{ query: itemData.category || 'misc', priority: 1, description: 'Deprecated fallback' }];
}

module.exports = { buildSmartSearchQueries };
