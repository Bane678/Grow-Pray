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


def island(grid, stage_weights, fill, seed):
    """One floating garden, cropped tight to its own pixels."""
    k = RENDER_K
    tile_w, tile_h = round(TILE_W_U * k), round(TILE_H_U * k)
    # The sprite the app draws. Tile_Recovered.png carries ~8% transparent
    # padding per side, which leaves visible gaps between tiles.
    tile = Image.open(os.path.join(ART, 'Ground Tiles', 'Recovered_Tile.png')).convert('RGBA')
    tile = tile.resize((tile_w, tile_h), Image.LANCZOS)

    span_w = grid * TILE_W_U * k
    span_h = grid * TILE_H_U * k
    pad = round(TREE_H * 0.2 * TREE_SQUASH * k)      # headroom for trees above the top row
    layer = Image.new('RGBA', (round(span_w) + 4, round(span_h) + pad + 4))
    centre_off = (grid - 1) * STEP_X_U * k

    def tile_xy(r, c):
        return (c - r) * STEP_X_U * k + centre_off, pad + (c + r) * STEP_Y_U * k

    order = sorted(((r, c) for r in range(grid) for c in range(grid)), key=lambda rc: (rc[0] + rc[1], rc[1]))
    for r, c in order:
        x, y = tile_xy(r, c)
        layer.alpha_composite(tile, (round(x), round(y)))

    rnd = random.Random(seed)
    kinds = list(TREES)
    stages, weights = zip(*stage_weights)
    for r, c in order:
        if rnd.random() > fill:
            continue
        img, dx, dy = sprite(rnd.choice(kinds), rnd.choices(stages, weights)[0], k)
        x, y = tile_xy(r, c)
        cx, cy = x + tile_w / 2, y + tile_h / 2
        layer.alpha_composite(img, (round(cx - img.width / 2 + dx), round(cy - img.height * 0.75 + dy)))
    return layer.crop(layer.getbbox())


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


# Stage mixes: a young garden, a growing one, and a mature one.
YOUNG = (('sapling', 6), ('growing', 3), ('grown', 1))
MID = (('growing', 3), ('grown', 5), ('flourishing', 2))
MATURE = (('grown', 2), ('flourishing', 8))


def header(out):
    W, H = 3840, 1646
    safe = (1097, 493, 1097 + 1646, 493 + 661)
    img = sky(W, H, seed=3)
    flares(img, [(330, 230), (3560, 300), (1900, 120), (760, 1450), (3200, 1500)], 34)

    # Three gardens growing from left to right of centre: sprouting, growing,
    # and the full one under the title. Side gardens are atmosphere; the title
    # and the main garden's heart sit in the safe area.
    text_bottom = title_block(img, W / 2, safe[1] + 6, 170, 62)
    place(img, island(7, YOUNG, 0.55, seed=21), (90, 640, 1130, 1560))
    place(img, island(7, MID, 0.62, seed=22), (2710, 640, 3750, 1560))
    place(img, island(9, MATURE, 0.70, seed=23), (1130, text_bottom + 20, 2710, H - 40))
    return save(img, out, 'header-21x9', safe)


def search(out):
    W, H = 3840, 2560
    safe = (836, 765, 836 + 2168, 765 + 1030)
    img = sky(W, H, seed=5)
    flares(img, [(420, 320), (3420, 420), (300, 1500), (3560, 1800), (2900, 180)], 40)
    text_bottom = title_block(img, W / 2, safe[1] - 30, 250, 92)
    place(img, island(11, MATURE, 0.66, seed=11), (240, text_bottom + 30, W - 240, H - 60))
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
