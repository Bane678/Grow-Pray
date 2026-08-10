# Pending release

## In flight

**iOS production build** `64fd249c-f79d-4020-92c0-9bf58696f4b1`
https://expo.dev/accounts/bane678/projects/grow-pray/builds/64fd249c-f79d-4020-92c0-9bf58696f4b1

All 21 pending commits are pushed (`master` = `7a26c9e`) and included in this
build. Version 1.0.0; the build number is auto-incremented by EAS
(`autoIncrement: true`, `appVersionSource: "remote"`), so nothing in `app.json`
needs bumping by hand.

Once it finishes: `npx eas-cli@latest submit --platform ios --profile production`

## What's in it

- Prayer alerts no longer drift (~2 min/day previously) - rolling 10-day window
  of individually dated alarms instead of one repeating alarm.
- Win-back notifications at day 4/8/15/30 so the app stops going silent.
- Countdown no longer flashes "23h 59m" at prayer handover.
- Upcoming prayer and countdown ring share one colour; urgent state when a
  prayer window is closing.
- Onboarding: localized currency, sapling planting payoff, user's name used,
  Qur'an/hadith/annotation card, rebuilt plan selector.
- New app icon (needed this native build - OTA cannot deliver icons).
- Rest period no longer traps the user in Settings.
- Tree swaps are instant; level-up FX only fires on real level-ups; error sound
  on invalid drop.

## Still blocked on Apple, not on us

- **Localized currency** keeps showing USD fallbacks until the subscription
  products leave "Prepare for Submission" in App Store Connect. The code is
  correct and resolves itself on the next app launch once approved. Apple
  requires the first subscription group to be submitted with an app version -
  this build is that opportunity.
- **14-day trial** - App Store Connect intro offers still need changing from
  1 week to 2 weeks on BOTH the monthly and yearly products, to match
  `PREMIUM_PLANS.trialDays`. Do this before/with submission or the paywall
  copy will not match what Apple charges.

## Note

Existing TestFlight testers stay on the old build until they install this one.
If you want the JS-only fixes to reach them sooner, an OTA to the production
channel would do it: `npx eas-cli@latest update --branch production`. The icon
still requires installing the new build.
