# Jannah Garden (Grow & Pray)

A gamified Islamic prayer tracker built with React Native and Expo. Maintain your daily prayers to grow a beautiful isometric garden — miss prayers and watch it decay.

## Features

- **Prayer Tracking** — Five daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) with active/grace/missed states
- **XP & Coin Economy** — Earn XP (+5 on-time, +3 in grace) and coins for completing prayers
- **Per-Prayer Streaks** — Each of the 5 prayers tracks its own streak independently
- **Isometric Garden** — Tile-by-tile recovery from center outward as you earn XP
- **Tree Planting** — Plant trees on recovered tiles; trees grow through 4 stages (sapling → growing → grown → flourishing)
- **Garden Decay** — Stop praying and your garden decays ring-by-ring; planted trees wither and die
- **Dead Tree Removal** — Chop dead trees on recovering tiles for coins (with axe animation)
- **Shop System** — Buy tree types (Palm, Oak, Willow, Cherry Blossom, Maple, Golden, Cedar) and streak freezes
- **Two-Finger Rotation** — Twist gesture to rotate the isometric view in 90° increments
- **Pinch-to-Zoom & Pan** — Full gesture support with momentum scrolling
- **Configurable Grace Period** — Choose 15/30/45/60 minute grace windows
- **Rest Period** — Menstruation mode pauses tracking
- **Debug Panel** — Time-travel testing for decay system (dev only)

## Tech Stack

- **Framework**: React Native + Expo (Managed workflow)
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS for RN)
- **Gestures**: react-native-gesture-handler (Pan, Pinch, Rotation)
- **Storage**: AsyncStorage
- **Notifications**: expo-notifications
- **Haptics**: expo-haptics

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (iOS/Android)

### Install & Run

```bash
# Install dependencies
npm install

# Start the dev server
npx expo start --tunnel --clear
```

Scan the QR code with Expo Go to run on your device.

## Project Structure

```
App.tsx                  # Main app (prayer UI, modals, state orchestration)
components/
  GardenScene.tsx        # Isometric garden renderer (tiles, trees, gestures)
  ShopModal.tsx          # Shop UI (trees tab, freezes tab)
  PrayerTimeline.tsx     # Prayer time display
  OnboardingScreen.tsx   # First-launch onboarding
hooks/
  useGardenState.ts      # Garden data, tile states, decay, planting, inventory
  usePrayerTimes.ts      # Prayer time calculations
  useNotifications.ts    # Push notification scheduling
assets/
  Garden Assets/         # Isometric tiles, tree sprites, icons, effects
```

## License

Private — All rights reserved.
