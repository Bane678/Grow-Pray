# Grow Pray — Road to App Store Submission

*Rewritten 2026-08-17. Supersedes the 2026-07-22 version, which had gone stale in one
important way: it claimed only one native build had ever existed and that
`ios.buildNumber` mattered. Neither is true any more — see "Build numbers" below.*

**Status: feature-complete. Blocked on screenshots, App Store Connect config, and
content verification — not on code.**

---

## Current state at a glance

| | |
|---|---|
| Version | `1.0.0` |
| Latest build | **#15**, built + submitted to TestFlight 2026-08-17 |
| Code state | Feature-complete; **significant uncommitted work in tree** |
| Blocking submission | Screenshots · ASC subscription state · content verification |

### Build numbers — read this before worrying about `app.json`

`app.json` still says `"buildNumber": "1"`. **This is vestigial and safe to ignore.**
`eas.json` sets `appVersionSource: "remote"` with `autoIncrement: true`, so EAS owns
the build number server-side and bumps it every production build. That's how we
reached build 15 while `app.json` never changed. Do not hand-edit it.

---

## ✅ Done

### Core features
- [x] Prayer times (location-aware, madhab + calculation method settings)
- [x] Qibla compass, smoothed
- [x] Isometric garden: tile recovery, 8 tree species, 4 growth stages
- [x] Per-prayer streaks, streak freezes, consistency multiplier
- [x] Daily + weekly challenges with coin rewards
- [x] Qur'an reader (114 surahs) and Hadith reader (Nawawi's 40)
- [x] Verse annotation + saved reflections
- [x] Dhikr / tasbih counter with adhkar library
- [x] Rest Period (pauses streaks + notifications)
- [x] Shop: trees, coin packs, streak freezes, boosts
- [x] Premium tier via RevenueCat

### Progression & game balance
- [x] Progression curve reworked to an **18-month arc** to max garden size
- [x] Day-one hook restored — first expansion still lands at ~5 prayers
- [x] Full-garden fill capped at ~2.6 years (was ~14 years)
- [x] Rings 9–10 deliberately flattened; they sit past the final expansion gate

### Performance
- [x] Viewport culling for large gardens
- [x] Stopped garden rebuilds while panning a zoomed-out view
- [x] Tree sway driven by one shared clock, stopped when zoomed out
- [x] Tile wind shimmer no longer saturates the UI thread when zoomed out
  *(this was the cause of app-wide jank on other tabs)*
- [x] Tree swap stall removed (non-blocking save)

### Notifications
- [x] Drift fixed — rolling 10-day window of individually dated alarms
- [x] Win-back notifications at day 4 / 8 / 15 / 30
- [x] Deadline warnings before a prayer window closes

### UI & polish
- [x] Countdown ring and "next prayer" unified on one colour (periwinkle + scrim)
- [x] Urgent state when a prayer window is closing
- [x] Onboarding: localized currency, name capture, annotation card, rebuilt plan selector
- [x] Edit mode reworked — pannable, tap-to-select, batch delete, confirm screen
- [x] Chop limit made visible (dimmed axe badges + toast, eased not blinking)
- [x] Level-up FX only fires on real level-ups, not on drag
- [x] Settings icons restyled to match the app palette
- [x] Premium page backdrop made fully opaque
- [x] **Rest Period UI redesigned** — moonlight palette, stepper instead of 10 chips,
      return date, glass overlay banner with progress
- [x] Night sky: baked-in sunrise glow removed from the top edge
- [x] Cloud drift fades out at night (was showing as grey capsules)
- [x] Prayer bar streak flame removed

### Audio
- [x] Invalid-drop error sound (two-tone descending beep)
- [x] Challenge-claim chime (rising C-major arpeggio, decays naturally)

### Bug fixes
- [x] Rest Period no longer traps the user in Settings
- [x] Modals no longer leave the garden unable to pan
- [x] **App-load hang fixed** — asset preload could stall forever without erroring;
      now races a 15s timeout. First paint also no longer hangs on a single image's
      `onLoad` (added `onError` + fallback timeout)
- [x] Countdown "23h 59m" flash at prayer handover

