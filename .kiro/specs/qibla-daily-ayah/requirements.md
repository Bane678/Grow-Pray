# Requirements Document

## Introduction

This spec adds two "completeness" features that strengthen Grow Pray as a daily
Islamic companion and improve its App Store standing, without bloating the
uncluttered layout:

1. **Qibla compass** — a free, core utility showing the direction to the Kaaba using
   the device magnetometer and the user's existing location. Free because every
   comparable app offers it and gating it reads as stingy.
2. **Daily Reflection (ayah / hadith)** — a verified verse or hadith surfaced each day
   as a card, giving a daily reason to open the app. Free users see today's
   reflection; premium unlocks the full archive and saved favourites. An optional
   daily reminder reuses the existing notification system.

Guiding constraints (app ethos — must hold for every requirement):
- No ads.
- No depictions of faces, animals, or humans in any added art/content.
- Islamic content must be authentic; Arabic, translations, and citations are flagged
  for the owner to verify before release.
- Fully on-device: reflection content is bundled; Qibla uses on-device sensors and the
  location already obtained for prayer times. No new backend or data collection.
- Reuse the existing design system (glass cards, Fraunces display headings, Amiri
  Arabic, accent palette) so additions feel native, not bolted on.
- Preserve the five-item bottom bar and the uncluttered garden; new surfaces attach to
  existing places (garden top bar, Dhikr tab) rather than adding navigation.

## Glossary

- **Qibla**: the direction of the Kaaba in Makkah that Muslims face in prayer.
- **Bearing**: the great-circle compass angle (0–360°, clockwise from true north) from
  the user's location to the Kaaba.
- **Heading**: the direction the top of the device is pointing, from the magnetometer.
- **Reflection**: a daily ayah or hadith presented as a content card.
- **Archive**: the full browsable set of reflections (premium).
- **Entitlement**: the premium access flag exposed by `usePremium().isPremium`.
- **asPage pattern**: the existing convention of rendering a feature as a lazily
  mounted, frozen-when-hidden full-screen surface.

## Requirements

### Requirement 1: Qibla compass (free)

**User Story:** As a Muslim user, I want to find the direction of the Kaaba from inside
the app, so that I can orient myself for prayer without a separate tool.

#### Acceptance Criteria
1. WHEN the user opens the Qibla view THEN the system SHALL display a compass that
   rotates with the device heading and a clear marker pointing toward the Kaaba.
2. The system SHALL compute the Qibla bearing locally from the user's coordinates to
   the Kaaba (21.4225° N, 39.8262° E) using the great-circle formula.
3. WHERE the user has set a manual city THE system SHALL use those coordinates;
   OTHERWISE the system SHALL use the device GPS location already permitted for prayer
   times.
4. WHILE the device heading is updating THE system SHALL display the current heading
   and indicate when the device is aligned with the Qibla (e.g. a visual/haptic cue).
5. IF the magnetometer is unavailable or location cannot be resolved THEN the system
   SHALL show a clear fallback message instead of crashing, including the numeric
   Qibla bearing when coordinates are available.
6. The Qibla feature SHALL be available to all users (not premium-gated).
7. The Qibla view SHALL be reachable from the garden without adding a sixth bottom-bar
   item, and SHALL follow the existing full-screen surface styling.
8. WHEN the user leaves the Qibla view THEN the system SHALL stop magnetometer updates
   to conserve battery.

### Requirement 2: Daily Reflection (ayah / hadith)

**User Story:** As a user building a habit, I want a short authentic reflection each
day, so that I have a recurring, meaningful reason to open the app.

#### Acceptance Criteria
1. WHEN the user opens the reflection surface THEN the system SHALL display today's
   reflection with its Arabic (where applicable), translation, and source citation in
   the existing card style.
2. The system SHALL select today's reflection deterministically from a bundled set so
   that the same reflection shows for the whole day and rotates day to day.
3. The reflection content SHALL be bundled on-device with no network request, contain
   no faces/animals/humans, and be flagged for owner authenticity verification.
4. IF the user is NOT premium THEN the system SHALL show today's reflection for free
   and present the archive and favourites as visibly available but locked; selecting a
   locked entry SHALL open the paywall.
5. IF the user IS premium THEN the system SHALL allow browsing the full reflection
   archive and saving/removing favourites, persisted on-device.
6. WHERE reflection reminders are enabled THE system SHALL schedule one daily local
   notification with a short reflection prompt, reusing the existing notification
   permission and preference plumbing.
7. WHEN reflection content renders Arabic THEN it SHALL use the Amiri Arabic font and
   the established card/typography styles.

### Requirement 3: Premium gating consistency

**User Story:** As the owner, I want the new premium gate to use the existing purchase
plumbing so behavior and entitlements stay consistent.

#### Acceptance Criteria
1. New premium gates SHALL read entitlement from `usePremium().isPremium`.
2. New paywall entries SHALL use the existing `PaywallModal`, adding a trigger reason
   `reflection_archive` for tailored copy.
3. WHEN entitlement becomes active THEN locked overlays SHALL disappear without an app
   restart.

### Requirement 4: Coherence, performance, and safety

**User Story:** As the owner, I want the new features to preserve the app's smooth,
coherent feel and safety guarantees so that quality does not regress.

#### Acceptance Criteria
1. New full-screen surfaces SHALL follow the existing lazy-mount / frozen-when-hidden
   conventions where applicable.
2. The Qibla feature SHALL NOT introduce a new OS runtime permission prompt beyond the
   location access already used for prayer times.
3. The project SHALL continue to type-check cleanly (`tsc --noEmit`) after each task.
4. No change SHALL reintroduce the garden-freeze bug (gesture interactivity stays
   decoupled from modal/performance flags), and the bottom bar SHALL remain five items.
