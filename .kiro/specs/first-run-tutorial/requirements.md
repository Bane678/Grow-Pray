# Requirements Document

## Introduction

New users currently land on the garden with no explanation of how to use the app: the
garden gestures, the prayer bar, the top-bar stats, the corner Qibla and Settings
icons, and the bottom tabs are all undiscovered. This spec adds a short, skippable,
run-once **first-run tutorial** that introduces these surfaces in-app, plus targeted
improvements to make the **Qibla compass** discoverable.

The tutorial is deliberately separate from onboarding: onboarding handles the "why"
(emotional flow, pledge, paywall); this tutorial handles the "how" and runs after
onboarding, on the first garden load. It is led by a faceless pixel **seedling guide**
to give warmth without depicting faces/animals/humans.

Guiding constraints (app ethos — must hold for every requirement):
- No ads.
- No depictions of faces, animals, or humans. The seedling guide is a plain plant
  sprite (no eyes/face); personality comes from animation and copy only.
- Fully on-device: no backend, no new network calls, no new data collection.
- Reuse the existing design system (glass cards, Fraunces headings, accent palette,
  existing seedling sprite) so it feels native.
- Preserve the five-item bottom bar and the uncluttered garden; no new permissions.

## Glossary

- **Tutorial / tour**: the run-once sequence of coachmark steps shown to new users.
- **Coachmark / step**: a single highlighted element with a short caption.
- **Spotlight**: the dimmed overlay plus a highlight ring drawing attention to a target.
- **Seedling guide**: the faceless plant sprite that hosts the tutorial captions.
- **Target**: a UI element a step points at (e.g. the prayer bar, the Qibla icon).
- **Run-once flag**: a persisted boolean marking the tutorial as already completed.

## Requirements

### Requirement 1: First-run tutorial tour

**User Story:** As a brand-new user, I want a short guided tour of the app when I first
arrive, so that I understand how to grow my garden and navigate the features.

#### Acceptance Criteria
1. WHEN a user reaches the garden for the first time after completing onboarding AND
   the tutorial has not been completed THEN the system SHALL start the tutorial.
2. The tutorial SHALL present a short sequence of steps (about six), each highlighting
   one area with a concise caption: the garden (tap a tile, pinch to zoom, grows with
   prayer), the prayer bar, the top-bar stats, the Qibla compass, the Settings gear,
   and the bottom tabs.
3. WHEN a step is shown THEN the system SHALL visually emphasise the target element
   (dimmed surroundings plus a highlight) and show the caption near it.
4. The tutorial SHALL provide "Next" (and "Done" on the final step) to advance and a
   "Skip" control available on every step.
5. WHEN the user finishes or skips the tutorial THEN the system SHALL persist a
   run-once flag so the tutorial does not appear again on subsequent launches.
6. The tutorial SHALL never block core actions: dismissing or skipping it always
   returns the user to a fully usable garden.
7. WHEN a target element's on-screen position cannot be measured THEN the system SHALL
   fall back to a centered caption for that step rather than failing.

### Requirement 2: Seedling guide presentation

**User Story:** As a user, I want the tutorial to feel warm and on-theme, so that
learning the app is pleasant and consistent with the garden.

#### Acceptance Criteria
1. The tutorial captions SHALL be hosted by a faceless seedling sprite reusing the
   existing seedling asset, with no eyes, face, or human/animal features.
2. The seedling guide SHALL use a subtle idle animation (e.g. a gentle bob/scale) for
   liveliness, without distracting motion.
3. The tutorial SHALL use the existing card, Fraunces heading, and accent styles.

### Requirement 3: Qibla discoverability

**User Story:** As a user, I want to understand that the corner compass finds the
direction of the Kaaba, so that I actually use the Qibla feature.

#### Acceptance Criteria
1. The garden top bar SHALL show a small text label beneath the Qibla compass icon and
   beneath the Settings gear icon, matching the existing small-label style used for the
   stats row.
2. The tutorial SHALL include a step that explains the Qibla compass.
3. UNTIL the user first opens the Qibla view THE system SHALL show a one-time gentle
   pulse/glow on the Qibla icon to draw attention; WHEN the Qibla view has been opened
   once THEN the pulse SHALL stop permanently (persisted).
4. The Qibla feature SHALL remain free and reachable from the existing corner icon
   (placement unchanged).

### Requirement 4: Replay and coherence

**User Story:** As the owner, I want the tutorial to be replayable and to preserve the
app's quality and safety guarantees.

#### Acceptance Criteria
1. The system SHALL provide a way to replay the tutorial from Settings (resetting the
   run-once flag and restarting the tour).
2. Additions SHALL not introduce a new OS runtime permission.
3. The project SHALL continue to type-check cleanly (`tsc --noEmit`) after each task.
4. No change SHALL reintroduce the garden-freeze bug or regress existing navigation;
   the bottom bar SHALL remain five items.
