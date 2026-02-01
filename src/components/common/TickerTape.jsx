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
 * - Price change animations (flash green/red on update)
 * - Market open/closed indicator
 * - Shows behind sidebar (z-index: 50 vs sidebar's 100)
 */

import React, { memo, useMemo, useRef, useState, useEffect, useCallback } from 'react';

const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";
const TICKER_HEIGHT = 28;
const ANIMATION_DURATION = 45; // seconds for full scroll
const FADE_DURATION = 0.8; // seconds for item fade in/out

// Core market ETFs (always shown)
const CORE_ETFS = ['SPY', 'QQQ', 'IWM'];

// Factor ETF mapping (factor name -> ETF ticker)
const FACTOR_ETF_MAP = {
  'Market': 'SPY',
  'Size': 'IWM',
  'Value': 'IWD',
  'Growth': 'IWF',
  'Momentum': 'MTUM',
  'Quality': 'QUAL',
  'Low Volatility': 'SPLV',
  'Gold': 'GLD',
  'Bonds': 'TLT',
};

// Default factor ETFs (shown when no factor analysis)
const DEFAULT_FACTOR_ETFS = ['MTUM', 'QUAL', 'IWD', 'GLD'];

// Check if US markets are open (NYSE/NASDAQ: 9:30 AM - 4:00 PM ET, weekdays)
const isMarketOpen = () => {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etTime.getDay();
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Weekdays only (Mon-Fri)
  if (day === 0 || day === 6) return false;

  // Market hours: 9:30 AM (570 min) to 4:00 PM (960 min) ET
  return timeInMinutes >= 570 && timeInMinutes < 960;
};

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

// Market status indicator
const MarketStatus = ({ isOpen }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '0 12px',
      marginRight: '8px',
      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    }}
  >
    <div
      style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: isOpen ? '#00ff88' : '#666',
        boxShadow: isOpen ? '0 0 8px rgba(0, 255, 136, 0.6)' : 'none',
        animation: isOpen ? 'pulse 2s ease-in-out infinite' : 'none',
      }}
    />
    <span
      style={{
        fontSize: '9px',
        fontWeight: '600',
        color: isOpen ? '#00ff88' : '#666',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}
    >
      {isOpen ? 'OPEN' : 'CLOSED'}
    </span>
  </div>
);

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

