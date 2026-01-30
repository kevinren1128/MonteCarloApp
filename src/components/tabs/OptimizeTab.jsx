import React, { useState } from 'react';
import { usePortfolioContext, useSimulationContext } from '../../contexts';
import { useOptimization } from '../../hooks/useOptimization';

const OptimizeTab = () => {
  const portfolio = usePortfolioContext();
  const simulation = useSimulationContext();
  const optimization = useOptimization();

  const [config, setConfig] = useState({
    targetReturn: 0.08,
    maxPositions: 25,
    minAllocation: 0.01,
    maxAllocation: 0.25
  });

  const runAnalysis = async () => {
    if (!portfolio.positions.length) {
      alert('No positions to optimize');
      return;
    }

    if (!optimization.hasCorrelation) {
      alert('Please compute correlation matrix first');
      return;
    }

    try {
      simulation.setThematicProgress({
        current: 0,
        total: 100,
        phase: 'optimization_setup'
      });
      simulation.setLoading('optimization', true);

      const results = await optimization.optimizeForTargetReturn(
        config.targetReturn,
        config
      );

      simulation.setOptimizationResults(results);
      simulation.setLoading('optimization', false);

    } catch (error) {
      console.error('Optimization error:', error);
      simulation.setLoading('optimization', false);
      alert('Optimization failed: ' + error.message);
    }
  };

  const isOptimizing = simulation.loading?.optimization;
  const hasData = portfolio.positions.length > 0;
  const ready = optimization.hasCorrelation;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Configuration */}
      <div style={{ marginBottom: '30px' }}>
        <h2>Portfolio Optimization</h2>
        
        {/* Target Return */}
        <div style={{ marginBottom: '20px' }}>
          <label>Target Annual Return: {config.targetReturn * 100}%</label>
          <input
            type="range" 
            min={0.05} max={0.20} step={0.01}
            value={config.targetReturn}
            onChange={(e) => setConfig({...config, targetReturn: parseFloat(e.target.value)})}
          />
        </div>
      </div>

      {/* Action Button */}
      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={runAnalysis}
          disabled={isOptimizing || !ready}
          style={{
            padding: '12px 24px',
            background: isOptimizing ? '#ccc' : '#00d4ff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isOptimizing ? 'not-allowed' : 'pointer'
          }}
        >
          {isOptimizing ? '⏳ Analyzing...' : '🚀 Run Analysis'}
        </button>
      </div>

      {/* Status */}
      {isOptimizing && (
        <div style={{ 
          padding: '20px', 
          background: '#f0f8ff', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          Optimization in progress...
        </div>
      )}

      {/* Results */}
      {simulation.optimizationResults && !isOptimizing && (
        <div style={{
          padding: '20px',
          background: '#e8f5e8',
          borderRadius: '8px',
          border: '1px solid #28a745'
        }}>
          ✅ Optimization Complete!
          <br/>
          Expected Return: {(simulation.optimizationResults.expectedReturn * 100).toFixed(1)}%
          <br/>
          Positions: {simulation.optimizationResults.positions.length}
        </div>
      )}

      {/* Data Requirements */}
      {!hasData && (
        <div style={{color: '#dc3545'}}>Add positions to database first</div>
      )}
      {!ready && hasData && (
        <div style={{color: '#ffc107'}}>Compute correlation matrix to enable optimization</div>
      )}
    </div>
  );
};

export default OptimizeTab;
