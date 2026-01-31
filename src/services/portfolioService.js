/**
 * Portfolio Service - Supabase CRUD Operations
 *
 * @module services/portfolioService
 * @description Handles portfolio data persistence with Supabase PostgreSQL.
 *
 * Database Schema (in Supabase):
 * - portfolios: id, user_id, name, cash_balance, revision, created_at, updated_at
 * - positions: id, portfolio_id, symbol, shares, avg_cost, created_at, updated_at
 * - portfolio_settings: portfolio_id, settings (JSONB), updated_at
 */

import { supabase, isAuthAvailable, getUser } from './authService';

// ============================================
// PORTFOLIO OPERATIONS
// ============================================

/**
 * Fetch the user's portfolio with all positions and settings
 * @returns {Promise<{portfolio: Object|null, error: Error|null}>}
 */
export async function fetchPortfolio() {
  if (!supabase || !isAuthAvailable()) {
    return { portfolio: null, error: null };
  }

  try {
    const { data: { user }, error: userError } = await getUser();
    if (userError || !user) {
      return { portfolio: null, error: userError };
    }

    // Fetch portfolio with positions and settings
    const { data: portfolios, error } = await supabase
      .from('portfolios')
      .select(`
        *,
        positions (*),
        portfolio_settings (settings)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('Error fetching portfolio:', error);
      return { portfolio: null, error };
    }

    if (!portfolios || portfolios.length === 0) {
      return { portfolio: null, error: null };
    }

    const portfolio = portfolios[0];

    // Transform to app format
    return {
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        cash: portfolio.cash_balance,
        revision: portfolio.revision,
        positions: (portfolio.positions || []).map(p => ({
          id: p.id,
          symbol: p.symbol,
          shares: parseFloat(p.shares),
          avgCost: p.avg_cost ? parseFloat(p.avg_cost) : null,
        })),
        settings: portfolio.portfolio_settings?.settings || {},
        updatedAt: portfolio.updated_at,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error in fetchPortfolio:', error);
    return { portfolio: null, error };
  }
}

/**
 * Save portfolio to Supabase
 * Creates a new portfolio if none exists, or updates existing
 * @param {Object} portfolio - Portfolio data from app state
 * @returns {Promise<{portfolio: Object|null, error: Error|null}>}
 */
export async function savePortfolio(portfolio) {
  if (!supabase || !isAuthAvailable()) {
    return { portfolio: null, error: new Error('Database not available') };
  }

  try {
    const { data: { user }, error: userError } = await getUser();
    if (userError || !user) {
      return { portfolio: null, error: userError || new Error('Not authenticated') };
    }

    // Upsert portfolio
    const { data: savedPortfolio, error: portfolioError } = await supabase
      .from('portfolios')
      .upsert({
        id: portfolio.id || undefined, // Let DB generate if new
        user_id: user.id,
        name: portfolio.name || 'My Portfolio',
        cash_balance: portfolio.cash || 0,
      }, {
        onConflict: 'id',
      })
      .select()
      .single();

    if (portfolioError) {
      console.error('Error saving portfolio:', portfolioError);
      return { portfolio: null, error: portfolioError };
    }

    const portfolioId = savedPortfolio.id;

    // Replace all positions (delete then insert for simplicity)
    if (portfolio.positions && portfolio.positions.length > 0) {
      // Delete existing positions
      await supabase
        .from('positions')
        .delete()
        .eq('portfolio_id', portfolioId);

      // Insert new positions
      const positionsToInsert = portfolio.positions.map(p => ({
        portfolio_id: portfolioId,
        symbol: p.symbol || p.ticker,
        shares: p.shares || p.quantity || 0,
        avg_cost: p.avgCost || p.averageCost || null,
      }));

      const { error: positionsError } = await supabase
        .from('positions')
        .insert(positionsToInsert);

      if (positionsError) {
        console.error('Error saving positions:', positionsError);
        // Don't fail completely if positions fail
      }
    } else {
      // Clear all positions if empty
      await supabase
        .from('positions')
        .delete()
        .eq('portfolio_id', portfolioId);
    }

    // Save settings if provided
    if (portfolio.settings) {
      const { error: settingsError } = await supabase
        .from('portfolio_settings')
        .upsert({
          portfolio_id: portfolioId,
          settings: portfolio.settings,
        }, {
          onConflict: 'portfolio_id',
        });

      if (settingsError) {
        console.error('Error saving settings:', settingsError);
      }
    }

    return {
      portfolio: {
        ...portfolio,
        id: portfolioId,
        revision: savedPortfolio.revision,
        updatedAt: savedPortfolio.updated_at,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error in savePortfolio:', error);
    return { portfolio: null, error };
  }
}

/**
 * Delete a portfolio and all associated data
 * @param {string} portfolioId - Portfolio UUID
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function deletePortfolio(portfolioId) {
  if (!supabase || !isAuthAvailable()) {
    return { success: false, error: new Error('Database not available') };
  }

  try {
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId);

    if (error) {
      console.error('Error deleting portfolio:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in deletePortfolio:', error);
    return { success: false, error };
  }
}

// ============================================
// POSITION OPERATIONS
// ============================================

/**
 * Add a single position to a portfolio
 * @param {string} portfolioId - Portfolio UUID
 * @param {Object} position - Position data {symbol, shares, avgCost}
 * @returns {Promise<{position: Object|null, error: Error|null}>}
 */
export async function addPosition(portfolioId, position) {
  if (!supabase || !isAuthAvailable()) {
    return { position: null, error: new Error('Database not available') };
  }

  try {
    const { data, error } = await supabase
      .from('positions')
      .insert({
        portfolio_id: portfolioId,
        symbol: position.symbol,
        shares: position.shares,
        avg_cost: position.avgCost || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding position:', error);
      return { position: null, error };
    }

    return {
      position: {
        id: data.id,
        symbol: data.symbol,
        shares: parseFloat(data.shares),
        avgCost: data.avg_cost ? parseFloat(data.avg_cost) : null,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error in addPosition:', error);
    return { position: null, error };
  }
}

/**
 * Update a position
 * @param {string} positionId - Position UUID
 * @param {Object} updates - Fields to update {shares?, avgCost?}
 * @returns {Promise<{position: Object|null, error: Error|null}>}
 */
export async function updatePosition(positionId, updates) {
  if (!supabase || !isAuthAvailable()) {
    return { position: null, error: new Error('Database not available') };
  }

  try {
    const updateData = {};
    if (updates.shares !== undefined) updateData.shares = updates.shares;
    if (updates.avgCost !== undefined) updateData.avg_cost = updates.avgCost;
    if (updates.symbol !== undefined) updateData.symbol = updates.symbol;

    const { data, error } = await supabase
      .from('positions')
      .update(updateData)
      .eq('id', positionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating position:', error);
      return { position: null, error };
    }

    return {
      position: {
        id: data.id,
        symbol: data.symbol,
        shares: parseFloat(data.shares),
        avgCost: data.avg_cost ? parseFloat(data.avg_cost) : null,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error in updatePosition:', error);
    return { position: null, error };
  }
}

/**
 * Delete a position
 * @param {string} positionId - Position UUID
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function deletePosition(positionId) {
  if (!supabase || !isAuthAvailable()) {
    return { success: false, error: new Error('Database not available') };
  }

  try {
    const { error } = await supabase
      .from('positions')
      .delete()
      .eq('id', positionId);

    if (error) {
      console.error('Error deleting position:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in deletePosition:', error);
    return { success: false, error };
  }
}

// ============================================
// SETTINGS OPERATIONS
// ============================================

/**
 * Save portfolio settings (JSON blob)
 * @param {string} portfolioId - Portfolio UUID
 * @param {Object} settings - Settings object
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function saveSettings(portfolioId, settings) {
  if (!supabase || !isAuthAvailable()) {
    return { success: false, error: new Error('Database not available') };
  }

  try {
    const { error } = await supabase
      .from('portfolio_settings')
      .upsert({
        portfolio_id: portfolioId,
        settings,
      }, {
        onConflict: 'portfolio_id',
      });

    if (error) {
      console.error('Error saving settings:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in saveSettings:', error);
    return { success: false, error };
  }
}

/**
 * Get portfolio settings
 * @param {string} portfolioId - Portfolio UUID
 * @returns {Promise<{settings: Object|null, error: Error|null}>}
 */
export async function getSettings(portfolioId) {
  if (!supabase || !isAuthAvailable()) {
    return { settings: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('portfolio_settings')
      .select('settings')
      .eq('portfolio_id', portfolioId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching settings:', error);
      return { settings: null, error };
    }

    return { settings: data?.settings || {}, error: null };
  } catch (error) {
    console.error('Error in getSettings:', error);
    return { settings: null, error };
  }
}

// ============================================
// SYNC HELPERS
// ============================================

/**
 * Get the revision number for a portfolio (for conflict detection)
 * @param {string} portfolioId - Portfolio UUID
 * @returns {Promise<{revision: number|null, error: Error|null}>}
 */
export async function getRevision(portfolioId) {
  if (!supabase || !isAuthAvailable()) {
    return { revision: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('portfolios')
      .select('revision')
      .eq('id', portfolioId)
      .single();

    if (error) {
      return { revision: null, error };
    }

    return { revision: data?.revision || 0, error: null };
  } catch (error) {
    return { revision: null, error };
  }
}

/**
 * Check if database is available and user is authenticated
 * @returns {Promise<boolean>}
 */
export async function isOnline() {
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
  fetchPortfolio,
  savePortfolio,
  deletePortfolio,
  addPosition,
  updatePosition,
  deletePosition,
  saveSettings,
  getSettings,
  getRevision,
  isOnline,
};
