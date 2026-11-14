"""Build the App Store product page header and search-results creative assets.

Usage:
    python scripts/store_header_banner.py <out folder>

Writes two dedicated assets (rather than one "universal" asset, which has to
serve a wide 21:9 and a squarer 3:2 crop at once and so suits neither):

    header-21x9.png   3840x1646  product page header
    search-3x2.png    3840x2560  search results

plus a *-safe-area.png check image for each, with Apple's art safe area
outlined. Upload only the two assets.

Apple doesn't publish the exact per-device crops, only that "critical
elements" belong inside the art safe area and atmospheric art can extend
across the canvas. So the title always sits inside the safe area, and each
garden is placed whole with nothing cut off at the canvas edge.

The gardens are not screenshots. They are assembled from the game's own tile
and tree sprites with the isometric maths in GardenScene.tsx and the per-type,
per-stage sizing in ShopModal.tsx's TREE_CATALOG, so they match the app.
"""
import os
import random
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'assets', 'Garden Assets')
SERIF = os.path.join(ROOT, 'node_modules/@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf')
SANS = 'C:/Windows/Fonts/segoeui.ttf'

TITLE = 'Grow Pray'
TAGLINE = 'Every prayer plants something.'

# ── Geometry, mirrored from components/GardenScene.tsx ─────────────────────────
TILE_W_U = 1456 * 0.08          # SCALED_WIDTH
TILE_H_U = 720 * 0.08           # SCALED_HEIGHT
STEP_X_U, STEP_Y_U = TILE_W_U / 2, TILE_H_U / 2
TREE_W, TREE_H, TREE_SQUASH = 848, 1264, 0.7
STAGES = ('sapling', 'growing', 'grown', 'flourishing')

# Per type: folder, file per stage, scale per stage, (dx, dy) per stage.
# Basic uses TREE_STAGES (0.10/0.12/0.14/0.16) * 0.9; the rest are the
# scaleOverrides / offsetX / offsetY in ShopModal's TREE_CATALOG.
TREES = {
    'Basic': ('Basic Trees', ('Sapling_converted', 'Growing_Tree_converted', 'Grown_Tree_converted', 'Flourishing_Tree_converted'),
              (0.090, 0.108, 0.126, 0.144), ((0, 0), (0, 0), (0, 0), (0, 0))),
    'Palm': ('Palm Trees', ('Palm_Sapling', 'Palm_Growing', 'Palm_Grown', 'Palm_Flourishing'),
             (0.100, 0.100, 0.117, 0.132), ((-2, -2), (9, -12), (17, -18), (19, -18))),
    'Oak': ('Oak Trees', ('Oak_Sapling', 'Oak_Growing', 'Oak_Grown', 'Oak_Flourishing'),
            (0.090, 0.108, 0.106, 0.137), ((-2, -2), (2, -2), (1, -18), (1, -18))),
    'Willow': ('Willow Trees', ('Willow_Sapling', 'Willow_Growing', 'Willow_Grown', 'Willow_Flourishing'),
               (0.090, 0.082, 0.085, 0.108), ((-2, -2), (0, -12), (5, -22), (5, -22))),
    'CherryBlossom': ('Cherry Blossom Trees', ('Cherry_Blossom_Sapling', 'Cherry_Blossom_Growing',
                      'Cherry_Blossom_Grown', 'Cherry_Blossom_Flourishing'),
                      (0.090, 0.108, 0.133, 0.154), ((-2, -2), (-1, -4), (0, -8), (0, -8))),
    'Maple': ('Maple Trees', ('Maple_Sapling', 'Maple_Growing', 'Maple_Grown', 'Maple_Flourishing'),
              (0.090, 0.113, 0.149, 0.153), ((-2, -2), (2, -8), (0, -2), (1, -12))),
    'Golden': ('Golden Trees', ('Golden_Tree_Sapling', 'Golden_Tree_Growing', 'Golden_Tree_Grown', 'Golden_Tree_Flourishing'),
               (0.090, 0.118, 0.142, 0.170), ((-2, -2), (0, -4), (1, -3), (2, -3))),
    'Cedar': ('Cedar Trees', ('Cedar_Sapling', 'Cedar_Growing', 'Cedar_Grown', 'Cedar_Flourished'),
              (0.090, 0.108, 0.126, 0.144), ((-2, -2), (2, -6), (2, -11), (2, -13))),
}

