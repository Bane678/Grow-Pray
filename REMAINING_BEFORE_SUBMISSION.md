# Grow Pray — Remaining Work & AI Handoff Guide

> **Purpose of this file:** This is a complete handoff document for the next AI assistant helping Sayeed finish and submit the **Grow Pray** app. It assumes **no prior conversation context**. Read the "Project Context" section first, then work through the steps. Each step has enough detail to act on directly. Ask the user to confirm anything marked **(VERIFY)**.

---

## 📋 Project Context (read this first)

**What it is:** "Grow Pray" — an iOS app that gamifies the 5 daily Islamic prayers (salah). Praying on time grows a virtual garden; missing prayers makes trees wither. Includes streaks, coins/XP, a shop, Qibla compass, dhikr counter, duas, daily reflections, and a day/night sky.

**Tech stack:**
- React Native + **Expo SDK 54**, TypeScript
- **EAS** for builds/submit/updates (`eas build`, `eas submit`, `eas update`)
- `expo-updates` configured (OTA updates possible for JS/asset-only changes)
- `nativewind` (Tailwind for RN), `react-native-reanimated`, `react-native-purchases` (RevenueCat for IAP)
- Prayer times computed **on-device** via the `adhan` library (no API) — see `hooks/usePrayerTimes.ts`

**Key identifiers (already configured in `eas.json` / `app.json`):**
- Bundle ID: `com.antigravity.growpray`
- App Store Connect App ID (ascAppId): `6762623534`
- Apple Team ID: `NZ8X3B789X`
- Apple ID (login): `sayeedali224@gmail.com`
- Expo projectId: `b4abc15f-4bf1-4add-979f-122f1c51bcb7`

**Key files:**
- `App.tsx` — the main app (~4600 lines, monolithic). Contains the root component, `usePrayerState`, and the `SkyBackground` component (day/night).
- `hooks/` — `usePrayerTimes.ts` (adhan, computes `Sunrise`/`Sunset`), `usePrayerState`, `useGardenState`, `usePremium`, `useDhikr`, `useQibla`, `useTutorial`, `usePrayerInsights`, `useReflections`, `useNotifications`, `useChallenges`, `useBoosts`.
- `components/` — `GardenScene`, `OnboardingScreen`, `ShopModal`, `PaywallModal`, `ChallengesModal`, `SettingsModal`, `PrayerHistoryModal`, `DhikrScreen`, `QiblaScreen`, `TutorialOverlay`, `InsightsView`, `DailyReflectionCard`.
- `index.html` — marketing landing page (deployed to growpray.com).
- `support.html`, `privacy-policy.html` — legal/support pages.
- `web-assets/` — web-optimised copies of art with clean, space-free filenames (used by `index.html`).
- `APP_STORE_METADATA.md` — all listing copy (description, keywords, IAP product IDs, prices).
- `SUBMISSION_CHECKLIST.md` — the original full step-by-step (field-by-field values for App Store Connect).

**Art assets:** `assets/Garden Assets/` → `Icons/`, `Effects/`, `Ground Tiles/`, `Tree Types/`. There are **8 tree species** (Oak, Maple, Cherry Blossom, Willow, Palm, Cedar, Golden, Basic/Classic), each with growth stages (Sapling → Growing → Grown → Flourishing). Prayer icons (Fajr/Dhuhr/Asr/Maghrib/Isha), a seedling mascot (`Icon_Seedling.png`), sky backdrops (`Daytime_Sky.png`, `Starry_Night_Sky.png`), and effects (falling leaves, pollen, sparkles).

**Infrastructure already set up:**
- Domain **growpray.com** (Namecheap). DNS: 4 A records → GitHub Pages IPs (`185.199.108–111.153`) + `www` CNAME → `bane678.github.io`. Email records for Purelymail also live (do NOT delete the MX/TXT/DKIM/DMARC records).
- Email **support@growpray.com** (Purelymail) — working.
- Website hosted via **GitHub Pages** on repo **`Bane678/Grow-Pray`** (branch `master`, root). A `CNAME` file in the repo points it at growpray.com.
- Business/trader info (for Apple DSA): Capital Office virtual address **124 City Road, London, EC1V 2NX**; DSA contact email `support@growpray.com`. Already submitted + address verified with an uploaded invoice.

**How to deploy website changes:** edit files → `git add` → `git commit` → `git push origin master`. GitHub Pages redeploys automatically (~1 min). The repo remote is `https://github.com/Bane678/Grow-Pray.git`.

---

## ✅ Already done

- App record created in App Store Connect; `eas.json` submit credentials filled.
- A production build was made and uploaded to TestFlight — **but it's an early build** (see Step 1).
- Internal TestFlight testing + beta "Test Information" filled.
- Apple **DSA / trader info** submitted and address verified.
- Domain, email, hosting, landing page, privacy + support pages all live.

---

