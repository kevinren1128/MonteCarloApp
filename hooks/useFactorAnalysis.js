import { useCallback } from 'react';
import { useMarketDataContext } from '../contexts/MarketDataContext';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import { runFactorAnalysis } from '../services/factorService';
import { computeFactorExposures } from '../utils/factorCompute';

export const useFactorAnalysis = () => {
  const marketData = useMarketDataContext();
  const portfolio = usePortfolioContext();

  const runFactorAnalysis = useCallback(async (symbols) => {
    if (!symbols || symbols.length === 0) return null;

    try {
      marketData.setLoading('factorAnalysis', true);
      marketData.clearFetchErrors();

      const factors = await fetchFactorData(symbols);
      const exposures = computeFactorExposures(
        symbols,
        factors,
        portfolio.positions
      );

      const analysis = {
        factors,
        exposures,
        timestamp: new Date().toISOString(),
        symbols
      };

      marketData.setFactorData(factors);
      marketData.setFactorAnalysis(analysis);

      return analysis;
    } catch (error) {
      marketData.addFetchError({
        type: 'factor',
        symbols: symbols.join(','),
        error: error.message
      });
      throw error;
    } finally {
      marketData.setLoading('factorAnalysis', false);
    }
  }, [marketData, portfolio]);

  const computePortfolioFactorExposure = useCallback(() => {
    if (!marketData.factorData || !portfolio.positions) return null;

    const positions = portfolio.positions;
    const factors = marketData.factorData;

    return positions.reduce((exposure, position) => {
      const factorData = factors[position.symbol];
      if (factorData) {
        const weight = portfolio.weights[position.symbol];
        Object.keys(factorData).forEach(factor => {
          exposure[factor] = (exposure[factor] || 0) + (factorData[factor] * weight);
        });
      }
      return exposure;
    }, {});
  }, [marketData.factorData, portfolio.positions, portfolio.weights]);

  const getFactorBreakdown = useCallback((symbol) => {
    if (!symbol || !marketData.factorData) return null;
    
    return marketData.factorData[symbol] || null;
  }, [marketData.factorData]);

  const calculateFactorRebalance = useCallback((targetExposures) => {
    const currentExposures = computePortfolioFactorExposure();
    if (!currentExposures) return null;

    return Object.keys(targetExposures).reduce((changes, factor) => {
      const current = currentExposures[factor] || 0;
      const target = targetExposures[factor];
      const difference = target - current;
      
      if (Math.abs(difference) > 0.01) {
        changes[factor] = difference;
      }
      return changes;
    }, {});
  }, [computePortfolioFactorExposure]);

  return {
    // State
    factorData: marketData.factorData,
    factorAnalysis: marketData.factorAnalysis,
    factorExposures: computePortfolioFactorExposure(),

    // Status
    isLoading: marketData.loading?.factorAnalysis || false,
    hasData: marketData.factorData !== null,
    hasAnalysis: marketData.factorAnalysis !== null,

    // Actions
    runFactorAnalysis,
    computePortfolioFactorExposure,
    getFactorBreakdown,
    calculateFactorRebalance
  };
};
