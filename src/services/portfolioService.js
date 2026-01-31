/**
 * Portfolio Service - Supabase CRUD Operations
 *
 * @module services/portfolioService
 * @description Handles all user data persistence with Supabase PostgreSQL.
 *
 * Tables:
 * - portfolios: id, user_id, name, cash_balance, revision
 * - positions: id, portfolio_id, symbol, shares, avg_cost, p5-p95, price, type
 * - portfolio_settings: portfolio_id, settings (JSONB)
 * - correlation_overrides: portfolio_id, correlation_matrix, method, tickers
 * - simulation_results: portfolio_id, stats, percentiles, paths
 * - factor_results: portfolio_id, exposures, betas, r_squared
 * - optimization_results: portfolio_id, weights, frontier, metrics
 */

import { supabase, isAuthAvailable, getUser } from './authService';

// ============================================
// LOGGING UTILITIES
// ============================================

const LOG_PREFIX = '[PortfolioService]';

/**
 * Structured logging for frontend observability
 */
const logger = {
  info: (message, data = {}) => {
    console.log(`${LOG_PREFIX} ${message}`, Object.keys(data).length > 0 ? data : '');
  },
  warn: (message, data = {}) => {
    console.warn(`${LOG_PREFIX} ${message}`, Object.keys(data).length > 0 ? data : '');
  },
  error: (message, data = {}) => {
    console.error(`${LOG_PREFIX} ${message}`, Object.keys(data).length > 0 ? data : '');
  },
  metric: (name, value, tags = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${LOG_PREFIX} [METRIC] ${name}=${value}ms`, tags);
    }
  },
};

// ============================================
// HELPER: Get or Create Portfolio
// ============================================

/**
 * Get user's portfolio ID, creating one if needed
 */
async function getOrCreatePortfolioId() {
  if (!supabase || !isAuthAvailable()) {
    return { portfolioId: null, error: new Error('Not available') };
  }

  const { data: { user }, error: userError } = await getUser();
  if (userError || !user) {
    return { portfolioId: null, error: userError || new Error('Not authenticated') };
  }

  // Try to get existing portfolio
  const { data: existing } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (existing?.id) {
    return { portfolioId: existing.id, userId: user.id, error: null };
  }

  // Create new portfolio
  const { data: created, error: createError } = await supabase
    .from('portfolios')
    .insert({ user_id: user.id, name: 'My Portfolio', cash_balance: 0 })
    .select('id')
    .single();

  if (createError) {
    return { portfolioId: null, error: createError };
  }

  return { portfolioId: created.id, userId: user.id, error: null };
}

// ============================================
// FULL DATA FETCH (Load Everything)
// ============================================

/**
 * Fetch all user data from Supabase
 * Call this on login to restore full state
 */
export async function fetchAllData() {
  const startTime = performance.now();

  if (!supabase || !isAuthAvailable()) {
    logger.warn('Fetch skipped - auth not available');
    return { data: null, error: null };
  }

  try {
    const { data: { user }, error: userError } = await getUser();
    if (userError || !user) {
      logger.warn('Fetch skipped - no user', { error: userError?.message });
      return { data: null, error: userError };
    }

    logger.info('Fetching all data...', { userId: user.id.slice(0, 8) });

    // Fetch portfolio with all related data
    const { data: portfolios, error } = await supabase
      .from('portfolios')
      .select(`
        *,
        positions (*),
        portfolio_settings (settings),
        correlation_overrides (correlation_matrix, method, tickers),
        simulation_results (*, created_at),
        factor_results (*, created_at),
        optimization_results (*, created_at)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      logger.error('Fetch error', { error: error.message });
      return { data: null, error };
    }

    if (!portfolios || portfolios.length === 0) {
      const duration = Math.round(performance.now() - startTime);
      logger.info('No portfolio found', { duration });
      return { data: null, error: null };
    }

    const p = portfolios[0];

    // Get most recent results (they're ordered by created_at in the query)
    const latestSimulation = p.simulation_results?.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    )[0];

    const latestFactor = p.factor_results?.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    )[0];

    const latestOptimization = p.optimization_results?.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    )[0];

    // Transform to app format
    const data = {
      portfolioId: p.id,
      revision: p.revision,

      // Cash balance
      cashBalance: parseFloat(p.cash_balance) || 0,

      // Positions with distribution params
      positions: (p.positions || []).map(pos => ({
        id: pos.id,
        ticker: pos.symbol,
        quantity: parseFloat(pos.shares) || 0,
        price: pos.price ? parseFloat(pos.price) : null,
        avgCost: pos.avg_cost ? parseFloat(pos.avg_cost) : null,
        type: pos.position_type || 'Equity',
        // Distribution parameters
        p5: pos.p5 != null ? parseFloat(pos.p5) : -0.25,
        p25: pos.p25 != null ? parseFloat(pos.p25) : -0.05,
        p50: pos.p50 != null ? parseFloat(pos.p50) : 0.08,
        p75: pos.p75 != null ? parseFloat(pos.p75) : 0.20,
        p95: pos.p95 != null ? parseFloat(pos.p95) : 0.40,
        // Currency fields for international stocks
        currency: pos.currency || 'USD',
        domesticPrice: pos.domestic_price ? parseFloat(pos.domestic_price) : null,
        exchangeRate: pos.exchange_rate ? parseFloat(pos.exchange_rate) : 1,
      })),

      // Settings
      settings: p.portfolio_settings?.settings || {},

      // Correlation matrix
      editedCorrelation: p.correlation_overrides?.correlation_matrix || null,
      correlationMethod: p.correlation_overrides?.method || 'shrinkage',
      correlationTickers: p.correlation_overrides?.tickers || [],

      // Latest simulation results
      simulationResults: latestSimulation ? {
        mean: latestSimulation.mean_return,
        median: latestSimulation.median_return,
        stdDev: latestSimulation.std_dev,
        var95: latestSimulation.var_95,
        cvar95: latestSimulation.cvar_95,
        sharpe: latestSimulation.sharpe_ratio,
        maxDrawdown: latestSimulation.max_drawdown,
        percentiles: latestSimulation.percentiles,
        pathEndpoints: latestSimulation.path_endpoints,
        numPaths: latestSimulation.num_paths,
        method: latestSimulation.method,
      } : null,

      // Latest factor analysis
      factorAnalysis: latestFactor ? {
        exposures: latestFactor.factor_exposures,
        rSquared: latestFactor.r_squared,
        residualVol: latestFactor.residual_vol,
        positionBetas: latestFactor.position_betas,
        riskContribution: latestFactor.risk_contribution,
      } : null,

      // Latest optimization
      optimizationResults: latestOptimization ? {
        objective: latestOptimization.objective,
        constraints: latestOptimization.constraints,
        optimalWeights: latestOptimization.optimal_weights,
        expectedReturn: latestOptimization.expected_return,
        expectedVolatility: latestOptimization.expected_volatility,
        sharpe: latestOptimization.sharpe_ratio,
        efficientFrontier: latestOptimization.efficient_frontier,
        currentMetrics: latestOptimization.current_metrics,
        improvement: latestOptimization.improvement,
      } : null,
    };

    const duration = Math.round(performance.now() - startTime);
    logger.info('Data loaded successfully', {
      positions: data.positions.length,
      hasCorrelation: !!data.editedCorrelation,
      hasSimulation: !!data.simulationResults,
      hasFactors: !!data.factorAnalysis,
      hasOptimization: !!data.optimizationResults,
      duration,
    });
    logger.metric('fetch_all_data', duration);

    return { data, error: null };
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    logger.error('fetchAllData exception', { error: error.message, duration });
    return { data: null, error };
  }
}

