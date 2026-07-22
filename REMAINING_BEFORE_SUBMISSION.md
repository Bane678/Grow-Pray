# Grow Pray — Remaining Work Before App Store Submission

*Rewritten 2026-07-22. Supersedes the previous version of this file, which was stale — most of what it flagged (debug daytime override, landing page redesign, official App Store badge, Apple credentials in eas.json) is already done. This version reflects the actual current state of the repo.*

---

## Where things actually stand

The app's feature set is essentially complete and has been evolving fast — dozens of commits since the last native build, including a full Qur'an reader, a Hadith reader (Nawawi's 40), verse annotation tools, a redesigned reflections hub, a smoothed Qibla compass, and many bug fixes. All of that has been shipped to current testers via **OTA update** (`eas update`), not a new native build.

**That's the critical thing to understand: `app.json`'s `ios.buildNumber` is still `"1"`.** Only one native build has ever existed. Apple's App Review only ever evaluates what's baked into a submitted `.ipa` — it cannot see OTA updates. So before you can submit for review, you need a **fresh native build** that bakes in everything currently on `master`. This is Step 1 below and it blocks everything after it.

---

## Step 1 — Fresh production build (CRITICAL, blocks everything else)

**What this is:** compiling a brand-new `.ipa` from the current code and uploading it to TestFlight/App Store Connect as build #2. See the "What is a build, really?" explainer below if the concept is unclear — short version: yes, this bakes in every change since build 1, and it's the only way Apple's reviewers ever see this session's work.

```powershell
eas build --profile production --platform ios
```

- Cloud build, ~20–40 min. Requires your Expo + Apple login (interactive) — run it yourself in your terminal so you can approve any prompts.
- When prompted about credentials, select **"Manage by Expo"** — it handles provisioning/certificates automatically (it already did this for build 1).
- You'll get a link to watch progress at expo.dev/builds.
- Once it finishes, it needs ~15–30 min more to process into TestFlight automatically — no separate upload command needed for TestFlight itself.

**After it processes:** install it via TestFlight and do a real pass — this is the first time all of this session's features exist in a build a reviewer could see:
- [ ] Qur'an reader — open a few surahs, including a long one (Al-Baqarah)
- [ ] Hadith reader — grade badges, citations display correctly
- [ ] Heart + annotate a verse, confirm it appears correctly in Saved
- [ ] Qibla compass — smoothness feels right
- [ ] Custom dhikr counter — target changes preserve count
- [ ] Full onboarding flow start to finish
- [ ] Location + notification permissions, prayer times correct
- [ ] Premium subscribe + Restore Purchases (sandbox, no real charge in TestFlight)
- [ ] App survives being closed and reopened the next day

If you find bugs, fix them, then repeat this step (a new build) before moving on.

---

## Step 2 — Verify subscriptions & IAPs are "Ready to Submit" (needs your confirmation — I can't check App Store Connect)

The app references these product IDs via RevenueCat. Each must exist in **App Store Connect → Monetization**, with price + English localization, in **"Ready to Submit"** state:

**Subscription group "Grow Pray Premium":**
| Product ID | Price | Trial |
|---|---|---|
| `growpray_premium_monthly` | $6.99/mo | 7 days |
| `growpray_premium_yearly` | $44.99/yr | 7 days |

**Consumable coin IAPs:**
| Product ID | Price |
|---|---|
| `growpray_coins_500` | $0.99 |
| `growpray_coins_1500` | $2.99 |
| `growpray_coins_5000` | $7.99 |
| `growpray_coins_12000` | $14.99 |

Are these already created? If not, field-by-field setup steps are below in the Reference section.

---

## Step 3 — Screenshots (status unknown — needs your confirmation)

Required for the App Store listing. You're on Windows with no iOS simulator, so these must come from a real iPhone — the fresh TestFlight build from Step 1 is the way to get them.

- **Required set:** 6.7" (iPhone 16 Pro Max) — 1290×2796 or similar Pro Max resolution.
- **Also required:** iPad 13" set, since `supportsTablet: true` is set in `app.json`.
- Screens to capture: garden view, prayer timeline, Qur'an/Hadith reader, Qibla compass, shop, dhikr screen.
- On the phone: open each screen, use the iOS screenshot gesture (side + volume-up buttons), AirDrop to your PC.

Have these been captured already? If yes, just need uploading into App Store Connect; if no, this happens after Step 1's fresh build is on your phone.

---

## Step 4 — Finish App Store listing metadata (needs your confirmation)

App Store Connect → your app → **App Store** tab → **1.0 Prepare for Submission**. Copy from `APP_STORE_METADATA.md`, but **use growpray.com URLs, not old bane678.github.io ones**:

| Field | Value |
|---|---|
| Name | `Grow Pray - Daily Prayer Tracker` |
| Subtitle | `Grow a garden through prayer` |
| Category | Health & Fitness (secondary: Lifestyle) |
| Age Rating | 4+ |
| Privacy Policy URL | `https://growpray.com/privacy-policy.html` |
| Support URL | `https://growpray.com/support.html` |
| Description / Keywords / Promo text | from `APP_STORE_METADATA.md` |

Has this been filled in already, or still pending?

---

## Step 5 — Confirm domain + HTTPS live

- [ ] `growpray.com` loads the landing page.
- [ ] `growpray.com/privacy-policy.html` shows the updated `support@growpray.com` email (pushed 2026-07-22 — should be live).
- [ ] `growpray.com/support.html` loads.
- [ ] "Enforce HTTPS" ticked in GitHub Pages settings (should already be on if the cert provisioned).

---

## Step 6 — Content verification (yours, not code — flagged in earlier sessions, still outstanding)

Three data files carry `// VERIFY` markers because the content ships to users making religious claims:

- **`data/hadith.ts`** (highest priority) — every hadith's Arabic matn, translation, narrator, grade (sahih/hasan), and citation needs checking against an authenticated printing of Nawawi's Forty before you'd want this final for App Review or real users.
- **`data/reflections.ts`** — the curated daily-reflection pool (Qur'an verses + hadith).
- **`data/adhkar.ts`** — dhikr/dua content, pre-existing.

The Qur'an text itself (`data/quran.json`) is a well-established open dataset (Tanzil Arabic + Saheeh International) — lower risk, but its file header still asks for an attribution check.

---

## Step 7 — Submit for review

Once Steps 1–6 are done:

```powershell
eas submit --profile production --platform ios --latest
```

Then in App Store Connect:
1. Scroll to the **Build** section on your version page → **+** → select the build you just uploaded.
2. Confirm Age Rating is **4+**.
3. Confirm screenshots, metadata, and IAPs are all attached.
4. Click **Submit for Review** (top right).

Apple typically responds within 1–3 days.

---

## Step 8 — Post-approval

- [ ] Get the real App Store URL from App Store Connect once approved.
- [ ] Update the `href="#"` placeholders on the two `.store-badge` links in `index.html` (there's a `TODO` comment marking them) with the real URL.
- [ ] Commit + push — GitHub Pages redeploys automatically.

---

## Quick status

- [ ] 1 — Fresh production build with all current features (**blocks everything below**)
- [ ] 2 — Verify subscriptions & IAPs "Ready to Submit"
- [ ] 3 — Screenshots captured + uploaded
- [ ] 4 — App Store listing metadata finished (growpray.com URLs)
- [ ] 5 — Domain/HTTPS confirmed live
- [ ] 6 — Hadith/reflections/adhkar content verified
- [ ] 7 — Submit for review
- [ ] 8 — Post-approval badge link update

---

## Already done (don't redo)

- Debug daytime override removed — day/night sky uses real sunrise/sunset.
- Apple credentials filled in `eas.json` (`appleId`, `ascAppId`, `appleTeamId`).
- App record created in App Store Connect; DSA/trader info submitted and address verified.
- Landing page redesign complete: real screenshots, garden continuity, organic dividers, **official Apple App Store badge** wired in (`web-assets/app-store-badge.svg`) with an honest `TODO` for the real URL post-approval.
- Domain, email (`support@growpray.com` via Purelymail), hosting (GitHub Pages → growpray.com) all live.
- Privacy policy email updated to `support@growpray.com` and pushed.

---

# Reference: subscription/IAP setup detail (if Step 2 is still pending)

In App Store Connect → your app → **Monetization**:

**Subscriptions:**
1. **Subscriptions** → **Create** → Subscription Group name `Grow Pray Premium`.
2. Inside the group, **+ → Create** for each plan:
   - Monthly: Reference name `Grow Pray Premium Monthly`, Product ID `growpray_premium_monthly`, Duration 1 Month, Price $6.99, Free Trial 7 Days. Localization (English US): Display Name `Premium Monthly`, description e.g. "Unlimited garden, 2× coins, exclusive premium trees".
   - Yearly: Reference name `Grow Pray Premium Yearly`, Product ID `growpray_premium_yearly`, Duration 1 Year, Price $44.99, Free Trial 7 Days. Localization: Display Name `Premium Yearly`, description e.g. "All premium features — 46% savings vs monthly".

**Consumable IAPs:** **In-App Purchases** → **+** for each:
| Reference Name | Product ID | Price |
|---|---|---|
| Handful of Coins | `growpray_coins_500` | $0.99 |
| Pouch of Coins | `growpray_coins_1500` | $2.99 |
| Chest of Coins | `growpray_coins_5000` | $7.99 |
| Treasury | `growpray_coins_12000` | $14.99 |

Each needs an English localization (display name + short description) and must reach **"Ready to Submit"** status once price + localization are saved.

---

# Reference: key identifiers

- Bundle ID: `com.antigravity.growpray`
- App Store Connect App ID (ascAppId): `6762623534`
- Apple Team ID: `NZ8X3B789X`
- Apple ID (dev login): `sayeedali224@gmail.com`
- Expo projectId: `b4abc15f-4bf1-4add-979f-122f1c51bcb7`
- App version: `1.0.0` · iOS buildNumber: currently `1` (will become `2` after Step 1)
- Domain: `growpray.com` (Namecheap DNS → GitHub Pages)
- Support email: `support@growpray.com` (Purelymail)
- Trader/registered address (DSA): 124 City Road, London, EC1V 2NX (Capital Office Ltd, verified)

---

*Bismillah. Step 1 is the one that unblocks everything else.*
