# Jannah Garden - V1 Launch Roadmap

*Created: February 5, 2026*  
*Last Updated: February 14, 2026*  
*Target Launch: February 17, 2026 (1 day before Ramadan)*  
*Days Remaining: 3 days*

---

## 📚 HOW TO USE THIS FILE

**This is your ONLY roadmap file.** All other .md files have been deleted.

**When you're ready to work:**
1. Scroll to the next uncompleted task
2. Read the task description
3. Copy the 🚀 prompt at the bottom
4. Paste it in the chat
5. I'll implement everything for that task
6. Test it
7. Move to next task

**Example:**
```
You: "Implement Task 2.1: Garden Expansion"
Me: [Builds garden expansion with all the steps listed]
You: "Working! Next task"
You: "Implement Task 2.2: Dead Tree Claiming"
```

---

## 📊 CURRENT STATUS ANALYSIS

### ✅ COMPLETED (MVP + Day 1 - 5 days total)

**MVP (Feb 1-4)**:
- ✅ Prayer time windows (active/grace/missed states)
- ✅ XP earning system (+5 on-time, +3 in grace)
- ✅ Tree growth (4 stages: 0-99, 100-299, 300-599, 600+)
- ✅ Prayer completion notifications
- ✅ Grace period warning notifications
- ✅ Rest Period (menstruation feature)
- ✅ Simple 3-screen onboarding (name, location, notifications)
- ✅ Basic UI with pixel art prayer icons
- ✅ Haptic feedback on prayer completion
- ✅ XP popup animation

**Day 1 (Feb 5-6)** ← JUST FINISHED:
- ✅ Per-prayer streaks (5 separate instead of 1 global)
- ✅ Coin economy foundation (earn coins for prayers, +2 base, +10 bonus for all 5, +50/+200 milestones)
- ✅ Configurable grace period (15/30/45/60 min user choice with settings modal)
- ✅ Per-prayer streak display (each prayer shows its own streak count)
- ✅ Coin badge in top bar (🪙)
- ✅ Settings modal (gear icon) with grace period picker + streak breakdown

### ❌ REMAINING FOR V1

**Critical Core Features**:
1. ❌ Garden expansion system (5×5 → 7×7 → 9×9 → 11×11)
4. ❌ Dead tree claiming + tree planting
5. ❌ Coin economy (earning + spending)
6. ✅ Shop system (trees, streak freezes, themes)
7. ✅ Streak freeze mechanic
8. ❌ Consistency multiplier (1.0× → 2.0× for perfect days)
9. ✅ Difficult Day mode (3 uses/month)

**Monetization Features**:
10. ✅ Premium subscription ($6.99/month)
11. ❌ IAP coin purchases
12. ❌ Premium-gated features (unlimited garden, 2× coins, etc.)

**Engagement Features**:
13. ❌ Prayer history & stats dashboard
14. ✅ Weekly challenges system
15. ✅ Ramadan special mode (2× XP, special content)

**Polish Features**:
16. ❌ Enhanced animations (tree sparkles, confetti, better XP)
17. ❌ Settings screen (grace period, notifications, profile)
18. ❌ Cloud backup system

- ✅ Two-finger rotation gesture (Garden view): two-finger twist to rotate the isometric view in 90° increments (visual projection only; game logic unchanged)

---

## 🎯 V1 FEATURE PRIORITY (Based on FEATURES_OVERVIEW.md)

### TIER 1: MUST-HAVE FOR LAUNCH (Core differentiators)
These define the product and can't be cut:
1. Per-prayer streaks (5 separate)
2. Coin economy + shop
3. Garden expansion tiers
4. Dead tree claiming
5. Premium subscription
6. Configurable grace period

### TIER 2: HIGH-VALUE (Strong engagement/monetization)
Important but could be v1.1 if time runs out:
7. Consistency multiplier
8. ✅ Streak freeze mechanic
9. ✅ Difficult Day mode
10. Weekly challenges
11. Ramadan mode

### TIER 3: POLISH (Nice-to-have)
Can ship without these:
12. Prayer history/stats
13. Enhanced animations beyond current
14. Cloud backup
15. Settings screen improvements

---