// ============================================
// SAVE POSITIONS
// ============================================

/**
 * Save positions with distribution parameters
 */
export async function savePositions(positions, cashBalance = 0) {
  const startTime = performance.now();
  const positionCount = positions?.length || 0;

  logger.info('Saving positions', { count: positionCount, cashBalance });

  const { portfolioId, userId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
    logger.error('Failed to get/create portfolio', { error: idError?.message });
    return { success: false, error: idError };
  }

  try {
    // Update cash balance
    const { error: cashError } = await supabase
      .from('portfolios')
      .update({ cash_balance: cashBalance })
      .eq('id', portfolioId);

    if (cashError) {
      logger.warn('Cash balance update error', { error: cashError.message });
    }

    // Delete ALL existing positions first (wait for it to complete)
    const { data: deletedData, error: deleteError } = await supabase
      .from('positions')
      .delete()
      .eq('portfolio_id', portfolioId)
      .select();

    if (deleteError) {
      logger.warn('Delete positions error', { error: deleteError.message });
      // Continue anyway - might be empty
    } else {
      logger.info('Deleted existing positions', { count: deletedData?.length || 0 });
    }

    // Small delay to ensure delete propagates
    await new Promise(resolve => setTimeout(resolve, 100));

    // Insert new positions
    if (positions && positions.length > 0) {
      const positionsToInsert = positions.map(p => ({
        portfolio_id: portfolioId,
        symbol: p.ticker || p.symbol,
        shares: p.quantity || p.shares || 0,
        avg_cost: p.avgCost || p.averageCost || null,
        price: p.price || null,
        position_type: p.type || 'Equity',
        p5: p.p5,
        p25: p.p25,
        p50: p.p50,
        p75: p.p75,
        p95: p.p95,
        // Currency fields for international stocks
        currency: p.currency || 'USD',
        domestic_price: p.domesticPrice || null,
        exchange_rate: p.exchangeRate || 1,
      }));

      const { data: insertedData, error: insertError } = await supabase
        .from('positions')
        .insert(positionsToInsert)
        .select();

      if (insertError) {
        logger.error('Insert positions error', { error: insertError.message });
        return { success: false, error: insertError };
      }

      logger.info('Inserted positions', { count: insertedData?.length || 0 });
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Positions saved successfully', { count: positionCount, duration });
    logger.metric('save_positions', duration, { count: positionCount });
    return { success: true, error: null };
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    logger.error('savePositions exception', { error: error.message, duration });
    return { success: false, error };
  }
}

// ============================================
// SAVE CORRELATION MATRIX
// ============================================

/**
 * Save edited correlation matrix
 */
export async function saveCorrelation(correlationMatrix, method, tickers) {
  const startTime = performance.now();

  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
    logger.error('saveCorrelation - no portfolio', { error: idError?.message });
    return { success: false, error: idError };
  }

  try {
    const { error } = await supabase
      .from('correlation_overrides')
      .upsert({
        portfolio_id: portfolioId,
        correlation_matrix: correlationMatrix,
        method: method || 'historical',
        tickers: tickers || [],
      }, { onConflict: 'portfolio_id' });

    if (error) {
      logger.error('Save correlation error', { error: error.message });
      return { success: false, error };
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Correlation matrix saved', { method, tickerCount: tickers?.length, duration });
    logger.metric('save_correlation', duration);
    return { success: true, error: null };
  } catch (error) {
    logger.error('saveCorrelation exception', { error: error.message });
    return { success: false, error };
  }
}

// ============================================
// SAVE SIMULATION RESULTS
// ============================================

/**
 * Save simulation results
 */
export async function saveSimulationResults(results) {
  const startTime = performance.now();

  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
    logger.error('saveSimulationResults - no portfolio', { error: idError?.message });
    return { success: false, error: idError };
  }

  try {
    const numPaths = results.numPaths || results.paths?.length || 0;

    const { error } = await supabase
      .from('simulation_results')
      .insert({
        portfolio_id: portfolioId,
        num_paths: numPaths,
        method: results.method || 'quasi-monte-carlo',
        mean_return: results.mean,
        median_return: results.median,
        std_dev: results.stdDev,
        var_95: results.var95 || results.percentiles?.p5,
        cvar_95: results.cvar95,
        sharpe_ratio: results.sharpe,
        max_drawdown: results.maxDrawdown,
        percentiles: results.percentiles,
        // Only save endpoints, not full paths (too large)
        path_endpoints: results.pathEndpoints || results.paths?.map(p => p[p.length - 1]),
      });

    if (error) {
      logger.error('Save simulation error', { error: error.message });
      return { success: false, error };
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Simulation results saved', { numPaths, method: results.method, duration });
    logger.metric('save_simulation', duration);
    return { success: true, error: null };
  } catch (error) {
    logger.error('saveSimulationResults exception', { error: error.message });
    return { success: false, error };
  }
}

// ============================================
// SAVE FACTOR RESULTS
// ============================================

/**
 * Save factor analysis results
 */
export async function saveFactorResults(results) {
  const startTime = performance.now();

  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
    logger.error('saveFactorResults - no portfolio', { error: idError?.message });
    return { success: false, error: idError };
  }

  try {
    const { error } = await supabase
      .from('factor_results')
      .insert({
        portfolio_id: portfolioId,
        factor_exposures: results.exposures || results.factorExposures,
        r_squared: results.rSquared,
        residual_vol: results.residualVol,
        position_betas: results.positionBetas,
        risk_contribution: results.riskContribution,
      });

    if (error) {
      logger.error('Save factor error', { error: error.message });
      return { success: false, error };
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Factor results saved', { rSquared: results.rSquared, duration });
    logger.metric('save_factors', duration);
    return { success: true, error: null };
  } catch (error) {
    logger.error('saveFactorResults exception', { error: error.message });
    return { success: false, error };
  }
}

// ============================================
// SAVE OPTIMIZATION RESULTS
// ============================================

/**
 * Save optimization results
 */
export async function saveOptimizationResults(results) {
  const startTime = performance.now();

  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
    logger.error('saveOptimizationResults - no portfolio', { error: idError?.message });
    return { success: false, error: idError };
  }

  try {
    const { error } = await supabase
      .from('optimization_results')
      .insert({
        portfolio_id: portfolioId,
        objective: results.objective || 'max_sharpe',
        constraints: results.constraints,
        optimal_weights: results.optimalWeights || results.weights,
        expected_return: results.expectedReturn,
        expected_volatility: results.expectedVolatility || results.volatility,
        sharpe_ratio: results.sharpe,
        efficient_frontier: results.efficientFrontier,
        current_metrics: results.currentMetrics,
        improvement: results.improvement,
      });

    if (error) {
      logger.error('Save optimization error', { error: error.message });
      return { success: false, error };
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Optimization results saved', { objective: results.objective, sharpe: results.sharpe, duration });
    logger.metric('save_optimization', duration);
    return { success: true, error: null };
  } catch (error) {
    logger.error('saveOptimizationResults exception', { error: error.message });
    return { success: false, error };
  }
}

// ============================================
// SAVE SETTINGS
// ============================================

/**
 * Save user settings (UI preferences, defaults, etc.)
 */
export async function saveSettings(settings) {
  const startTime = performance.now();

  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
    logger.error('saveSettings - no portfolio', { error: idError?.message });
    return { success: false, error: idError };
  }

  try {
    const { error } = await supabase
      .from('portfolio_settings')
      .upsert({
        portfolio_id: portfolioId,
        settings,
      }, { onConflict: 'portfolio_id' });

    if (error) {
      logger.error('Save settings error', { error: error.message });
      return { success: false, error };
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Settings saved', { keyCount: Object.keys(settings || {}).length, duration });
    logger.metric('save_settings', duration);
    return { success: true, error: null };
  } catch (error) {
    logger.error('saveSettings exception', { error: error.message });
    return { success: false, error };
  }
}

// ============================================
// DELETE PORTFOLIO
// ============================================

/**
 * Delete portfolio and all associated data
 */
export async function deletePortfolio() {
  const startTime = performance.now();

  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
    logger.error('deletePortfolio - no portfolio', { error: idError?.message });
    return { success: false, error: idError };
  }

  try {
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId);

    if (error) {
      logger.error('Delete error', { error: error.message });
      return { success: false, error };
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Portfolio deleted', { portfolioId, duration });
    logger.metric('delete_portfolio', duration);
    return { success: true, error: null };
  } catch (error) {
    logger.error('deletePortfolio exception', { error: error.message });
    return { success: false, error };
  }
}

