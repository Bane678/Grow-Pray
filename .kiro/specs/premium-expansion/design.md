# Design Document

## Overview

This design adds two premium-anchored features — Advanced Prayer Insights and a
Dhikr/Dua hub with Tasbih — plus a navigation change that moves Settings to a gear
icon so a "Dhikr" slot can join the five-item bottom bar. It deliberately *deepens
existing surfaces* rather than adding many new ones, to preserve the app's uncluttered
feel. Everything is on-device and reuses the current design system and premium
plumbing.

Grounding in the current codebase:
- Tabs render in `App.tsx` via `BottomTabBar` (garden, challenges, shop, history,
  settings); tab pages use the `asPage` + `FreezeWhenHidden` lazy pattern.
- History UI is `components/PrayerHistoryModal.tsx` (streaks, month stats, calendar
  heatmap, day detail). It does NOT currently receive `isPremium`.
- Settings UI is `components/SettingsModal.tsx` (supports `asPage`).
- Premium entitlement comes from `hooks/usePremium.ts` (`isPremium`).
- Paywall is `components/PaywallModal.tsx` with a `triggerReason` prop.
- Data shapes: `prayerHistory: { [date: string]: string[] }`,
  `streaks: Record<string, number>`.
- `react-native-svg`, `expo-blur` (BlurView), `expo-haptics`, and `theme/typography`
  (FONTS) are already used.

## Architecture

Navigation: keep Settings as an existing tab *page* (it already renders under
`activeTab === 'settings'`); change only how it is *reached*.
- `BottomTabBar.tabs`: replace the `settings` entry with a `dhikr` entry. Final order:
  Garden · Challenges · Shop · History · Dhikr.
- Add a gear icon button in the garden `TopInfoBar` → `setActiveTab('settings')`.
- `activeTab` union adds `'dhikr'`; `'settings'` stays valid but unlisted in the bar.
- Settings page keeps `onClose → setActiveTab('garden')` as its back action.

Feature wiring follows the established page pattern: each new full-screen feature is a
component rendered conditionally on `activeTab`, wrapped in `FreezeWhenHidden`, lazily
mounted via `visitedTabs`.

Premium gating is reactive: components read `usePremium().isPremium` and render locked
overlays that vanish when the entitlement flips, with no restart.

## Components and Interfaces

| File | Change |
|---|---|
| `App.tsx` | Tab list swap (settings→dhikr); gear button in top bar; render `DhikrScreen` page; pass `isPremium`/`onOpenPaywall` to History; post-prayer dhikr nudge; on-time timing-log write |
| `components/PrayerHistoryModal.tsx` | `Calendar \| Insights` segmented control; new `isPremium` + `onOpenPaywall` props; Insights view + free gate |
| `components/InsightsView.tsx` (new) | Premium insights charts (bars + trend) |
| `components/DhikrScreen.tsx` (new) | Tasbih + Duas/Adhkar hub (asPage) |
| `hooks/useDhikr.ts` (new) | Tasbih/dhikr state + persistence |
| `hooks/usePrayerInsights.ts` (new) | Pure insight computations |
| `data/adhkar.ts` (new) | Bundled, owner-verified dhikr/dua content |
| `components/PaywallModal.tsx` | New trigger reasons + copy |

Key interfaces:
- `PrayerHistoryModal` gains `isPremium: boolean` and
  `onOpenPaywall: (reason: 'insights') => void`.
- `DhikrScreen` props: `isPremium: boolean`,
  `onOpenPaywall: (reason: 'dhikr_library') => void`, plus the `asPage`/`visible`
  conventions used by other pages.
- `PaywallModal.triggerReason` extends to include `'insights' | 'dhikr_library'`.

## Data Models

```ts
// data/adhkar.ts
type DhikrCategory = 'after_salah' | 'morning' | 'evening' | 'sleep' | 'travel';

type DhikrItem = {
  id: string;
  category: DhikrCategory;
  arabic: string;          // VERIFY before release
  transliteration: string; // VERIFY before release
  translation: string;     // VERIFY before release
  repeat: number;
  premium: boolean;        // after_salah = false; others = true
};

type TasbihPreset = { id: string; label: string; arabic: string; target: number };
```

Persistence keys (AsyncStorage, on-device only):
- `@GrowPray:tasbih` → `{ count: number; presetId: string; customTarget?: number }`
- `@GrowPray:dhikrStreak` → `{ count: number; lastDate: string }` (premium)
- `@GrowPray:prayerTimingLog` → `{ [date: string]: { [prayer: string]: 'onTime' | 'grace' } }`
  (write-only for now; `prayerHistory` is untouched)

Insight computations (pure, memoized over `prayerHistory` + `streaks`):
- `perPrayerRate(history, windowDays)` → `Record<Prayer, 0..1>`
- `most/leastConsistent` → argmax/argmin of the above
- `completionTrend(history, windowDays, buckets)` → `number[]`
- `perfectDays(history, range)`, `totalPrayers(history, range)`

## Correctness Properties

### Property 1: Calendar unchanged
Selecting "Calendar" renders the existing history experience unchanged.

**Validates: Requirements 1.1, 3.4**

### Property 2: Premium values gated
A non-premium user can never see actual insight values (preview is blurred and
non-interactive); a premium user always sees real, locally-computed values.

**Validates: Requirements 1.2, 4.1**

### Property 3: Free worship core
Free users always retain access to Tasbih and After-Salah adhkar.

**Validates: Requirements 2.1, 2.2**

### Property 4: Completion never blocked
Marking a prayer complete always succeeds regardless of the dhikr nudge.

**Validates: Requirements 5.1**

### Property 5: History integrity
`prayerHistory` is never mutated by the new on-time timing log.

**Validates: Requirements 5.2**

### Property 6: Tasbih persistence
Tasbih count persists and restores exactly across app restarts.

**Validates: Requirements 2.1, 4.2**

## Error Handling

- All AsyncStorage reads/writes are wrapped in try/catch; failures fall back to safe
  defaults (count 0, empty timing log) and never crash a screen.
- Insight helpers handle empty/sparse history (return 0 rates, empty trend) without
  dividing by zero.
- If premium state is still loading, locked overlays default to the locked state to
  avoid briefly exposing premium content.

## Testing Strategy

- `tsc --noEmit` clean and `get_diagnostics` clean after each task.
- Manual matrix using the dev "Toggle Premium" and "Replay Onboarding" tools:
  - History: free → blurred lock + paywall; premium → real charts; Calendar unchanged.
  - Dhikr: tasbih counts/persists; free vs locked categories; paywall opens on locked.
  - Settings: reachable via gear; all functions present; dev tools under `__DEV__`.
  - Post-prayer nudge appears, is dismissible, and never blocks completion.
  - Garden still pans/zooms after opening/closing these surfaces (no freeze regression).

## Out of Scope

- Premium garden environments/art (deferred — needs assets).
- "On-time %" insight UI (data only begins accruing now).
- Quran/audio and Qibla compass (separate future specs).
