# Grow Pray — Onboarding Redesign Spec ("Plant Your Niyyah")

*Fable 5 deliverable, 2026-07-24. Response to the reimagining brief. This is a buildable spec: every screen has final copy, visual composition, interaction, and data notes. Implementation notes at the end map each screen to existing components.*

---

## 1. Design thesis

The app's promise is **"your prayers, made visible."** The current onboarding breaks that promise for 21 straight screens: it *talks about* a garden, then asks for money, and only afterwards lets the user touch anything. Meanwhile its most sacred moment — the pledge — is a near-clone of Just Pray's, and its paywall reaches back and spends the user's oath as a sales lever.

The redesign is built on one idea: **onboarding should not describe the loop, it should run the loop once.** The user's answers become an intention; the intention becomes a seed; the seed is planted — by their own hand — into their *real* garden; their *real* prayer times go live on screen; and, for most users, their first real prayer is marked and the seed visibly sprouts **before any money is mentioned**. The commitment moment stops being a signature on a contract (Just Pray's device) and becomes **planting your niyyah** — a gesture that exists nowhere else, is rooted in the app's own metaphor, and is anchored to the first hadith of Nawawi's Forty ("Actions are but by intentions"), which already ships in the app's own hadith reader.

One hard rule threads the whole flow: **the garden may be sold; the niyyah may not.** Commercial screens may reference the game object ("help it flourish"). They may never reference the oath.

**Shape:** 16 core screens + 2 dynamic insight cards ≈ 18 beats (down from 21), ~2.5 minutes. Length was never the enemy — empty screens were. Every screen below either gives something back or collects something it visibly repays later.

---

## 2. Screen-by-screen specification

Palette, glass panels, gold accent, starfield, and typography are all inherited from the existing system unless stated. "Insight cards" keep the existing redesigned treatment (glow hero + medallion + checklist). All CTAs are the existing gold pill unless stated.

---

### S1 — Opening: "Salaam"

- **Purpose:** Set tone in one breath: calm, Islamic, alive. Establish the core promise with motion, not paragraphs. If cut: the flow opens on a question, which reads as an interrogation.
- **Copy:**
  - Title: **Salaam.**
  - Body: **Five daily prayers. One living garden. Every salah you keep is planted — and everything you grow stays on this phone.**
  - CTA: **Bismillah** *(kept — the single best button label in the current flow)*
- **Visual:** Night gradient + starfield. Centre: the existing `GardenGrowthPreview` animation (sapling → flourishing on a real tile) at ~200px, glow behind it. No phone mockup — the loop itself is the demo. Title 40px display under the animation.
- **Interaction:** One tap. Light haptic.
- **Data:** None.

*(Replaces both the current welcome-with-phone-mockup and the separate growthPillar screen — the animation does the work of both.)*

---

### S2 — Ayah

- **Purpose:** Scripture early establishes that this is a Muslim-made space, not a habit app wearing a crescent. One quiet, full-bleed moment. If cut: religious credibility arrives too late, after the quiz.
- **Copy:**
  - Quote: **"Indeed, prayer prohibits immorality and wrongdoing."**
  - Source: **QUR'AN 29:45**
  - CTA: **Continue**
- **Visual:** Keep the existing card exactly — full-bleed `OB_AYAH` art, 3-stop dark gradient, curly quotes, letter-spaced source. It already works.
- **Interaction:** One tap.
- **Data:** None.

---

### S3 — Where you are (empathy select) → Insight Card A

