# Pending release

Nothing below has shipped. Owner is holding until they're ready.

## Ready to OTA (`eas update --branch production`)

Pure JS/asset changes - reach existing installs without a new build.

- **Prayer time staleness fix** (`9abc791`) - times were computed once and never
  recomputed; also fixes manual-city timezone and `nextPrayer` clock.
- **Notification drift fix** (`2e59f26`) - prayer alerts were a fixed daily
  repeating alarm and drifted ~2 min/day. Also fixes the countdown flashing
  "23h 59m" at prayer handover.
- **Win-back ladder** (`60c345b`) - day 4/8/15/30 re-engagement notifications.
- **Onboarding polish** (`d61026a`, JS parts) - localized currency, sapling
  planting payoff, user's name surfaced, streak-freeze onboarding option,
  paywall growth preview geometry.
- **Garden preview captions** (`5b6710d`) - prayer counts instead of misleading
  "Day 1 / Week 1 / Month 1".

## Needs a native build + submit (`eas build` → `eas submit`)

OTA cannot deliver these.

- **App icon** (`d61026a`) - `Logo_3.png` as the iOS icon, and `App_Logo.png`
  alpha fix for the Android adaptive icon / web favicon. Icons are baked into
  the binary.

## Blocked on Apple, not on us

- **Localized currency** will keep showing USD fallbacks until the subscription
  products leave "Prepare for Submission" in App Store Connect. The code is
  correct and resolves itself on the next app launch once they're approved.
  Apple requires the first subscription group to be submitted with an app
  version.
- **14-day trial** - App Store Connect intro offers still need changing from
  1 week to 2 weeks on BOTH the monthly and yearly products, to match
  `PREMIUM_PLANS.trialDays`.
