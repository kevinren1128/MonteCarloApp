import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// Monospace font stack (same as app)
const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// Theme colors
const COLORS = {
  bg: '#0a0f1c',
  bgCard: 'rgba(15, 23, 42, 0.8)',
  cyan: '#00d4ff',
  purple: '#7b2ff7',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  border: 'rgba(42, 42, 74, 0.6)',
};

// ============================================
// PATH GENERATION UTILITIES
// ============================================
const PATH_COUNT = 7;

// Simple seeded random number generator
function createRNG(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Generate simulation paths based on parameters
function generatePaths({ seed, volatility, horizon }) {
  const rand = createRNG(seed);
  const steps = horizon === '5Y' ? 50 : 25;
  const startX = 40;
  const endX = 420;
  const startY = 200;
  const baseReturn = horizon === '5Y' ? 0.08 : 0.10; // Expected annual return
  const years = horizon === '5Y' ? 5 : 1;

  const paths = [];
  const finalValues = [];

  for (let i = 0; i < PATH_COUNT; i++) {
    let y = startY;
    let cumReturn = 0;
    const points = [`M${startX} ${y}`];

    for (let t = 1; t <= steps; t++) {
      const x = startX + (endX - startX) * (t / steps);
      // Random walk with drift
      const dt = years / steps;
      const drift = baseReturn * dt;
      const diffusion = (volatility / 100) * Math.sqrt(dt) * (rand() * 2 - 1) * 1.5;
      cumReturn += drift + diffusion;

      // Convert return to Y position (higher return = lower Y)
      const returnPercent = cumReturn;
      y = startY - returnPercent * 150; // Scale factor for visual
      y = Math.max(20, Math.min(230, y)); // Clamp to chart bounds

      points.push(`L${x.toFixed(1)} ${y.toFixed(1)}`);
    }

    paths.push(points.join(' '));
    finalValues.push(cumReturn);
  }

  // Sort final values to get percentiles
  const sorted = [...finalValues].sort((a, b) => a - b);
  const p5 = sorted[0];
  const p50 = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[sorted.length - 1];

  return {
    paths,
    stats: {
      p5: Math.round(p5 * 100),
      p50: Math.round(p50 * 100),
      p95: Math.round(p95 * 100),
    }
  };
}

// ============================================
// INTERACTIVE PREVIEW CARD COMPONENT
// ============================================
const PreviewCard = () => {
  const [volatility, setVolatility] = useState(25);
  const [horizon, setHorizon] = useState('1Y');
  const [seed, setSeed] = useState(42);
  const [isHoveredRerun, setIsHoveredRerun] = useState(false);

  // Generate paths when parameters change
  const { paths, stats } = useMemo(
    () => generatePaths({ seed, volatility, horizon }),
    [seed, volatility, horizon]
  );

  const handleRerun = useCallback(() => {
    setSeed(Math.floor(Math.random() * 1000000));
  }, []);

  const styles = {
    card: {
      position: 'relative',
      width: '100%',
      maxWidth: '500px',
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(10, 15, 28, 0.95) 100%)',
      borderRadius: '16px',
      border: `1px solid ${COLORS.border}`,
      overflow: 'hidden',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    },
    header: {
      padding: '12px 20px',
      borderBottom: `1px solid ${COLORS.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: '14px',
      fontWeight: '600',
      color: COLORS.textPrimary,
      fontFamily: FONT_FAMILY,
    },
    badge: {
      fontSize: '10px',
      padding: '4px 8px',
      background: 'rgba(0, 212, 255, 0.15)',
      border: '1px solid rgba(0, 212, 255, 0.3)',
      borderRadius: '4px',
      color: COLORS.cyan,
      fontFamily: FONT_FAMILY,
    },
    controls: {
      padding: '12px 20px',
      borderBottom: `1px solid ${COLORS.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
    },
    controlGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    label: {
      fontSize: '11px',
      color: COLORS.textSecondary,
      fontFamily: FONT_FAMILY,
    },
    slider: {
      width: '80px',
      height: '4px',
      WebkitAppearance: 'none',
      background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.purple})`,
      borderRadius: '2px',
      cursor: 'pointer',
    },
    horizonBtn: (active) => ({
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: '600',
      fontFamily: FONT_FAMILY,
      background: active
        ? `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.purple})`
        : 'rgba(255, 255, 255, 0.05)',
      border: active ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
      color: active ? '#fff' : COLORS.textSecondary,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    }),
    rerunBtn: {
      padding: '4px 12px',
      fontSize: '11px',
      fontWeight: '600',
      fontFamily: FONT_FAMILY,
      background: isHoveredRerun
        ? 'rgba(0, 212, 255, 0.2)'
        : 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(0, 212, 255, 0.3)',
      borderRadius: '4px',
      color: COLORS.cyan,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      marginLeft: 'auto',
    },
    chartArea: {
      position: 'relative',
      height: '180px',
      padding: '10px',
    },
    statsRow: {
      display: 'flex',
      justifyContent: 'space-around',
      padding: '14px 20px',
      borderTop: `1px solid ${COLORS.border}`,
      background: 'rgba(0, 0, 0, 0.2)',
    },
    stat: {
      textAlign: 'center',
    },
    statValue: {
      fontSize: '18px',
      fontWeight: '700',
      fontFamily: FONT_FAMILY,
      transition: 'color 0.2s ease',
    },
    statLabel: {
      fontSize: '10px',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginTop: '4px',
    },
  };

  const formatStat = (value) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value}%`;
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Portfolio Simulation</span>
        <span style={styles.badge}>10,000 paths</span>
      </div>

      {/* Interactive Controls */}
      <div style={styles.controls}>
        <div style={styles.controlGroup}>
          <span style={styles.label}>Volatility</span>
          <input
            type="range"
            min="10"
            max="60"
            value={volatility}
            onChange={(e) => setVolatility(Number(e.target.value))}
            style={styles.slider}
          />
          <span style={{ ...styles.label, color: COLORS.cyan, minWidth: '32px' }}>{volatility}%</span>
        </div>

        <div style={styles.controlGroup}>
          <span style={styles.label}>Horizon</span>
          <button
            style={styles.horizonBtn(horizon === '1Y')}
            onClick={() => setHorizon('1Y')}
          >
            1Y
          </button>
          <button
            style={styles.horizonBtn(horizon === '5Y')}
            onClick={() => setHorizon('5Y')}
          >
            5Y
          </button>
        </div>

        <button
          style={styles.rerunBtn}
          onClick={handleRerun}
          onMouseEnter={() => setIsHoveredRerun(true)}
          onMouseLeave={() => setIsHoveredRerun(false)}
        >
          🎲 Rerun
        </button>
      </div>

      {/* Chart Area */}
      <div style={styles.chartArea}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 460 220"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="pathGradInteractive" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00d4ff"/>
              <stop offset="100%" stopColor="#7b2ff7"/>
            </linearGradient>
            <filter id="glowInteractive" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="40" y1="20" x2="40" y2="200" stroke="rgba(148, 163, 184, 0.15)" strokeWidth="1"/>
          <line x1="40" y1="200" x2="420" y2="200" stroke="rgba(148, 163, 184, 0.15)" strokeWidth="1"/>
          <line x1="40" y1="110" x2="420" y2="110" stroke="rgba(148, 163, 184, 0.08)" strokeWidth="1" strokeDasharray="4"/>

          {/* Paths */}
          <g
            stroke="url(#pathGradInteractive)"
            strokeWidth="2"
            fill="none"
            filter="url(#glowInteractive)"
          >
            {paths.map((d, i) => (
              <path
                key={`${seed}-${i}`}
                d={d}
                style={{
                  opacity: 0.3 + (i / PATH_COUNT) * 0.5,
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </g>

          {/* Labels */}
          <text x="35" y="25" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily={FONT_FAMILY}>+</text>
          <text x="35" y="115" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily={FONT_FAMILY}>0</text>
          <text x="35" y="198" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily={FONT_FAMILY}>-</text>
          <text x="40" y="215" fill="#94a3b8" fontSize="9" fontFamily={FONT_FAMILY}>Today</text>
          <text x="420" y="215" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily={FONT_FAMILY}>{horizon}</text>
        </svg>
      </div>

      {/* Dynamic Stats */}
      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <div style={{ ...styles.statValue, color: stats.p5 < 0 ? '#ef4444' : '#22c55e' }}>
            {formatStat(stats.p5)}
          </div>
          <div style={styles.statLabel}>P5 (Bear)</div>
        </div>
        <div style={styles.stat}>
          <div style={{ ...styles.statValue, color: stats.p50 < 0 ? '#ef4444' : COLORS.cyan }}>
            {formatStat(stats.p50)}
          </div>
          <div style={styles.statLabel}>P50 (Median)</div>
        </div>
        <div style={styles.stat}>
          <div style={{ ...styles.statValue, color: stats.p95 < 0 ? '#ef4444' : '#22c55e' }}>
            {formatStat(stats.p95)}
          </div>
          <div style={styles.statLabel}>P95 (Bull)</div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// GOOGLE SIGN IN BUTTON (Landing Page Version)
// ============================================
const GoogleSignInButton = ({ large = false }) => {
  const { login, state } = useAuth();
  const { isLoading, isAvailable } = state;
  const [isHovered, setIsHovered] = React.useState(false);

  if (!isAvailable) {
    return null;
  }

  const handleClick = async () => {
    const { error } = await login();
    if (error) {
      console.error('Login failed:', error);
    }
  };

  const styles = {
    button: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: large ? '12px' : '10px',
      padding: large ? '14px 32px' : '12px 24px',
      borderRadius: '8px',
      background: isHovered
        ? 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)'
        : 'linear-gradient(135deg, rgba(0, 212, 255, 0.9) 0%, rgba(123, 47, 247, 0.9) 100%)',
      border: 'none',
      cursor: isLoading ? 'wait' : 'pointer',
      fontSize: large ? '16px' : '14px',
      fontWeight: '600',
      color: '#fff',
      fontFamily: FONT_FAMILY,
      transition: 'all 0.2s ease',
      boxShadow: isHovered
        ? '0 8px 30px rgba(0, 212, 255, 0.4)'
        : '0 4px 20px rgba(0, 212, 255, 0.3)',
      opacity: isLoading ? 0.7 : 1,
      transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
    },
    icon: {
      width: large ? '22px' : '18px',
      height: large ? '22px' : '18px',
      background: '#fff',
      borderRadius: '4px',
      padding: '3px',
    },
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      style={styles.button}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg style={styles.icon} viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
    </button>
  );
};

// ============================================
// HERO SECTION
// ============================================
const HeroSection = () => {
  const styles = {
    section: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '60px',
      padding: '80px 60px',
      maxWidth: '1200px',
      margin: '0 auto',
      minHeight: '70vh',
    },
    left: {
      flex: 1,
      maxWidth: '500px',
    },
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '24px',
    },
    logoIcon: {
      fontSize: '32px',
    },
    logoText: {
      fontSize: '18px',
      fontWeight: '600',
      background: `linear-gradient(135deg, ${COLORS.cyan} 0%, ${COLORS.purple} 100%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontFamily: FONT_FAMILY,
    },
    headline: {
      fontSize: '48px',
      fontWeight: '700',
      color: COLORS.textPrimary,
      lineHeight: 1.2,
      marginBottom: '20px',
      fontFamily: FONT_FAMILY,
    },
    headlineAccent: {
      background: `linear-gradient(135deg, ${COLORS.cyan} 0%, ${COLORS.purple} 100%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    tagline: {
      fontSize: '18px',
      color: COLORS.textSecondary,
      lineHeight: 1.6,
      marginBottom: '32px',
    },
    cta: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    },
    trust: {
      fontSize: '12px',
      color: COLORS.textSecondary,
      marginTop: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    right: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
    },
  };

  return (
    <section style={styles.section}>
      <div style={styles.left}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>📈</span>
          <span style={styles.logoText}>factorsim.xyz</span>
        </div>
        <h1 style={styles.headline}>
          See <span style={styles.headlineAccent}>thousands of futures</span> for your portfolio
        </h1>
        <p style={styles.tagline}>
          Monte Carlo simulation shows you the full range of possible outcomes—not just averages.
          Understand your risk before the market teaches you the hard way.
        </p>
        <div style={styles.cta}>
          <GoogleSignInButton large />
        </div>
        <p style={styles.trust}>
          <span style={{ color: '#22c55e' }}>🔒</span>
          Free to use • Your data stays private • No credit card required
        </p>
      </div>
      <div style={styles.right}>
        <PreviewCard />
      </div>
    </section>
  );
};

// ============================================
// HOW IT WORKS SECTION
// ============================================
const HowItWorksSection = () => {
  const steps = [
    {
      icon: '📊',
      title: 'Input your portfolio',
      description: 'Add your positions with quantities and prices. We fetch real-time data and historical returns.',
    },
    {
      icon: '🎲',
      title: 'Run simulations',
      description: '10,000+ randomized market paths using correlated returns and fat-tailed distributions.',
    },
    {
      icon: '🎯',
      title: 'Explore outcomes',
      description: 'See P5 to P95 return ranges, max drawdown risk, and position contribution analysis.',
    },
  ];

  const styles = {
    section: {
      padding: '80px 60px',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    header: {
      textAlign: 'center',
      marginBottom: '60px',
    },
    title: {
      fontSize: '32px',
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: '12px',
      fontFamily: FONT_FAMILY,
    },
    subtitle: {
      fontSize: '16px',
      color: COLORS.textSecondary,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '40px',
    },
    step: {
      textAlign: 'center',
      padding: '32px',
      background: COLORS.bgCard,
      borderRadius: '16px',
      border: `1px solid ${COLORS.border}`,
      transition: 'all 0.2s ease',
    },
    stepNumber: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${COLORS.cyan} 0%, ${COLORS.purple} 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      margin: '0 auto 20px',
    },
    stepTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: COLORS.textPrimary,
      marginBottom: '12px',
      fontFamily: FONT_FAMILY,
    },
    stepDesc: {
      fontSize: '14px',
      color: COLORS.textSecondary,
      lineHeight: 1.6,
    },
  };

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>How it works</h2>
        <p style={styles.subtitle}>Three steps to understand your portfolio risk</p>
      </div>
      <div style={styles.grid}>
        {steps.map((step, i) => (
          <div key={i} style={styles.step}>
            <div style={styles.stepNumber}>{step.icon}</div>
            <h3 style={styles.stepTitle}>{step.title}</h3>
            <p style={styles.stepDesc}>{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

// ============================================
// FEATURES GRID SECTION
// ============================================
const FeaturesSection = () => {
  const features = [
    {
      icon: '📈',
      title: 'Goal Probability',
      description: 'What are the odds of hitting your target return? See exact percentages across thousands of scenarios.',
    },
    {
      icon: '⚠️',
      title: 'Tail Risk Analysis',
      description: 'Understand worst-case scenarios. See P5 outcomes and maximum drawdown distributions.',
    },
    {
      icon: '⚡',
      title: 'Factor Exposure',
      description: 'Decompose your portfolio into market, value, momentum, and size factors.',
    },
    {
      icon: '🎯',
      title: 'Position Optimization',
      description: 'Find which positions help vs. hurt your risk-adjusted returns with incremental Sharpe analysis.',
    },
  ];

  const styles = {
    section: {
      padding: '80px 60px',
      maxWidth: '1200px',
      margin: '0 auto',
      background: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '24px',
    },
    header: {
      textAlign: 'center',
      marginBottom: '60px',
    },
    title: {
      fontSize: '32px',
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: '12px',
      fontFamily: FONT_FAMILY,
    },
    subtitle: {
      fontSize: '16px',
      color: COLORS.textSecondary,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '24px',
    },
    feature: {
      display: 'flex',
      gap: '20px',
      padding: '28px',
      background: COLORS.bgCard,
      borderRadius: '12px',
      border: `1px solid ${COLORS.border}`,
    },
    featureIcon: {
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      background: 'rgba(0, 212, 255, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      flexShrink: 0,
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: COLORS.textPrimary,
      marginBottom: '8px',
      fontFamily: FONT_FAMILY,
    },
    featureDesc: {
      fontSize: '14px',
      color: COLORS.textSecondary,
      lineHeight: 1.5,
    },
  };

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>Professional-grade analysis</h2>
        <p style={styles.subtitle}>The same tools institutional investors use</p>
      </div>
      <div style={styles.grid}>
        {features.map((feature, i) => (
          <div key={i} style={styles.feature}>
            <div style={styles.featureIcon}>{feature.icon}</div>
            <div style={styles.featureContent}>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ============================================
// FINAL CTA SECTION
// ============================================
const FinalCTASection = () => {
  const styles = {
    section: {
      padding: '100px 60px',
      textAlign: 'center',
      maxWidth: '700px',
      margin: '0 auto',
    },
    title: {
      fontSize: '36px',
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: '16px',
      fontFamily: FONT_FAMILY,
    },
    subtitle: {
      fontSize: '18px',
      color: COLORS.textSecondary,
      marginBottom: '32px',
    },
    buttonWrapper: {
      display: 'flex',
      justifyContent: 'center',
    },
  };

  return (
    <section style={styles.section}>
      <h2 style={styles.title}>Ready to see your portfolio's future?</h2>
      <p style={styles.subtitle}>
        Start simulating in seconds. No credit card, no setup, just insights.
      </p>
      <div style={styles.buttonWrapper}>
        <GoogleSignInButton large />
      </div>
    </section>
  );
};

// ============================================
// FOOTER
// ============================================
const Footer = () => {
  const styles = {
    footer: {
      padding: '40px 60px',
      borderTop: `1px solid ${COLORS.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    left: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      color: COLORS.textSecondary,
    },
    right: {
      fontSize: '12px',
      color: COLORS.textSecondary,
    },
  };

  return (
    <footer style={styles.footer}>
      <div style={styles.left}>
        <span>📈</span>
        <span>factorsim.xyz</span>
        <span style={{ margin: '0 8px' }}>•</span>
        <span>Monte Carlo Portfolio Simulator</span>
      </div>
      <div style={styles.right}>
        Built with React • v6.4.2
      </div>
    </footer>
  );
};

// ============================================
// MAIN LANDING PAGE COMPONENT
// ============================================
const LandingPage = () => {
  // Inject styles for slider and animations
  React.useEffect(() => {
    const styleId = 'landing-page-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Custom slider styling */
        input[type="range"] {
          -webkit-appearance: none;
          height: 4px;
          background: linear-gradient(90deg, #00d4ff, #7b2ff7);
          border-radius: 2px;
          cursor: pointer;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          background: #fff;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          transition: transform 0.15s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: #fff;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const style = document.getElementById(styleId);
      if (style) style.remove();
    };
  }, []);

  const styles = {
    page: {
      minHeight: '100vh',
      background: `linear-gradient(180deg, ${COLORS.bg} 0%, #0f172a 50%, ${COLORS.bg} 100%)`,
      color: COLORS.textPrimary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflowX: 'hidden',
    },
    bgGradient: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: `radial-gradient(ellipse at 20% 20%, rgba(0, 212, 255, 0.08) 0%, transparent 50%),
                   radial-gradient(ellipse at 80% 80%, rgba(123, 47, 247, 0.08) 0%, transparent 50%)`,
      pointerEvents: 'none',
      zIndex: 0,
    },
    content: {
      position: 'relative',
      zIndex: 1,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.bgGradient} />
      <div style={styles.content}>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <FinalCTASection />
        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;
