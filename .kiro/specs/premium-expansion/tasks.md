# Implementation Plan: Premium Expansion — Insights & Dhikr

## Overview

Work top to bottom. Run `tsc --noEmit` after each numbered task and keep
`get_diagnostics` clean. Each task notes the requirement(s) it satisfies. Phases are
ordered so navigation and premium plumbing land first, then the two features, then
verification.

## Tasks

### Phase 1 — Navigation reorg (Settings → gear, add Dhikr slot)
- [ ] 1.1 Add `'dhikr'` to the `activeTab` union and lazy `visitedTabs` handling in `App.tsx`. (Req 3)
- [ ] 1.2 In `BottomTabBar`, replace the `settings` entry with a `dhikr` entry (icon + "Dhikr"); keep order Garden · Challenges · Shop · History · Dhikr; preserve badge logic. (Req 3.1, 3.5)
- [ ] 1.3 Add a gear icon button to the garden `TopInfoBar` → `setActiveTab('settings')`. (Req 3.2, 3.3)
- [ ] 1.4 Verify Settings still renders as a page, `onClose → garden` works, and `__DEV__` developer tools remain reachable. (Req 3.3, 3.4)

### Phase 2 — Premium plumbing
- [ ] 2.1 Extend `PaywallModal` `triggerReason` with `'insights'` and `'dhikr_library'` and add copy to `TRIGGER_MESSAGES`. (Req 4.2)

### Phase 3 — Advanced Insights (History tab)
- [ ] 3.1 Create `hooks/usePrayerInsights.ts`: perPrayerRate, most/least consistent, completionTrend, perfectDays, totalPrayers — pure, memoized over `prayerHistory` + `streaks`. (Req 1.4, 1.5)
- [ ] 3.2 Create `components/InsightsView.tsx`: per-prayer bars (PRAYER_COLORS), trend line (`react-native-svg`), most/least + perfect-day cards, year overview; existing card + Fraunces styles. (Req 1.4, 1.7)
- [ ] 3.3 Add `isPremium` + `onOpenPaywall` props to `PrayerHistoryModal`; pass them from `App.tsx`. (Req 1.3, 4.1)
- [ ] 3.4 Add the `Calendar | Insights` segmented control to `PrayerHistoryModal` (default Calendar; Calendar unchanged). (Req 1.1, 1.2)
- [ ] 3.5 Wire Insights: premium → charts; non-premium → `BlurView` preview + "Unlock with Premium" → `onOpenPaywall('insights')`. (Req 1.3, 1.4)
- [ ] 3.6 Add forward on-time logging to `@GrowPray:prayerTimingLog` on prayer completion (from `getPrayerWindowStatus`); do not alter `prayerHistory`. (Req 1.6)

### Phase 4 — Dhikr & Dua hub + Tasbih
- [ ] 4.1 Create `data/adhkar.ts` with typed presets + adhkar; After-Salah + tasbih presets `premium:false`, other categories `premium:true`; mark Arabic/translations with VERIFY comments. (Req 2.4, 2.5, 2.7)
- [ ] 4.2 Create `hooks/useDhikr.ts`: count/target/preset state, increment/reset, persistence (`@GrowPray:tasbih`); optional premium dhikr streak (`@GrowPray:dhikrStreak`). (Req 2.3)
- [ ] 4.3 Create `components/DhikrScreen.tsx` (asPage + FreezeWhenHidden, dark glass): Tasbih section (tap counter, preset chips, haptics, completion signal) + Duas & Adhkar section (category cards); props `isPremium`, `onOpenPaywall`. (Req 2.1–2.5)
- [ ] 4.4 Gate premium categories/targets: locked items open `onOpenPaywall('dhikr_library')`; free users get Tasbih + After-Salah. (Req 2.5, 4.3)
- [ ] 4.5 Render `DhikrScreen` as the `dhikr` tab page in `App.tsx`, mirroring the other tab pages. (Req 2.1, 5.1)
- [ ] 4.6 Add the post-prayer "Continue with dhikr?" dismissible nudge in `handleTogglePrayerWithChallenges` success path; accept opens Dhikr; never blocks completion. (Req 2.6)

### Phase 5 — Optional tie-in (off by default)
- [ ] 5.1 (Optional) Grant a small, capped XP/coin nudge on completing a dhikr session via existing earn paths; keep disabled until economy-tuned.

### Phase 6 — Verification
- [ ] 6.1 `tsc --noEmit` and `get_diagnostics` clean on all changed files. (Req 5.3)
- [ ] 6.2 Manual pass (dev Toggle Premium + Replay Onboarding): History free-lock vs premium charts; Dhikr tasbih persist + locked categories + paywall; Settings via gear; post-prayer nudge; garden pan/zoom (no freeze regression). (Req 5.4)
- [ ] 6.3 Confirm no new permissions, no network calls, no ads, no faces/animals/humans. (Req 5.2)
- [ ] 6.4 Owner: verify all Arabic, transliterations, and translations in `data/adhkar.ts` before release. (Req 2.7)

## Task Dependency Graph

Tasks grouped into waves; tasks within a wave can proceed in parallel, and each wave
depends on the previous ones.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1"] },
    { "wave": 2, "tasks": ["1.2", "1.3"] },
    { "wave": 3, "tasks": ["1.4", "2.1", "3.6"] },
    { "wave": 4, "tasks": ["3.1", "4.1", "4.2"] },
    { "wave": 5, "tasks": ["3.2", "3.3", "4.3"] },
    { "wave": 6, "tasks": ["3.4", "4.4"] },
    { "wave": 7, "tasks": ["3.5", "4.5"] },
    { "wave": 8, "tasks": ["4.6"] },
    { "wave": 9, "tasks": ["5.1"] },
    { "wave": 10, "tasks": ["6.1", "6.2", "6.3", "6.4"] }
  ]
}
```

Narrative dependencies:
- 1.1 precedes 1.2 and 1.3 (union must exist before bar/gear wiring); 1.2 and 1.3
  precede 1.4.
- 2.1 precedes 3.5 and 4.4 (paywall reasons before gating uses them).
- 3.1 → 3.2 → 3.4 → 3.5; 3.3 → 3.5. 3.6 is independent after Phase 1.
- 4.1 and 4.2 precede 4.3 → 4.4 → 4.5 → 4.6.
- Phase 6 depends on Phases 1–4 (Phase 5 optional).

## Notes

- Keep the Calendar view untouched; Insights is purely additive.
- `prayerHistory` shape must never change; on-time data goes to a separate key.
- Defer the optional economy tie-in (5.1) until premium features are validated.
- Garden interactivity must remain decoupled from modal/performance flags.
