# Jannah Garden — Launch Day Checklist

*Target: February 17, 2026 (1 day before Ramadan)*

---

## ✅ Pre-Submission (Code Complete)

- [x] All Tier 1 features implemented & tested
- [x] All Tier 2 features implemented & tested
- [x] Task 7.2: Enhanced Settings Screen
- [x] Task 7.3: Visual Polish (XP popup, coin popup, milestones)
- [x] Task 8.2: Code audit & manual testing
- [x] Task 8.3: App Store metadata prepared
- [x] app.json configured (bundle ID, permissions, plugins)
- [x] eas.json build configuration created
- [x] Privacy policy & support pages created
- [x] App Store metadata written (APP_STORE_METADATA.md)

---

## 🚀 Launch Day Steps

### Step 1: App Icon (15 min)
- [ ] Create 1024×1024 app icon (garden/tree + Islamic green palette)
- [ ] Replace `assets/icon.png` with final icon
- [ ] Replace `assets/adaptive-icon.png` for Android
- [ ] Replace `assets/splash-icon.png` with matching splash

### Step 2: EAS Setup (10 min)
```powershell
# Install EAS CLI if not installed
npm install -g eas-cli

# Login to Expo account
eas login

# Initialize project (links to your Expo account)
eas init

# Update app.json extra.eas.projectId with the ID from eas init
```

### Step 3: Build for iOS (20-40 min build time)
```powershell
# Production build for iOS
eas build --platform ios --profile production

# This will:
# - Ask you to generate credentials (select "Let Expo handle it")
# - Build in the cloud
# - Give you an .ipa download link when done
```

### Step 4: Build for Android (20-40 min build time)
```powershell
# Production build for Android
eas build --platform android --profile production

# This generates an .aab (Android App Bundle)
```

### Step 5: App Store Connect (iOS) — 30 min
1. [ ] Go to [App Store Connect](https://appstoreconnect.apple.com)
2. [ ] Create new app → Bundle ID: `com.antigravity.jannahgarden`
3. [ ] Fill in metadata from `APP_STORE_METADATA.md`:
   - App Name: "Jannah Garden - Prayer Tracker"
   - Subtitle: "Grow a garden through prayer"
   - Description: Copy from metadata file
   - Keywords: Copy from metadata file
   - Category: Health & Fitness
   - Support URL: `https://antigravity.studio/jannah-garden/support`
   - Privacy Policy URL: `https://antigravity.studio/jannah-garden/privacy`
4. [ ] Upload screenshots (capture from simulator/device):
   - 6.7" (iPhone 15 Pro Max): 1290 × 2796
   - 6.5" (iPhone 11 Pro Max): 1242 × 2688
   - 5.5" (iPhone 8 Plus): 1242 × 2208 (optional)
   - iPad Pro 12.9": 2048 × 2732 (optional)
5. [ ] Set up subscriptions:
   - Create Subscription Group: "Jannah Garden Premium"
   - Monthly: $6.99, 7-day trial, ID: `com.antigravity.jannahgarden.premium.monthly`
   - Yearly: $44.99, 7-day trial, ID: `com.antigravity.jannahgarden.premium.yearly`
6. [ ] Set up IAP coin packages (see APP_STORE_METADATA.md)
7. [ ] Submit build:
   ```powershell
   eas submit --platform ios --latest
   ```
8. [ ] Select the build in App Store Connect → Add to release
9. [ ] Fill Review Notes (copy from metadata)
10. [ ] **Submit for Review**

### Step 6: Google Play Console (Android) — 30 min
1. [ ] Go to [Google Play Console](https://play.google.com/console)
2. [ ] Create new app → Package: `com.antigravity.jannahgarden`
3. [ ] Fill in store listing (same metadata)
4. [ ] Upload screenshots
5. [ ] Set up subscriptions & IAPs
6. [ ] Content rating questionnaire
7. [ ] Submit build:
   ```powershell
   eas submit --platform android --latest
   ```
8. [ ] **Submit for Review**

### Step 7: Host Privacy & Support Pages (15 min)
- [ ] Deploy `privacy-policy.html` and `support.html` to your domain
- [ ] Options: GitHub Pages, Vercel, Netlify, or any static host
- [ ] Verify URLs work:
  - `https://antigravity.studio/jannah-garden/privacy`
  - `https://antigravity.studio/jannah-garden/support`

---

## ⏰ Timeline Estimate

| Step | Duration | Running Total |
|------|----------|---------------|
| App Icon | 15 min | 15 min |
| EAS Setup | 10 min | 25 min |
| iOS Build | 30 min (waiting) | 55 min |
| Android Build | 30 min (parallel) | 55 min |
| App Store Connect | 30 min | 1h 25min |
| Google Play Console | 30 min | 1h 55min |
| Host pages | 15 min | 2h 10min |
| **Total** | **~2 hours** | |

---

## 📝 Post-Submission

- Apple review: typically 24-48 hours
- Google review: typically 1-3 days (can be faster)
- Monitor for rejection reasons and address quickly
- Prepare social media announcement for when approved

---

## 🔑 Credentials Needed

Before launching, ensure you have:
- [ ] Apple Developer account ($99/year) — [developer.apple.com](https://developer.apple.com)
- [ ] Google Play Developer account ($25 one-time) — [play.google.com/console](https://play.google.com/console)
- [ ] Expo account — [expo.dev](https://expo.dev)
- [ ] Domain for privacy/support pages

---

*Bismillah. Let's launch! 🚀🌿*
