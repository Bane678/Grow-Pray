# Design Document

## Overview

This design adds a free **Qibla compass** and a **Daily Reflection** surface (free
today's card, premium archive + favourites) to Grow Pray. Both attach to existing
surfaces to keep the five-item bottom bar and the uncluttered garden intact:

- Qibla is reached from a small compass icon in the garden top bar (mirroring the
  Settings gear), opening a full-screen Qibla view.
- The Daily Reflection lives at the top of the existing **Dhikr** tab as a "Reflection
  of the day" card, with the archive/favourites below it (premium-gated).

Everything is on-device. Qibla uses `expo-sensors` (Magnetometer) plus the coordinates
already used for prayer times. Reflection content is bundled. Premium gating reuses
`usePremium` + `PaywallModal`.

Grounding in the current codebase:
- Location/coords: `hooks/usePrayerTimes.ts` accepts `manualCoords { lat, lng, ... }`;
  GPS is obtained via `expo-location` (already a dependency). The app already requests
  foreground location for prayer times.
- Garden top bar: `TopInfoBar` in `App.tsx` already hosts the Settings gear button
  (top-right). A compass button can mirror it (top-left).
- Dhikr tab: `components/DhikrScreen.tsx` (asPage) already receives `isPremium` and
  `onOpenPaywall`; it is the natural home for the reflection card.
- Premium: `hooks/usePremium.ts` (`isPremium`); `components/PaywallModal.tsx`
  (`triggerReason`). Notifications: `hooks/useNotifications.ts`.
- Fonts: `theme/typography.ts` (`FONTS.display`, `FONTS.arabic`).

## Architecture

Navigation/placement (no new bottom-bar item):
- Add a compass icon button to `TopInfoBar` (top-left) → opens the Qibla view.
- Qibla renders as a full-screen overlay/page reached via an `activeTab`-style flag or
  a dedicated modal; it follows the existing full-screen surface styling.
- The Daily Reflection card mounts inside `DhikrScreen` above the Tasbih section.

Qibla data flow:
- On mount, resolve coordinates: prefer `manualCoords`; otherwise call
  `Location.getCurrentPositionAsync` (permission already granted for prayer times).
- Compute the Qibla bearing once (pure function) from coordinates to the Kaaba.
- Subscribe to `Magnetometer` for heading; the compass dial rotates by `-heading` and
  the Kaaba marker sits at `bearing`. Unsubscribe on unmount/blur.

Reflection data flow:
- `data/reflections.ts` holds a bundled, typed, owner-verified list.
- Today's index = day-of-year mod list length (deterministic per day).
- Favourites persist to AsyncStorage; archive browsing is premium-gated.

Premium gating is reactive: components read `usePremium().isPremium` and locked
overlays vanish when the entitlement flips, with no restart.

## Components and Interfaces

| File | Change |
|---|---|
| `App.tsx` | Compass button in `TopInfoBar`; render `QiblaScreen`; wire coords + premium |
| `components/QiblaScreen.tsx` (new) | Compass dial, Kaaba marker, heading, fallbacks |
| `hooks/useQibla.ts` (new) | Resolve coords, compute bearing, magnetometer heading subscription |
| `components/DailyReflectionCard.tsx` (new) | Today's reflection card + archive/favourites entry |
| `hooks/useReflections.ts` (new) | Today's pick, favourites persistence, archive access |
| `data/reflections.ts` (new) | Bundled, owner-verified reflections (VERIFY flagged) |
| `components/DhikrScreen.tsx` | Mount the reflection card above Tasbih |
| `components/PaywallModal.tsx` | New `reflection_archive` trigger reason + copy |
| `package.json` | Add `expo-sensors` |

Key interfaces:
- `TopInfoBar` gains `onOpenQibla: () => void`.
- `QiblaScreen` props: `coords: { lat: number; lng: number } | null`, `onClose: () => void`.
- `DhikrScreen` gains an embedded `DailyReflectionCard` (uses `isPremium`,
  `onOpenPaywall`).
- `PaywallModal.triggerReason` extends to include `'reflection_archive'`.

## Data Models

```ts
// hooks/useQibla.ts
const KAABA = { lat: 21.4225, lng: 39.8262 };

// Great-circle initial bearing (degrees, 0..360 clockwise from true north).
function qiblaBearing(lat: number, lng: number): number;

interface QiblaState {
  bearing: number | null;     // null until coords resolved
  heading: number;            // 0..360 from magnetometer
  aligned: boolean;           // |heading - bearing| within tolerance
  status: 'ok' | 'no-location' | 'no-sensor' | 'loading';
}
```

```ts
// data/reflections.ts
type ReflectionKind = 'ayah' | 'hadith';

interface Reflection {
  id: string;
  kind: ReflectionKind;
  arabic?: string;          // VERIFY (ayat/hadith text where shown)
  translation: string;      // VERIFY
  source: string;           // VERIFY (e.g. "Qur'an 2:152", "Bukhari 6407")
}
```

Persistence keys (AsyncStorage, on-device only):
- `@GrowPray:reflectionFavourites` → `string[]` (reflection ids; premium)
- Reflection reminder reuses the existing `@GrowPray:notificationsEnabled` flow with a
  dedicated daily notification identifier; no new permission.

## Correctness Properties

### Property 1: Bearing correctness
For known coordinates the computed Qibla bearing matches the great-circle bearing to
the Kaaba within a small tolerance.

**Validates: Requirements 1.2, 1.3**

### Property 2: Sensor lifecycle
Leaving the Qibla view stops magnetometer updates (no lingering subscription).

**Validates: Requirements 1.8**

### Property 3: Qibla never gated
The Qibla feature is always available regardless of entitlement.

**Validates: Requirements 1.6**

### Property 4: Graceful degradation
With no sensor or no location, the Qibla view shows a fallback (and the numeric bearing
when coordinates exist) rather than crashing.

**Validates: Requirements 1.5**

### Property 5: Deterministic daily reflection
For a given calendar day the selected reflection is stable and identical across reads.

**Validates: Requirements 2.1, 2.2**

### Property 6: Archive gated, today free
A non-premium user can always read today's reflection but cannot open the archive; a
premium user can browse the archive and persist favourites.

**Validates: Requirements 2.4, 2.5**

### Property 7: No new permission
Enabling Qibla introduces no OS runtime permission beyond the existing location access.

**Validates: Requirements 4.2**

## Error Handling

- Coordinate resolution and magnetometer subscription are wrapped in try/catch; on
  failure the Qibla view shows `no-location` / `no-sensor` states with guidance.
- The bearing helper guards against invalid coordinates and normalises to 0..360.
- AsyncStorage reads/writes for favourites fall back to an empty list on failure.
- Reflection selection guards against an empty list (renders nothing rather than
  crashing) and out-of-range indices.

## Testing Strategy

- `tsc --noEmit` clean and `get_diagnostics` clean after each task.
- Unit-style checks for pure helpers: `qiblaBearing` against known cities (e.g. London
  ≈ 119°, New York ≈ 58°) within tolerance; daily-index determinism.
- Manual matrix (dev Toggle Premium):
  - Qibla: dial rotates with device, Kaaba marker points correctly, aligned cue fires;
    fallback shown when sensor/location missing; updates stop on close.
  - Reflection: today's card shows for free; archive/favourites locked for free and
    open the paywall; premium can browse + favourite; daily reminder schedules.
  - Garden still pans/zooms; bottom bar still five items.

## Out of Scope

- Sunnah/Nafl/Qada tracking (separate future spec).
- Premium garden environments/art (deferred — needs assets).
- Reflection authoring/editing UI (content is bundled and owner-curated).
- Map-based or AR Qibla; only a magnetometer compass is in scope.
