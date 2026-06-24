# Implementation Plan: Qibla Compass & Daily Reflection

## Overview

Work top to bottom. Run `tsc --noEmit` after each numbered task and keep
`get_diagnostics` clean. Each task notes the requirement(s) it satisfies. Phases are
ordered so the dependency (expo-sensors) and premium plumbing land first, then Qibla,
then the Daily Reflection, then verification.

## Tasks

### Phase 1 — Setup & premium plumbing
- [x] 1.1 Add the `expo-sensors` dependency (Expo-aligned version) and confirm it installs cleanly. (Req 1.1, 4.2)
- [x] 1.2 Extend `PaywallModal` `triggerReason` with `'reflection_archive'` and add copy to `TRIGGER_MESSAGES`; widen the `App.tsx` `paywallReason` union to match. (Req 3.2)

### Phase 2 — Qibla compass (free)
- [x] 2.1 Create `hooks/useQibla.ts`: `qiblaBearing(lat,lng)` great-circle helper (Kaaba 21.4225, 39.8262); resolve coords (prefer `manualCoords`, else `Location.getCurrentPositionAsync`); subscribe to `Magnetometer` for heading; expose `{ bearing, heading, aligned, status }`; unsubscribe on unmount. (Req 1.2, 1.3, 1.4, 1.8)
- [x] 2.2 Create `components/QiblaScreen.tsx`: rotating compass dial (`react-native-svg`), Kaaba marker at `bearing`, heading readout, aligned cue (visual + light haptic); `no-location` / `no-sensor` fallbacks showing the numeric bearing when available; existing full-screen card styling + Fraunces headings. (Req 1.1, 1.4, 1.5, 1.7)
- [x] 2.3 Add a compass icon button to `TopInfoBar` (top-left, mirroring the gear) with an `onOpenQibla` prop. (Req 1.7)
- [x] 2.4 Render `QiblaScreen` from `App.tsx` as a full-screen surface; pass resolved coords; wire `onOpenQibla` to open it and `onClose` to dismiss; ensure magnetometer stops on close. (Req 1.1, 1.6, 1.8, 4.1)

### Phase 3 — Daily Reflection
- [x] 3.1 Create `data/reflections.ts`: typed, bundled reflections (ayah/hadith) with Arabic (where shown), translation, source; mark all with VERIFY comments; no faces/animals/humans. (Req 2.3, 2.7)
- [x] 3.2 Create `hooks/useReflections.ts`: deterministic today's pick (day-of-year mod length); favourites persistence (`@GrowPray:reflectionFavourites`); archive accessor; empty-list guards. (Req 2.1, 2.2, 2.5)
- [x] 3.3 Create `components/DailyReflectionCard.tsx`: today's reflection (Amiri Arabic + translation + source) in the existing card style; entry to archive/favourites; props `isPremium`, `onOpenPaywall`. (Req 2.1, 2.7)
- [x] 3.4 Gate archive/favourites: free → today's card only, archive/favourites locked → `onOpenPaywall('reflection_archive')`; premium → browse archive + add/remove favourites. (Req 2.4, 2.5, 3.1, 3.3)
- [x] 3.5 Mount `DailyReflectionCard` at the top of `DhikrScreen` (above Tasbih), passing through `isPremium` / `onOpenPaywall`. (Req 2.1, 4.1)
- [x] 3.6 Add an optional daily reflection reminder reusing `useNotifications` (dedicated daily identifier, existing permission/preference); no new permission prompt. (Req 2.6, 4.2)

### Phase 4 — Verification
- [x] 4.1 `tsc --noEmit` and `get_diagnostics` clean on all changed files. (Req 4.3)
- [x] 4.2 Verify `qiblaBearing` against known cities (London ≈ 119°, New York ≈ 58°) within tolerance; verify daily-index determinism. (Req 1.2, 2.2)
- [ ] 4.3 Manual pass (dev Toggle Premium): Qibla dial/marker/aligned cue + fallbacks + updates stop on close; reflection free today vs locked archive + premium browse/favourite + reminder; garden pan/zoom; bottom bar still five items. (Req 4.4)
- [x] 4.4 Confirm no new permissions beyond existing location, no network calls, no ads, no faces/animals/humans. (Req 4.2)
- [ ] 4.5 Owner: verify all Arabic, translations, and citations in `data/reflections.ts` before release. (Req 2.3)

## Task Dependency Graph

Tasks grouped into waves; tasks within a wave can proceed in parallel, and each wave
depends on the previous ones.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1", "1.2"] },
    { "wave": 2, "tasks": ["2.1", "3.1"] },
    { "wave": 3, "tasks": ["2.2", "3.2"] },
    { "wave": 4, "tasks": ["2.3", "3.3"] },
    { "wave": 5, "tasks": ["2.4", "3.4"] },
    { "wave": 6, "tasks": ["3.5", "3.6"] },
    { "wave": 7, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5"] }
  ]
}
```

Narrative dependencies:
- 1.1 (expo-sensors) precedes 2.1; 1.2 (paywall reason) precedes 3.4.
- 2.1 → 2.2 → 2.3 → 2.4 for Qibla.
- 3.1 → 3.2 → 3.3 → 3.4 → 3.5; 3.6 follows the card existing.
- Phase 4 depends on Phases 1–3.

## Notes

- Qibla is free and must never be premium-gated.
- Keep the bottom bar at five items; Qibla attaches to the garden top bar, the
  reflection card to the Dhikr tab.
- Reflection and Qibla content/behaviour must stay on-device and on-ethos.
- Garden interactivity must remain decoupled from modal/performance flags.