## ⚠️ STEP 1 — Fresh production build with all current features (CRITICAL)

The TestFlight build is **older than** these features, which are committed in the repo but NOT in that build:
- Dhikr screen, Qibla screen, first-run tutorial, prayer insights, daily reflections
- **Day/night sky** background system (in `App.tsx` → `SkyBackground`)
- Onboarding redesign, indopak Arabic font, removal of the old "difficult day" feature, bug fixes

**Before building, remove the debug override:**
- Open `App.tsx`, find the `SkyBackground` component → `computeIsDay()` callback.
- There is a temporary debug line forcing daytime:
  ```js
  // DEBUG: force daytime — remove this line to restore real day/night logic
  return true;
  ```
  **Delete both that comment and the `return true;` line.** If left in, the app is permanently stuck on the daytime sky.

**Then build:**
```
eas build --profile production --platform ios
```
Cloud build, ~20–40 min. Requires the user's Expo + Apple login (interactive) — have the user run it in their own terminal.

**Faster iteration option (recommended for the AI to suggest):** build a development client once with
`eas build --profile development-device --platform ios`, install on the iPhone, then `npx expo start --dev-client --tunnel`. After that, JS/image changes hot-reload live on device (Expo Go won't work — the app has custom native modules).

---

## STEP 2 — Verify subscriptions & IAPs are "Ready to Submit" (VERIFY)

The app references these product IDs (via RevenueCat). They must exist in App Store Connect → Monetization, each with price + English localization, in **"Ready to Submit"** state:
- Subscription group **Grow Pray Premium**:
  - `growpray_premium_monthly` — $6.99/mo, 7-day trial
  - `growpray_premium_yearly` — $44.99/yr, 7-day trial
- Consumable coin IAPs: `growpray_coins_500` ($0.99), `growpray_coins_1500` ($2.99), `growpray_coins_5000` ($7.99), `growpray_coins_12000` ($14.99)

Field-by-field values are in `SUBMISSION_CHECKLIST.md` Step 3. **Ask the user whether these are already created.**

---

## STEP 3 — Screenshots (NOT done)

Required for the App Store listing AND needed to fix the website (Step 7 below).
- Capture: garden view, prayer timeline, dhikr screen, qibla screen, shop, (optional) insights/streaks.
- Sizes: **6.9"/6.7"** iPhone Pro Max is the main required set; iPad 13" too (`supportsTablet: true` in `app.json`).
- On Windows (user's OS) there's no iOS simulator — capture on a real iPhone via the dev/TestFlight build, or use a Mac/cloud Mac.
- Upload into the matching slots in App Store Connect.

---

## STEP 4 — Finish App Store listing metadata (VERIFY)

App Store Connect → **App Store** tab → **1.0 Prepare for Submission**. Pull copy from `APP_STORE_METADATA.md`:
- Name `Grow Pray - Daily Prayer Tracker`, Subtitle `Grow a garden through prayer`
- Category Health & Fitness (secondary Lifestyle), Age rating 4+
- Description, keywords, promotional text — from `APP_STORE_METADATA.md`
- **Privacy Policy URL** → `https://growpray.com/privacy-policy.html`
- **Support URL** → `https://growpray.com/support.html`
- Review notes (template in `SUBMISSION_CHECKLIST.md` Step 7)

> ⚠️ `APP_STORE_METADATA.md` still lists old `bane678.github.io` URLs. Use the **growpray.com** URLs instead.

---

## STEP 5 — Confirm domain + HTTPS live

- [ ] growpray.com loads the landing page; tick **Enforce HTTPS** in GitHub Pages settings once the SSL cert is provisioned.
- [ ] Verify `growpray.com/support.html` and `growpray.com/privacy-policy.html` load.

---

## STEP 6 — 🌐 Redesign the lower landing page sections (USER PRIORITY)

**User's complaint:** "Only the first page (the hero) looks interesting and high quality. Every other section looks generic and AI-generated. Fix that."

**Context for the AI:** `index.html` is a single-file site (inline CSS + a little JS). The **hero** works because it's an immersive layered garden *scene* (sky image, ground strip, real trees, mascot, drifting particles, a real phone screenshot). Everything below reverts to flat dark-navy boxes and **mocked-up fake UI**, which is what reads as generic.

**Specific problems to fix (these sections in `index.html`):**
1. **Feature rows (`.frow` / `.fr-visual`)** currently show **HTML re-creations** of the app (a fake "prayer times" list, and `.reward-grid` icon-in-a-box tiles). These are the biggest "AI slop" tell. **Replace them with real app screenshots** (from Step 3) inside phone frames.
2. **`.reward` icon tiles** (small icon centered in a rounded box) — generic SaaS pattern. Replace with real screenshots or richer illustrated compositions.
3. **Tree collection (`.tree-grid` / `.tree-card`)** — floating cards. Make it feel like a garden shelf: trees rooted on a ground strip at varied heights.
4. **"Anywhere" night section (`.phone-pair`)** reuses ONE screenshot twice — swap in different real screenshots.
5. **Hard rectangular section edges** — add organic dividers (hills / leaf silhouettes) like the hero's horizon.
6. **No environmental continuity** — the garden world (sky, ground, trees, mascot) vanishes after the hero. Carry it through: a continuous ground/scenery, the seedling mascot reappearing as a "guide" beside sections (Habitica-style), and ideally a **sky gradient that shifts dawn → midday → dusk → starry night as you scroll** (mirrors the 5 prayers).

**Assets available for this** (in `web-assets/`, clean names): `sky-day.png`, `sky-night.png`, `screenshot.png`, `seedling.png`, all 8 trees (`tree-oak.png` … `tree-golden.png`), growth stages (`stage-sapling/growing/grown/flourishing.png`), prayer icons (`fajr.png`…`isha.png`), game icons (`icon-fire/coin/xp/trophy/location/hands/scroll/moon.png`), effects (`leaf.png`, `pollen.png`, `sparkle.png`), `grass.png`. To add more, copy from `assets/Garden Assets/...` into `web-assets/` with simple names (avoid spaces — spaces break on GitHub Pages).

**Note:** There's also a removable **night theme** for the whole page — adding `class="night"` to the `<body>` tag switches it on; removing the word reverts. The user previously tried full-night and reverted to day, so keep the daytime hero unless they ask otherwise.

**Goal:** every section should feel as crafted and "alive" as the hero, using real product art/screenshots — not abstract icon tiles or fake UI.

---

## STEP 7 — 🍎 Replace the fake App Store badge with the official one (USER PRIORITY)

**User's complaint:** The "Download on the App Store" badge on the landing page is an AI-recreated/CSS version, not the real Apple one. Use the genuine official badge.

**Where it is:** In `index.html`, search for `class="store-badge"` — it's a CSS-built fake (an apple glyph + "Download on the / App Store" text). It appears **3 times** (hero, the "anywhere" section, and there's also a `.btn-primary` "Download free" button in the CTA band).

**How to fix:**
1. Download the **official Apple "Download on the App Store" badge** from Apple's marketing guidelines: https://developer.apple.com/app-store/marketing/guidelines/ (the "App Store Badges" section provides official SVG/PNG assets in multiple languages/locales). Use the black badge to match the dark site.
2. Save it into `web-assets/` (e.g. `app-store-badge.svg`).
3. Replace each `.store-badge` block with an `<a>` wrapping an `<img>` of the official badge, e.g.:
   ```html
   <a href="REAL_APP_STORE_URL"><img src="web-assets/app-store-badge.svg" alt="Download on the App Store" style="height:54px"></a>
   ```
4. **Follow Apple's rules:** don't recolor/distort it, keep the required clear space around it, and respect minimum size. These are enforced in Apple's guidelines.
5. The `href` should be the real App Store URL — **not available until the app is approved** (Step 9). Until then, leave a clear `TODO` placeholder and update post-approval.

After editing: commit + push to deploy (`git add . && git commit -m "..." && git push origin master`).

---

## STEP 8 — TestFlight the fresh build

Once the Step 1 build processes:
- [ ] Install via TestFlight; verify end-to-end:
  - Day/night sky switches correctly and ISN'T stuck (debug line removed)
  - Dhikr counter works/resets, Qibla points correctly, tutorial shows for new users
  - Notifications, location, prayer times correct
  - Premium subscribe + Restore Purchases (sandbox)
- [ ] External testers (optional) require Apple's short beta review.

---

## STEP 9 — Submit for review

- [ ] `eas submit --profile production --platform ios --latest`
- [ ] In App Store Connect, attach the new build to version 1.0.
- [ ] Confirm screenshots, metadata, IAPs all attached; age rating 4+.
- [ ] **Submit for Review** (Apple usually responds in 1–3 days).

---

## STEP 10 — Post-approval

- [ ] Get the real App Store URL and update the official badge `href` (Step 7) + the `.btn-primary` link in `index.html`. Commit + push.
- [ ] Begin the marketing campaign.

---

## Quick status

- [ ] 1 — Remove debug line + fresh production build (all features)
- [ ] 2 — Verify subscriptions & IAPs "Ready to Submit"
- [ ] 3 — Screenshots
- [ ] 4 — Finish App Store metadata (use growpray.com URLs)
- [ ] 5 — Confirm domain + HTTPS live
- [ ] 6 — Redesign lower landing page sections (real screenshots, garden continuity, organic dividers)
- [ ] 7 — Replace fake App Store badge with official Apple asset
- [ ] 8 — TestFlight the fresh build
- [ ] 9 — Submit for review
- [ ] 10 — Post-approval badge link + marketing

---

*Bismillah. The hard part's done — this is the home stretch. 🌿🚀*