RENDER_K = 3.2   # pixels per app unit when drawing a garden; scaled down to fit after
_cache = {}


def sprite(kind, stage, k):
    key = (kind, stage, k)
    if key not in _cache:
        folder, files, scales, offsets = TREES[kind]
        i = STAGES.index(stage)
        img = Image.open(os.path.join(ART, 'Tree Types', folder, files[i] + '.png')).convert('RGBA')
        w = round(TREE_W * scales[i] * k)
        h = round(TREE_H * scales[i] * TREE_SQUASH * k)
        dx, dy = offsets[i]
        _cache[key] = (img.resize((w, h), Image.LANCZOS), dx * k, dy * k)
    return _cache[key]


TILE_FILES = {'dead': 'Dead_Tile', 'recovering': 'Recovering_Tile', 'recovered': 'Recovered_Tile'}
DEAD_TREE_W_U, DEAD_TREE_H_U = 720 * 0.08, 1472 * 0.08 * TREE_SQUASH   # SCALED_DEAD_TREE_*


def island(grid, spec):
    """One floating garden, cropped tight to its own pixels.

    spec(r, c) -> (tile_state, tree) where tree is None, 'dead', or
    (kind, stage). Every tile sprite is stretched to the same footprint, as
    the app does.
    """
    k = RENDER_K
    tile_w, tile_h = round(TILE_W_U * k), round(TILE_H_U * k)
    tiles = {state: Image.open(os.path.join(ART, 'Ground Tiles', f + '.png')).convert('RGBA')
             .resize((tile_w, tile_h), Image.LANCZOS) for state, f in TILE_FILES.items()}
    dead_tree = Image.open(os.path.join(ART, 'Tree Types', 'Basic Trees', 'Dead_Tree.png')).convert('RGBA')         .resize((round(DEAD_TREE_W_U * k), round(DEAD_TREE_H_U * k)), Image.LANCZOS)

    span_w = grid * TILE_W_U * k
    span_h = grid * TILE_H_U * k
    pad = round(TREE_H * 0.2 * TREE_SQUASH * k)      # headroom for trees above the top row
    layer = Image.new('RGBA', (round(span_w) + 4, round(span_h) + pad + 4))
    centre_off = (grid - 1) * STEP_X_U * k

    def tile_xy(r, c):
        return (c - r) * STEP_X_U * k + centre_off, pad + (c + r) * STEP_Y_U * k

    order = sorted(((r, c) for r in range(grid) for c in range(grid)), key=lambda rc: (rc[0] + rc[1], rc[1]))
    specs = {rc: spec(*rc) for rc in order}
    for r, c in order:
        x, y = tile_xy(r, c)
        layer.alpha_composite(tiles[specs[(r, c)][0]], (round(x), round(y)))
    for r, c in order:
        tree = specs[(r, c)][1]
        if tree is None:
            continue
        if tree == 'dead':
            img, dx, dy = dead_tree, 0, 0
        else:
            img, dx, dy = sprite(*tree, k)
        x, y = tile_xy(r, c)
        cx, cy = x + tile_w / 2, y + tile_h / 2
        layer.alpha_composite(img, (round(cx - img.width / 2 + dx), round(cy - img.height * 0.75 + dy)))
    return layer.crop(layer.getbbox())


def mixed(grid, stage_weights, fill, seed):
    """A fully recovered garden with trees of mixed stages."""
    rnd = random.Random(seed)
    stages, weights = zip(*stage_weights)
    plan = {}
    for r in range(grid):
        for c in range(grid):
            plan[(r, c)] = (rnd.choice(list(TREES)), rnd.choices(stages, weights)[0]) if rnd.random() < fill else None
    return island(grid, lambda r, c: ('recovered', plan[(r, c)]))