// Single ticker item component with price change animation and fade-in support
const TickerItem = ({ ticker, price, change, isPortfolio, priceDirection, isNew }) => {
  // Track if this is the first render for this item (for fade-in animation)
  const [hasAnimated, setHasAnimated] = useState(false);
  const shouldAnimate = isNew && !hasAnimated;

  // After animation plays, mark as complete
  useEffect(() => {
    if (isNew && !hasAnimated) {
      const timer = setTimeout(() => setHasAnimated(true), FADE_DURATION * 1000);
      return () => clearTimeout(timer);
    }
  }, [isNew, hasAnimated]);

  // Flash effect based on price direction
  const flashColor = priceDirection === 'up' ? 'rgba(0, 255, 136, 0.3)'
    : priceDirection === 'down' ? 'rgba(255, 68, 102, 0.3)'
    : 'transparent';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 16px',
        borderRight: '1px solid rgba(255, 255, 255, 0.03)',
        background: flashColor,
        transition: 'background 0.5s ease-out',
        animation: shouldAnimate ? `tickerFadeIn ${FADE_DURATION}s ease-out forwards` : 'none',
      }}
    >
      {/* Ticker Symbol */}
      <span
        style={{
          fontSize: '11px',
          fontWeight: '600',
          color: isPortfolio ? '#00d4ff' : '#a78bfa',
          letterSpacing: '0.5px',
        }}
      >
        {ticker}
      </span>

      {/* Price */}
      <span
        style={{
          fontSize: '11px',
          color: priceDirection === 'up' ? '#00ff88'
            : priceDirection === 'down' ? '#ff4466'
            : '#e0e0e0',
          transition: 'color 0.3s ease',
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
};

const TickerTape = memo(({ positions = [], marketData = {}, factorAnalysis = null }) => {
  // Track previous prices to detect changes
  const prevPricesRef = useRef({});
  const [priceDirections, setPriceDirections] = useState({});
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());

  // Track new tickers for fade-in animation
  const prevTickersRef = useRef(new Set());
  const [newTickers, setNewTickers] = useState(new Set());

  // Update market status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketOpen(isMarketOpen());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Get list of all ETF tickers to exclude from portfolio section
  const allMarketEtfs = useMemo(() => {
    const etfs = new Set(CORE_ETFS);
    Object.values(FACTOR_ETF_MAP).forEach(t => etfs.add(t));
    DEFAULT_FACTOR_ETFS.forEach(t => etfs.add(t));
    return etfs;
  }, []);

  // Filter portfolio positions (exclude market ETFs to avoid duplicates)
  const portfolioItems = useMemo(() => {
    return positions
      .filter(p => p.ticker && p.price && !allMarketEtfs.has(p.ticker))
      .map(p => ({
        ticker: p.ticker,
        price: p.price,
        change: p.ytdReturn || p.dayChange || null,
        isPortfolio: true,
      }));
  }, [positions, allMarketEtfs]);

  // Determine which factor ETFs to show, prioritized by portfolio exposure
  const prioritizedFactorEtfs = useMemo(() => {
    // If we have factor analysis, sort by absolute beta (highest exposure first)
    if (factorAnalysis?.portfolioFactorBetas) {
      const betas = factorAnalysis.portfolioFactorBetas;
      const factorScores = Object.entries(FACTOR_ETF_MAP)
        .filter(([factor]) => factor !== 'Market') // Exclude Market (SPY already in core)
        .map(([factor, etf]) => ({
          etf,
          factor,
          score: Math.abs(betas[factor] || 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4) // Top 4 factor exposures
        .map(({ etf }) => etf);

      return factorScores;
    }

    // Default factor ETFs when no analysis
    return DEFAULT_FACTOR_ETFS;
  }, [factorAnalysis]);

  // Build market ETFs list: Core indices + prioritized factors
  const marketEtfList = useMemo(() => {
    const list = [...CORE_ETFS];
    prioritizedFactorEtfs.forEach(etf => {
      if (!list.includes(etf)) list.push(etf);
    });
    return list;
  }, [prioritizedFactorEtfs]);

  // Get market ETF data from marketData or positions
  const marketItems = useMemo(() => {
    return marketEtfList.map(ticker => {
      const md = marketData[ticker];
      if (md?.currentPrice) {
        return {
          ticker,
          price: md.currentPrice,
          change: md.ytdReturn || null,
          isPortfolio: false,
        };
      }
      const pos = positions.find(p => p.ticker === ticker);
      if (pos?.price) {
        return {
          ticker,
          price: pos.price,
          change: pos.ytdReturn || pos.dayChange || null,
          isPortfolio: false,
        };
      }
      return null;
    }).filter(Boolean);
  }, [marketData, positions, marketEtfList]);

  // Detect price changes and update directions
  useEffect(() => {
    const allItems = [...portfolioItems, ...marketItems];
    const newDirections = {};
    let hasChanges = false;

    allItems.forEach(item => {
      const prevPrice = prevPricesRef.current[item.ticker];
      if (prevPrice !== undefined && prevPrice !== item.price) {
        newDirections[item.ticker] = item.price > prevPrice ? 'up' : 'down';
        hasChanges = true;
      }
      prevPricesRef.current[item.ticker] = item.price;
    });

    if (hasChanges) {
      setPriceDirections(newDirections);
      // Clear flash after animation
      setTimeout(() => {
        setPriceDirections({});
      }, 1500);
    }
  }, [portfolioItems, marketItems]);

  // Detect new tickers for fade-in animation (smooth integration without interrupting scroll)
  useEffect(() => {
    const currentTickers = new Set([
      ...portfolioItems.map(p => p.ticker),
      ...marketItems.map(m => m.ticker)
    ]);

    // Find newly added tickers (skip on initial mount)
    if (prevTickersRef.current.size > 0) {
      const addedTickers = new Set();
      currentTickers.forEach(ticker => {
        if (!prevTickersRef.current.has(ticker)) {
          addedTickers.add(ticker);
        }
      });

      // Mark new tickers for fade-in animation
      if (addedTickers.size > 0) {
        setNewTickers(addedTickers);
        // Clear "new" status after fade-in completes
        setTimeout(() => {
          setNewTickers(new Set());
        }, FADE_DURATION * 1000);
      }
    }

    prevTickersRef.current = currentTickers;
  }, [portfolioItems, marketItems]);

  // Build the full sequence
  const buildSequence = useMemo(() => {
    const sequence = [];

    if (portfolioItems.length > 0) {
      sequence.push({ type: 'divider', label: 'Portfolio', color: '#00d4ff' });
      portfolioItems.forEach(item => sequence.push({ type: 'ticker', ...item }));
    }

    if (marketItems.length > 0) {
      sequence.push({ type: 'divider', label: 'Markets', color: '#a78bfa' });
      marketItems.forEach(item => sequence.push({ type: 'ticker', ...item }));
    }

    return sequence;
  }, [portfolioItems, marketItems]);

  if (buildSequence.length === 0) {
    return null;
  }

  // Triplicate sequence for seamless loop (ensures content fills viewport during scroll)
  const displaySequence = useMemo(() => {
    return [...buildSequence, ...buildSequence, ...buildSequence];
  }, [buildSequence]);

  return (
    <>
      {/* CSS Animation */}
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes tickerFadeIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
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
          zIndex: 50,
          overflow: 'hidden',
          fontFamily: FONT_FAMILY,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Market Status - fixed position */}
        <MarketStatus isOpen={marketOpen} />

        {/* Scrolling Content */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            height: '100%',
          }}
        >
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
                  priceDirection={priceDirections[item.ticker]}
                  isNew={newTickers.has(item.ticker)}
                />
              )
            ))}
          </div>
        </div>

        {/* Fade edge (right only now since market status is on left) */}
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
