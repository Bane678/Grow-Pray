# Landing Page Versions

`index.html` is the **active** page (the one that gets deployed/previewed).
The three versions live as standalone files in the project root — each is fully
self-contained and can also be opened directly in a browser.

| Version | File | Design |
|---|---|---|
| **v1 — Original** | `index-v1-original.html` | The original night-garden page (as of commit `ff40c2a`): fixed starfield, feature rows, tree shelf. No pricing/FAQ/testimonials. |
| **v2 — Night Conversion** | `index-v2-night-conversion.html` | Same night-sky identity as v1, restructured as a conversion funnel: trust strip, testimonials, 3-step "how it works", prayer timeline, feature grid, pricing cards, FAQ, sticky mobile CTA. |
| **v3 — Day Journey** | `index-v3-day-journey.html` | Full redesign. The page travels through one prayer day: dawn (Fajr) hero at the top → midday features → golden-hour (Maghrib) pricing → starry night (Isha) FAQ and final CTA. Chapter medallions made from the prayer-scene art mark each stop. |

**Currently active: v3 — Day Journey**

## How to switch

Copy the version you want over `index.html`:

PowerShell:
```powershell
Copy-Item index-v1-original.html index.html -Force        # activate v1
Copy-Item index-v2-night-conversion.html index.html -Force # activate v2
Copy-Item index-v3-day-journey.html index.html -Force      # activate v3
```

Bash:
```bash
cp index-v1-original.html index.html   # activate v1
cp index-v2-night-conversion.html index.html   # activate v2
cp index-v3-day-journey.html index.html   # activate v3
```

## Rules to avoid confusion (for humans and AI)

1. **Never edit `index.html` directly.** Edit the version file
   (`index-v*.html`), then re-copy it over `index.html`. Otherwise the
   version file and the active page drift apart.
2. Keep `index-v1-original.html` byte-identical to the original — it is the
   pristine reference. If it's ever damaged, restore it with:
   `git show ff40c2a:index.html > index-v1-original.html`
3. When a version is edited, update the "Currently active" line above if it
   changes which version is live.

## Shared placeholders (v2 & v3) — replace before going live

- Trust-strip numbers ("4.9" rating, "120K+ prayers tracked") — invented for layout
- The three testimonial quotes and names
- Premium price ($2.99/month) — match the real App Store subscription
- App Store badge links are `href="#"` pending the real store URL
