# Implementation Plan: First-Run Tutorial & Qibla Discoverability

## Overview

Work top to bottom. Run `tsc --noEmit` after each numbered task and keep
`get_diagnostics` clean. Each task notes the requirement(s) it satisfies. Phases land
the tutorial engine first, then the overlay UI, then the trigger wiring, then Qibla
discoverability, then replay + verification.

## Tasks

### Phase 1 — Tutorial engine
- [x] 1.1 Create `hooks/useTutorial.ts`: tour state `{ active, stepIndex }`, the step list (garden, prayerBar, stats, qibla, settings, tabs), run-once flag (`@GrowPray:tutorialComplete`), and `start/next/skip/complete` with safe AsyncStorage guards. (Req 1.1, 1.2, 1.5, 4.3)

### Phase 2 — Overlay UI + seedling guide
- [x] 2.1 Create `components/TutorialOverlay.tsx`: dim layer + highlight ring at the target rect; caption card (existing card/Fraunces styles) hosting the faceless seedling sprite with a gentle idle animation; "Skip" on every step and "Next"/"Done" to advance; centered fallback when no rect. (Req 1.3, 1.4, 1.7, 2.1, 2.2, 2.3)

### Phase 3 — Targeting & trigger
- [x] 3.1 In `App.tsx`, attach refs to the tutorial targets (garden area, `FloatingPrayerBar`, top-bar stats, Qibla button, Settings gear, `BottomTabBar`) and provide a registry that measures each via `measureInWindow`. (Req 1.2, 1.3, 1.7)
- [x] 3.2 Trigger the tutorial on first garden visibility for new users (end of `handlePreparingDone`, and on normal load when `tutorialComplete` is unset), guarded so it never runs during onboarding/preparing. (Req 1.1, 1.6)
- [x] 3.3 Render `TutorialOverlay` above the garden, wiring step captions + measured rects, `onNext`/`onSkip`/complete. (Req 1.3, 1.4, 1.6)

### Phase 4 — Qibla discoverability
- [x] 4.1 Add small labels ("QIBLA", "SETTINGS") under the corner icons in `TopInfoBar`, matching the stats-row label style. (Req 3.1)
- [x] 4.2 Add a one-time pulse/glow on the Qibla icon driven by a `qiblaPulse` prop from `@GrowPray:qiblaSeen`; set the flag (stop pulse) when the Qibla view is first opened. (Req 3.3, 3.4)
- [x] 4.3 Ensure the tutorial's Qibla step references the compass clearly (caption copy). (Req 3.2)

### Phase 5 — Replay
- [x] 5.1 Add a "Replay tutorial" action reachable from Settings that resets `@GrowPray:tutorialComplete` and restarts the tour. (Req 4.1)

### Phase 6 — Verification
- [x] 6.1 `tsc --noEmit` and `get_diagnostics` clean on all changed files. (Req 4.3)
- [ ] 6.2 Manual pass: fresh-user trigger after onboarding; steps highlight correct elements; Next/Skip/Done; run-once persists; Qibla labels + one-time pulse + tutorial step; replay from Settings; garden pan/zoom; bottom bar still five items. (Req 4.4)
- [x] 6.3 Confirm no new permissions, no network calls, no ads, no faces/animals/humans (seedling guide is faceless). (Req 2.1, 4.2)

## Task Dependency Graph

Tasks grouped into waves; tasks within a wave can proceed in parallel, and each wave
depends on the previous ones.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1"] },
    { "wave": 2, "tasks": ["2.1", "4.1"] },
    { "wave": 3, "tasks": ["3.1", "4.2"] },
    { "wave": 4, "tasks": ["3.2", "3.3", "4.3"] },
    { "wave": 5, "tasks": ["5.1"] },
    { "wave": 6, "tasks": ["6.1", "6.2", "6.3"] }
  ]
}
```

Narrative dependencies:
- 1.1 (engine) precedes the overlay and trigger work.
- 2.1 (overlay) and 3.1 (targets) precede 3.2/3.3 (trigger + render).
- 4.1/4.2 (Qibla labels + pulse) are independent and can land alongside the overlay.
- Phase 6 depends on Phases 1–5.

## Notes

- Tutorial is the "how"; onboarding stays the "why". Keep them separate.
- Seedling guide must be faceless (plant only); personality via animation + copy.
- Keep the bottom bar at five items and the garden uncluttered.
- Tutorial must never block core actions; Skip is always available.
