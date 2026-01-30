import { useCallback, useMemo } from 'react';
import { useMarketDataContext } from '../contexts/MarketDataContext';
import { computeSampleCorrelation } from '../utils/statistics';

export const useCorrelation = () => {
  const context = useMarketDataContext();

  const computeCorrelationMatrix = useCallback(async (symbols, returnsMatrix) => {
    try {
      context.setLoading('correlation', true);
      
      const correlation = computeSampleCorrelation(returnsMatrix);
      const symbolsList = symbols;
      
      const hasValidCorrelation = correlation && correlation.length > 0;
      
      if (hasValidCorrelation) {
        context.setCorrelationMatrix(correlation);
        
        // Create correlation groups (sector/theme based)
        const groups = createCorrelationGroups(symbolsList, correlation);
        context.setCorrelationGroups(groups);
      }
      
      return correlation;
    } catch (error) {
      context.addFetchError({
        type: 'correlation',
        error: error.message
      });
      throw error;
    } finally {
      context.setLoading('correlation', false);
    }
  }, [context]);

  const updateCorrelationCell = useCallback((rowIndex, colIndex, value) => {
    if (!context.correlationMatrix) return;
    
    const newMatrix = [...context.correlationMatrix];
    newMatrix[rowIndex][colIndex] = value;
    newMatrix[colIndex][rowIndex] = value;
    
    context.setEditedCorrelation(newMatrix);
  }, [context.correlationMatrix, context.setEditedCorrelation]);

  const resetCorrelation = useCallback(() => {
    context.resetEditedCorrelation();
  }, [context.resetEditedCorrelation]);

  // Derive correlation statistics
  const correlationStats = useMemo(() => {
    if (!context.editedCorrelation || !context.correlationMatrix) return null;
    
    const matrix = context.editedCorrelation;
    const symbols = Object.keys(context.unifiedMarketData);
    
    return {
      average: matrix.reduce((sum, row) => 
        sum + row.reduce((rowSum, val) => rowSum + val, 0), 0
      ) / (matrix.length * matrix.length),
      symbols: symbols,
      matrix: matrix
    };
  }, [context.editedCorrelation, context.correlationMatrix, context.unifiedMarketData]);

  const createCorrelationGroups = (symbols, correlation) => {
    if (!symbols || !correlation) return null;
    
    // Group by sector/theme based on correlation values
    const groups = {};
    symbols.forEach((symbol, i) => {
      // Simple grouping logic based on correlation thresholds
      const sector = context.unifiedMarketData[symbol]?.sector || 'Unknown';
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push({ symbol, correlation: correlation[i] });
    });
    
    return groups;
  };

  return {
    // State
    correlationMatrix: context.correlationMatrix,
    editedCorrelation: context.editedCorrelation,
    correlationGroups: context.correlationGroups,
    symbols: Object.keys(context.unifiedMarketData),

    // Status
    isLoading: context.loading ? context.loading.correlation : false,
    hasData: context.hasCorrelation,

    // Actions
    computeCorrelationMatrix,
    updateCorrelationCell,
    resetCorrelation,

    // Stats
    correlationStats,
    matrixViewMode: context.matrixViewMode,
    setMatrixViewMode: context.setMatrixViewMode
  };
};
