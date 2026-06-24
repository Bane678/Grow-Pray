# Design Document

## Overview

This design adds a short, skippable, run-once **first-run tutorial** and **Qibla
discoverability** improvements. The tutorial is a spotlight coachmark tour hosted by a
faceless seedling guide, triggered on the first garden load after onboarding. Qibla
gets small corner labels, a tutorial step, and a one-time attention pulse.

Everything is on-device, reuses the existing design system, adds no permissions, and
keeps the five-item bottom bar untouched.

Grounding in the current codebase:
- Onboarding completion is persisted at `@GrowPray:onboardingComplete`; `App.tsx`
  reveals the garden via `handlePreparingDone` (new users) after the PreparingScreen.
- The garden, `FloatingPrayerBar`, `TopInfoBar` (stats + Qibla compass top-left +
  Settings gear top-right), and `BottomTabBar` all render in `App.tsx`.
- The Qibla view opens from the `TopInfoBar` compass button via `showQibla` state.
- `Icon_Seedling.png` already exists and is used elsewhere (PreparingScreen, modals).
- Fonts: `theme/typography.ts` (`FONTS.display`). Settings: `components/SettingsModal.tsx`.

## Architecture

Trigger: after the garden becomes visible for a new user (end of `handlePreparingDone`,
and also on normal load for users who have not seen the tutorial), if
`@GrowPray:tutorialComplete` is not set, start the tour. The tour overlays the garden;
it does not change navigation.

Targeting: each highlighted element registers a ref. When the tour starts (or a step
changes) the overlay measures the current target with `measureInWindow` to get its
screen rect, then renders a dim layer + highlight ring at that rect and positions the
caption above or below depending on the rect's vertical position. If measurement fails
or returns nothing, the step renders a centered caption (graceful fallback).

State: a `useTutorial` hook owns `{ active, stepIndex }`, the run-once flag, and
`start/next/skip/complete`. `App.tsx` passes the list of target refs (or a registry) so
the overlay can measure them.

Qibla discoverability:
- `TopInfoBar` gains small labels under the compass and gear icons (same tiny
  uppercase style as the stats labels).
- A one-time pulse on the compass icon driven by a `@GrowPray:qiblaSeen` flag; opening
  the Qibla view sets the flag and stops the pulse.

## Components and Interfaces

| File | Change |
|---|---|
| `hooks/useTutorial.ts` (new) | Tour state, run-once flag (`@GrowPray:tutorialComplete`), start/next/skip/complete |
| `components/TutorialOverlay.tsx` (new) | Dim layer + highlight ring + seedling-guide caption card; Next/Skip/Done |
| `App.tsx` | Target refs (garden, prayer bar, stats, qibla, gear, tabs); trigger on first garden load; render overlay; pass `qiblaSeen` to top bar; set it when Qibla opens |
| `components/QiblaScreen.tsx` | (unchanged behaviour) opening it flips `qiblaSeen` via `App.tsx` |
| `SettingsModal` host (`App.tsx`/`SettingsModal.tsx`) | "Replay tutorial" action that resets the flag and restarts |

Key interfaces:
- `useTutorial()` → `{ active, stepIndex, totalSteps, start(), next(), skip(), complete() }`.
- `TutorialOverlay` props: `visible`, `step` (caption text + target rect or null),
  `stepIndex`, `totalSteps`, `onNext`, `onSkip`.
- `TopInfoBar` gains `qiblaPulse: boolean` to drive the one-time glow.
- A target registry: `Record<TutorialTargetId, () => Promise<Rect | null>>` (each entry
  measures a ref via `measureInWindow`).

## Data Models

```ts
// hooks/useTutorial.ts
type TutorialTargetId =
  | 'garden' | 'prayerBar' | 'stats' | 'qibla' | 'settings' | 'tabs';

interface TutorialStep {
  id: TutorialTargetId;
  title: string;
  body: string;
  // 'center' = no spotlight (used for the garden / fallback)
  placement?: 'auto' | 'center';
}

interface Rect { x: number; y: number; width: number; height: number; }
```

Persistence keys (AsyncStorage, on-device only):
- `@GrowPray:tutorialComplete` → `'true'` once finished or skipped.
- `@GrowPray:qiblaSeen` → `'true'` after the Qibla view is opened once.

## Correctness Properties

### Property 1: Run once
After the tutorial is completed or skipped, it never starts automatically again.

**Validates: Requirements 1.5, 4.1**

### Property 2: Always skippable and non-blocking
A Skip control is available on every step, and skipping returns to a fully usable
garden without side effects.

**Validates: Requirements 1.4, 1.6**

### Property 3: Measurement fallback
If a target cannot be measured, the step still renders (centered) rather than crashing
or showing an empty spotlight.

**Validates: Requirements 1.7**

### Property 4: Qibla pulse one-shot
The Qibla attention pulse shows until the Qibla view is first opened, then never again
(persisted).

**Validates: Requirements 3.3**

### Property 5: Faceless guide
The seedling guide and all tutorial visuals contain no faces, animals, or humans.

**Validates: Requirements 2.1**

### Property 6: No new permission
The tutorial and Qibla labels/pulse introduce no OS runtime permission.

**Validates: Requirements 4.2**

## Error Handling

- `measureInWindow` is wrapped so a null/throwing measurement falls back to a centered
  caption for that step.
- AsyncStorage reads/writes for the run-once and `qiblaSeen` flags fall back to safe
  defaults (treat as not-completed / show pulse) and never crash.
- Starting the tutorial is guarded so it cannot run while onboarding or the preparing
  screen is still visible.

## Testing Strategy

- `tsc --noEmit` clean and `get_diagnostics` clean after each task.
- Manual matrix (use a dev "Replay tutorial" action):
  - Fresh user: onboarding → preparing → garden → tutorial starts; steps highlight the
    right elements; Next advances; Done/Skip ends and persists (no re-show on relaunch).
  - Qibla: corner labels visible; pulse shows until first open, then stops; tutorial
    step explains it.
  - Replay from Settings restarts the tour.
  - Garden still pans/zooms after the tour; bottom bar still five items.

## Out of Scope

- Per-feature deep tutorials inside each tab (this is a high-level orientation only).
- A custom-generated mascot asset (reuse the existing seedling; a new sprite is
  optional and not required by this spec).
- Animated character with expressions (ethos: faceless plant only).
