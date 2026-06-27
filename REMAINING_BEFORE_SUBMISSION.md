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


---

# 🖥️ Running the growpray.com website locally (for the next AI)

The landing page (`index.html`), `support.html`, and `privacy-policy.html` are plain static files served from the **project root**. No build step.

**Start a local preview server** (the user is on Windows; use this exact command from the project root):
```
python -m http.server 8080
```
Then open **http://localhost:8080/** (also `/support.html`, `/privacy-policy.html`).
> Treat this as a long-running background process — start it in the background, don't block on it. To stop it, kill the process.

**Share a live preview with someone (temporary public URL):** in a second terminal:
```
npx ngrok http 8080
```
Copy the `https://….ngrok-free.app` URL it prints. (ngrok account on file: `Killerbane678`, free plan. First-time visitors see an ngrok interstitial — they click "Visit Site".)

**Deploy changes to the real growpray.com** (GitHub Pages auto-deploys on push):
```
git add . && git commit -m "..." && git push origin master
```
Repo: `https://github.com/Bane678/Grow-Pray.git` · branch `master` · Pages serves the root · a `CNAME` file in the repo binds it to growpray.com. Push the progress flag if PowerShell mis-reports git's stderr: `git push origin master --progress`.

---

# 📚 Full Context Reference

**Machine / environment**
- Project path: `c:\Users\sayee\.gemini\antigravity\scratch\jannah-garden`
- OS: Windows (shell: PowerShell/cmd). No iOS simulator available (can't screenshot via simulator — use a real iPhone).
- Note: the shell sometimes drops the FIRST character of a command — if a command errors with a mangled first word, just re-run it.

**Owner**
- Name: Sayeed Ali (full legal: Mohammad Raihan Sayeed Ali)
- Personal Apple ID / dev login: `sayeedali224@gmail.com`
- Home address (do NOT use publicly — used only where a personal address is unavoidable): 53 Bradford Road, Portsmouth, PO5 1AA, UK
- ⚠️ **Working rule the user explicitly asked for:** if you are unsure of a specific detail (an address, a number, a name), **ASK — never make it up.** (This came from an incident where a placeholder address was invented.)

**Apple / App Store Connect**
- App name: `Grow Pray - Daily Prayer Tracker`
- Bundle ID: `com.antigravity.growpray`
- ASC App ID (ascAppId): `6762623534`
- Apple Team ID: `NZ8X3B789X`
- TestFlight: an early build is uploaded (builds 1–9 visible). Internal testing group includes tester `d0rpit`. Beta "Test Information" filled; feedback email `support@growpray.com`; sign-in NOT required (no accounts).
- DSA / trader info: SUBMITTED and address VERIFIED. Trader address = the virtual office below. DSA contact email `support@growpray.com`. Verified by uploading the Capital Office invoice (`order-invoice-15271171`).

**Business / address**
- Virtual office (registered/trader address): **124 City Road, London, EC1V 2NX** — provider **Capital Office Ltd** (yourvirtualofficelondon.co.uk). Their phone `+44 (0)207 566 3939` is THEIRS, not the user's. Service: Registered Office Address, 12 months, expires 19-Jun-2027.

**Domain & DNS (Namecheap)**
- Domain: **growpray.com**
- Website DNS: 4 × A records on `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (GitHub Pages) + CNAME `www` → `bane678.github.io.`
- ⚠️ **Do NOT delete the email DNS records** (they keep `support@growpray.com` working): MX `@` → `mailserver.purelymail.com` (priority 50); TXT `@` SPF `v=spf1 include:_spf.purelymail.com ~all`; TXT `@` purelymail ownership; CNAME DKIM `purelymail1/2/3._domainkey` → `key1/2/3.dkimroot.purelymail.com`; CNAME `_dmarc` → `dmarcroot.purelymail.com`.

**Email**
- `support@growpray.com` via **Purelymail**. Account login `sayeed@purelymail.com`. Webmail at purelymail.com → Webmail. Used as the public support + feedback + DSA contact address.

**The app (tech)**
- React Native + **Expo SDK 54**, TypeScript. EAS build/submit/update. `expo-updates` (OTA possible for JS/asset-only changes). RevenueCat (`react-native-purchases`) for IAP. `adhan` lib computes prayer times on-device. `nativewind`, `reanimated`.
- Expo projectId: `b4abc15f-4bf1-4add-979f-122f1c51bcb7`.
- **Cannot run in Expo Go** (custom native modules). For live-reload dev: build a dev client (`eas build --profile development-device --platform ios`), install on iPhone, then `npx expo start --dev-client --tunnel`.
- Data storage: **all local on device** via AsyncStorage. No accounts, no cloud, no server, no ads. (Cloud backup is a future idea.)
- `App.tsx` is a ~4600-line monolith holding the root component, `usePrayerState`, and `SkyBackground`.

**Features in the app**
- 5-prayer tracking with on-device times + notifications; garden that grows trees per prayer (withers when missed); per-prayer streaks + milestones (7/30/100); coins + XP; consistency multiplier; Garden Shop (8 tree species, streak freezes, expansions); weekly challenges; Ramadan mode (2× XP); Qibla compass; dhikr/tasbih counter (**indopak** Arabic font); authentic duas (after salah, morning, evening, sleep, travel — these are FREE, not premium); daily ayah/hadith reflection; first-run tutorial; prayer insights; premium subscription.
- **Removed:** the old "difficult day" feature (deleted everywhere).
- **Day/night sky** (`SkyBackground` in `App.tsx`): crossfades `Daytime_Sky.png` / `Starry_Night_Sky.png` based on real sunrise/sunset; snaps instantly on open; rechecks via timer + AppState. ⚠️ Currently has a DEBUG `return true;` forcing daytime in `computeIsDay()` — REMOVE before production build.

**Monetisation (must exist in App Store Connect, "Ready to Submit")**
- Subscriptions group "Grow Pray Premium": `growpray_premium_monthly` $6.99/mo (7-day trial), `growpray_premium_yearly` $44.99/yr (7-day trial).
- Consumable coins: `growpray_coins_500` $0.99, `growpray_coins_1500` $2.99, `growpray_coins_5000` $7.99, `growpray_coins_12000` $14.99.

**Landing page structure (`index.html`) — current state after redesign**
- Single file, inline CSS + small JS. Fonts: Fraunces (headings) + Nunito (body). Palette: dark navy + emerald + gold.
- Hero = a full daytime garden scene (sky image, grass ground, swaying trees, bobbing seedling mascot, drifting particles, phone with `web-assets/screenshot.png`). **User loves the hero — don't break it.**
- Below the hero: ONE continuous day→night gradient on `<body>` so sections flow with no flat-box seams; sections are transparent. The mascot reappears as a guide; trees are rooted into sections; particles drift across all sections; tree collection is a "garden shelf" on a grassy mound; the prayer feature is shown inside a phone frame ("Today's Prayers"); reward/tools tiles sit on grassy "garden cards".
- **Two `SWAP-IN POINT` HTML comments** mark where real screenshots should replace mockups (the mini-phone prayer screen, and the night-section phone pair which currently reuses one screenshot).
- A removable full-page **night theme** exists: add `class="night"` to `<body>` to enable, remove the word to revert. (User tried full-night once and reverted to day — keep daytime hero unless asked.)
- **App Store badge is still a CSS fake** (`.store-badge`, appears 3×) — Step 7 replaces it with Apple's official badge + real store URL post-approval. There's a TODO comment above `.store-badge` in the CSS.
- `web-assets/` holds clean, space-free copies of all art the page uses (originals live in `assets/Garden Assets/...` which have SPACES in paths — those spaces break on GitHub Pages, hence the copies). To add art: copy into `web-assets/` with a simple lowercase-dashed name.

**User working style (helps the next AI)**
- Prefers you to **act** and build rather than over-explain; says things like "just start building".
- Not deeply technical with deployment/Apple tooling — give **click-by-click** browser steps for App Store Connect, Namecheap, GitHub, etc.
- Has strong design taste; dislikes anything that looks "generic / AI-generated" — push for real assets, real screenshots, scenes with character.
- Wants honesty over flattery, and to be asked when a detail is unknown.

---

# 🧠 Memory Primer — paste this into a new AI to transfer context

> Copy everything in the block below into the new AI at the start of your session (or save it to its long-term memory). It encodes the project state so the new assistant can continue seamlessly.

```
You are helping Sayeed finish and ship "Grow Pray" — an iOS app (React Native + Expo SDK 54, TypeScript) that gamifies the 5 daily Islamic prayers as a growing garden. The project lives at c:\Users\sayee\.gemini\antigravity\scratch\jannah-garden on Windows.

STATUS: The app's code is essentially complete (prayer tracking, garden, streaks, coins/XP, shop with 8 tree species, Qibla compass, dhikr counter with indopak font, free duas, daily reflection, first-run tutorial, insights, Ramadan mode, premium subscription, and a day/night sky that crossfades on real sunrise/sunset). Data is stored locally only (AsyncStorage) — no accounts, no cloud, no ads. The old "difficult day" feature was removed. An early build is on TestFlight; DSA trader info is submitted and the address is verified.

KEY IDS: bundle com.antigravity.growpray · ascAppId 6762623534 · Apple Team NZ8X3B789X · Apple ID sayeedali224@gmail.com · Expo projectId b4abc15f-4bf1-4add-979f-122f1c51bcb7.

INFRASTRUCTURE: Domain growpray.com (Namecheap) → GitHub Pages on repo Bane678/Grow-Pray (branch master; deploy by pushing). Website files: index.html (marketing), support.html, privacy-policy.html, and a web-assets/ folder of clean-named art copies (originals under "assets/Garden Assets/..." have spaces that break on Pages). Email support@growpray.com via Purelymail. Trader/virtual-office address: 124 City Road, London EC1V 2NX (Capital Office). DO NOT delete the Purelymail DNS records (MX/SPF/DKIM/DMARC).

WHAT'S LEFT before App Store submission (see REMAINING_BEFORE_SUBMISSION.md for full detail):
1. Remove the DEBUG `return true;` in App.tsx > SkyBackground > computeIsDay(), then make a FRESH production build (`eas build --profile production --platform ios`) — the TestFlight build predates many features.
2. Verify subscriptions + coin IAPs are "Ready to Submit" in App Store Connect.
3. Take real app screenshots (no simulator on Windows — use a real iPhone).
4. Finish the App Store listing metadata using growpray.com URLs (copy from APP_STORE_METADATA.md).
5. Confirm growpray.com + HTTPS live.
6. Landing page: keep improving the lower sections with REAL screenshots at the two SWAP-IN POINT markers in index.html.
7. Replace the fake CSS App Store badge (.store-badge, 3×) with Apple's official badge + the real App Store URL once approved.
8. TestFlight the fresh build, then submit for review.

RUN THE WEBSITE LOCALLY: `python -m http.server 8080` from the project root → http://localhost:8080/ . Share via `npx ngrok http 8080`.

HOW TO WORK WITH SAYEED: He prefers you to take action and build rather than over-explain. He is NOT a deep technical expert on Apple/DNS tooling, so give clear click-by-click browser steps. He has strong design taste and hates anything that looks generic/AI-generated — favour real assets and real screenshots. Be honest, not flattering. CRITICAL: if you don't know a specific detail (an address, number, name), ASK him — never invent it.
```

---

*This file is the single source of truth for finishing Grow Pray. Bismillah. 🌿🚀*
