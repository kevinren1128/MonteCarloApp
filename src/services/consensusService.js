/**
 * Consensus Service - Shared Database Reads
 *
 * @module services/consensusService
 * @description Reads shared consensus data from Supabase database (populated by cron job)
 * Falls back to live FMP API calls for missing/stale data.
 */

import { supabase } from './authService';

// Stale threshold: consider data stale if older than 48 hours
const STALE_HOURS = 48;

/**
 * Check if consensus data is stale
 * @param {string} fetchedAt - ISO timestamp
 * @returns {boolean} True if data is stale
 */
function isStale(fetchedAt) {
  if (!fetchedAt) return true;
  return Date.now() - new Date(fetchedAt).getTime() > STALE_HOURS * 60 * 60 * 1000;
}

/**
 * Transform database row to match ConsensusTab data shape
 * The JSONB `data` column stores the FULL FMP response.
 * Typed columns are for fast SQL queries; we spread JSONB and let typed columns override if fresher.
 *
 * @param {Object} row - Database row from consensus_latest view
 * @returns {Object} Transformed data matching frontend ConsensusTab format
 */
function transformConsensusRow(row) {
  const data = row.data || {};

  return {
    // Spread the full nested structure from JSONB
    ...data,

    // Override with typed columns (in case JSONB is stale or for fast access)
    ticker: row.ticker,
    price: row.price ?? data.price,
    marketCap: row.market_cap ?? data.marketCap,

    // Reconstruct nested objects with typed column overrides
    fy1: {
      ...data.fy1,
      revenue: row.fy1_revenue ?? data.fy1?.revenue,
      eps: row.fy1_eps ?? data.fy1?.eps,
    },

    multiples: {
      ...data.multiples,
      forwardPE: row.forward_pe ?? data.multiples?.forwardPE,
    },

    priceTargets: {
      ...data.priceTargets,
      consensus: row.price_target_consensus ?? data.priceTargets?.consensus,
    },

    ratings: {
      ...data.ratings,
      consensus: row.consensus_rating ?? data.ratings?.consensus,
      totalAnalysts: row.analyst_count ?? data.ratings?.totalAnalysts,
    },

    // Status metadata (not in original ConsensusTab format, but useful for UI)
    _status: row.status,
    _fetchedAt: row.fetched_at,
    _stale: isStale(row.fetched_at),
    _fromSharedDb: true,
  };
}

/**
 * Get shared consensus data from database for multiple tickers
 * Reads from the consensus_latest materialized view for fast lookups.
 *
 * @param {string[]} tickers - Array of ticker symbols
 * @returns {Promise<Object>} Map of ticker -> consensus data
 * @throws {Error} If database query fails
 */
export async function getSharedConsensusData(tickers) {
  if (!tickers || tickers.length === 0) {
    return {};
  }

  if (!supabase) {
    console.warn('[ConsensusService] Supabase not configured, returning empty');
    return {};
  }

  try {
    // Query the materialized view for latest data
    const { data, error } = await supabase
      .from('consensus_latest')
      .select('*')
      .in('ticker', tickers);

    if (error) {
      console.error('[ConsensusService] Database query error:', error);
      throw error;
    }

    // Transform to match ConsensusTab data shape
    const result = {};
    for (const row of (data || [])) {
      result[row.ticker] = transformConsensusRow(row);
    }

    console.log(`[ConsensusService] Loaded ${Object.keys(result).length}/${tickers.length} tickers from shared DB`);

    return result;
  } catch (error) {
    console.error('[ConsensusService] Failed to load shared data:', error);
    throw error;
  }
}

/**
 * Get tickers that need live FMP fetch (missing or stale in shared DB)
 *
 * @param {string[]} allTickers - All tickers to check
 * @param {Object} sharedData - Data loaded from getSharedConsensusData
 * @returns {string[]} Tickers that need live fetch
 */
export function getMissingOrStaleTickers(allTickers, sharedData) {
  return allTickers.filter(ticker => {
    const data = sharedData[ticker];
    if (!data) return true;  // Missing
    if (data._status === 'failed') return true;  // Previously failed
    if (data._stale) return true;  // Stale
    return false;
  });
}

/**
 * Check if a ticker is a known unsupported ticker (from shared DB)
 *
 * @param {string} ticker - Ticker to check
 * @param {Object} sharedData - Data loaded from getSharedConsensusData
 * @returns {boolean} True if ticker is known to be unsupported
 */
export function isKnownUnsupported(ticker, sharedData) {
  const data = sharedData[ticker];
  return data?._status === 'failed' && !data._stale;
}

/**
 * Get summary of shared data status
 *
 * @param {string[]} allTickers - All requested tickers
 * @param {Object} sharedData - Data loaded from getSharedConsensusData
 * @returns {Object} Summary stats
 */
export function getSharedDataSummary(allTickers, sharedData) {
  let fromDb = 0;
  let stale = 0;
  let missing = 0;
  let failed = 0;

  for (const ticker of allTickers) {
    const data = sharedData[ticker];
    if (!data) {
      missing++;
    } else if (data._status === 'failed') {
      failed++;
    } else if (data._stale) {
      stale++;
    } else {
      fromDb++;
    }
  }

  return { fromDb, stale, missing, failed, total: allTickers.length };
}
