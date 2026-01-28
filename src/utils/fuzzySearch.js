/**
 * Fuzzy Search Utility
 *
 * @module utils/fuzzySearch
 * @description Wrapper around Fuse.js for command palette fuzzy search.
 * Falls back to simple search if Fuse.js is not installed.
 */

// Fuse.js is optional - we'll try to load it dynamically
let Fuse = null;
let fuseLoadAttempted = false;

// Lazy load Fuse.js to avoid breaking the app if it's not installed
async function loadFuse() {
  if (fuseLoadAttempted) return Fuse;
  fuseLoadAttempted = true;
  try {
    const module = await import('fuse.js');
    Fuse = module.default;
  } catch (e) {
    console.warn('Fuse.js not installed, using simple fuzzy search fallback');
  }
  return Fuse;
}

// Start loading Fuse.js immediately (but don't block)
loadFuse();

/**
 * Default Fuse.js options optimized for command search
 */
const DEFAULT_OPTIONS = {
  // Search in these fields
  keys: [
    { name: 'label', weight: 2 },
    { name: 'description', weight: 1 },
    { name: 'category', weight: 0.5 },
  ],
  // Include matches info for highlighting
  includeMatches: true,
  // Include score for ranking
  includeScore: true,
  // Threshold: 0 = perfect match, 1 = match anything
  // 0.4 is a good balance for command search
  threshold: 0.4,
  // Don't match if more than 40% of pattern length away from start
  distance: 100,
  // Use extended search patterns
  useExtendedSearch: false,
  // Ignore location in string for matching
  ignoreLocation: true,
  // Minimum characters to start matching
  minMatchCharLength: 1,
  // Sort by score
  sortFn: (a, b) => a.score - b.score,
};

/**
 * Creates a fuzzy search instance for a list of items.
 *
 * @param {Array} items - Array of items to search through
 * @param {Object} options - Optional Fuse.js options override
 * @returns {Function} Search function that takes a query and returns results
 */
export function createFuzzySearch(items, options = {}) {
  // If Fuse.js isn't loaded, return a function that uses simple search
  if (!Fuse) {
    return function search(query, limit = 10) {
      return simpleFuzzySearch(items, query, ['label', 'description']).slice(0, limit);
    };
  }

  const fuse = new Fuse(items, { ...DEFAULT_OPTIONS, ...options });

  /**
   * Search for items matching the query.
   *
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of results (default: 10)
   * @returns {Array} Array of matching items with score and matches
   */
  return function search(query, limit = 10) {
    if (!query || query.trim() === '') {
      // Return all items when no query (limited)
      return items.slice(0, limit).map((item) => ({
        item,
        score: 0,
        matches: [],
      }));
    }

    const results = fuse.search(query, { limit });
    return results;
  };
}

/**
 * Highlights matched portions of text based on Fuse.js match indices.
 *
 * @param {string} text - Original text
 * @param {Array} indices - Array of [start, end] match indices
 * @returns {Array} Array of { text, highlight } segments
 */
export function highlightMatches(text, indices = []) {
  if (!indices || indices.length === 0) {
    return [{ text, highlight: false }];
  }

  const segments = [];
  let lastIndex = 0;

  // Sort indices by start position
  const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

  for (const [start, end] of sortedIndices) {
    // Add non-highlighted segment before this match
    if (start > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, start),
        highlight: false,
      });
    }
    // Add highlighted segment
    segments.push({
      text: text.slice(start, end + 1),
      highlight: true,
    });
    lastIndex = end + 1;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      highlight: false,
    });
  }

  return segments;
}

/**
 * Simple fallback fuzzy search without Fuse.js (for when library isn't available)
 * Uses basic substring matching with scoring.
 *
 * @param {Array} items - Array of items to search
 * @param {string} query - Search query
 * @param {Array} keys - Keys to search in each item
 * @returns {Array} Matching items sorted by relevance
 */
export function simpleFuzzySearch(items, query, keys = ['label', 'description']) {
  if (!query || query.trim() === '') {
    return items.map((item) => ({ item, score: 0, matches: [] }));
  }

  const lowerQuery = query.toLowerCase();
  const results = [];

  for (const item of items) {
    let bestScore = Infinity;
    const matches = [];

    for (const key of keys) {
      const value = item[key];
      if (!value) continue;

      const lowerValue = value.toLowerCase();
      const queryIndex = lowerValue.indexOf(lowerQuery);

      if (queryIndex !== -1) {
        // Exact substring match - score based on position
        const score = queryIndex / lowerValue.length;
        if (score < bestScore) {
          bestScore = score;
        }
        matches.push({
          key,
          indices: [[queryIndex, queryIndex + query.length - 1]],
        });
      } else {
        // Try character-by-character fuzzy match
        let queryIdx = 0;
        let matchIndices = [];

        for (let i = 0; i < lowerValue.length && queryIdx < lowerQuery.length; i++) {
          if (lowerValue[i] === lowerQuery[queryIdx]) {
            matchIndices.push([i, i]);
            queryIdx++;
          }
        }

        if (queryIdx === lowerQuery.length) {
          // All characters matched - score based on gaps
          const gaps = matchIndices.length > 1
            ? matchIndices.slice(1).reduce((sum, [start], i) =>
                sum + (start - matchIndices[i][1] - 1), 0)
            : 0;
          const score = 0.5 + (gaps / lowerValue.length) * 0.5;

          if (score < bestScore) {
            bestScore = score;
          }
          matches.push({
            key,
            indices: matchIndices,
          });
        }
      }
    }

    if (matches.length > 0 && bestScore < 1) {
      results.push({ item, score: bestScore, matches });
    }
  }

  // Sort by score (lower is better)
  results.sort((a, b) => a.score - b.score);

  return results;
}

export default createFuzzySearch;
