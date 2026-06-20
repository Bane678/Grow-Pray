# Requirements Document

## Introduction

Grow Pray's premium tier is currently weighted toward game-economy perks (unlimited
garden, 2× coins, premium trees, free freezes), which makes the onboarding paywall
lean on indirect benefits. This spec adds two concrete, on-ethos premium-anchored
features and a small navigation change to fit them in cleanly:

1. **Advanced Prayer Insights** — a premium analytics view that deepens the existing
   History tab (no new navigation surface).
2. **Dhikr & Dua hub + Tasbih** — a new worship destination (a Tasbih counter plus a
   library of authentic adhkar/duas), with a free core and a premium full library.
3. **Navigation reorganization** — move Settings from the bottom tab bar to a gear
   icon in the garden top bar, freeing a bottom slot for Dhikr so the bar stays at
   five items.

Guiding constraints (app ethos — must hold for every requirement):
- No ads.
- No depictions of faces, animals, or humans in any added art/content.
- Islamic content must be authentic; Arabic + translations are flagged for the owner
  to verify before release.
- Fully on-device: no backend, no new network calls, no new data collection.
- Reuse the existing design system (glass cards, per-prayer colors, Fraunces display
  headings, coin/streak iconography) so additions feel native, not bolted on.

## Glossary

- **Insights**: premium analytics derived from local prayer history and streaks.
- **Tasbih**: a digital dhikr counter with preset targets.
- **Adhkar / Dua**: Islamic remembrances/supplications presented as content cards.
- **Entitlement**: the premium access flag exposed by `usePremium().isPremium`.
- **asPage pattern**: the existing convention of rendering a feature as a lazily
  mounted, frozen-when-hidden full-screen tab page.

## Requirements

### Requirement 1: Advanced Prayer Insights (premium)

**User Story:** As a consistent user, I want deeper insight into my prayer habits so
that I can see patterns and improve, and feel my subscription delivers ongoing value.

#### Acceptance Criteria
1. WHEN the user opens the History tab THEN the system SHALL display a segmented
   control with "Calendar" and "Insights", defaulting to "Calendar".
2. WHEN the user selects "Calendar" THEN the system SHALL display the existing history
   content (streak cards, month-stats bar, monthly completion, calendar heatmap, day
   detail, legend) unchanged.
3. IF the user is NOT premium WHEN they select "Insights" THEN the system SHALL show a
   blurred/locked preview with a single "Unlock with Premium" CTA that opens the
   paywall with a relevant trigger reason.
4. IF the user IS premium WHEN they select "Insights" THEN the system SHALL display,
   from local data only: per-prayer completion rate (one bar per prayer in its color),
   most- and least-consistent prayer, a completion trend over a recent window, total
   perfect days and current best streak, and a simple year overview.
5. The insights SHALL be derived only from `prayerHistory` and `streaks`; no new
   persisted prayer data is required for launch.
6. The system SHALL begin recording, going forward, whether each completed prayer was
   on-time or in grace under a new dedicated key, WITHOUT changing the existing
   `prayerHistory` shape; no UI consumes this at launch.
7. WHEN insights render THEN they SHALL reuse `react-native-svg` primitives and the
   established card/typography styles.

### Requirement 2: Dhikr & Dua hub with Tasbih

**User Story:** As a Muslim user, I want a tasbih counter and a library of authentic
duas and adhkar inside the app so that I can do dhikr where I track my prayers.

#### Acceptance Criteria
1. The system SHALL provide a "Dhikr" destination reachable from the primary
   navigation.
2. The Dhikr hub SHALL present two sections: Tasbih and Duas & Adhkar.
3. WHEN the user taps the Tasbih counter THEN it SHALL increment by one with haptic
   feedback; the system SHALL offer presets SubhanAllah (×33), Alhamdulillah (×33),
   Allahu Akbar (×34), and a custom target; WHEN a target is reached THEN the system
   SHALL signal completion; the count and preset SHALL persist across restarts.
4. Each Dua/Adhkar item SHALL display Arabic, transliteration, English translation,
   and a repeat count, in the existing card style, grouped by category.
5. IF the user is NOT premium THEN Tasbih and the After-Salah adhkar SHALL be fully
   available, and premium-only content (Morning, Evening, Sleep, Travel, custom
   targets, dhikr streaks) SHALL be visibly present but locked; selecting a locked
   item SHALL open the paywall.
6. WHEN the user completes a prayer THEN the system SHALL show a gentle, dismissible
   "Continue with dhikr" prompt; accepting opens the Tasbih; declining SHALL never
   block prayer completion.
7. All dhikr/dua content SHALL be bundled on-device with no network request, contain
   no faces/animals/humans, and be flagged for owner authenticity verification.

### Requirement 3: Navigation reorganization (Settings to gear)

**User Story:** As a user, I want the app to stay uncluttered and easy to navigate
even after new features are added.

#### Acceptance Criteria
1. The bottom tab bar SHALL contain exactly five items: Garden, Challenges, Shop,
   History, Dhikr.
2. Settings SHALL be reachable from a gear icon in the garden top info bar.
3. WHEN the user taps the gear THEN the system SHALL open the existing Settings
   surface with all current functionality intact (location, madhab, notifications,
   restore purchases, support links, reset, and the `__DEV__` developer tools entry).
4. The navigation change SHALL NOT remove or regress any existing Settings capability.
5. The bottom bar's existing badge behavior (challenge claimable count) SHALL keep
   working.

### Requirement 4: Premium gating consistency

**User Story:** As the owner, I want all new premium gates to use the existing
purchase plumbing so behavior and entitlements stay consistent.

#### Acceptance Criteria
1. New premium gates SHALL read entitlement from `usePremium().isPremium`.
2. New paywall entries SHALL use the existing `PaywallModal`, adding trigger reasons
   `insights` and `dhikr_library` for tailored copy.
3. WHEN entitlement becomes active THEN locked overlays SHALL disappear without an app
   restart.

### Requirement 5: Coherence, performance, and safety

**User Story:** As the owner, I want new features to preserve the app's smooth,
coherent feel and safety guarantees so that quality does not regress.

#### Acceptance Criteria
1. New tab pages SHALL follow the `asPage` + `FreezeWhenHidden` lazy-mount pattern.
2. Additions SHALL not introduce new runtime permissions.
3. The project SHALL continue to type-check cleanly (`tsc --noEmit`) after each task.
4. No change SHALL reintroduce the garden-freeze bug (gesture interactivity stays
   decoupled from modal/performance flags).
