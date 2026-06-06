# Grow Pray — Apple Submission Checklist

*All code is done. These are the 8 remaining steps to get the app live.*

---

## Step 1 — Host Privacy & Support Pages
**~15 min**

The two HTML files already exist in the project. You just need to put them on the internet.

**Easiest option: GitHub Pages (free)**

1. Go to [github.com](https://github.com) → create a new **public** repo called `grow-pray-site`
2. Upload both files:
   - `privacy-policy.html` → rename to `privacy.html`
   - `support.html` → keep as `support.html`
3. In the repo → **Settings** → **Pages** → Source: `main` branch → `/root` → **Save**
4. Your pages will be live at:
   - `https://YOUR_USERNAME.github.io/grow-pray-site/privacy.html`
   - `https://YOUR_USERNAME.github.io/grow-pray-site/support.html`
5. Wait ~2 min for GitHub to deploy, then open both URLs to confirm they load

> **Note:** You can also use Vercel or Netlify if you prefer — drag the folder onto [vercel.com/new](https://vercel.com/new) and it deploys instantly.

---

## Step 2 — Create App Record in App Store Connect
**~10 min**

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **+** → **New App**
3. Fill in:
   - **Platforms:** iOS
   - **Name:** `Grow Pray - Daily Prayer Tracker`
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** `com.antigravity.growpray` ← must match exactly
   - **SKU:** `growpray` (anything unique, internal only)
   - **User Access:** Full Access
4. Click **Create**
5. You're now in the app record. Leave it open — you'll fill the rest in Step 5.

---

## Step 3 — Set Up Subscriptions & IAPs
**~20 min**

Do this before building because the build references these product IDs.

### 3a — Create Subscription Group

In your app record → **Monetization** → **Subscriptions** → **Create**

- **Subscription Group Name:** `Grow Pray Premium`
- Click **Create**

### 3b — Add Monthly Subscription

Inside the group → **+** → **Create**

| Field | Value |
|-------|-------|
| Reference Name | `Grow Pray Premium Monthly` |
| Product ID | `growpray_premium_monthly` |
| Subscription Duration | 1 Month |
| Price | $6.99 |
| Free Trial | 7 Days |

Add a **Localization** (English US):
- Display Name: `Premium Monthly`
- Description: `Unlimited garden, 2× coins, exclusive premium trees`

### 3c — Add Yearly Subscription

Same group → **+** → **Create**

| Field | Value |
|-------|-------|
| Reference Name | `Grow Pray Premium Yearly` |
| Product ID | `growpray_premium_yearly` |
| Subscription Duration | 1 Year |
| Price | $44.99 |
| Free Trial | 7 Days |

Add a **Localization** (English US):
- Display Name: `Premium Yearly`
- Description: `All premium features — 46% savings vs monthly`

### 3d — Add Coin IAPs

In your app record → **Monetization** → **In-App Purchases** → **+** for each:

| Reference Name | Product ID | Type | Price |
|----------------|-----------|------|-------|
| Handful of Coins | `growpray_coins_500` | Consumable | $0.99 |
| Pouch of Coins | `growpray_coins_1500` | Consumable | $2.99 |
| Chest of Coins | `growpray_coins_5000` | Consumable | $7.99 |
| Treasury | `growpray_coins_12000` | Consumable | $14.99 |

For each one: add an English localization with a display name and short description (e.g. "500 coins for your garden").

> All products must be in **"Ready to Submit"** state. They reach this state once you add the price, localization, and save.

---

## Step 4 — Fill Your Apple Credentials into eas.json
**~5 min**

Open `eas.json` in the project. Find the `submit.production.ios` section and fill in:

```json
"appleId": "your.apple.id@email.com",
"ascAppId": "YOUR_10_DIGIT_APP_ID",
"appleTeamId": "YOUR_TEAM_ID"
```

**Where to find each value:**
- `appleId` — the email you use to log into App Store Connect
- `ascAppId` — in App Store Connect → your app → **App Information** → **Apple ID** (a 10-digit number, e.g. `6739481234`)
- `appleTeamId` — in [developer.apple.com](https://developer.apple.com) → **Account** → **Membership** → **Team ID** (10 chars, e.g. `ABC1234XYZ`)

---

## Step 5 — Take Screenshots
**~20 min** *(do this while the build runs in Step 6)*

You need screenshots from **Xcode Simulator**. Minimum required: the **6.7" set**.

### Which simulators to use
- **Required:** iPhone 16 Pro Max (6.7") → produces 1320 × 2868 px
- **Required:** iPhone 16 Plus or 14 Pro Max (6.5") → produces 1284 × 2778 px  
- **Required (you have supportsTablet: true):** iPad Pro 13" → produces 2064 × 2752 px

### How to take them
1. Open Xcode → **Open Simulator** (or run `open -a Simulator` in Terminal)
2. In Simulator menu: **File** → **Open Simulator** → pick device size
3. Run the app on the simulator: `npx expo start` then press `i`
4. Navigate to each screen you want to capture
5. Take screenshot: **Command + S** (saves to Desktop)

### Screens to capture (5–6 recommended)
1. **Main garden view** — a few trees grown, prayer timeline visible at bottom
2. **Prayer timeline** — mix of completed/active/upcoming prayers
3. **Shop modal open** — showing tree varieties
4. **Onboarding paywall screen** — shows the premium trees hero
5. **Streak/progress view** — per-prayer streaks with XP
6. **Challenges modal** (optional)

### After capturing
- You can add text overlays in Figma or Canva (optional but it looks better)
- Keep originals at full resolution — App Store Connect will accept them as-is

---

## Step 6 — Run the Production Build
**~5 min setup, 30–40 min waiting**

Make sure you're logged into EAS first:

```powershell
# Install EAS CLI if needed
npm install -g eas-cli

# Log in to your Expo account
eas login

# Run the iOS production build
eas build --platform ios --profile production
```

- When prompted about credentials: select **"Manage by Expo"** (it handles provisioning + certificates automatically)
- The build runs in the cloud — you'll get a link to monitor progress at [expo.dev](https://expo.dev/builds)
- When it finishes (30–40 min) you'll get a download link for the `.ipa`

> **This is when to take screenshots** — Step 5 above. The build takes ~40 min so do screenshots while waiting.

---

## Step 6b — Beta Test with TestFlight
**~1-2 days**

Do this right after the build finishes in Step 6. You need real devices to catch notification, location, and IAP bugs that the simulator misses.

### Upload the build to TestFlight
The build from Step 6 is automatically available in TestFlight once it finishes processing (usually 15-30 min after the build completes). No extra command needed.

### Add internal testers (instant access, no Apple review needed)
1. In App Store Connect → **TestFlight** tab
2. Click **Internal Testing** → **+** next to testers
3. Add up to 100 people by their Apple ID email
4. They get an email invite → they install the **TestFlight app** from the App Store → then install Grow Pray

### What to ask testers to check
- [ ] Go through the full onboarding start to finish
- [ ] Allow location — confirm prayer times look correct for their city
- [ ] Allow notifications — confirm they actually receive prayer reminders
- [ ] Mark prayers over at least one full day
- [ ] Open the Shop, try buying a tree with coins
- [ ] Go to Settings → tap Restore Purchases
- [ ] Try the premium subscription flow (sandbox — no real charge in TestFlight)
- [ ] Check that the app works after being closed and reopened the next day

### Fix any bugs found, then rebuild
If you need to fix something:
```powershell
# After fixing, run a new build
eas build --platform ios --profile production
# Then upload again
eas submit --platform ios --latest
```
The new build appears in TestFlight automatically for testers to update.

Once you're happy with the feedback, move on to Step 7.

---

## Step 7 — Fill App Store Connect Metadata & Upload Screenshots
**~20 min**

Go back to your app record in App Store Connect → **App Store** tab → **1.0 Prepare for Submission**

### App Information section
| Field | Value |
|-------|-------|
| Name | `Grow Pray - Daily Prayer Tracker` |
| Subtitle | `Grow a garden through prayer` |
| Category | Health & Fitness |
| Secondary Category | Lifestyle |
| Privacy Policy URL | your GitHub Pages URL from Step 1 |

### Version Information section
| Field | Value |
|-------|-------|
| Description | Copy from `APP_STORE_METADATA.md` |
| Keywords | `prayer,islam,muslim,salah,tracker,garden,streak,habit,ramadan,quran,deen,islamic,fajr,spiritual` |
| Support URL | your GitHub Pages URL from Step 1 |
| What's New | Copy "What's New" section from `APP_STORE_METADATA.md` |
| Promotional Text | `Build a beautiful garden by praying on time. Track all 5 daily prayers, grow rare trees, and maintain streaks. 🌳🕌` |

### Screenshots section
Upload your screenshots from Step 5 into the correct size slots.

### Review Notes (Notes for Apple reviewer)
```
This app helps Muslims track their 5 daily prayers by growing a virtual pixel-art garden.
Trees grow when prayers are completed on time.

To test the app:
1. Allow location access — used only to calculate prayer times on-device
2. Tap any prayer button to mark it complete and watch the tree grow
3. Visit the Shop (bag icon) to see purchasable trees and items

Subscription: $6.99/month or $44.99/year with a 7-day free trial.
Premium unlocks unlimited garden size, 2× coins, and exclusive trees (Golden Tree and Ancient Cedar).

No login required. All data is stored locally on device. No ads.
```

---

## Step 8 — Submit the Build for Review
**~5 min**

### Upload the build to App Store Connect
```powershell
eas submit --platform ios --latest
```
This automatically uploads the build that just finished in Step 6.

### In App Store Connect
1. Scroll to the **Build** section on your version page
2. Click **+** → select the build you just uploaded
3. Scroll down → confirm Age Rating is **4+**
4. Click **Submit for Review** (top right)

> Apple will usually review within 1–3 days. You'll get an email when it's approved or if they have questions.

---

## Status

- [ ] Step 1 — Host privacy & support pages
- [ ] Step 2 — Create app record in App Store Connect
- [ ] Step 3 — Set up subscriptions & IAPs
- [ ] Step 4 — Fill Apple credentials into eas.json
- [ ] Step 5 — Take screenshots
- [ ] Step 6 — Run production build
- [ ] Step 6b — Beta test with TestFlight
- [ ] Step 7 — Fill metadata & upload screenshots
- [ ] Step 8 — Submit for review

---

*Bismillah. 🚀🌿*
