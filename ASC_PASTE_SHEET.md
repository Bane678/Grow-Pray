# 🍎 App Store Connect — Paste-Ready Sheet

Everything you type into App Store Connect, ready to copy. Work top to bottom.
URLs are the live growpray.com ones (already verified loading over HTTPS).

Sign in: https://appstoreconnect.apple.com → **Apps** → **Grow Pray**.

---

# PART 1 — In-App Purchases (Monetization tab)

Go to **Monetization**. Goal: all 6 products show **"Ready to Submit"**. A product reaches
that state once it has a **price** + a saved **English (U.S.) localization** (display name +
description). The **Product IDs must match EXACTLY** — the app looks for these literal
strings, so a typo means purchases silently fail.

> First check if any already exist. Only create the ones that are missing.

## Subscriptions → group **"Grow Pray Premium"**
If the group doesn't exist: **Subscriptions → Create** → Group name `Grow Pray Premium`.

### Monthly
| Field | Value |
|---|---|
| Reference Name | `Grow Pray Premium Monthly` |
| Product ID | `growpray_premium_monthly` |
| Duration | 1 Month |
| Price | **$6.99** |
| Free Trial | 7 Days (Introductory Offer → Free → 1 week) |
| Display Name (en-US) | `Premium Monthly` |
| Description (en-US) | `Unlimited garden, 2× coins, exclusive premium trees, priority support` |

### Yearly
| Field | Value |
|---|---|
| Reference Name | `Grow Pray Premium Yearly` |
| Product ID | `growpray_premium_yearly` |
| Duration | 1 Year |
| Price | **$44.99** |
| Free Trial | 7 Days (Introductory Offer → Free → 1 week) |
| Display Name (en-US) | `Premium Yearly` |
| Description (en-US) | `All premium features — 46% savings vs monthly. Best value!` |

## In-App Purchases → all **Consumable**
**In-App Purchases → +** for each:

| Reference Name | Product ID | Type | Price | Display Name (en-US) | Description (en-US) |
|---|---|---|---|---|---|
| Handful of Coins | `growpray_coins_500` | Consumable | $0.99 | `500 Coins` | `500 coins for your garden` |
| Pouch of Coins | `growpray_coins_1500` | Consumable | $2.99 | `1,500 Coins` | `1,500 coins for your garden` |
| Chest of Coins | `growpray_coins_5000` | Consumable | $7.99 | `5,000 Coins` | `5,000 coins for your garden` |
| Treasury | `growpray_coins_12000` | Consumable | $14.99 | `12,000 Coins` | `12,000 coins for your garden` |

> Each consumable also needs a **review screenshot** before it can be submitted with the
> app. You can use the Shop screenshot for all four. (App Store Connect requires one image
> per IAP in the "Review Information" area.)

**→ After this, tell me which products (if any) are stuck in "Missing Metadata" and why.**

---

# PART 2 — App Store listing (App Store tab → 1.0 Prepare for Submission)

## App Information
| Field | Value |
|---|---|
| Name | `Grow Pray - Daily Prayer Tracker` |
| Subtitle | `Grow a garden through prayer` |
| Primary Category | Health & Fitness |
| Secondary Category | Lifestyle |
| Privacy Policy URL | `https://growpray.com/privacy-policy.html` |

## Pricing & Availability
- Price: **Free** (the app is free; revenue is via IAP/subscription).

## Version 1.0 — Promotional Text
```
Build a beautiful garden by praying on time. Track all 5 daily prayers, grow rare trees, and maintain streaks that bloom into something amazing. 🌳🕌
```