def timeline(grid, seed):
    """The same plot at three points in time, sharing tree positions and types,
    so each tree visibly grows from one garden to the next.

    Mirrors how a real garden starts in the app: dead ground with the odd dead
    tree, and a cross of five recovered tiles in the middle holding a sapling.
    """
    rnd = random.Random(seed)
    mid = grid // 2
    kinds = list(TREES)
    plan = {}
    for r in range(grid):
        for c in range(grid):
            plan[(r, c)] = {
                'kind': rnd.choice(kinds),
                'plant': rnd.random() < 0.72,
                'dead_tree': rnd.random() < 0.18,
                'd': abs(r - mid) + abs(c - mid),
            }
    plan[(mid, mid)].update(kind='Basic', plant=True)

    def start(r, c):
        t = plan[(r, c)]
        if t['d'] == 0:
            return 'recovered', ('Basic', 'sapling')
        if t['d'] == 1:
            return 'recovered', None
        return 'dead', 'dead' if t['dead_tree'] else None

    def growing(r, c):
        t = plan[(r, c)]
        d = t['d']
        if d <= 3:
            stage = 'grown' if d <= 1 else 'growing' if d == 2 else 'sapling'
            return 'recovered', (t['kind'], stage) if t['plant'] or d == 0 else None
        if d == 4:
            return 'recovering', None
        return 'dead', 'dead' if t['dead_tree'] else None

    def flourishing(r, c):
        t = plan[(r, c)]
        return 'recovered', (t['kind'], 'flourishing') if t['plant'] or t['d'] == 0 else None

    return island(grid, start), island(grid, growing), island(grid, flourishing)


def place(canvas, isle, box, glow=True):
    """Scale an island to fit inside box (x0, y0, x1, y1), bottom-centred."""
    x0, y0, x1, y1 = box
    s = min((x1 - x0) / isle.width, (y1 - y0) / isle.height)
    isle = isle.resize((round(isle.width * s), round(isle.height * s)), Image.LANCZOS)
    px = round((x0 + x1) / 2 - isle.width / 2)
    py = round(y1 - isle.height)
    if glow:
        halo = Image.new('RGBA', canvas.size, (74, 222, 128, 0))
        a = Image.new('L', canvas.size, 0)
        a.paste(isle.split()[3], (px, py))
        halo.putalpha(a.filter(ImageFilter.GaussianBlur(isle.width * 0.04)).point(lambda v: v * 0.35))
        canvas.alpha_composite(halo)
    canvas.alpha_composite(isle, (px, py))
    return (px, py, px + isle.width, py + isle.height)


def sky(W, H, seed):
    top, bottom = (9, 13, 28), (22, 32, 66)
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    img = img.convert('RGBA')
    rnd = random.Random(seed)
    stars = Image.new('RGBA', (W, H))
    sd = ImageDraw.Draw(stars)
    for _ in range(int(W * H / 30000)):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        r = rnd.choice([2, 2.5, 3, 4])
        sd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rnd.randint(50, 190)))
    return Image.alpha_composite(img, stars)


def flares(img, points, size):
    glow = Image.new('RGBA', img.size)
    gd = ImageDraw.Draw(glow)
    for x, y in points:
        gd.ellipse([x - size * 1.3, y - size * 1.3, x + size * 1.3, y + size * 1.3], fill=(255, 236, 200, 90))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size)))
    d = ImageDraw.Draw(img)
    w = size * 0.15
    for x, y in points:
        d.polygon([(x, y - size), (x + w, y), (x, y + size), (x - w, y)], fill=(255, 248, 230, 255))
        d.polygon([(x - size, y), (x, y + w), (x + size, y), (x, y - w)], fill=(255, 248, 230, 255))


def title_block(img, cx, top, title_px, tag_px):
    d = ImageDraw.Draw(img)
    tf, sf = ImageFont.truetype(SERIF, title_px), ImageFont.truetype(SANS, tag_px)
    d.text((cx - tf.getlength(TITLE) / 2, top), TITLE, font=tf, fill=(247, 241, 232, 255))
    ty = top + round(title_px * 1.22)
    d.text((cx - sf.getlength(TAGLINE) / 2, ty), TAGLINE, font=sf, fill=(205, 212, 228, 255))
    return ty + round(tag_px * 1.3)


