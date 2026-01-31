import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Google Sign In Button
 * Renders a styled button that initiates Google OAuth flow
 */
export function GoogleSignIn({ compact = false }) {
  const { login, state } = useAuth();
  const { isLoading, isAvailable } = state;

  // Don't render if auth isn't configured
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
      gap: compact ? '6px' : '10px',
      padding: compact ? '8px 14px' : '10px 20px',
      borderRadius: '6px',
      background: '#fff',
      border: '1px solid #dadce0',
      cursor: isLoading ? 'wait' : 'pointer',
      fontSize: compact ? '13px' : '14px',
      fontWeight: '500',
      color: '#3c4043',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: 'all 0.15s ease',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      opacity: isLoading ? 0.7 : 1,
    },
    buttonHover: {
      background: '#f8f9fa',
      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
      borderColor: '#c6c6c6',
    },
    icon: {
      width: compact ? '16px' : '18px',
      height: compact ? '16px' : '18px',
    },
    spinner: {
      width: compact ? '14px' : '16px',
      height: compact ? '14px' : '16px',
      border: '2px solid #dadce0',
      borderTop: '2px solid #4285f4',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
  };

  // Inject keyframes for spinner
  React.useEffect(() => {
    const styleId = 'google-signin-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      style={{
        ...styles.button,
        ...(isHovered ? styles.buttonHover : {}),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isLoading ? (
        <div style={styles.spinner} />
      ) : (
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
      )}
      <span>{isLoading ? 'Signing in...' : (compact ? 'Sign in' : 'Sign in with Google')}</span>
    </button>
  );
}

export default GoogleSignIn;