### Compliance & legal
- [x] **Privacy policy corrected** — it claimed coordinates were "never sent to any
      server", but manual city search sends the query to OpenStreetMap/Nominatim and
      coordinates to TimeAPI.io. Both now disclosed by name. *(⚠️ edit is committed
      locally but **not yet deployed** to growpray.com — see Remaining #3)*
- [x] **Paywall copy corrected** — it advertised Morning/Evening/Sleep/Travel adhkar
      as premium; they are all free. Only custom dhikr + dhikr streak are gated
- [x] Paywall now lists all 9 genuinely-gated features (was 5)
- [x] In-app policy links point to HTTPS `growpray.com` directly (was 301-ing to HTTP)
- [x] Security audit passed — no secrets in repo, RevenueCat key is a public SDK key,
      premium validated server-side via entitlements, all dev tools `__DEV__`-gated

### Infrastructure
- [x] Domain, email (`support@growpray.com`), GitHub Pages hosting live
- [x] Apple credentials in `eas.json`; app record + DSA/trader info verified
- [x] Landing page with official App Store badge (URL still a placeholder)
- [x] App icons fixed (opaque 1024×1024 iOS; Android adaptive transparency)

### Dev tooling *(all `__DEV__`-only, never ships)*
- [x] Screenshot Mode: random garden generator (varied size, density, species)
- [x] Growth stages respect ring order — no outer tree more mature than an inner one
- [x] Double-tap to hide/show all UI chrome
- [x] Sky override (Auto / Day / Night) — also drives prayer highlights to match
- [x] Status bar hide toggle
- [x] Coin top-up, Edit Name, Force Show UI
- [x] Debug modal made scrollable + tap-outside-to-dismiss

---

## 🚧 In progress

- [ ] **Night sky upscale** — target 2048×3052. First attempt came back as a 37-colour
      palette PNG which would band visibly on a gradient; needs redoing as true-colour
      PNG-24. Upscayl **desktop** app (not Upscayl Cloud) is the free route.
- [ ] **Daytime sky upscale** — same treatment, same target, not started
- [ ] **App Store screenshots** — design system built (7 slides, see
      `scratchpad/growpray-slides/`, published as a canvas). Needs 3–5 garden PNGs
      saved to disk to embed, then export

---

## ⬜ Remaining before submission

### 1. Commit and push outstanding work ⚠️ *do this first*
Uncommitted: `App.tsx`, `GardenScene.tsx`, `useGardenState.ts`, `PaywallModal.tsx`,
`SettingsModal.tsx`, `privacy-policy.html`, `Starry_Night_Sky.png`.
Unpushed: 3 commits. Untracked: `assets/Background/`, `assets/Screenshots/`,
two `*_Test.png` sky experiments (delete or keep deliberately), `.claude/`.

### 2. Finish screenshots
- Native size **1206×2622** → upload to the **iPhone 6.3" Display** bucket in ASC
  (confirmed accepted; do *not* use the 6.5" bucket)
- One set covers all display sizes — Apple derives the rest
- First 3 uploaded are what shows on the compact install sheet, so lead strong

### 3. Deploy the corrected privacy policy
The fix is in the repo but the **live page still shows the old, inaccurate text**.
Apple checks the live URL. Push to GitHub Pages before submitting.

### 4. App Store Connect — subscriptions ⚠️ *known blocker*
Products are still in **"Prepare for Submission"**. This is why testers see USD
instead of localized currency — the code is correct and resolves itself once Apple
approves. Apple requires the first subscription group to be submitted *with* an app
version, so this clears as part of submission.

**Trial length must be 14 days on both plans** to match `PREMIUM_PLANS.trialDays`.
If ASC still says 7, the paywall lies to the user — a rejection risk.

| Product ID | Price | Trial |
|---|---|---|
| `growpray_premium_monthly` | $6.99/mo | **14 days** |
| `growpray_premium_yearly` | $44.99/yr | **14 days** |

Coin consumables: `growpray_coins_500` ($0.99), `_1500` ($2.99), `_5000` ($7.99),
`_12000` ($14.99) — each needs price + English localization → "Ready to Submit".

### 5. Content verification ⚠️ *yours, not code*
Files carry `// VERIFY` markers because they make religious claims to users:
- **`data/hadith.ts`** (highest priority) — every matn, translation, narrator,
  grade and citation against an authenticated printing of Nawawi's Forty
- **`data/reflections.ts`** — curated daily pool
- **`data/adhkar.ts`** — dhikr/dua content
- `data/quran.json` — established dataset (Tanzil + Yusuf Ali, public domain); lower
  risk, but confirm attribution

### 6. App Store listing metadata
From `APP_STORE_METADATA.md`, using **growpray.com** URLs:

| Field | Value |
|---|---|
| Name | `Grow Pray - Daily Prayer Tracker` |
| Subtitle | `Grow a garden through prayer` |
| Category | Health & Fitness (secondary: Lifestyle) |
| Age rating | 4+ |
| Privacy policy | `https://growpray.com/privacy-policy.html` |
| Support | `https://growpray.com/support.html` |

### 7. Cut a final build
Everything above is JS-only **except the sky images** (native asset change → needs a
real build, not an OTA).
```powershell
eas build --profile production --platform ios --auto-submit
```

### 8. Submit for review
ASC → version page → **Build** section → **+** → select build → confirm age rating,
screenshots, metadata, IAPs → **Submit for Review**. Apple typically replies in 1–3 days.

### 9. Post-approval
- [ ] Get the real App Store URL
- [ ] Replace the `href="#"` placeholders on the two `.store-badge` links in
      `index.html` (marked with a `TODO`)
- [ ] Commit + push — GitHub Pages redeploys automatically

---

## Reference — key identifiers

| | |
|---|---|
| Bundle ID | `com.antigravity.growpray` |
| ASC App ID | `6762623534` |
| Apple Team ID | `NZ8X3B789X` |
| Apple dev login | `sayeedali224@gmail.com` |
| Expo project ID | `b4abc15f-4bf1-4add-979f-122f1c51bcb7` |
| RevenueCat entitlement | `premium` |
| Domain | `growpray.com` (Namecheap DNS → GitHub Pages) |
| Support email | `support@growpray.com` (Purelymail) |
| Trader address (DSA) | 124 City Road, London, EC1V 2NX (Capital Office Ltd, verified) |

### Known inconsistency worth resolving
`SettingsModal.tsx` uses `sayeedali224@gmail.com` as the in-app support address,
while the privacy policy tells users to contact `support@growpray.com`. Pick one.

---

*Bismillah. The code is done — what's left is content, config and assets.*
