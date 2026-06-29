# 📸 iPad Screenshot Guide (borrowed Mac, brief session)

Goal: capture the **iPad 13"** App Store screenshot set on a borrowed Mac, as fast as
possible. Strategy: **build the simulator app in the cloud from Windows BEFORE you sit at
the Mac**, so the only thing you do on the Mac is install Xcode, drop the app on the
simulator, and press a screenshot key. No Metro, no `npm install`, no Xcode project building
on the Mac.

> iPhone screenshots are captured separately on your real iPhone via TestFlight — see the
> end of this file. This guide is the iPad half.

---

## PART 1 — Do this on Windows, NOW (before borrowing the Mac)

Build a **standalone iOS simulator** build in the EAS cloud. It produces a `.app` (inside a
`.tar.gz`) that runs on the simulator with the JS already bundled in — no dev server needed.

From the project root, in your terminal:
```
eas build --profile preview-simulator --platform ios
```
- ~20–40 min in the cloud. When done, EAS prints an **Application Archive URL** (a
  `.tar.gz`). **Copy that URL** — you'll download it on the Mac. (You can also find it later
  with `eas build:list --platform ios`.)
- This uses the new `preview-simulator` profile I added to `eas.json` (it sets
  `ios.simulator: true`, so the artifact targets the simulator, not a real device).

✅ Output you need before touching the Mac: **the Application Archive (.tar.gz) URL**.

> Tip: start this build right away — it runs while you do the App Store Connect steps.

---

## PART 2 — On the borrowed Mac (the only hands-on Mac time)

### 2.1 Install Xcode (the long part — start it first)
- Open the **App Store** on the Mac → search **Xcode** → **Get/Install** (it's free, but
  large, ~7–15 GB; this download is the slowest step — kick it off immediately).
- After install, open Xcode once so it finishes "installing components." Accept the license
  if prompted (or run `sudo xcodebuild -license accept` in Terminal).
- You do **not** need to sign in to any Apple Developer account — a simulator build needs
  no signing.

### 2.2 Open the iPad simulator
- In Xcode menu: **Xcode → Open Developer Tool → Simulator**.
- In Simulator menu: **File → Open Simulator → iPad Pro 13-inch (M4)** (or whatever 13"
  iPad Pro is listed). This is the device that produces the required **2064 × 2752** images.
  - If no 13" iPad appears: **Window → Devices and Simulators → Simulators → +** to add one,
    or in Xcode **Settings → Components** install an iOS runtime.

### 2.3 Get the app onto the simulator
1. Download the **Application Archive (.tar.gz)** from the URL you copied in Part 1 (open it
   in Safari on the Mac, or AirDrop the URL to yourself).
2. **Double-click the .tar.gz** in Finder to unpack it → you'll get a **`GrowPray.app`** (or
   `grow-pray.app`).
3. Make sure the iPad simulator is **booted** (open from Part 2.2).
4. **Drag `GrowPray.app` onto the simulator window.** It installs the app. Tap its icon to
   launch. (Equivalent Terminal command if drag fails:
   `xcrun simctl install booted /path/to/GrowPray.app` then
   `xcrun simctl launch booted com.antigravity.growpray`.)

### 2.4 Capture the screenshots
- Walk through the **Shot list** below. For each screen:
  - Take the screenshot: **File → Save Screen Shot** (or **⌘S**). It saves to the
    **Desktop** at the simulator's native resolution (2064 × 2752) — exactly what App Store
    Connect wants. **Do not resize or crop them.**
- App is local-only (AsyncStorage), so to make the garden look full you may need to mark a
  few prayers / plant trees first (see "Staging the garden" below).

### 2.5 Get the images off the Mac
- AirDrop the Desktop screenshots to your iPhone/yourself, or copy to a USB stick / upload
  to Drive. You'll upload them into App Store Connect from any machine.

---

## 🌿 Staging the garden (so screenshots look alive, not empty)

The app starts empty. Before capturing, spend 2 minutes making it look established:
- Mark several prayers complete (tap the prayer buttons) so trees appear and grow.
- Open the **Shop** and plant a couple of different tree types if you have coins (or just
  show the shop itself for that shot).
- If there's a quick way to fast-forward streaks, use it; otherwise a few trees + non-zero
  coins/XP reads well enough.

> The simulator has no real GPS — prayer times may use a fallback location. That's fine for
> screenshots; we're showing the UI, not real times.

---

## 🎯 Shot list (same screens for iPad AND iPhone)

Capture these in order. Sizes: iPad = 2064×2752 (simulator), iPhone = your phone's native
(see Part 3). Aim for 5–6 strong shots; the first 3 matter most.

1. **Garden / hero** — main garden view with several grown trees, coin/XP visible, prayer
   timeline at the bottom. *(home screen)*
2. **Prayer timeline** — a mix of completed (green) / active / upcoming prayers. *(home
   screen, scrolled to the timeline if needed)*
3. **Garden Shop** — bottom tab bar → **Shop**; show tree varieties + streak freezes.
4. **Challenges** — bottom tab bar → **Challenges**; show progress bars + coin rewards.
5. **Dhikr** — bottom tab bar → **Dhikr**; the tasbih counter (indopak font).
6. **Qibla** *(optional)* — tap the **compass icon top-left** of the garden screen.
7. **Ramadan / Insights** *(optional, if easy)* — whichever looks good.

Navigation reference (from the code): bottom tab bar keys are **Challenges, Shop, Dhikr**
plus the garden home; **Qibla** is the top-left corner icon on the garden screen;
**Settings** is the top-right icon.

App Store Connect captions to pair with each (from `APP_STORE_METADATA.md`):
1. "Your prayers bloom into a beautiful garden"
2. "Track all 5 daily prayers with perfect timing"
3. "Collect rare trees for your garden"
4. "Complete challenges for bonus rewards"
5. "Count your dhikr with a beautiful tasbih"
6. "Find the Qibla wherever you are"

---

## PART 3 — iPhone screenshots (your real iPhone, via TestFlight)

Once Build #10 is in TestFlight (see the submission plan):
1. Install **TestFlight** from the App Store on your iPhone, accept the Grow Pray invite,
   install the build.
2. Stage the garden the same way (mark prayers, plant trees).
3. Capture the **same shot list** using your iPhone's screenshot gesture
   (side button + volume up).
4. AirDrop them to your computer.

⚠️ **Before capturing, tell me your exact iPhone model.** App Store Connect's required
iPhone slot is **6.9"** (1320 × 2868, e.g. iPhone 16 Pro Max). If your phone is a different
size, the screenshots come out at a different resolution and we need to confirm which slot
they fit (Apple accepts 6.9" or 6.5" as the primary; smaller sizes may need scaling). Don't
capture a full set until we've confirmed your model maps to an accepted size.

---

## Uploading to App Store Connect
App Store Connect → Grow Pray → **App Store** tab → **1.0** → **Previews and Screenshots**.
There are separate slots per device size — drop the **iPad 13"** images in the iPad slot and
the **iPhone 6.9"** images in the iPhone slot. Order them to match the shot list (#1 first).
