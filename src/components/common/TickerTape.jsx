/**
 * TickerTape Component
 *
 * A scrolling ticker tape showing portfolio positions and market ETFs
 * at the top of the screen.
 *
 * Features:
 * - Continuous smooth scrolling animation
 * - Two sections: Portfolio positions and Market ETFs
 * - Clear visual dividers between sections
 * - Shows behind sidebar (z-index: 50 vs sidebar's 100)
 * - Matches app theme with gradient background
 */

import React, { memo, useMemo } from 'react';

const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";
const TICKER_HEIGHT = 28;
const ANIMATION_DURATION = 45; // seconds for full scroll (longer with more items)

// Key market ETFs to always show
const MARKET_ETFS = ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'GLD', 'TLT', 'VIX'];

// Format price with appropriate decimals
const formatPrice = (price) => {
  if (price === null || price === undefined || isNaN(price)) return '—';
  return price >= 1000
    ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : price.toFixed(2);
};

// Format percentage change
const formatChange = (change) => {
  if (change === null || change === undefined || isNaN(change)) return null;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${(change * 100).toFixed(1)}%`;
};

// Section divider component
const SectionDivider = ({ label, color }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '0 16px',
      marginLeft: '8px',
      marginRight: '8px',
    }}
  >
    <div
      style={{
        width: '2px',
        height: '16px',
        background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
      }}
    />
    <span
      style={{
        fontSize: '9px',
        fontWeight: '700',
        color: color,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        opacity: 0.9,
      }}
    >
      {label}
    </span>
    <div
      style={{
        width: '2px',
        height: '16px',
        background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
      }}
    />
  </div>
);

// Single ticker item component
const TickerItem = ({ ticker, price, change, isPortfolio }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '0 16px',
      borderRight: '1px solid rgba(255, 255, 255, 0.03)',
    }}
  >
    {/* Ticker Symbol */}
    <span
      style={{
        fontSize: '11px',
        fontWeight: '600',
        color: isPortfolio ? '#00d4ff' : '#a78bfa', // Cyan for portfolio, purple for markets
        letterSpacing: '0.5px',
      }}
    >
      {ticker}
    </span>

    {/* Price */}
    <span
      style={{
        fontSize: '11px',
        color: '#e0e0e0',
      }}
    >
      ${formatPrice(price)}
    </span>

    {/* Change (if available) */}
    {change !== null && (
      <span
        style={{
          fontSize: '10px',
          fontWeight: '500',
          color: change >= 0 ? '#00ff88' : '#ff4466',
          padding: '1px 4px',
          borderRadius: '3px',
          background: change >= 0
            ? 'rgba(0, 255, 136, 0.1)'
            : 'rgba(255, 68, 102, 0.1)',
        }}
      >
        {formatChange(change)}
      </span>
    )}
  </div>
);

const TickerTape = memo(({ positions = [], marketData = {} }) => {
  // Filter portfolio positions (exclude ETFs that are in MARKET_ETFS to avoid duplicates)
  const portfolioItems = useMemo(() => {
    return positions
      .filter(p => p.ticker && p.price && !MARKET_ETFS.includes(p.ticker))
      .map(p => ({
        ticker: p.ticker,
        price: p.price,
        change: p.ytdReturn || p.dayChange || null,
        isPortfolio: true,
      }));
  }, [positions]);

  // Get market ETF data from marketData or positions
  const marketItems = useMemo(() => {
    return MARKET_ETFS.map(ticker => {
      // First check marketData (unifiedMarketData) - uses currentPrice field
      const md = marketData[ticker];
      if (md?.currentPrice) {
        return {
          ticker,
          price: md.currentPrice,
          change: md.ytdReturn || null,
          isPortfolio: false,
        };
      }
      // Then check positions (user might have these ETFs)
      const pos = positions.find(p => p.ticker === ticker);
      if (pos?.price) {
        return {
          ticker,
          price: pos.price,
          change: pos.ytdReturn || pos.dayChange || null,
          isPortfolio: false,
        };
      }
      // No data available
      return null;
    }).filter(Boolean);
  }, [marketData, positions]);

  // Build the full sequence: Portfolio section + Markets section
  const buildSequence = useMemo(() => {
    const sequence = [];

    // Portfolio section
    if (portfolioItems.length > 0) {
      sequence.push({ type: 'divider', label: 'Portfolio', color: '#00d4ff' });
      portfolioItems.forEach(item => sequence.push({ type: 'ticker', ...item }));
    }

    // Markets section
    if (marketItems.length > 0) {
      sequence.push({ type: 'divider', label: 'Markets', color: '#a78bfa' });
      marketItems.forEach(item => sequence.push({ type: 'ticker', ...item }));
    }

    return sequence;
  }, [portfolioItems, marketItems]);

  // Don't render if no items
  if (buildSequence.length === 0) {
    return null;
  }

  // Duplicate sequence for seamless loop
  const displaySequence = useMemo(() => {
    // Need at least 2 copies for the 50% translateX animation
    return [...buildSequence, ...buildSequence];
  }, [buildSequence]);

  return (
    <>
      {/* CSS Animation */}
      <style>{`
        @keyframes tickerScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .ticker-tape-container:hover .ticker-tape-content {
          animation-play-state: paused;
        }
      `}</style>

      {/* Ticker Tape Bar */}
      <div
        className="ticker-tape-container"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: TICKER_HEIGHT,
          background: 'linear-gradient(180deg, rgba(10, 10, 20, 0.95) 0%, rgba(15, 15, 25, 0.9) 100%)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
          zIndex: 50, // Behind sidebar (z-index: 100)
          overflow: 'hidden',
          fontFamily: FONT_FAMILY,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Scrolling Content */}
        <div
          className="ticker-tape-content"
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            whiteSpace: 'nowrap',
            animation: `tickerScroll ${ANIMATION_DURATION}s linear infinite`,
          }}
        >
          {displaySequence.map((item, index) => (
            item.type === 'divider' ? (
              <SectionDivider key={`divider-${item.label}-${index}`} label={item.label} color={item.color} />
            ) : (
              <TickerItem
                key={`${item.ticker}-${index}`}
                ticker={item.ticker}
                price={item.price}
                change={item.change}
                isPortfolio={item.isPortfolio}
              />
            )
          ))}
        </div>

        {/* Fade edges for smooth visual */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '60px',
            height: '100%',
            background: 'linear-gradient(90deg, rgba(10, 10, 20, 1) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '60px',
            height: '100%',
            background: 'linear-gradient(270deg, rgba(10, 10, 20, 1) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </>
  );
});

TickerTape.displayName = 'TickerTape';

export { TICKER_HEIGHT };
export default TickerTape;