- **Purpose:** The segmentation backbone. Drives insight card A, the plan summary, and post-onboarding tuning. If cut: all personalization downstream collapses to generic.
- **Copy:**
  - Title: **How is your relationship with salah right now?**
  - Subtitle: **Wherever you are is where we start.** *(replaces "Be honest. We're here to support, not judge." — telling someone you won't judge them plants the idea that they could be judged)*
  - Options (kept, one softened):
    - I pray all 5 on time
    - I pray daily, not always on time
    - Most days, but I miss some
    - Occasionally — I'm working on it
    - I want to start, or start again
  - CTA: **Next**
- **Insight Card A** (existing system, re-copy the "starting" variant):
  - For "start or start again": Title **Then this is a beginning, not a comeback.** Body: **You don't owe this app an explanation. From your first salah, your garden starts growing — momentum you can see, from day one.** Bullets: Each prayer grows something real · Missed days show recovery, not ruin · Streak freezes for the hard weeks
  - Other three variants: keep current copy (already good).
- **Interaction:** Select → auto-highlight → Next → insight card → Continue.
- **Data:** `routine` key. Pays back: insight card A (immediately), plan summary (S9), which welcome-back tone the app uses later.

---

### S4 — Hardest prayer

- **Purpose:** Behavioral, shame-free, and directly actionable (Fajr answer drives Fajr-specific reminders in the plan). If cut: plan summary loses its most concrete personalization.
- **Copy:** Title: **Which prayer is hardest to keep?** Subtitle: **Everyone has one.** Options unchanged (Fajr/Dhuhr/Asr/Maghrib/Isha/"Honestly, all of them"). CTA: **Next**
- **Visual/Interaction:** Existing select card. No changes.
- **Data:** `hardestPrayer`. Pays back: S9 plan, notification defaults.

---

### S5 — What gets in the way (multi-select)

- **Purpose:** Feeds the plan summary's feature-matching. If cut: S9 becomes a generic feature list.
- **Copy:** Title: **What usually gets in the way?** Subtitle: **Choose all that apply.** Options unchanged. CTA: **Next**
- **Data:** `blockers[]`. Pays back: S9 assembles features per blocker, visibly.

---

### S6 — What would help (REFRAMED — replaces the guilt question) → Insight Card B

- **Purpose:** The old question — "How do you feel when you miss a prayer?" with options like *"Numb, I've normalised it"* — asked users to confess spiritual failure to a subscription app on day zero. This version collects the **same segmentation** (guilt-sensitive vs. progress-driven vs. restart-oriented) by asking users to *design their own support* instead. Diagnostic → directional; Calm's model. If cut: we lose the single most emotionally-bonding beat of the flow — this is the screen where the app proves it understands them.
- **Copy:**
  - Title: **When you do miss one — what would actually help?**
  - Subtitle: **We'll build your support around this.**
  - Options:
    - **A nudge to pray it as soon as I can** *(icon: refresh)*
    - **Knowing the next one is a fresh start** *(icon: sunrise)*
    - **Seeing my progress, not my failures** *(icon: sprout)*
    - **Less guilt, more encouragement** *(icon: heart)*
  - CTA: **Next**
- **Insight Card B** (absorbs the old standalone "reframe" screen):
  - For "Less guilt" and "fresh start": Title: **That's how this garden works.** Body: The Prophet ﷺ said: **"The most beloved of deeds to Allah are the most consistent, even if they are few."** *(Bukhari & Muslim)* — **Grow Pray never shames a missed prayer. No red marks, no broken-streak sirens. Your garden shows recovery, not ruin.** Bullets: Gentle reminders, never alarms · Every prayer is a fresh start · Streak freezes for life's harder days
  - For "nudge": lead with the make-up reminder + deadline warnings. For "progress": lead with streaks/history/garden visibility.
- **Data:** `supportStyle`. Pays back: insight card B (immediately), notification tone defaults, S9.

---

### S7 — Name (+ privacy, folded in)

- **Purpose:** Personalizes the niyyah (S13) and the plan. Privacy reassurance lives *here* — the exact moment data anxiety spikes — instead of on its own screen. If cut: the niyyah becomes anonymous and loses half its weight.
- **Copy:**
  - Title: **What should we call you?**
  - Body: **Your name appears in one place that matters — your intention.**
  - Placeholder: **Your name**
  - Trust line (small, under input, shield icon): **Stays on this phone. No account. No email. Ever.**
  - CTA: **Next**
- **Visual:** Existing input card + the trust row styled like the permission screens' helper rows.
- **Interaction:** Text input, existing profanity guard, Enter submits.
- **Data:** `name`. Pays back: S13 niyyah, S14 sprout moment, daily use.

---

### S8 — Your niyyah (goal select, re-anchored)

- **Purpose:** The goal question becomes the **setup for the planting**. The word niyyah enters here and pays off on S13 — an arc, not a survey item. If cut: S13 has nothing to plant.
- **Copy:**
  - Title: **Set your niyyah for the next 30 days.**
  - Subtitle: **One intention. In a moment, you'll plant it.**
  - Options (unchanged list, re-voiced first-person):
    - I intend to pray all five on time
    - I intend to wake for Fajr, consistently
    - I intend to build a routine that lasts
    - I intend to be more present in salah
    - I intend to come back to my prayers
  - CTA: **Next**
- **Data:** `goal`. Pays back: written on the seed at S13, headline of S9 plan, 30-day check-in later.

---

### S9 — Your plan

- **Purpose:** The "everything you told us, assembled" screen — the flow's proof it was listening. Kept nearly as-is (it's genuinely good). New closing line points forward to the planting. If cut: the quiz becomes data harvesting with no visible payoff.
- **Copy:** Existing dynamic builder, with the final static line replaced by:
  - **Everything's ready. Two minutes of setup — then you plant that intention.**
  - CTA: **Set up my prayer times** *(kept — honestly describes what's next)*
- **Visual:** Existing `OB_PLAN` hero + panel. Add one row pinned at the top of the feature list, gold accent: **The full Qur'an & Nawawi's 40 Hadith — free, for everyone, forever.** *(First appearance of the anti-lock message; see Decision 5.)*
- **Data:** Consumes everything; collects nothing.

---

### S10 — Asr question (madhab, plain-language)

- **Purpose:** Required before showing times (changes Asr calculation). Reframed from jargon-first to consequence-first. If cut: Asr times are wrong for Hanafis — non-negotiable.
- **Copy:**
  - Title: **One question about Asr.**
  - Body: **Schools of thought differ on when Asr begins. Which timing do you follow?**
  - Options: **Earlier Asr — Shafi'i, Maliki & Hanbali** / **Later Asr — Hanafi**
  - Microcopy: **Not sure? Pick either — you can change it anytime in Settings.**
  - CTA: **Next**
- **Data:** `madhab`. Pays back: literally the next screen's numbers.

---

### S11 — Location → **"Your times are live"** (two-state screen)

- **Purpose:** Keep the existing textbook priming *and add the missing payoff*: the current flow computes the user's prayer times during onboarding and never shows them. This is the cheapest real value in the entire funnel and it's currently thrown away. If cut: the paywall arrives before the app has demonstrably done anything.
- **State 1 — priming (copy kept verbatim from current, it's the best screen in the flow):**
  - Title: **Location** · Body: **Enable location permission to find your local prayer times and calculate qibla direction.** · Helper: 🛡 **Your location never leaves your phone.** · Primary: **Enable location** · Secondary: **Skip for now**
- **State 2 — payoff (same card morphs after grant; new):**
  - Title: **Your times are live.**
  - City name small, then today's five prayers listed with real times, next prayer highlighted gold with countdown: **Asr · 4:12 PM · in 2h 18m**
  - CTA: **Continue**
  - On skip: proceed without state 2; microcopy **You can set your city in Settings.** (No fake times shown.)
- **Visual:** The five-prayer list uses the existing prayer icons (Fajr…Isha assets) in a glass panel — a soft preview of the real prayer bar.
- **Data:** Location grant. Pays back: instantly, visibly, on the same screen.

---

### S12 — Notifications (primed with *their* data)

- **Purpose:** Same honest pattern, but now the priming uses the user's actual next prayer instead of generic copy — the strongest possible "why" for the permission. If cut: notification grant rate drops; it's the app's main retention channel.
- **Copy:**
  - Title: **Never miss the window.**
  - Body: **Asr is at 4:12 today. Want a quiet heads-up before each prayer?** *(falls back to generic current copy if location was skipped)*
  - Helper: 🔔 **Gentle reminders, never noisy.**
  - Primary: **Enable notifications** · Secondary: **Maybe later** · Decline caption: **You can enable this later in settings.**
- **Data:** Notification grant.

---

### S13 — **Plant your niyyah** (replaces the pledge — the centerpiece)

- **Purpose:** The commitment moment, rebuilt as Grow Pray's own. No signature pad (Just Pray's device), no contract framing, no Bukhari 7405 (Just Pray uses it). Instead: the first hadith of Nawawi's Forty — already in this app's own hadith reader — and a physical act inside the app's own metaphor. The user's goal from S8 becomes a seed; they hold the earth to plant it. If cut: onboarding has no emotional peak and the garden starts empty and meaningless.
- **Copy:**
  - Small label: **THE FIRST HADITH OF NAWAWI'S FORTY**
  - Hadith: **"Actions are but by intentions."** — *Prophet Muhammad ﷺ · Bukhari 1 & Muslim 1907*
  - The intention, on a small parchment tag above the soil: **"I intend to pray all five on time."** — **{Name} · Day 0**
  - Under the tile: **Press and hold the earth to plant your niyyah.**
  - After planting (text fades in): **Planted. May Allah let it grow.**
  - CTA (appears after): **Continue**
- **Visual:** Starfield night. Centre-bottom: a single real garden tile (existing `Recovered_Tile` asset) lit by a soft gold radial glow. The intention tag floats above it. No panels — this screen is mostly darkness and one piece of earth.
- **Interaction:** **The tile is the button.** Press-and-hold ~1.2s: a thin gold progress ring draws around the tile (re-skin of `HoldToConfirmButton`'s fill logic as a radial stroke via `react-native-svg`), haptics ramp from light to medium, the tag shrinks into a seed and drops into the soil, tiny particle puff (existing sparkle asset), success haptic. Releasing early rewinds the ring — same forgiving behavior as the current hold button.
- **Data:** Writes the intention + `plantedAt` to storage, **and writes a real seed/sapling-stage object into the actual garden state** — this tile exists when the garden loads. Pays back: S14, the first in-app session, and a 30-day check-in ("your niyyah, one month on").
- **Hard rule established here:** no commercial screen may ever reference this moment. See Decision 2.

---

### S14 — The first prayer (adaptive)

- **Purpose:** Runs the core loop for real, inside onboarding, when honestly possible. This is the screen that earns the paywall. If cut: the ask lands before any lived value — the current flow's central flaw.
- **Logic:** Determine the most recent prayer window that has already begun today (post-midnight edge case: use the most recent begun window, drop the word "today").
- **Copy:**
  - Title: **Have you prayed Dhuhr today?**
  - Options: **Yes, alhamdulillah** / **Not yet**
- **Branch A — "Yes":** The prayer is marked for real (same state write as the in-app prayer bar). Full-screen beat: the planted tile from S13, the soil breaks, the sapling rises (existing sapling asset, spring scale + glow), success haptic, small toast with the real first-prayer XP/coin reward.
  - Copy: **Your first prayer — planted and growing. This is the whole app: every salah you keep, you'll see.**
  - CTA: **Continue**
- **Branch B — "Not yet":** The tile stays as planted soil, with a live countdown chip.
  - Copy: **Asr arrives at 4:12. Your seed is ready when you are.** *(No guilt. No "don't forget." The seed waits; it doesn't wither in onboarding.)*
  - CTA: **Continue**
  - *(Post-onboarding: their first real prayer mark triggers the sprout animation + a one-time toast — "Your first prayer. Your first sprout." — so this cohort still gets the moment, just in the garden where it belongs.)*
- **Data:** Optionally one real prayer record. Self-report honesty is not policed — it's their garden.

---

### S15 — The offer (single paywall)

- **Purpose:** The ask — after live times, a planted niyyah, and (for most) a marked prayer and a sprout. If cut: no business.
- **Copy, top to bottom:**
  - Hero: **the user's own tile** in its current state (sprouted sapling or planted soil) on a small glass shelf — their garden, not stock art. (Fallback: `OB_PAYWALL` art if state capture is awkward.)
  - **Free-forever strip (before any premium content, small gold label):**
    - **YOURS FREE, ALWAYS** — Full Qur'an · Nawawi's 40 Hadith · Prayer times · Duas & tasbih · Your garden
  - Headline: **Help it flourish.**
  - Subtitle: **Premium removes the ceilings — and keeps Grow Pray ad-free, built by one Muslim developer.**
  - Benefit rows (conveniences and the personal layer only — icon + title + sub):
    - **Unlimited garden** — free gardens grow to 7×7
    - **2× coins and XP** — progress twice as fast
    - **Golden Tree & Ancient Cedar** — two trees only premium gardens grow
    - **3 streak freezes, monthly** — for the weeks life wins
    - **Advanced insights** — your patterns across weeks and months
    - **Margin notes** — highlight, annotate and save any verse *(the Qur'an is free to read for everyone; premium adds your personal layer on top)*
  - Plans: **Yearly — BEST VALUE · $3.75/mo · $44.99 billed yearly** (pre-selected) / **Monthly — $6.99/mo**
  - CTA: **Start 14 days free**
  - Under-CTA: **14 days free · then $44.99/year · Cancel anytime in two taps**
  - Trust row: **No ads, ever · Private by design**
  - Decline: **Continue with the free garden** — a full-width *ghost button* (hairline border, 60% text opacity), not the current 28%-opacity naked link.
- **What is deliberately absent:** any mention of the pledge/niyyah; any religious content framed as a gain you must buy; "PREMIUM ONLY" badge language over religious art.
- **Interaction:** Plan select, purchase via RevenueCat, decline → S16.

---

### S16 — The honest second look (decline screen)

- **Purpose:** The retained second ask — persuasive, not aggressive. Pillars proves the category tolerates far harsher; we take the headroom as trust, not pressure. If cut: measurable Day-0 revenue loss for zero trust gain — the brief is right to keep it.
- **Copy:**
  - Headline: **The free garden is complete.**
  - Body: **Every prayer, every surah, every dua — free, always. Premium only removes the ceilings:**
  - List (neutral glass rows, gold icons — **not red**, no crossed-out icons):
    - Garden capped at 7×7
    - Coins & XP at standard pace
    - No streak freezes when life gets hard
    - Golden Tree & Ancient Cedar stay in the shop window
    - Insights stay basic
  - Support line: **Premium is also what keeps Grow Pray ad-free — one developer, no investors, no data sold.**
  - Primary CTA: **Try 14 days free**
  - Secondary (equal width, ghost): **Keep the free garden**
  - *(No religious content anywhere on this screen — constraint 0 honored. The current "Qur'an & Hadith library stays locked" line is deleted.)*
- **Visual:** `FreePremiumTransform` animation (barren→flourishing loop) as the hero — kept, it's the best asset on the current version of this screen. Night palette. Explicitly **not** the category's red danger screen: the visual argument is aspiration (what it becomes), not fear (what you lose).
- **Exit:** "Keep the free garden" → PreparingScreen → the garden loads **with their planted tile present** → existing 6-step tutorial runs.

---

## 3. The six decisions

**1. Paywall placement — end of first session, after lived value.** Sequence into the ask: real prayer times shown live (S11) → niyyah physically planted into their real garden (S13) → for most users, a real prayer marked and a real sprout (S14). I kept the paywall inside onboarding rather than deferring it days: 82–89% of trial starts happen Day 0, and a solo developer at launch cannot forfeit that window. The owner's proposed order (commitment → value → ask) is implemented exactly.

**2. The pledge survives as "Plant your niyyah" — and commerce may never touch it.** Signature pad, contract framing, and Bukhari 7405 all go (all three are Just Pray's). The commitment becomes: intention chosen in the quiz → written on a seed → planted by hand into the real garden, anchored to "Actions are but by intentions" (Nawawi #1, Bukhari 1 & Muslim 1907 — already in the app's own data with the same citation). Hard rule: **paywall may reference the garden, never the niyyah.** "You've made your pledge. Give it the best chance to flourish" is deleted; "Help it flourish" refers to the tile on screen, a game object.

**3. Two-step ask stays; the second step argues by aspiration.** S16 leads with what free includes (confidence, not desperation), lists only convenience ceilings in neutral styling, adds the solo-dev/ad-free support framing (Pillars' mission-framing, scaled honestly), and offers an equal-weight exit. More persuasive than the current version because it's more specific; less aggressive because nothing is red and nothing sacred is on the table.

**4. Guilt questions: reframed, not cut.** The confession question ("How do you feel when you miss a prayer?" / "Numb, I've normalised it") becomes support-design ("When you do miss one — what would actually help?"). Same segmentation, opposite power dynamic: the user configures the app, instead of disclosing failure to it. The "fresh start" hadith moves into the insight card that answers them.

**5. "The Qur'an is free" becomes a headline asset, three times.** (a) Pinned gold row on the plan summary; (b) the **YOURS FREE, ALWAYS** strip rendered *above* the premium list on the paywall itself — the inversion of Deen Buddy; (c) the decline screen opens with "every surah… free, always." The three stale copy strings selling Qur'an/Hadith as premium (lines ~1317, ~1406, ~1667) are all replaced by this spec: benefit rows now say **Margin notes** with an explicit "free to read for everyone" clause, and the loss-list line is deleted outright.

**6. Trial: 14 days.** Research favors 17–32 (45.7% vs 26.8% trial-to-paid), the category leader validates 14, and 7 days cannot contain the thing being sold — a streak worth protecting (14 days = two Jumu'ahs and the 7-day milestone with room to spare). I stop at 14 rather than 21+ because pre-launch, a solo developer needs revenue signal within the launch feedback window; test 21 later from a position of data.

---

## 4. What I removed, and why

| Removed | Why | What's lost |
|---|---|---|
| **premiumIntro screen** | Redundant pre-pitch; exists back-to-back with the paywall and currently shows the *same image* (missing-asset bug). Its personalized goal-line moves into the paywall subtitle territory implicitly. | A second priming exposure before pricing. Mitigated by a stronger single paywall. Kills the `OB_PREMIUM = OB_PAYWALL` bug by deletion. |
| **Signature pad + contract pledge** | Near-identical to Just Pray (same hadith source, same pad, same hold). Highest-friction gesture in the flow, 15 screens deep, pre-value. | A proven commitment device, traded for an unproven but ownable one. The single biggest creative bet in this spec. |
| **Standalone privacy pillar** | Preachy as a screen; vital as a whisper. Moved to the name input (trust line) and paywall (trust row) — the two moments privacy anxiety actually fires. | Emphasis for privacy-first users. Partially restored by placement at higher-anxiety moments. |
| **growthPillar screen** | S1 shows the same animation; S13–14 replace the *description* of growth with actual growth. | Nothing meaningful. |
| **Standalone reframe card** | Its content (consistency hadith + fresh-start framing) is the natural *answer* to the reframed S6 question — it belongs in insight card B, where it lands as a response instead of a lecture. | The before/after notification mockup. Genuinely nice; if mourned, it fits inside S12's priming as a small visual. |
| **"How do you feel when you miss a prayer?"** | Confession framing; monetization-adjacent guilt harvesting. Replaced by S6. | Direct emotional-state data. The replacement captures equivalent segments. |
| **Welcome phone mockup** | It existed to prove the app is real. A live planted tile proves it better. | A literal product screenshot. The App Store listing carries those. |

---

## 5. Honest tradeoffs

**Where I traded conversion for trust:**
- Branch B users ("Not yet" at S14) reach the paywall without the sprout moment — a softer ask for maybe a third of users. The alternative (faking the sprout, or guilting them about the unprayed prayer) is worse than the cost.
- The decline path is upgraded from a 28%-opacity link to a visible ghost button, twice. That will cost some trial starts. In this category, a findable exit *is* the brand.
- No red screen, no loss-aversion styling on S16, despite direct evidence (Pillars) that the category tolerates it. I'm betting Grow Pray's positioning — the calm, honest one — compounds better than a few points of Day-0 conversion. This is a bet, not a fact.

**Where I traded trust for conversion:**
- The paywall still lives in the first session, before a single full day of use. Purist sequencing (offer after 3 days of real use) might feel even cleaner — but Day-0 economics are brutal and real. I chose the owner's revenue over the purist's arc, and placed the lived-value beats as close to the ask as physics allows.
- The "supporting one Muslim developer" line leverages sympathy. I kept it factual (it *is* one developer, it *is* ad-free) and out of the pledge's blast radius. Watch it in reviews; cut it if it reads as begging.

**What I'm least confident about, in order:**
1. **The niyyah-planting itself.** Does rendering an intention as a seed read as beautiful, or as trivializing an act of worship? The copy is careful (the seed *carries* the intention; it never *is* the intention — note "May Allah let it grow," not "your niyyah grew"), but this needs testing with actual Muslim users across devoutness levels, especially older/conservative testers. This is the spec's biggest bet and its biggest risk.
2. **"Have you prayed X today?"** — could read as surveillance to a sensitive user, though it's framed as an offer, not an audit. Watch first-session drop at S14.
3. **Fajr-window edge cases** in the adaptive logic (onboarding at 2am). Handled in logic notes, but the copy for "most recent window" needs care.
4. **Collapsing privacy to two whispers** — if App Store reviews mention data fears, restore a dedicated beat.

**What I'd A/B test, in priority order:**
1. S13 planting vs. current signature pledge (activation + D7 retention, not just completion)
2. Trial length 14 vs. 21
3. S16 aspiration-framing vs. a Pillars-style harder loss list (measure trial starts *and* refund/review sentiment)
4. Ghost-button decline vs. current low-opacity link
5. Paywall hero: live tile state vs. static art

**What a Muslim user might dislike, stated plainly:** that any commitment mechanic exists inside an app that sells something, however carefully separated; that a hadith appears two screens before a price; that guilt-adjacent segmentation exists at all, however softly reframed. The design reduces each of these to its minimum honest form, but none of them reaches zero while the business model exists. The mitigation is the same everywhere: the Qur'an is free, the exit is visible, and the oath is never spent.

---

## 6. Implementation notes (for whoever builds this)

- **Reuse:** `GardenGrowthPreview` (S1) · permission cards + copy (S11 state 1, S12) · insight-card system (S3/S6 — re-key variants) · summary builder (S9 — edit closing line, add free-forever row) · `FreePremiumTransform` (S16) · `HoldToConfirmButton` fill logic → radial ring around the S13 tile (`react-native-svg` circle, `strokeDashoffset`) · existing haptics patterns throughout.
- **Delete:** `SignaturePad` usage (component can stay for the onboarding-pledge legacy flag or future features) · premiumIntro step + `OB_PREMIUM` alias · legacy `REDESIGN_*` fallback branches, orphaned `support`/`transition` kinds, stale step-count comment — clear the dead code *before* building on this spec.
- **New, small:** `PlantingTile` (S13: tile + tag + radial hold + seed-drop particles) · sprout beat (S14A: sapling spring-in — assets exist) · countdown chip (S14B) · live-times panel (S11 state 2 — data already computed by `usePrayerTimes`).
- **State writes:** S13 → intention `{goalId, text, name, plantedAt}` + a real garden-tile record at sapling-0 stage; S14A → one prayer record via the same path the prayer bar uses (do **not** fork a parallel write); S14B → flag `firstSproutPending` consumed by the garden on first real prayer mark.
- **Config:** trial 7→14 days in RevenueCat + App Store Connect intro offer (both monthly & yearly).
- **Copy fixes that ship regardless of the redesign:** the three Qur'an-as-premium strings (paywall pill ~1317, freeWarning loss item ~1406, premiumIntro row ~1667) and the paywall's pledge-referencing subtitle.
