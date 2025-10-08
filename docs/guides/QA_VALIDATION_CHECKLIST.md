# QA Validation Checklist - Game Duration System

## ✅ Backend Validation (COMPLETED)

### Database Schema
- ✅ `games` table has `duration_days`, `activated_at`, `winner_user_id` columns  
- ✅ All RPC functions deployed and functional:
  - `maybe_activate_game(uuid)` 
  - `start_game(uuid, int)`
  - `finish_game(uuid)`
  - `get_game_overview(uuid)`
  - `get_player_game_stats(uuid, uuid)`

### Edge Functions  
- ✅ `finish-due-games` deployed and active
- ✅ CRON_SECRET configured for security
- ✅ Cloudflare Worker cron job deployed (every 5 minutes)

### Subscription Integration
- ✅ Subscription schema validated (`subscribed`, `subscription_tier`)
- ✅ RPC functions use correct subscription columns
- ✅ Free users: max 14 days, Pro users: max 30 days

## 🔍 Frontend Validation (TO VERIFY)

### Development Server Running
- ✅ Server: http://localhost:8080
- ✅ No build errors

### Key Components to Test

#### 1. League Management (`/leagues`)
**What to test:**
- [ ] Create new league
- [ ] Navigate to league details
- [ ] See "Game Management" section
- [ ] Create new game button works

#### 2. Game Creation Flow
**What to test:**
- [ ] "Create New Game" dialog opens
- [ ] Game name input works
- [ ] Duration selector shows (14-30 days for pro, 14 max for free)
- [ ] Subscription gating works (test with different subscription tiers)
- [ ] "Start spillet" button appears after game creation
- [ ] Duration selector in start dialog

#### 3. Game Page (`/games/:gameId`)
**What to test:**
- [ ] Game overview loads with new RPC data
- [ ] Duration displayed correctly
- [ ] Status shows: setup → active → finished progression
- [ ] Countdown timer works (real-time updates)
- [ ] Member count vs base count displayed
- [ ] Leaderboard shows area_km2 data
- [ ] Real-time updates when players join/leave

#### 4. Activity Selection for Base (`/activities?game=:id&selectBase=1`)
**What to test:**  
- [ ] Game context displayed in header
- [ ] "Set as Base" buttons visible on activities
- [ ] Base selection triggers game activation check
- [ ] Redirect to game page after base selection

#### 5. Real-time Features
**What to test:**
- [ ] Countdown timer updates every second
- [ ] Game status changes reflected immediately
- [ ] Player count updates when someone joins
- [ ] Leaderboard updates with territory changes

## 🧪 End-to-End User Flows

### Flow 1: Complete Game Creation (Free User)
1. [ ] Login as free user
2. [ ] Create league
3. [ ] Create game with 14-day duration
4. [ ] Try 21-day duration (should fail)
5. [ ] Start game successfully
6. [ ] Set base activity
7. [ ] Verify game activates when all players have base

### Flow 2: Complete Game Creation (Pro User)  
1. [ ] Login as pro user (or upgrade subscription)
2. [ ] Create league
3. [ ] Create game with 30-day duration
4. [ ] Try 31-day duration (should fail)
5. [ ] Start game successfully
6. [ ] Verify pro features work

### Flow 3: Game Lifecycle
1. [ ] Create game → status: setup
2. [ ] All players set base → status: active
3. [ ] Wait for end_date → status: finished (cron job)
4. [ ] Winner selected based on territory

## 🔧 Technical Validation

### API Endpoints
- [ ] `rpcStartGame()` returns subscription info
- [ ] `rpcGetGameOverview()` returns complete game state  
- [ ] Real-time subscriptions work on GamePage
- [ ] Error handling for invalid durations

### Performance
- [ ] Page loads quickly with new RPC calls
- [ ] Real-time updates don't cause excessive API calls
- [ ] Countdown timer performs smoothly

### Security
- [ ] Only league admins can start games
- [ ] Subscription limits enforced correctly
- [ ] User cannot manipulate duration client-side

## 🚨 Known Issues to Watch For
- [ ] Danish characters in database (fixed in migration)
- [ ] Game status constraints (only: setup, active, finished)
- [ ] Subscription table unique constraints
- [ ] Profile vs User ID mapping in RPC functions

## 📝 Manual Testing Notes

**Environment:** Development (localhost:8080)
**Date:** 2025-09-13
**Tester:** Claude Code

**Testing Steps:**
1. Open browser to localhost:8080
2. Test each flow systematically
3. Note any UI/UX issues
4. Verify subscription gating works
5. Test real-time updates with multiple browser tabs
6. Confirm countdown timer accuracy

---

## ✅ DEPLOYMENT STATUS SUMMARY

All backend systems are fully deployed and functional:
- Database migration: ✅ DEPLOYED
- RPC functions: ✅ DEPLOYED  
- Edge function: ✅ DEPLOYED
- Cron job: ✅ DEPLOYED (every 5 minutes)
- Frontend API integration: ✅ IMPLEMENTED

**Next Steps:** Manual UI testing to verify end-user experience.