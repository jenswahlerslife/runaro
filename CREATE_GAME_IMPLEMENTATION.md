# Create Game Implementation - Complete

## 🎯 Feature Summary
Successfully implemented "Create Game" functionality for leagues with Free vs Pro plan rules, set initial status, and surfaced "Start game" CTA for all league members.

## 📋 Implementation Details

### ✅ Database Layer
**File:** `supabase/migrations/20250915160000_enhance_create_game_with_duration.sql`

- Enhanced `create_game` function to accept `p_duration_days` parameter
- Server-side plan validation:
  - **FREE plan**: Forces `duration_days = 14` (ignores client input)
  - **PRO plan**: Validates `duration_days` between 14-30 (inclusive), defaults to 14
- Backward compatibility maintained with overloaded function signatures
- Proper error handling with descriptive messages
- Security: `SECURITY DEFINER` with locked `search_path`

### ✅ API Layer
**File:** `src/lib/gamesApi.ts`

- Updated `createGame()` function to accept optional `durationDays` parameter
- Enhanced error handling for function-level errors
- Returns comprehensive game data including `duration_days`, `user_plan`, `status`

### ✅ UI Components

#### DurationSelector Component
**File:** `src/components/leagues/GameManagement.tsx`
- **Free plan**: Fixed UI showing "14 dage (Gratis)" (no editing)
- **Pro plan**: Dropdown selector with options 14-30 days
- Clear help text explaining plan restrictions

#### Create Game Flow
- Admin clicks "Create Game" button in league management
- Modal opens with:
  - Game name input
  - Duration selector (plan-dependent UI)
  - Create button with loading states
- Server-side validation enforces plan rules
- Success toast shows actual duration and status
- Automatic navigation to game setup page

#### Start Game CTA Implementation
**Locations implemented:**

1. **League Cards** (`src/pages/LeaguesPage.tsx`):
   - Shows "Start Game" button for ALL members when setup game exists
   - Priority logic: Setup game → Admin controls → Member view → Waiting state

2. **League Page** (`src/pages/LeagueMembers.tsx`):
   - Banner/section showing active game info
   - "Start game" button for setup games, "Gå til spillet" for active games
   - Navigates to appropriate page based on game status

3. **Game Management** (`src/components/leagues/GameManagement.tsx`):
   - Individual game cards show StartGameCta component
   - Only visible for setup status games
   - Includes Strava connection check

### ✅ Routing & Navigation
- League card click → `/leagues/:leagueId/members` (league page)
- Start Game CTA → `/games/:gameId/setup` (base selection)
- Game creation → automatic redirect to setup page

### ✅ Authorization & Security
- Server-side plan validation (never trust client)
- Admin-only game creation (league owner OR admin role)
- Minimum 2 approved members required
- Comprehensive RLS policies maintained

### ✅ Testing Coverage
**Files created:**
- `src/lib/gamesApi.test.ts` - Unit tests for API functions
- `src/components/leagues/GameManagement.test.tsx` - Component tests
- `src/components/leagues/StartGameCta.test.tsx` - CTA behavior tests
- `src/integration/createGame.integration.test.ts` - End-to-end flow tests

**Test scenarios covered:**
- Free plan duration enforcement (14 days fixed)
- Pro plan validation (14-30 days range)
- Boundary value testing (13, 14, 30, 31 days)
- Authorization failures (non-admin, insufficient members)
- UI state management (loading, error, success)
- Start Game CTA visibility rules

## 🚀 Usage Examples

### Free Plan League Admin
```typescript
// User sees fixed "14 dage (Gratis)" in modal
// Calls: createGame('league123', 'My Game', 30)
// Server enforces: duration_days = 14
// Result: Game created with 14 days duration
```

### Pro Plan League Admin
```typescript
// User selects 21 days from dropdown
// Calls: createGame('league123', 'Pro Game', 21)
// Server validates: 14 ≤ 21 ≤ 30 ✓
// Result: Game created with 21 days duration
```

### All League Members
- See "Start Game" button on league cards when setup game exists
- See game banner on league page with appropriate CTA
- Can navigate to game setup/play based on status

## 📊 Validation Results

### Server-side Validation
✅ Free + 30 days input → coerces to 14 days
✅ Pro + 13 days → 422 error with helpful message
✅ Pro + 31 days → 422 error with helpful message
✅ Pro + 14 days → Success
✅ Pro + 30 days → Success
✅ Non-admin → 403 Forbidden
✅ Unknown league → 404 Not Found
✅ < 2 members → 422 Validation Error

### UI/UX Validation
✅ Free plan shows fixed duration UI (no dropdown)
✅ Pro plan shows 14-30 day selector with default 14
✅ Clear help text explains plan limitations
✅ Start Game CTA visible to all members for setup games
✅ League card navigation works correctly
✅ Proper loading states and error handling

## 🔧 Installation & Deployment

### Database Migration
```bash
# Deploy the enhanced create_game function
npm run db:push
```

### Install Test Dependencies
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8 prettier
```

### Run Tests
```bash
npm run test                # All tests
npm run test:coverage       # With coverage report
npm run test:ui            # Visual test interface
```

## 🎉 Success Criteria Met

✅ **Admin can create game with plan-appropriate duration controls**
✅ **Free plan: fixed 14 days (no editing UI)**
✅ **Pro plan: 14-30 days inclusive, default 14**
✅ **Game created with status = "setup" and correct duration_days**
✅ **Start Game CTA visible to all league members**
✅ **League card navigation works correctly**
✅ **Server-side authorization and validation**
✅ **Comprehensive test coverage**
✅ **Graceful UI states (loading, success, failure)**
✅ **Follows repo patterns and conventions**

## 🛠️ Architecture Notes
- Leveraged existing subscription system and `get_user_plan()` function
- Maintained backward compatibility with existing `create_game` calls
- Reused existing UI components and styling patterns
- Followed established error handling and toast notification patterns
- Integrated seamlessly with existing game flow (setup → base selection → activation)

The implementation is production-ready and follows all specified requirements while maintaining the existing codebase's quality and patterns.