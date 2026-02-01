# Auth Implementation

## What Was Implemented

Google OAuth authentication via Supabase, with portfolio sync on login.

### Auth Flow

```
1. User clicks "Sign in with Google"
         │
         ▼
2. signInWithGoogle() redirects to Google
         │
         ▼
3. Google consent → redirect to Supabase callback
         │
         ▼
4. Supabase exchanges code for JWT → stored in localStorage
         │
         ▼
5. AuthContext detects auth state change
         │
         ▼
6. Portfolio syncs from Supabase (or pushes local if newer)
         │
         ▼
7. Auto-refresh prices after 500ms delay
```

### Key Files

| File | Purpose |
|------|---------|
| `src/services/authService.js` | Supabase client, OAuth methods |
| `src/contexts/AuthContext.jsx` | Auth state provider |
| `src/components/auth/GoogleSignIn.jsx` | Sign-in button variants |
| `src/components/auth/UserMenu.jsx` | Avatar dropdown with sync status |

### Auth State Shape

```javascript
const { state, logout } = useAuth();
// state = {
//   isAuthenticated: boolean,
//   isAvailable: boolean,
//   isLoading: boolean,
//   displayInfo: { name, email, avatar }
// }
```

## Key Decisions

### 1. Supabase over Firebase

**Why Supabase?**
- PostgreSQL > Firestore for relational data
- Built-in Row Level Security
- Open source, no vendor lock-in
- Free tier is generous

**Trade-offs:**
- Smaller ecosystem than Firebase
- Less documentation

### 2. Google OAuth Only

**Why no email/password?**
- Simpler UX (one-click login)
- No password reset flows
- Google handles security
- Most users have Google accounts

**Future:**
- Could add GitHub OAuth for developers
- Apple Sign-In for iOS users

### 3. JWT in localStorage

**Why localStorage?**
- Supabase default behavior
- Persists across browser restarts
- Simple to implement

**Security considerations:**
- Vulnerable to XSS (but we control the code)
- httpOnly cookies would be more secure
- Acceptable for personal portfolio app

## What We Tried That Didn't Work

1. **Calling refreshAllPrices directly from login effect**
   - Problem: Function not defined yet (hoisting issue)
   - Solution: Use `shouldRefreshAfterLogin` flag + separate effect

2. **Immediate portfolio load after auth**
   - Problem: State not settled, caused race conditions
   - Solution: 500ms delay before auto-refresh

3. **Showing previous user's data after sign-out**
   - Problem: State not reset on logout
   - Solution: Reset to clean default state on sign-out

## Gotchas

1. **Login flow timing**
   - Data loads from Supabase first
   - 500ms delay before auto-refresh (lets state settle)
   - `shouldRefreshAfterLogin` flag bridges the async gap

2. **Redirect URL configuration**
   - Must match in both Google Cloud Console AND Supabase dashboard
   - Format: `https://<project>.supabase.co/auth/v1/callback`
   - Add localhost for development

3. **Test mode bypass**
   - `?test=true` query param bypasses auth for debugging
   - Useful for development without login flow

4. **Avatar dropdown position**
   - Opens upward (`bottom: 100%`) because avatar is in bottom-left sidebar
   - Standard dropdown would go off-screen

## Future Ideas

1. **Session refresh**
   - Automatically refresh JWT before expiry
   - Handle expired sessions gracefully

2. **Multiple auth providers**
   - GitHub OAuth for developers
   - Apple Sign-In for iOS users

3. **Account linking**
   - Link multiple OAuth providers to same account
   - Migrate between providers