## Version 1.0 — Description
```
Grow Pray turns your daily prayers into a living, growing garden. Every salah you complete on time plants and grows a tree in your personal garden — miss one, and it withers.

🌿 PRAYER TRACKING MADE BEAUTIFUL
• Track all 5 daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha)
• Accurate prayer times based on your location
• Grace period support (15-60 minutes configurable)
• Smart notifications before each prayer window closes

🌳 GROW YOUR GARDEN
• Start with a 5×5 garden and expand up to 11×11
• Earn XP and coins for every prayer completed
• Plant unique tree varieties from the Garden Shop
• Watch trees grow through 4 stages as you stay consistent

🔥 STREAKS & CHALLENGES
• Track individual streaks for each of the 5 prayers
• Weekly challenges with bonus coin rewards
• Consistency multiplier — the more perfect days, the bigger the rewards
• Milestone celebrations at 7, 30, and 100 day streaks

🏪 GARDEN SHOP
• Spend coins on rare tree types for your garden
• Purchase streak freezes to protect your hard-earned streaks
• Unlock garden expansions to grow your paradise

🌙 RAMADAN MODE
• Special 2× XP during the blessed month
• Exclusive Ramadan content and challenges

💎 PREMIUM FEATURES
• Unlimited garden size
• 2× coin earning rate
• Exclusive premium tree varieties
• Advanced prayer insights and trends
• Priority support

🧭 WORSHIP TOOLS
• Qibla compass to find the direction of the Kaaba
• Digital tasbih counter for your daily dhikr
• Authentic duas and adhkar: after salah, morning, evening, before sleep, and travel
• A daily ayah or hadith to reflect on

Built with love for the Muslim community. No ads. Your data stays on your device.

Start growing your garden today. 🌿
```

## Version 1.0 — Keywords
```
prayer,islam,muslim,salah,tracker,garden,streak,habit,ramadan,quran,deen,islamic,fajr,spiritual
```

## Version 1.0 — Support URL & Marketing URL
| Field | Value |
|---|---|
| Support URL | `https://growpray.com/support.html` |
| Marketing URL (optional) | `https://growpray.com` |

## Version 1.0 — What's New in This Version
```
Welcome to Grow Pray! 🌿

Your first release includes:
• Track all 5 daily prayers with accurate times
• Grow trees and expand your garden
• Per-prayer streak tracking
• Coin economy with Garden Shop
• Weekly challenges
• Streak freeze protection
• Consistency multiplier rewards
• Ramadan mode with 2× XP
• Qibla compass, tasbih, duas & adhkar, and a daily reflection
• Premium subscription option
• Beautiful pixel-art garden with gesture controls

JazakAllahu Khairan for downloading. May your garden flourish! 🤲
```

## App Review Information → Notes
```
This app helps Muslims track their 5 daily prayers by growing a virtual pixel-art garden.
Trees grow when prayers are completed on time.

To test the app:
1. Allow location access — used only to calculate prayer times on-device
2. Tap any prayer button to mark it complete and watch the tree grow
3. Visit the Shop (bag icon) to see purchasable trees and items

Subscription: $6.99/month or $44.99/year with a 7-day free trial.
Premium unlocks unlimited garden size, 2× coins, and exclusive trees.

No login required. All data is stored locally on device. No ads.
```
- **Sign-in required?** → **No** (leave the demo account username/password blank).
- **Contact info:** first/last name + phone + email (use `support@growpray.com`).

## Age Rating
- Complete the questionnaire choosing "None" for all content types → results in **4+**.

## App Privacy (the "Data Collection" section)
- The app stores everything locally and has no accounts/ads/analytics server.
- If you collect **no** data that leaves the device, you can answer **"Data Not Collected."**
  (Location is used on-device to compute prayer times and is not transmitted — so it is not
  "collected" in Apple's sense. If unsure on any specific question here, pause and ask me
  before answering, since this is a legal attestation.)

## Build
- Under **Build**, click **+** and attach **Build #10** (once it's finished processing in
  TestFlight). If it's not there yet, wait for processing.

---

# PART 3 — Final submit
When IAPs are "Ready to Submit", all listing fields are filled, both screenshot sets are
uploaded, age rating is 4+, and Build #10 is attached:
- Click **Add for Review / Submit for Review** (top right).
- The 6 IAPs can be submitted **with** this app version — make sure they're selected/attached
  to the version so they review together (first-time IAPs must ship with a build).

Apple typically reviews in 1–3 days.
