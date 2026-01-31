import React from 'react';
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
// ANIMATED SVG PATHS COMPONENT
// ============================================
const AnimatedPaths = () => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 460 260"
    xmlns="http://www.w3.org/2000/svg"
    style={{ position: 'absolute', top: 0, left: 0 }}
  >
    <defs>
      <linearGradient id="pathGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#00d4ff"/>
        <stop offset="100%" stopColor="#7b2ff7"/>
      </linearGradient>
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <g stroke="url(#pathGrad)" strokeWidth="2" fill="none" filter="url(#glow)" opacity="0.75">
      <path d="M40 210 C120 180, 200 150, 420 70" className="path-line" style={{ animationDelay: '0s' }}/>
      <path d="M40 210 C120 190, 210 170, 420 90" className="path-line" style={{ animationDelay: '0.2s', opacity: 0.7 }}/>
      <path d="M40 210 C130 200, 230 190, 420 120" className="path-line" style={{ animationDelay: '0.4s', opacity: 0.6 }}/>
      <path d="M40 210 C140 210, 250 220, 420 160" className="path-line" style={{ animationDelay: '0.6s', opacity: 0.5 }}/>
      <path d="M40 210 C120 220, 200 250, 420 210" className="path-line" style={{ animationDelay: '0.8s', opacity: 0.45 }}/>
      <path d="M40 210 C110 230, 200 260, 420 235" className="path-line" style={{ animationDelay: '1s', opacity: 0.4 }}/>
    </g>

    {/* Axis lines */}
    <line x1="40" y1="30" x2="40" y2="240" stroke="rgba(148, 163, 184, 0.2)" strokeWidth="1"/>
    <line x1="40" y1="240" x2="440" y2="240" stroke="rgba(148, 163, 184, 0.2)" strokeWidth="1"/>

    {/* Labels */}
    <text x="35" y="25" fill="#94a3b8" fontSize="10" textAnchor="end">P95</text>
    <text x="35" y="130" fill="#94a3b8" fontSize="10" textAnchor="end">P50</text>
    <text x="35" y="235" fill="#94a3b8" fontSize="10" textAnchor="end">P5</text>
    <text x="40" y="255" fill="#94a3b8" fontSize="10">Today</text>
    <text x="440" y="255" fill="#94a3b8" fontSize="10" textAnchor="end">1 Year</text>
  </svg>
);

// ============================================
// PREVIEW CARD COMPONENT
// ============================================
const PreviewCard = () => {
  const styles = {
    card: {
      position: 'relative',
      width: '100%',
      maxWidth: '500px',
      height: '340px',
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(10, 15, 28, 0.95) 100%)',
      borderRadius: '16px',
      border: `1px solid ${COLORS.border}`,
      overflow: 'hidden',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    },
    header: {
      padding: '16px 20px',
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
    chartArea: {
      position: 'relative',
      height: '200px',
      padding: '10px',
    },
    statsRow: {
      display: 'flex',
      justifyContent: 'space-around',
      padding: '16px 20px',
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
    },
    statLabel: {
      fontSize: '10px',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginTop: '4px',
    },
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Portfolio Simulation</span>
        <span style={styles.badge}>10,000 paths</span>
      </div>
      <div style={styles.chartArea}>
        <AnimatedPaths />
      </div>
      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <div style={{ ...styles.statValue, color: '#ef4444' }}>-18%</div>
          <div style={styles.statLabel}>P5 (Bear)</div>
        </div>
        <div style={styles.stat}>
          <div style={{ ...styles.statValue, color: COLORS.cyan }}>+12%</div>
          <div style={styles.statLabel}>P50 (Median)</div>
        </div>
        <div style={styles.stat}>
          <div style={{ ...styles.statValue, color: '#22c55e' }}>+38%</div>
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
  // Inject keyframes for path animation
  React.useEffect(() => {
    const styleId = 'landing-page-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes drawPath {
          0%   { stroke-dashoffset: 1; opacity: 0.2; }
          40%  { stroke-dashoffset: 0; opacity: 0.85; }
          100% { stroke-dashoffset: 0; opacity: 0.3; }
        }
        .path-line {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: drawPath 3.5s ease-in-out infinite;
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
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