## 🚀 12-DAY IMPLEMENTATION PLAN

**Your speed**: MVP (estimated 15-20 hours) done in 4 days = ~5 hours/day = You work 3-4× faster than my estimates

**Available**: Feb 5-17 = 12 days × 5 hours = 60 hours total

---

## DAY 1-2: Core Systems Overhaul (12 hours)

### Task 1.1: Switch to Per-Prayer Streaks (6 hours)
**Current**: Single global streak  
**Target**: 5 independent streaks (Fajr, Dhuhr, Asr, Maghrib, Isha)

**Files**: `App.tsx`, `hooks/usePrayerState.ts` (refactor), `components/TopInfoBar.tsx`

**Steps**:
1. Replace `streak` state with `streaks` object:
   ```typescript
   {
     Fajr: 12,
     Dhuhr: 15,
     Asr: 8,
     Maghrib: 20,
     Isha: 14
   }
   ```
2. Update AsyncStorage keys:
   - `@GrowPray:streak_Fajr`
   - `@GrowPray:streak_Dhuhr`
   - etc.
3. Update `togglePrayerCompleted()` to increment specific prayer streak
4. Update midnight check to validate each prayer independently
5. Update TopInfoBar to show highest streak OR expandable view showing all 5
6. Update notifications to reference specific prayer streaks

**Test**: Complete Fajr → Fajr streak goes to 1. Miss Dhuhr → Dhuhr streak stays 0, Fajr unaffected.

✅ **STATUS: COMPLETED** (Feb 6)

---

### Task 1.2: Coin Economy Foundation (4 hours)
**Current**: No coins  
**Target**: Earn coins for prayers, store balance

**Files**: `App.tsx`, new `hooks/useCoinSystem.ts`

**Steps**:
1. Add `coins` state (AsyncStorage: `@GrowPray:coins`)
2. Create `earnCoins(amount, reason)` function
3. Earning logic:
   - Complete any prayer: +2 coins (base)
   - Complete all 5 prayers in one day: +10 coins (bonus)
   - 7-day streak milestone (per prayer): +50 coins
   - 30-day streak milestone (per prayer): +200 coins
4. Add coin badge to TopInfoBar (show balance: "🪙 245")
5. Add floating "+10 🪙" animation on earning

**Test**: Complete all 5 prayers → Earn 20 coins (2×5 + 10 bonus)

✅ **STATUS: COMPLETED** (Feb 6)

---

### Task 1.3: Configurable Grace Period (2 hours)
**Current**: Fixed 30 minutes  
**Target**: User chooses 15/30/45/60 min

**Files**: `App.tsx`, `components/SettingsModal.tsx` (new)

**Steps**:
1. Add AsyncStorage: `@GrowPray:gracePeriodMinutes` (default 30)
2. Create simple settings modal (accessed from top-right gear icon)
3. Grace period picker: Radio buttons for 15/30/45/60
4. Update `getPrayerWindowStatus()` to use user's chosen grace period
5. Show selected grace period in settings

**Test**: Set 60 min grace → Complete prayer 45 min after window → Get grace XP (3)

✅ **STATUS: COMPLETED** (Feb 6)

---

## DAY 2-3: Garden Expansion + Dead Trees (12 hours)

### ✅ Task 2.1: Garden Expansion (5 hours) — DONE
**Current**: Fixed grid
**Target**: Organic tile-by-tile recovery from center outward, dynamic grid expansion

**Implemented**:
- Ring-based tile recovery order (cross-first, then corners per ring)
- Two-phase tile recovery: Dead → Recovering → Recovered
- Quadratic XP cost formula: `tileCost(n) = floor(10 + n² * 0.3)`
- Dynamic grid sizing (11→21) at 80% threshold
- Skip recovery with coins (tap recovering tile)
- Dead tree removal for coins (tap dead tree on recovering tile)
- Grid expansion celebration modal

✅ **STATUS: COMPLETED**

---

### ✅ Task 2.2: Dead Tree Claiming + Tree Planting (7 hours) — DONE
**Current**: Dead trees removed for coins only
**Target**: Plant trees on cleared recovered tiles

