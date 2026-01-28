/**
 * Skeleton Loader Components
 * 
 * @module components/common/Skeleton
 * @description Animated skeleton placeholders for loading states
 */

import React from 'react';

/**
 * Base Skeleton component with GPU-accelerated shimmer animation
 * Uses a pseudo-element approach via CSS for transform-based animation
 */
const Skeleton = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = '4px',
  style = {},
}) => (
  <div style={{
    width,
    height,
    borderRadius,
    background: 'rgba(255,255,255,0.05)',
    position: 'relative',
    overflow: 'hidden',
    ...style,
  }}>
    {/* Shimmer overlay - uses transform for GPU acceleration */}
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
      animation: 'skeletonShimmer 1.5s ease-in-out infinite',
      willChange: 'transform',
    }} />
    <style>{`
      @keyframes skeletonShimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `}</style>
  </div>
);

/**
 * Skeleton for text content
 */
export const SkeletonText = ({ lines = 1, width = '100%', gap = '8px' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap }}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton 
        key={i} 
        width={i === lines - 1 && lines > 1 ? '60%' : width} 
        height="14px" 
      />
    ))}
  </div>
);

/**
 * Skeleton for table rows
 */
export const SkeletonTableRow = ({ columns = 5 }) => (
  <tr>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} style={{ padding: '12px 8px' }}>
        <Skeleton height="16px" width={i === 0 ? '60px' : i === columns - 1 ? '30px' : '80%'} />
      </td>
    ))}
  </tr>
);

/**
 * Skeleton for a table
 */
export const SkeletonTable = ({ rows = 5, columns = 5 }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead>
      <tr>
        {Array.from({ length: columns }).map((_, i) => (
          <th key={i} style={{ padding: '12px 8px', textAlign: 'left' }}>
            <Skeleton height="12px" width="60%" />
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </tbody>
  </table>
);

/**
 * Skeleton for a card
 */
export const SkeletonCard = ({ hasTitle = true, lines = 3 }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    padding: '20px',
  }}>
    {hasTitle && (
      <div style={{ marginBottom: '16px' }}>
        <Skeleton height="20px" width="40%" />
      </div>
    )}
    <SkeletonText lines={lines} />
  </div>
);

/**
 * Skeleton for stat cards
 */
export const SkeletonStats = ({ count = 4 }) => (
  <div style={{ 
    display: 'grid', 
    gridTemplateColumns: `repeat(${count}, 1fr)`, 
    gap: '16px' 
  }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        padding: '16px',
        textAlign: 'center',
      }}>
        <Skeleton height="32px" width="60%" style={{ margin: '0 auto 8px' }} />
        <Skeleton height="12px" width="80%" style={{ margin: '0 auto' }} />
      </div>
    ))}
  </div>
);

/**
 * Skeleton for charts
 */
export const SkeletonChart = ({ height = '200px' }) => (
  <div style={{
    height,
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    padding: '20px',
    gap: '8px',
  }}>
    {Array.from({ length: 12 }).map((_, i) => (
      <Skeleton 
        key={i} 
        width="20px" 
        height={`${30 + Math.random() * 60}%`}
        borderRadius="4px 4px 0 0"
      />
    ))}
  </div>
);

/**
 * Skeleton for position row specifically
 */
export const SkeletonPositionRow = () => (
  <tr style={{ background: 'rgba(255, 255, 255, 0.01)' }}>
    <td style={{ padding: '12px 8px' }}><Skeleton height="28px" width="60px" borderRadius="4px" /></td>
    <td style={{ padding: '12px 8px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Skeleton height="14px" width="100px" />
        <Skeleton height="10px" width="50px" />
      </div>
    </td>
    <td style={{ padding: '12px 8px' }}><Skeleton height="28px" width="60px" borderRadius="4px" /></td>
    <td style={{ padding: '12px 8px' }}><Skeleton height="28px" width="80px" borderRadius="4px" /></td>
    <td style={{ padding: '12px 8px' }}><Skeleton height="16px" width="70px" /></td>
    <td style={{ padding: '12px 8px' }}><Skeleton height="16px" width="50px" /></td>
    <td style={{ padding: '12px 8px' }}><Skeleton height="16px" width="40px" /></td>
    <td style={{ padding: '12px 8px' }}><Skeleton height="16px" width="50px" /></td>
    <td style={{ padding: '12px 8px' }}><Skeleton height="16px" width="50px" /></td>
    <td style={{ padding: '12px 8px' }}><Skeleton height="18px" width="45px" borderRadius="2px" /></td>
    <td style={{ padding: '12px 8px' }}><Skeleton height="24px" width="24px" borderRadius="4px" /></td>
  </tr>
);

export default Skeleton;
