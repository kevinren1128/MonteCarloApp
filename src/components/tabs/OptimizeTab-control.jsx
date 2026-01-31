import React, { useState, useEffect } from 'react';
import { useSimulationContext } from '../../contexts';
import { useOptimization } from '../../hooks/useOptimization';

const OptimizeTab = () => {
  const optimization = useOptimization();
  const simulation = useSimulationContext();

  const [optimizationConfig, setOptimizationConfig] = useState({
    targetReturn: 0.08,
    maxPositions: 25,
    minAllocation: 0.01,
    maxAllocation: 0.20
  });

  const runAnalysis = async () => {
    if (!optimization.hasCorrelation) {
      console.warn('⚠️ Missing correlation matrix');
      return;
    }

    try {
      simulation.setLoading('optimization', true);
      
      const results = await optimization.optimizeForTargetReturn(
        optimizationConfig.targetReturn,
        optimizationConfig
      );
      
      if (results) {
        simulation.setOptimizationResults(results);
      }
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      simulation.setLoading('optimization', false);
    }
  };

  // Progress tracking
  const isOptimizing = simulation.loading?.optimization;

  return (
    <div>
      {/* Optimization controls */}
      <div style={{ padding: '20px' }}>
        <button 
          onClick={runAnalysis}
          disabled={isOptimizing || !optimization.canOptimize}
        >
          {isOptimizing ? '⏳ Analyzing...' : '🚀 Run Analysis'}
        </button>
        
        {/* Progress indicator */}
        {isOptimizing && (
          <div>Running optimization... ({simulation.progress?.phase})</div>
        )}
      </div>

      {/* Results display */}
      {optimization.currentOptimizationResults && !isOptimizing && (
        <div>
          ✅ Optimization complete!
          Expected return: {optimization.currentOptimizationResults.expectedReturn}%
        </div>
      )}
    </div>
  );
};

export default OptimizeTab;