// ============================================
// UTILITY
// ============================================

/**
 * Check if sync is available (auth configured + user logged in)
 */
export async function isSyncAvailable() {
  if (!supabase || !isAuthAvailable()) {
    return false;
  }
  try {
    const { data: { user } } = await getUser();
    return !!user;
  } catch {
    return false;
  }
}

// ============================================
// POSITION NOTES
// ============================================

/**
 * Save notes for a position
 */
export async function savePositionNotes(positionId, notes, tags = [], thesis = null) {
  const startTime = performance.now();

  try {
    const { error } = await supabase
      .from('position_notes')
      .upsert({
        position_id: positionId,
        notes,
        tags,
        thesis,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'position_id' });

    if (error) {
      logger.error('Save position notes error', { error: error.message, positionId });
      return { success: false, error };
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Position notes saved', { positionId, duration });
    return { success: true, error: null };
  } catch (error) {
    logger.error('savePositionNotes exception', { error: error.message });
    return { success: false, error };
  }
}

/**
 * Get notes for a position
 */
export async function getPositionNotes(positionId) {
  try {
    const { data, error } = await supabase
      .from('position_notes')
      .select('*')
      .eq('position_id', positionId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      logger.error('Get position notes error', { error: error.message, positionId });
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (error) {
    logger.error('getPositionNotes exception', { error: error.message });
    return { data: null, error };
  }
}

/**
 * Get all notes for positions in a portfolio
 */
export async function getAllPositionNotes(portfolioId) {
  try {
    const { data, error } = await supabase
      .from('position_notes')
      .select(`
        *,
        positions!inner(portfolio_id, symbol)
      `)
      .eq('positions.portfolio_id', portfolioId);

    if (error) {
      logger.error('Get all position notes error', { error: error.message });
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    logger.error('getAllPositionNotes exception', { error: error.message });
    return { data: [], error };
  }
}

/**
 * Delete notes for a position
 */
export async function deletePositionNotes(positionId) {
  try {
    const { error } = await supabase
      .from('position_notes')
      .delete()
      .eq('position_id', positionId);

    if (error) {
      logger.error('Delete position notes error', { error: error.message });
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    logger.error('deletePositionNotes exception', { error: error.message });
    return { success: false, error };
  }
}

// ============================================
// TARGET ALLOCATIONS
// ============================================

/**
 * Save target allocation for a symbol
 */
export async function saveTargetAllocation(portfolioId, symbol, targetWeight, minWeight = null, maxWeight = null) {
  const startTime = performance.now();

  try {
    const { error } = await supabase
      .from('target_allocations')
      .upsert({
        portfolio_id: portfolioId,
        symbol: symbol.toUpperCase(),
        target_weight: targetWeight,
        min_weight: minWeight,
        max_weight: maxWeight,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'portfolio_id,symbol' });

    if (error) {
      logger.error('Save target allocation error', { error: error.message, symbol });
      return { success: false, error };
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Target allocation saved', { symbol, targetWeight, duration });
    return { success: true, error: null };
  } catch (error) {
    logger.error('saveTargetAllocation exception', { error: error.message });
    return { success: false, error };
  }
}

/**
 * Save multiple target allocations at once
 */
export async function saveTargetAllocations(portfolioId, allocations) {
  const startTime = performance.now();

  try {
    const records = allocations.map(a => ({
      portfolio_id: portfolioId,
      symbol: a.symbol.toUpperCase(),
      target_weight: a.targetWeight,
      min_weight: a.minWeight || null,
      max_weight: a.maxWeight || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('target_allocations')
      .upsert(records, { onConflict: 'portfolio_id,symbol' });

    if (error) {
      logger.error('Save target allocations error', { error: error.message });
      return { success: false, error };
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Target allocations saved', { count: allocations.length, duration });
    return { success: true, error: null };
  } catch (error) {
    logger.error('saveTargetAllocations exception', { error: error.message });
    return { success: false, error };
  }
}

/**
 * Get all target allocations for a portfolio
 */
export async function getTargetAllocations(portfolioId) {
  try {
    const { data, error } = await supabase
      .from('target_allocations')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('symbol');

    if (error) {
      logger.error('Get target allocations error', { error: error.message });
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    logger.error('getTargetAllocations exception', { error: error.message });
    return { data: [], error };
  }
}

/**
 * Delete a target allocation
 */
export async function deleteTargetAllocation(portfolioId, symbol) {
  try {
    const { error } = await supabase
      .from('target_allocations')
      .delete()
      .eq('portfolio_id', portfolioId)
      .eq('symbol', symbol.toUpperCase());

    if (error) {
      logger.error('Delete target allocation error', { error: error.message });
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    logger.error('deleteTargetAllocation exception', { error: error.message });
    return { success: false, error };
  }
}

// ============================================
// DIVIDEND HISTORY
// ============================================

/**
 * Add a dividend record
 */
export async function addDividend(portfolioId, dividend) {
  const startTime = performance.now();

  try {
    const { data, error } = await supabase
      .from('dividend_history')
      .insert({
        portfolio_id: portfolioId,
        symbol: dividend.symbol.toUpperCase(),
        ex_date: dividend.exDate,
        amount: dividend.amount,
        shares_held: dividend.sharesHeld || null,
        total_amount: dividend.totalAmount || (dividend.amount * (dividend.sharesHeld || 1)),
        received_date: dividend.receivedDate || null,
        reinvested: dividend.reinvested || false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Add dividend error', { error: error.message, symbol: dividend.symbol });
      return { data: null, error };
    }

    const duration = Math.round(performance.now() - startTime);
    logger.info('Dividend added', { symbol: dividend.symbol, amount: dividend.amount, duration });
    return { data, error: null };
  } catch (error) {
    logger.error('addDividend exception', { error: error.message });
    return { data: null, error };
  }
}

/**
 * Get all dividends for a portfolio
 */
export async function getDividends(portfolioId, symbol = null) {
  try {
    let query = supabase
      .from('dividend_history')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('ex_date', { ascending: false });

    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Get dividends error', { error: error.message });
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    logger.error('getDividends exception', { error: error.message });
    return { data: [], error };
  }
}

/**
 * Get dividend summary by symbol
 */
export async function getDividendSummary(portfolioId) {
  try {
    const { data, error } = await supabase
      .from('dividend_history')
      .select('symbol, amount, total_amount')
      .eq('portfolio_id', portfolioId);

    if (error) {
      logger.error('Get dividend summary error', { error: error.message });
      return { data: {}, error };
    }

    // Aggregate by symbol
    const summary = {};
    (data || []).forEach(d => {
      if (!summary[d.symbol]) {
        summary[d.symbol] = { count: 0, totalAmount: 0 };
      }
      summary[d.symbol].count++;
      summary[d.symbol].totalAmount += d.total_amount || d.amount;
    });

    return { data: summary, error: null };
  } catch (error) {
    logger.error('getDividendSummary exception', { error: error.message });
    return { data: {}, error };
  }
}

/**
 * Delete a dividend record
 */
export async function deleteDividend(dividendId) {
  try {
    const { error } = await supabase
      .from('dividend_history')
      .delete()
      .eq('id', dividendId);

    if (error) {
      logger.error('Delete dividend error', { error: error.message });
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    logger.error('deleteDividend exception', { error: error.message });
    return { success: false, error };
  }
}

export default {
  fetchAllData,
  savePositions,
  saveCorrelation,
  saveSimulationResults,
  saveFactorResults,
  saveOptimizationResults,
  saveSettings,
  deletePortfolio,
  isSyncAvailable,
  // Position notes
  savePositionNotes,
  getPositionNotes,
  getAllPositionNotes,
  deletePositionNotes,
  // Target allocations
  saveTargetAllocation,
  saveTargetAllocations,
  getTargetAllocations,
  deleteTargetAllocation,
  // Dividend history
  addDividend,
  getDividends,
  getDividendSummary,
  deleteDividend,
};
