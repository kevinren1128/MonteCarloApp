# First-Time User Onboarding

## Overview

When a new user logs in for the first time (no portfolio data in the cloud), the app automatically shows the User Guide modal to help them get started.

## Implementation

### Detection Logic

A user is considered "first-time" when:
1. They just logged in (auth state changed to authenticated)
2. They have no positions saved in the cloud (server returns empty/null positions)
3. They haven't completed onboarding before (localStorage flag not set)

### Components

**`useFirstTimeUser` hook** (`src/hooks/useFirstTimeUser.js`)
- Manages onboarding state
- `shouldShowOnboarding` - true when guide should auto-open
- `completeOnboarding()` - marks onboarding as done (persists to localStorage)
- `triggerOnboardingCheck(serverData)` - called after login to check if first-time

**Storage key:** `factorsim-onboarding-completed` (defined in `src/constants/storage.js`)

### Flow

```
User logs in
    ↓
AuthContext SIGNED_IN event
    ↓
App.jsx loadServerData() fetches portfolio
    ↓
triggerOnboardingCheck(data) called
    ↓
If no positions AND not completed before:
    - shouldShowOnboarding = true
    - UserGuide modal auto-opens with welcome message
    ↓
User closes guide (or clicks "I'll explore on my own")
    ↓
completeOnboarding() called
    - Sets localStorage flag
    - Won't show again
```

### UserGuide Enhancements

The UserGuide component (`src/components/common/UserGuide.jsx`) now:
- Accepts `isFirstTime` prop
- Shows special welcome box for first-time users
- Has "See Recommended Workflow" and "I'll explore on my own" buttons
- Added Consensus tab documentation
- Updated workflow to include Consensus step

### Files Modified

- `src/constants/storage.js` - Added `ONBOARDING_COMPLETED` key
- `src/hooks/useFirstTimeUser.js` - New hook (created)
- `src/hooks/index.js` - Export new hook
- `src/App.jsx` - Integrated hook, auto-show logic
- `src/components/common/UserGuide.jsx` - Welcome UI, Consensus docs

## Testing

To test the onboarding flow:

1. Clear localStorage: `localStorage.removeItem('factorsim-onboarding-completed')`
2. Sign out if signed in
3. Sign in with a Google account that has no portfolio data
4. User guide should auto-open with welcome message

To reset for an existing user (for testing):
```javascript
// In browser console
localStorage.removeItem('factorsim-onboarding-completed');
// Then sign out and sign back in
```

## Future Improvements

- [ ] Add step-by-step interactive tour
- [ ] Track onboarding completion in Supabase (not just localStorage)
- [ ] Add onboarding progress indicator
- [ ] Allow users to re-trigger onboarding from settings
