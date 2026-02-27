# Visual Overhaul Roadmap

> Transforming the garden from sprite-based tiles to a painterly, atmospheric world.
> Backup commit: `6656d8f` — revert with `git reset --hard 6656d8f`

---

## Assets Checklist

| Asset | File | Status |
|---|---|---|
| Dead Tile | `Ground Tiles/Ground_Dead_Tile.png` | ✅ Ready |
| Recovering Tile | `Ground Tiles/Ground_Recovering_Tile.png` | ✅ Ready |
| Recovered Tile | `Ground Tiles/Tile_Recovered.png` | ✅ Ready |
| Sapling | `Tree Types/Tree_Sapling.png` | ✅ Ready |
| Growing Tree | `Tree Types/Tree_Growing.png` | ✅ Ready |
| Grown Tree | `Tree Types/Tree_Grown.png` | ✅ Ready |
| Flourishing Tree | `Tree Types/Tree_Flourishing.png` | ✅ Ready |
| Dead Tree | `Tree Types/Tree_Dead.png` | ✅ Ready |
| Background Sky | `Icons/Background_Sky.png` | ✅ Ready |
| Ground decorations | Code-drawn (no asset) | ✅ N/A |

---

## Implementation Steps

### Step 1: Swap asset references & measure new dimensions
- [ ] Update `ASSETS` object in `GardenScene.tsx` to point to new tile and tree files
- [ ] Measure actual pixel dimensions of each new asset
- [ ] Update `TILE_WIDTH`, `TILE_HEIGHT`, `DISPLAY_SCALE` constants
- [ ] Update `TREE_WIDTH`, `TREE_HEIGHT`, per-stage scale factors
- [ ] Update dead tree dimension constants
- [ ] Verify no broken `require()` paths

**Impact:** Tiles and trees render with new art. May look misaligned until Step 2.

---

### Step 2: Tune tile and tree sizing
- [ ] Adjust display scales so tiles tessellate cleanly in the isometric diamond
- [ ] Ensure trees sit centered on their tiles with correct vertical offset
- [ ] Verify tap targets still align with visual tile positions
- [ ] Test at default zoom and at max zoom-in/zoom-out
- [ ] Check center tree placement and scale

**Impact:** Garden should look visually correct and proportional. Ready for screenshots.

---

### Step 3: Add background sky
- [ ] Render `Background_Sky.png` as a fixed full-screen `<Image>` behind the gesture layer
- [ ] Image stays static — no zoom/pan (only the garden moves in front)
- [ ] Replace flat navy `#0f1526` background with the sky image
- [ ] Ensure stars/clouds overlays still render correctly on top

**Impact:** Garden now floats in an atmospheric world instead of a void.

---

### Step 4: Tree ground shadows
- [ ] Add a semi-transparent dark ellipse at the base of every planted tree
- [ ] Add shadow for the center tree
- [ ] Shadow size scales with tree stage (bigger tree = bigger shadow)
- [ ] Shadows render below tree but above tile (correct z-order)
- [ ] Subtle — roughly 20-30% opacity black, slightly blurred

**Impact:** Instant depth. Trees feel grounded on the tiles.

---

### Step 5: Code-drawn ground decorations
- [ ] Scatter 2-4 tiny colored dots (2-3px) on each recovered tile
- [ ] Colors: soft yellow `#fde68a`, white `#f5f5f0`, pale pink `#f9a8d4`, pale blue `#93c5fd`
- [ ] Positions deterministic (seeded by row+col) — no shift between renders
- [ ] Static, no animation
- [ ] Only on recovered tiles, not recovering or dead

**Impact:** Subtle organic detail. Garden feels alive without performance cost.

---

### Step 6: Atmospheric edge vignette
- [ ] Dark radial gradient overlay centered on the garden
- [ ] Darkens outward — recovered tiles in the center are clear, dead tiles at edges are dimmed
- [ ] Renders inside the pan/zoom container (moves with the garden)
- [ ] Intensity tunable — start with ~40% black at the outermost edges
- [ ] Should not obscure the center of the garden at all

**Impact:** Dead tiles feel ominous. Creates depth and the "dead forest encroaching" atmosphere.

---

### Step 7: Time-of-day color tinting
- [ ] Full-screen semi-transparent color overlay
- [ ] Shifts based on current time vs. prayer windows:
  - Fajr: cool blue `rgba(100, 140, 200, 0.15)`
  - Dhuhr: warm bright `rgba(255, 220, 150, 0.08)`
  - Asr: golden afternoon `rgba(240, 180, 100, 0.12)`
  - Maghrib: orange sunset `rgba(200, 100, 50, 0.18)`
  - Isha: deep night `rgba(30, 20, 60, 0.25)`
- [ ] Smooth transitions between prayer periods (not instant snap)
- [ ] Updates in real-time (check every minute)
- [ ] Renders above garden but below UI elements

**Impact:** Emotional connection between prayer time and visual atmosphere.

---

### Step 8: Fireflies on dead tiles
- [ ] Small warm-colored glowing dots (`#fbbf24`, `#e8a87c`)
- [ ] Slow drift animation (8-12 second loops)
- [ ] Only in the dead tile zone (not on recovered tiles)
- [ ] Sparse — maybe 8-12 total, spread across the dead area
- [ ] Subtle opacity pulse (0.1 → 0.4 → 0.1)
- [ ] Render inside pan/zoom container (move with garden)

**Impact:** Life in the darkness. Atmospheric detail that adds wonder.

---

### Step 9: Prayer completion garden pulse
- [ ] When a prayer is marked complete, brief golden glow across all recovered tiles
- [ ] ~1 second duration, fades from 0.15 opacity to 0
- [ ] Warm gold color matching `THEME.accent`
- [ ] Layered on top of existing XP popup (both fire simultaneously)
- [ ] Single pulse, not repeating

**Impact:** Prayer completion feels meaningful at the garden level, not just the UI.

---

### Step 10: Re-tune existing particle effects
- [ ] Adjust pollen colors to match warmer palette (more gold, less grey)
- [ ] Adjust falling leaf colors to complement new tree art
- [ ] Tune grass wind shimmer for new recovered tile texture
- [ ] Verify star field still looks correct against background sky
- [ ] Verify cloud drift opacity works with the sky image
- [ ] Ensure all particles render at correct z-layer

**Impact:** Polish pass. Everything feels cohesive.

---

## Execution Notes

- Each step is self-contained — review after each before proceeding
- Steps 1-2 are foundational (must be done first and together)
- Steps 3-10 are independent and can be reordered based on preference
- All code changes are in `GardenScene.tsx` and `App.tsx`
- Core game logic (XP, prayers, expansion, challenges) is untouched throughout