**Implemented**:
- Dead trees tappable on recovering tiles → removal for +5 coins
- Recovered tiles (with dead tree removed) tappable → plant tree modal
- PlantedTree data persisted in AsyncStorage (type + XP at planting)
- Planted trees rendered in GardenScene at correct isometric positions
- Planted trees grow through 4 stages based on XP earned since planting
- Basic tree type available for free (shop will add more types)
- `useGardenState` hook handles planting logic with `plantTree()` and `getPlantedTree()`

**Flow**:
1. Tile is dead + has dead tree
2. XP → tile becomes recovering → dead tree tappable → dig up for coins
3. More XP → tile becomes recovered
4. Tap recovered tile → "Plant a Tree?" modal → Plant!
5. Tree starts as sapling → grows with XP

✅ **STATUS: COMPLETED**

---

### Task 2.3: Garden Decay System (6 hours)
**Current**: Once tiles are recovered, they stay green forever. No consequences for inactivity.
**Target**: Tiles decay back to dead when user stops praying. Planted trees wither and eventually die.

**Files**: `hooks/useGardenState.ts`, `App.tsx`

**Motivation**: Create urgency to return and pray. Without decay, once your garden is built, you can abandon the app with no consequences. This mechanic:
- Makes expensive trees feel valuable (fear of losing investment)
- Gives meaning to streak freezes (protect tiles → protect trees)
- Drives daily engagement through loss aversion (strongest motivator)

**Steps**:

1. **Track last XP gain timestamp**:
   - Add `lastXPGainTimestamp` to AsyncStorage (`@GrowPray:lastXPGainTimestamp`)
   - Update on every XP gain (prayer completion)
   - Calculate days since last activity: `daysSinceLastXP = (Date.now() - lastXPGainTimestamp) / (1000 * 60 * 60 * 24)`

2. **Tile decay formula**:
   - After 2 days of no XP: Outer ring tiles start reverting (recovered → recovering)
   - After 4 days: Outer ring becomes dead, next ring starts reverting
   - After 7 days: All non-center tiles are dead (garden returns to starting 5-tile cross)
   - Formula: `decayRings = Math.floor(daysSinceLastXP / 2)` — each 2 days, lose 1 ring
   - Center 5 tiles (initial cross) are protected — never decay

3. **Update getTileState() to factor in decay**:
   ```typescript
   getTileState(row, col, currentXP, daysSinceLastXP) {
     const key = `${row},${col}`;
     
     // Initial 5 tiles never decay
     if (initialRecoveredSet.has(key)) return 'recovered';
     
     // Calculate tile's ring distance from center
     const center = Math.floor(MAX_GRID_SIZE / 2);
     const ringDistance = Math.max(Math.abs(row - center), Math.abs(col - center));
     
     // Calculate how many outer rings have decayed
     const decayRings = Math.floor(daysSinceLastXP / 2);
     
     // If this tile is in a decayed ring → force dead
     if (ringDistance > (maxRingReached - decayRings)) {
       return 'dead';
     }
     
     // Otherwise use XP-based state (existing logic)
     if (gardenData.tileOverrides[key]) return gardenData.tileOverrides[key];
     return tileStatesFromXP.get(key) || 'dead';
   }
   ```

4. **Tree withering on dead tiles**:
   - Add `plantedTreeStates` to track withering: `{ "row,col": { witheredStage: 2, witherStartTimestamp: 1234567890 } }`
   - When a tile with a planted tree becomes dead:
     - Tree loses 1 growth stage per day tile is dead
     - Start from current stage → wither back: flourishing → grown → growing → sapling
   - If tile stays dead after tree reaches sapling → becomes dead tree (PlantedTree removed, dead tree appears)
   - User must earn XP to recover tile again to save the tree

5. **Visual feedback for withering**:
   - In GardenScene, when rendering planted trees on dead tiles:
     - Calculate withered stage: `currentStage - Math.floor(daysTileDead)`
     - Clamp to sapling minimum (stage 0)
     - Grey out or add visual indicator (dead tree color overlay)
   - Add tooltip/indicator: "⚠️ Tree is withering! Pray to restore this tile."

6. **Grace period for small lapses**:
   - First 1 day of inactivity: No decay (forgiveness window)
   - Day 2+: Decay starts
   - This prevents punishing users who miss just one day

