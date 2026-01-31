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
  if (!supabase || !isAuthAvailable()) {
    return { data: null, error: null };
  }

  try {
    const { data: { user }, error: userError } = await getUser();
    if (userError || !user) {
      return { data: null, error: userError };
    }

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
      console.error('[PortfolioService] Fetch error:', error);
      return { data: null, error };
    }

    if (!portfolios || portfolios.length === 0) {
      console.log('[PortfolioService] No portfolio found for user');
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

    console.log('[PortfolioService] Loaded data:', {
      positions: data.positions.length,
      hasCorrelation: !!data.editedCorrelation,
      hasSimulation: !!data.simulationResults,
      hasFactors: !!data.factorAnalysis,
      hasOptimization: !!data.optimizationResults,
    });

    return { data, error: null };
  } catch (error) {
    console.error('[PortfolioService] fetchAllData error:', error);
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
  console.log('[PortfolioService] savePositions called with', positions?.length || 0, 'positions');

  const { portfolioId, userId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
    console.error('[PortfolioService] Failed to get/create portfolio:', idError);
    return { success: false, error: idError };
  }

  console.log('[PortfolioService] Using portfolioId:', portfolioId, 'userId:', userId);

  try {
    // Update cash balance
    const { error: cashError } = await supabase
      .from('portfolios')
      .update({ cash_balance: cashBalance })
      .eq('id', portfolioId);

    if (cashError) {
      console.error('[PortfolioService] Cash balance update error:', cashError);
    }

    // Delete ALL existing positions first (wait for it to complete)
    console.log('[PortfolioService] Deleting existing positions...');
    const { data: deletedData, error: deleteError } = await supabase
      .from('positions')
      .delete()
      .eq('portfolio_id', portfolioId)
      .select();

    if (deleteError) {
      console.error('[PortfolioService] Delete positions error:', deleteError);
      // Continue anyway - might be empty
    } else {
      console.log('[PortfolioService] Deleted', deletedData?.length || 0, 'existing positions');
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
      }));

      console.log('[PortfolioService] Inserting positions:', positionsToInsert.map(p => p.symbol));

      const { data: insertedData, error: insertError } = await supabase
        .from('positions')
        .insert(positionsToInsert)
        .select();

      if (insertError) {
        console.error('[PortfolioService] Insert positions error:', insertError);
        return { success: false, error: insertError };
      }

      console.log('[PortfolioService] Successfully inserted:', insertedData?.length || 0, 'positions');
    }

    console.log('[PortfolioService] ✅ Saved', positions?.length || 0, 'positions successfully');
    return { success: true, error: null };
  } catch (error) {
    console.error('[PortfolioService] savePositions exception:', error);
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
  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
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
      console.error('[PortfolioService] Save correlation error:', error);
      return { success: false, error };
    }

    console.log('[PortfolioService] Saved correlation matrix');
    return { success: true, error: null };
  } catch (error) {
    console.error('[PortfolioService] saveCorrelation error:', error);
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
  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
    return { success: false, error: idError };
  }

  try {
    const { error } = await supabase
      .from('simulation_results')
      .insert({
        portfolio_id: portfolioId,
        num_paths: results.numPaths || results.paths?.length || 0,
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
      console.error('[PortfolioService] Save simulation error:', error);
      return { success: false, error };
    }

    console.log('[PortfolioService] Saved simulation results');
    return { success: true, error: null };
  } catch (error) {
    console.error('[PortfolioService] saveSimulationResults error:', error);
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
  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
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
      console.error('[PortfolioService] Save factor error:', error);
      return { success: false, error };
    }

    console.log('[PortfolioService] Saved factor results');
    return { success: true, error: null };
  } catch (error) {
    console.error('[PortfolioService] saveFactorResults error:', error);
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
  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
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
      console.error('[PortfolioService] Save optimization error:', error);
      return { success: false, error };
    }

    console.log('[PortfolioService] Saved optimization results');
    return { success: true, error: null };
  } catch (error) {
    console.error('[PortfolioService] saveOptimizationResults error:', error);
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
  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
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
      console.error('[PortfolioService] Save settings error:', error);
      return { success: false, error };
    }

    console.log('[PortfolioService] Saved settings');
    return { success: true, error: null };
  } catch (error) {
    console.error('[PortfolioService] saveSettings error:', error);
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
  const { portfolioId, error: idError } = await getOrCreatePortfolioId();
  if (idError || !portfolioId) {
    return { success: false, error: idError };
  }

  try {
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId);

    if (error) {
      console.error('[PortfolioService] Delete error:', error);
      return { success: false, error };
    }

    console.log('[PortfolioService] Deleted portfolio');
    return { success: true, error: null };
  } catch (error) {
    console.error('[PortfolioService] deletePortfolio error:', error);
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
};
