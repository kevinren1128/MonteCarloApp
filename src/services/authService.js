/**
 * Auth Service - Supabase Authentication
 *
 * @module services/authService
 * @description Handles user authentication via Supabase with Google OAuth.
 *
 * Setup Instructions:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Enable Google OAuth in Authentication > Providers
 * 3. Create Google OAuth credentials at console.cloud.google.com
 * 4. Add redirect URI: https://<project>.supabase.co/auth/v1/callback
 * 5. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// SUPABASE CLIENT CONFIGURATION
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is configured
const isConfigured = supabaseUrl && supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key');

// Create Supabase client (or null if not configured)
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Check if Supabase authentication is available
 * @returns {boolean}
 */
export const isAuthAvailable = () => {
  return supabase !== null;
};

// ============================================
// AUTHENTICATION METHODS
// ============================================

/**
 * Sign in with Google OAuth
 * Redirects to Google sign-in page, then back to the app
 * @returns {Promise<{error: Error|null}>}
 */
export const signInWithGoogle = async () => {
  if (!supabase) {
    console.warn('Supabase not configured - sign in unavailable');
    return { error: new Error('Authentication not configured') };
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    return { error };
  } catch (error) {
    console.error('Sign in error:', error);
    return { error };
  }
};

/**
 * Sign out the current user
 * @returns {Promise<{error: Error|null}>}
 */
export const signOut = async () => {
  if (!supabase) {
    return { error: null };
  }

  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error };
  }
};

/**
 * Get the current session
 * @returns {Promise<{data: {session: Object|null}, error: Error|null}>}
 */
export const getSession = async () => {
  if (!supabase) {
    return { data: { session: null }, error: null };
  }

  try {
    return await supabase.auth.getSession();
  } catch (error) {
    console.error('Get session error:', error);
    return { data: { session: null }, error };
  }
};

/**
 * Get the current user
 * @returns {Promise<{data: {user: Object|null}, error: Error|null}>}
 */
export const getUser = async () => {
  if (!supabase) {
    return { data: { user: null }, error: null };
  }

  try {
    return await supabase.auth.getUser();
  } catch (error) {
    console.error('Get user error:', error);
    return { data: { user: null }, error };
  }
};

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Callback function (event, session) => void
 * @returns {Object} Subscription object with unsubscribe method
 */
export const onAuthStateChange = (callback) => {
  if (!supabase) {
    // Return a no-op subscription
    return { data: { subscription: { unsubscribe: () => {} } } };
  }

  return supabase.auth.onAuthStateChange(callback);
};

/**
 * Get user display info from user object
 * @param {Object} user - Supabase user object
 * @returns {{name: string, email: string, avatar: string|null}}
 */
export const getUserDisplayInfo = (user) => {
  if (!user) {
    return { name: 'Guest', email: '', avatar: null };
  }

  const metadata = user.user_metadata || {};
  return {
    name: metadata.full_name || metadata.name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    avatar: metadata.avatar_url || metadata.picture || null,
  };
};

export default {
  supabase,
  isAuthAvailable,
  signInWithGoogle,
  signOut,
  getSession,
  getUser,
  onAuthStateChange,
  getUserDisplayInfo,
};