7. **Decay prevention mechanics** (future integration points):
   - Streak freezes: Could extend to preventing tile decay for X days
   - Premium: Slower decay rate (3 days per ring instead of 2)
   - Difficult day: Pauses decay during marked period

**Test**: 
- Complete prayers → Plant Cherry Blossom tree → Simulate 4 days no XP (adjust lastXPGainTimestamp in AsyncStorage) → Tile reverts to dead → Tree withers by 2 stages → Simulate 2 more days → Tree becomes dead tree again

✅ **STATUS: COMPLETED**

**Implemented**:
- `lastXPGainTimestamp` tracked in GardenData, auto-updated when XP increases
- 1-day grace period before decay starts
- Ring-by-ring decay: every 2 days of inactivity, outermost ring dies
- Partial decay: recovered tiles demote to recovering as warning before dying
- Center cross (initial 5 tiles) protected — never decay
- `maxRingReached` computed from XP to determine decay scope
- Planted trees on decayed tiles show withered visual (grey tint + 50% opacity)
- Trees survive decay (not removed) — recover tile to restore them
- `isDecaying` and `daysSinceLastXP` exposed for UI indicators
- Migration: existing users default to no decay until they stop praying

---

## DAY 4-5: Shop System (12 hours)

### Task 3.2: Shop UI + Trees Tab (6 hours)
**Current**: No shop  
**Target**: Modal shop with tabs: Trees | Streak Freezes | Boosts

✅ **STATUS: COMPLETED** (Feb 14)

**Files**: `screens/ShopScreen.tsx`, `App.tsx`

**Steps**:
1. Create shop modal (button in TopInfoBar)
2. Tab navigation: Trees (active) | Streak Freezes | Boosts (coming soon)
3. **Trees Tab**:
   - Common trees (50 coins):
     - Palm Tree (already have asset)
     - Oak Tree (need asset or reuse growing tree with different color)
     - Willow Tree (need asset)
   - Rare trees (200 coins):
     - Cherry Blossom (need asset)
     - Maple Tree (need asset)
   - Premium trees (Premium-only):
     - Golden Tree (need asset or recolor)
     - Cedar Tree (need asset)
4. Purchase flow:
   - Show preview (all 4 growth stages)
   - "Buy for 50 🪙" button
   - Deduct coins → Add to inventory
   - Show "Added to inventory!" toast
5. Display owned count: "Oak Tree (You own: 2)"

**Design note**: Assets can be recolored versions of existing trees if time is tight.

**Test**: Buy Oak tree for 50 coins → Inventory shows Oak: 1 → Can plant in claimed dead tree spot

🚀 **TO START THIS TASK, SAY:**  
```
Implement Task 3.2: Shop UI + Trees
```

---

### Task 3.3: Streak Freeze Shop + Mechanic (6 hours)
**Current**: No streak protection  
**Target**: Buy freezes, auto-protect streak when missed

✅ **STATUS: COMPLETED** (Feb 14)

**Files**: `ShopScreen.tsx`, `App.tsx`, `hooks/useStreakFreezes.ts`

