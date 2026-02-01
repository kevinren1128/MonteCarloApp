/**
 * TickerTape Component
 *
 * A scrolling ticker tape showing portfolio positions at the top of the screen.
 * Displays tickers with their prices and daily changes, scrolling continuously
 * from right to left.
 *
 * Features:
 * - Continuous smooth scrolling animation
 * - Shows behind sidebar (z-index: 50 vs sidebar's 100)
 * - Responsive to sidebar width changes
 * - Matches app theme with gradient background
 */

import React, { memo, useMemo } from 'react';

const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";
const TICKER_HEIGHT = 28;
const ANIMATION_DURATION = 30; // seconds for full scroll

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

const TickerTape = memo(({ positions = [], sidebarWidth = 0 }) => {
  // Filter positions with valid data and create display items
  const tickerItems = useMemo(() => {
    return positions
      .filter(p => p.ticker && p.price)
      .map(p => ({
        ticker: p.ticker,
        price: p.price,
        change: p.ytdReturn || p.dayChange || null,
        currency: p.currency || 'USD',
      }));
  }, [positions]);

  // Don't render if no positions
  if (tickerItems.length === 0) {
    return null;
  }

  // Duplicate items to create seamless loop (need enough to fill screen + animation)
  const displayItems = useMemo(() => {
    // Repeat the items enough times to ensure smooth scrolling
    const repeats = Math.max(4, Math.ceil(20 / tickerItems.length));
    return Array(repeats).fill(tickerItems).flat();
  }, [tickerItems]);

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
          {displayItems.map((item, index) => (
            <div
              key={`${item.ticker}-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 20px',
                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {/* Ticker Symbol */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#00d4ff',
                  letterSpacing: '0.5px',
                }}
              >
                {item.ticker}
              </span>

              {/* Price */}
              <span
                style={{
                  fontSize: '11px',
                  color: '#e0e0e0',
                }}
              >
                ${formatPrice(item.price)}
              </span>

              {/* Change (if available) */}
              {item.change !== null && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '500',
                    color: item.change >= 0 ? '#00ff88' : '#ff4466',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    background: item.change >= 0
                      ? 'rgba(0, 255, 136, 0.1)'
                      : 'rgba(255, 68, 102, 0.1)',
                  }}
                >
                  {formatChange(item.change)}
                </span>
              )}
            </div>
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