# Stage mix for the search asset's single garden.
MATURE = (('grown', 2), ('flourishing', 8))


def arrow(img, x, y, size, colour=(230, 191, 129, 230)):
    """A small chevron pointing right, marking the direction of growth."""
    d = ImageDraw.Draw(img)
    w = max(6, size // 5)
    d.line([(x - size / 2, y - size), (x + size / 2, y), (x - size / 2, y + size)], fill=colour, width=w, joint='curve')


def paste_scaled(canvas, isle, scale, cx, bottom):
    """Paste an island at a given scale, bottom-centred on (cx, bottom)."""
    isle = isle.resize((round(isle.width * scale), round(isle.height * scale)), Image.LANCZOS)
    px, py = round(cx - isle.width / 2), round(bottom - isle.height)
    halo = Image.new('RGBA', canvas.size, (74, 222, 128, 0))
    a = Image.new('L', canvas.size, 0)
    a.paste(isle.split()[3], (px, py))
    halo.putalpha(a.filter(ImageFilter.GaussianBlur(isle.width * 0.04)).point(lambda v: v * 0.35))
    canvas.alpha_composite(halo)
    canvas.alpha_composite(isle, (px, py))
    return (px, py, px + isle.width, py + isle.height)


def header(out):
    W, H = 3840, 1646
    safe = (1097, 493, 1097 + 1646, 493 + 661)
    img = sky(W, H, seed=3)
    flares(img, [(330, 200), (3560, 230), (1900, 110), (1250, 330), (2650, 360)], 34)

    # One garden at three moments: starting out, growing, flourishing, read
    # left to right. All three share ONE scale, so the plot is visibly the
    # same size and only its state changes. Fitting each separately shrank the
    # flourishing one, whose tall trees made it the tallest.
    text_bottom = title_block(img, W / 2, safe[1] + 6, 170, 62)
    gardens = timeline(7, seed=31)
    width = 1300                                   # on-canvas width of every garden
    scale = width / max(g.width for g in gardens)

    # A gentle curve: the outer gardens rise beside the title, the middle one
    # sits under it. Uses the side sky instead of leaving it empty, and keeps
    # every garden whole inside the canvas.
    side_bottom = 1330
    mid_bottom = H - 45
    centres = (40 + width / 2, W / 2, W - 40 - width / 2)
    bottoms = (side_bottom, mid_bottom, side_bottom)
    placed = [paste_scaled(img, g, scale, cx, b) for g, cx, b in zip(gardens, centres, bottoms)]
    for left, right in zip(placed, placed[1:]):
        ax = (left[2] + right[0]) / 2
        ay = (left[1] + left[3] + right[1] + right[3]) / 4 + 40
        arrow(img, ax, ay, 46)
    assert placed[1][1] > text_bottom, 'middle garden runs into the tagline'
    return save(img, out, 'header-21x9', safe)


def search(out):
    W, H = 3840, 2560
    safe = (836, 765, 836 + 2168, 765 + 1030)
    img = sky(W, H, seed=5)
    flares(img, [(420, 320), (3420, 420), (300, 1500), (3560, 1800), (2900, 180)], 40)
    text_bottom = title_block(img, W / 2, safe[1] - 30, 250, 92)
    place(img, mixed(11, MATURE, 0.66, seed=11), (240, text_bottom + 30, W - 240, H - 60))
    return save(img, out, 'search-3x2', safe)


def save(img, out, name, safe):
    final = img.convert('RGB')   # Apple rejects alpha channels
    final.save(os.path.join(out, name + '.png'))
    check = final.copy()
    ImageDraw.Draw(check).rectangle(safe, outline=(255, 0, 255), width=8)
    check.resize((check.width // 3, check.height // 3), Image.LANCZOS).save(os.path.join(out, name + '-safe-area.png'))
    return final.size


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    print('header-21x9.png', header(out))
    print('search-3x2.png ', search(out))


if __name__ == '__main__':
    main()