**Steps**:
1. **Streak Freezes Tab**:
   - Single Prayer Freeze: 50 coins (protect one prayer's streak)
   - All Prayers Freeze: 150 coins (protect all 5 for one day)
2. Purchase adds to inventory: `streakFreezes = { single: 3, all: 1 }`
3. **Freeze usage logic**:
   - When user misses a prayer at midnight check:
     - Show prompt: "Use Streak Freeze? (You have 2 single freezes)"
     - Options: "Use Freeze" | "Let it Break"
     - If use: Deduct freeze, maintain streak, show "Streak Protected! 🛡️"
     - If let break: Streak → 0
4. Show freeze count in TopInfoBar: "🛡️ 2" (tap to see details)

**Test**: Buy single freeze → Miss Fajr → Prompt appears → Use freeze → Fajr streak maintained

🚀 **TO START THIS TASK, SAY:**  
```
Implement Task 3.3: Streak Freezes
```

---

## DAY 6-7: Premium + Monetization (12 hours)

### Task 4.2: Premium Subscription Setup (8 hours)
**Current**: No monetization  
**Target**: Working subscription with RevenueCat/Expo IAP

✅ **STATUS: COMPLETED** (Feb 14)

**Files**: `utils/premiumManager.ts`, `screens/PaywallScreen.tsx`, `App.tsx`

**Steps**:
1. Install: `expo-in-app-purchases` or `react-native-purchases` (RevenueCat)
2. Configure:
   - App Store Connect: Create subscription (Monthly $6.99, Yearly $44.99)
   - RevenueCat dashboard setup (if using)
   - Link app bundle ID
3. Create `PremiumManager`:
   ```typescript
   checkPremiumStatus() // Returns true/false
   purchaseSubscription(packageId)
   restorePurchases()
   ```
4. Build Paywall screen:
   - Trigger when:
     - User reaches 7×7 garden at 500 XP
     - User taps premium tree in shop
     - User taps "Go Premium" in settings
   - Show comparison:
     ```
     FREE              PREMIUM
     7×7 garden        Unlimited garden
     1× coins          2× coins
     3 Difficult Days  10 Difficult Days
     No freezes        3 free freezes/month
     Common trees      + Premium trees
     ```
   - Buttons: "Start Free Trial" (7 days) | "Subscribe $6.99/mo"
   - "Restore Purchases" link
5. Integrate premium checks throughout app:
   - Garden expansion beyond 7×7
   - Shop: Premium tree section
   - Coin earning: Multiply by 2 if premium
   - Streak freezes: Add 3 free on 1st of month

**Test**: Purchase premium → Garden expands past 7×7 → Coins earn at 2× rate

🚀 **TO START THIS TASK, SAY:**  
```
Implement Task 4.2: Premium Subscription
```

---

### Task 4.3: IAP Coin Purchases (4 hours)
**Current**: Coins only earned  
**Target**: Can also buy coins

✅ **STATUS: COMPLETED** (Feb 15)

**Files**: `ShopScreen.tsx`, `utils/iapManager.ts`

**Steps**:
1. Add "Coins" tab to shop
2. Packages:
   - Handful: 500 coins - $0.99
   - Pouch: 1,500 coins - $2.99
   - Chest: 5,000 coins - $7.99
   - Treasury: 12,000 coins - $14.99
3. Configure as consumable IAPs in App Store Connect
4. Purchase flow:
   - User taps package
   - Payment prompt via Expo IAP
   - On success: Credit coins + show "🪙 +500 coins!"
   - Handle errors gracefully
5. Receipt validation (RevenueCat handles this automatically)

**Test**: Buy Pouch → $2.99 charged → Coins balance +1500

🚀 **TO START THIS TASK, SAY:**  
```
Implement Task 4.3: IAP Coin Purchases
```

---

## DAY 8: Advanced Mechanics (6 hours)

### Task 5.2: Consistency Multiplier (3 hours)
**Current**: Flat XP earning  
**Target**: Bonus XP for consecutive perfect days

✅ **STATUS: COMPLETED** (Feb 15)

**Files**: `App.tsx`, `hooks/useConsistencyMultiplier.ts`

**Steps**:
1. Track `perfectDays` (consecutive days with all 5 prayers completed)
2. Calculate multiplier:
   ```typescript
   0-6 days:   1.0×
   7-13 days:  1.25×
   14-29 days: 1.5×
   30-59 days: 1.75×
   60+ days:   2.0× (max)
   ```
3. Apply to XP: `finalXP = baseXP * multiplier`
4. Show multiplier badge in TopInfoBar: "⚡ 1.5×"
5. Show in XP popup: "+5 XP × 1.5 = +7.5 XP"
6. Reset `perfectDays` to 0 if any prayer missed

**Test**: Complete all 5 prayers for 7 days → Multiplier → 1.25× → Earn 6.25 XP per prayer

🚀 **TO START THIS TASK, SAY:**  
```
Implement Task 5.2: Consistency Multiplier
```

---

### Task 5.3: Difficult Day Mode (3 hours) ✅ COMPLETED (Feb 15)
**Current**: Fixed grace period  
**Target**: Special mode with 2-hour grace for tough days

**Files**: `App.tsx`, `hooks/useDifficultDay.ts`, `components/DifficultDayModal.tsx`

**Steps**:
1. Add "Difficult Day" button in settings
2. State: `difficultDayActive`, `difficultDayUsesThisMonth`
3. Limits:
   - Free users: 3 uses per month
   - Premium users: 10 uses per month
4. When activated:
   - Grace period extends to 2 hours for ALL prayers today
   - XP penalty: 50% (earn 2.5 XP in grace instead of 3)
   - Badge in TopInfoBar: "🌙 Difficult Day Active"
   - Auto-deactivates at midnight
5. Reset uses on 1st of month
6. Confirmation modal: "Use Difficult Day? (X uses left this month)"

**Test**: Activate Difficult Day → Complete prayer 90 min after window → Still valid → Earn 2.5 XP

🚀 **TO START THIS TASK, SAY:**  
```
Implement Task 5.3: Difficult Day Mode
```

---

## DAY 9-10: Engagement Features (6 hours)

### Task 6.2: Weekly Challenges (4 hours) ✅ COMPLETED (Feb 15)
**Current**: No challenges  
**Target**: 4 weekly goals with coin rewards

**Files**: `screens/ChallengesScreen.tsx`, `hooks/useChallenges.ts`, `App.tsx`

**Steps**:
1. Add "Challenges" button in TopInfoBar or new bottom tab
2. Weekly challenges (reset every Monday):
   - **Perfect Week**: Complete all 35 prayers → +200 coins
   - **Dawn Warrior**: Complete Fajr 7 days straight → +100 coins
   - **On-Time Master**: No grace period all week → +150 coins
   - **Tree Planter**: Plant 3 new trees → +50 coins
3. Track progress:
   ```typescript
   challenges = {
     perfectWeek: { progress: 25, target: 35, completed: false },
     dawnWarrior: { progress: 5, target: 7, completed: false },
     ...
   }
   ```
4. Show progress bars for each challenge
5. "Claim Reward" button when complete → Credit coins

**Test**: Complete 35 prayers in one week → "Claim Reward" appears → +200 coins

🚀 **TO START THIS TASK, SAY:**  
```
Implement Task 6.2: Weekly Challenges
```

---

### Task 6.3: Ramadan Mode (2 hours) ✅ COMPLETED (Feb 15)
**Current**: No special events  
**Target**: 2× XP during Ramadan

**Files**: `App.tsx`, `hooks/useRamadanMode.ts`

**Steps**:
1. Detect Ramadan dates (hardcode 2026: Feb 18 - Mar 19)
2. When Ramadan active:
   - Apply 2× XP multiplier (stacks with consistency multiplier)
   - Show banner in TopInfoBar: "🌙 Ramadan Kareem - 2× XP!"
   - Special notification: "Ramadan Mubarak! Earn double XP this month"
3. Optionally: Add special Ramadan tree in shop
4. Auto-disable after Ramadan ends

**Test**: During Feb 18-Mar 19 → Earn 10 XP per prayer (5 base × 2 Ramadan bonus)

🚀 **TO START THIS TASK, SAY:**  
```
Implement Task 6.3: Ramadan Mode
```

---

## DAY 10-11: Polish & Settings (5 hours)

### Task 7.2: Enhanced Settings Screen (3 hours) ✅ COMPLETED (Feb 16)
**Current**: Minimal settings  
**Target**: Full settings with customization

**Files**: `screens/SettingsScreen.tsx`, `App.tsx`

**Steps**:
1. Create full settings modal:
   - **Account**: Display name, email (if cloud sync added)
   - **Prayer Settings**:
     - Grace period: 15/30/45/60 min selector
     - Prayer calculation method (if multiple methods supported)
   - **Notifications**:
     - Toggle per prayer (Fajr on/off, Dhuhr on/off, etc.)
     - Toggle grace warnings
     - Toggle streak risk alerts
   - **Appearance**:
     - Dark mode (current) / Light mode toggle
     - Show current theme
   - **Premium**:
     - "Go Premium" button (if free)
     - "Manage Subscription" (if premium)
   - **About**:
     - App version
     - Terms of Service link
     - Privacy Policy link
     - "Contact Support" email link
   - **Danger Zone**:
     - "Reset All Progress" button (with confirmation)
     - "Delete Account" (if cloud sync added)
2. Save all settings to AsyncStorage
3. Apply settings throughout app

**Test**: Change grace period to 60 min → Toggle Fajr notifications off → Settings persist

🚀 **TO START THIS TASK, SAY:**  
```
Implement Task 7.2: Enhanced Settings
```

---

### Task 7.3: Visual Polish (2 hours) ✅ COMPLETED (Feb 16)
**Current**: Basic animations  
**Target**: Enhanced polish

**Files**: `App.tsx`, `components/*.tsx`

**Steps**:
1. Improve XP popup:
   - Add scale bounce animation
   - Add slight rotation
   - Better particle burst
2. Add tree level-up celebration:
   - Sparkle particles around tree
   - Screen flash (very subtle)
   - Confetti rain (simple dots)
3. Add coin earn animation:
   - "+200 🪙" floats up from prayer icon
   - Coin badge pulses briefly
4. Add streak milestone celebration:
   - At 7/30/100 days: Full-screen modal
   - Show trophy icon + streak count
   - "+50 coins bonus!" text
5. Add haptic feedback throughout:
   - Medium impact on level-up
   - Light impact on coin earn
   - Success notification on milestone

**Test**: Reach 100 XP → Tree grows with sparkles → Screen flashes briefly

🚀 **TO START THIS TASK, SAY:**  
```
Implement Task 7.3: Visual Polish
```

---

## DAY 11-12: Testing & Launch Prep (5 hours)

### Task 8.2: Comprehensive Testing (3 hours)
**Test ALL features systematically**:

**Prayer System**:
- [ ] Complete prayer during active window → Earn 5 XP, increment streak
- [ ] Complete prayer during grace → Earn 3 XP, increment streak
- [ ] Miss prayer → Streak breaks at midnight
- [ ] Miss one prayer → Other 4 streaks unaffected
- [ ] All 5 prayers in one day → +10 coin bonus

**Garden System**:
- [ ] Reach 500 XP → Garden expands to 7×7
- [ ] Try to expand beyond 7×7 without premium → Paywall appears
- [ ] Tap dead tree → Claim modal opens
- [ ] Plant tree → Tree appears as sapling
- [ ] Planted tree grows with XP

**Economy**:
- [ ] Earn coins from prayers
- [ ] Buy tree from shop → Deduct coins, add to inventory
- [ ] Buy streak freeze → Deduct coins
- [ ] Miss prayer with freeze → Prompt appears → Use freeze → Streak maintained

**Premium**:
- [ ] Purchase subscription → Premium status granted
- [ ] Expand garden beyond 7×7 as premium
- [ ] Earn 2× coins as premium
- [ ] Access premium trees in shop

**Mechanics**:
- [ ] Complete all 5 prayers for 7 days → Consistency multiplier 1.25×
- [ ] Activate Difficult Day → Grace extends to 2 hours
- [ ] Weekly challenge completion → Claim coins

**Edge Cases**:
- [ ] Midnight rollover → Missed prayers detected → Streaks break correctly
- [ ] Rest Period active → Streaks freeze → No penalties
- [✅] Ramadan mode → 2× XP active
- [ ] App backgrounding/foregrounding → State persists
- [ ] No internet → App still functional (offline)

---

### Task 8.3: App Store Preparation (2 hours)
**Files**: `app.json`, App Store Connect

**Steps**:
1. **App Store Connect Setup**:
   - Create app listing
   - Configure subscriptions (Monthly $6.99, Yearly $44.99)
   - Configure IAP coin packages
   - Set up sandbox test users
2. **Assets**:
   - App icon (1024×1024)
   - Screenshots (6.5" iPhone: 5-6 screens)
   - Preview video (optional, 30 sec)
3. **Metadata**:
   - Title: "Jannah Garden - Prayer Tracker"
   - Subtitle: "Build a garden through prayer"
   - Keywords: prayer, islam, muslim, habit, tracker, garden, streak
   - Description: Write compelling 2-paragraph description
   - Privacy Policy URL: Create simple page
   - Support URL: Create contact page
4. **Version Info**:
   - Version: 1.0.0
   - What's New: "Initial launch"
5. **Submit for Review**:
   - Upload build via Xcode/EAS
   - Fill all required info
   - Submit (2-3 day review typically)

---

## 📋 FINAL V1 FEATURE CHECKLIST

### ✅ Tier 1 - MUST HAVE
- [✅] Per-prayer streaks (5 separate) ← DONE
- [✅] Configurable grace period (15/30/45/60) ← DONE
- [✅] Coin economy (earn + spend) ← DONE
- [✅] Shop (trees + streak freezes)
- [✅] Garden expansion tiers (5×5 → 7×7 → 9×9 → 11×11)
- [✅] Dead tree claiming + planting
- [✅] Premium subscription ($6.99/mo)
- [✅] IAP coin purchases

### ✅ Tier 2 - HIGH VALUE (If time permits)
- [✅] Consistency multiplier
- [✅] Difficult Day mode
- [✅] Weekly challenges
- [✅] Ramadan mode (2× XP)
- [✅] Enhanced settings

### ⏸️ Tier 3 - DEFERRED TO V1.1
- [ ] Prayer history/stats dashboard (Premium feature)
- [ ] Cloud backup/sync
- [ ] Eid celebration events
- [ ] Daily hadith / Meditation spot
- [ ] Monthly chronicle PDF
- [ ] Tile themes/decorations
- [ ] Social features (friends, leaderboards)

---

## 🎯 REALISTIC OUTCOMES

### BEST CASE (12 hours/day, all goes smoothly)
- Complete all Tier 1 + Tier 2 features
- Launch Feb 17 with full V1
- 15+ complete features from FEATURES_OVERVIEW.md

### LIKELY CASE (5-6 hours/day, normal pace)
- Complete all Tier 1 features
- 2-3 Tier 2 features (prioritize multiplier + challenges)
- Launch Feb 16-17 with strong V1
- Ship remaining Tier 2 as v1.1 update post-launch

### WORST CASE (blockers occur)
- Complete Tier 1 minus premium (if IAP issues)
- Launch Feb 18 (Ramadan day 1) with core features
- Add monetization as urgent v1.1 within 1 week

---

## 💡 PRO TIPS FOR SUCCESS

1. **Don't reinvent assets**: Recolor existing trees instead of creating 20 new ones
2. **Use Expo IAP**: Easier than RevenueCat for first launch
3. **Hardcode Ramadan dates**: Don't waste time on Islamic calendar API
4. **Skip cloud sync for V1**: Huge time sink, do in v1.2
5. **Minimal settings**: Don't build elaborate settings UI, keep it simple
6. **Test incrementally**: Run app after every major task completion
7. **Document as you go**: Note any bugs/issues in a separate file for post-launch fixes
8. **Prepare App Store before Day 12**: Do screenshots/description in parallel

---

## 🚀 LAUNCH TIMELINE

- **Feb 5-16**: Development (12 days)
- **Feb 17**: Final testing + app submission
- **Feb 18**: RAMADAN STARTS - Soft launch to friends/family (TestFlight)
- **Feb 19-21**: App Store review (typically 2-3 days)
- **Feb 22**: Public launch 🎉

---

## 🎮 NEXT IMMEDIATE ACTION

✅ **Day 1 COMPLETE!** You finished:
- Per-prayer streaks
- Coin economy  
- Configurable grace period

✅ **Day 2 - Task 2.1 COMPLETE!** You finished:
- Organic tile-by-tile recovery system
- Dynamic grid expansion at 80% threshold
- Skip recovery with coins
- Dead tree removal for coins

✅ **Day 2 - Task 2.2 COMPLETE!** You finished:
- Tree planting on cleared recovered tiles
- Planted tree rendering + growth stages
- Plant tree modal

🚀 **NEXT UP: Task 3.1 - Shop UI + Trees**

**Copy and paste this to continue:**
```
Implement Task 3.1: Shop UI + Trees
```

---

**YOU'VE GOT THIS!** 🚀

Based on your MVP speed (4 days for what I estimated at 15-20 hours), you can absolutely ship a full-featured V1 by Ramadan. The key is staying focused on Tier 1 features and not getting distracted by perfect polish.

**Remember**: Shipped is better than perfect. You can iterate post-launch!
