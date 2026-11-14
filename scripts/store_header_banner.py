"""Build the App Store "universal" creative asset (header + search results).

Usage:
    python scripts/store_header_banner.py <out folder>

Writes header-universal.png (5244x2950, Apple's universal 16:9 template) plus
preview crops showing how it lands in the 21:9 header and 3:2 search slots,
and a copy with the safe area outlined for checking.

The garden is not a screenshot. It is assembled from the game's own tile and
tree sprites using the same isometric maths as GardenScene.tsx, so it matches
the app exactly but is drawn at banner resolution instead of being upscaled.
"""
import os
import random
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'assets', 'Garden Assets')
SERIF = os.path.join(ROOT, 'node_modules/@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf')
SANS = 'C:/Windows/Fonts/segoeui.ttf'

# Apple's universal creative template.
W, H = 5244, 2950
SAFE = (1921, 660, 1921 + 1402, 660 + 962)   # x0, y0, x1, y1

# ── Geometry, mirrored from components/GardenScene.tsx ─────────────────────────
TILE_W_U = 1456 * 0.08          # SCALED_WIDTH
TILE_H_U = 720 * 0.08           # SCALED_HEIGHT
STEP_X_U, STEP_Y_U = TILE_W_U / 2, TILE_H_U / 2
TREE_W, TREE_H, TREE_SQUASH = 848, 1264, 0.7

# Flourishing-stage sprite, scale and offset per type, from TREE_CATALOG in
# components/ShopModal.tsx. Basic uses TREE_STAGES flourishing 0.16 * 0.9.
TREES = {
    'Basic':         ('Basic Trees/Flourishing_Tree_converted.png',          0.144, 0,  0),
    'Palm':          ('Palm Trees/Palm_Flourishing.png',                      0.132, 19, -18),
    'Oak':           ('Oak Trees/Oak_Flourishing.png',                        0.137, 1,  -18),
    'Willow':        ('Willow Trees/Willow_Flourishing.png',                  0.108, 5,  -22),
    'CherryBlossom': ('Cherry Blossom Trees/Cherry_Blossom_Flourishing.png',  0.154, 0,  -8),
    'Maple':         ('Maple Trees/Maple_Flourishing.png',                    0.153, 1,  -12),
    'Golden':        ('Golden Trees/Golden_Tree_Flourishing.png',             0.170, 2,  -3),
    'Cedar':         ('Cedar Trees/Cedar_Flourished.png',                     0.144, 2,  -13),
}

GRID = 9             # tiles per side; fewer, larger trees read better small
UNIT = 2.25          # banner pixels per app unit
GARDEN_TOP = 1420    # y of the diamond's top vertex; clears the tagline
FILL = 0.62          # share of tiles with a tree; denser reads as a wall


def load(path):
    return Image.open(os.path.join(ART, path)).convert('RGBA')


def sky():
    top, bottom = (9, 13, 28), (22, 32, 66)
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    img = img.convert('RGBA')

    rnd = random.Random(7)
    stars = Image.new('RGBA', (W, H))
    sd = ImageDraw.Draw(stars)
    for _ in range(520):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H * 0.8)
        r = rnd.choice([2, 2.5, 3, 4, 5])
        sd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rnd.randint(50, 190)))
    img = Image.alpha_composite(img, stars)

    # A few bright four-point stars, like the app's twinkling ones.
    glow = Image.new('RGBA', (W, H))
    gd = ImageDraw.Draw(glow)
    flares = [(980, 520), (4300, 760), (760, 1650), (4560, 1950), (3880, 330)]
    for x, y in flares:
        gd.ellipse([x - 60, y - 60, x + 60, y + 60], fill=(255, 236, 200, 90))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(40)))
    d = ImageDraw.Draw(img)
    for x, y in flares:
        L, w = 46, 7
        d.polygon([(x, y - L), (x + w, y), (x, y + L), (x - w, y)], fill=(255, 248, 230, 255))
        d.polygon([(x - L, y), (x, y + w), (x + L, y), (x, y - w)], fill=(255, 248, 230, 255))
    return img


def garden():
    """Render the garden on its own transparent layer."""
    k = UNIT
    tile_w, tile_h = round(TILE_W_U * k), round(TILE_H_U * k)
    # The sprite the app draws. Tile_Recovered.png carries ~8% transparent
    # padding per side, which left visible gaps between tiles.
    tile = load('Ground Tiles/Recovered_Tile.png').resize((tile_w, tile_h), Image.LANCZOS)

    sprites = {}
    for name, (path, scale, dx, dy) in TREES.items():
        w = round(TREE_W * scale * k)
        h = round(TREE_H * scale * TREE_SQUASH * k)
        sprites[name] = (load('Tree Types/' + path).resize((w, h), Image.LANCZOS), dx * k, dy * k)

    layer = Image.new('RGBA', (W, H))
    width = GRID * TILE_W_U * k
    left = (W - width) / 2
    centre_off = (GRID - 1) * STEP_X_U * k

    def tile_xy(r, c):
        x = left + (c - r) * STEP_X_U * k + centre_off
        y = GARDEN_TOP + (c + r) * STEP_Y_U * k
        return x, y

    order = sorted(((r, c) for r in range(GRID) for c in range(GRID)), key=lambda rc: (rc[0] + rc[1], rc[1]))
    for r, c in order:
        x, y = tile_xy(r, c)
        layer.alpha_composite(tile, (round(x), round(y)))

    rnd = random.Random(11)
    kinds = list(TREES)
    for r, c in order:
        if rnd.random() > FILL:
            continue
        sprite, dx, dy = sprites[rnd.choice(kinds)]
        x, y = tile_xy(r, c)
        cx, cy = x + tile_w / 2, y + tile_h / 2
        px = round(cx - sprite.width / 2 + dx)
        py = round(cy - sprite.height * 0.75 + dy)
        layer.alpha_composite(sprite, (px, py))
    return layer


def text(img):
    d = ImageDraw.Draw(img)
    cx = (SAFE[0] + SAFE[2]) / 2
    title = ImageFont.truetype(SERIF, 250)
    tag = ImageFont.truetype(SANS, 92)
    t, s = 'Grow Pray', 'Every prayer plants something.'
    tw = title.getlength(t)
    d.text((cx - tw / 2, SAFE[1] + 10), t, font=title, fill=(247, 241, 232, 255))
    sw = tag.getlength(s)
    d.text((cx - sw / 2, SAFE[1] + 330), s, font=tag, fill=(205, 212, 228, 255))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)

    img = sky()
    g = garden()
    # Shift the garden so ALL of it lands inside the 21:9 header crop (the
    # tighter of the two placements vertically) and below the tagline. Fails
    # loudly rather than shipping a garden with its top or bottom cut off.
    hh = round(W * 9 / 21)
    crop_top, crop_bottom = (H - hh) // 2, (H + hh) // 2
    x0, y0, x1, y1 = g.getbbox()
    shift = (crop_bottom - 40) - y1
    g = g.transform(g.size, Image.AFFINE, (1, 0, 0, 0, 1, -shift))
    y0, y1 = y0 + shift, y1 + shift
    text_bottom = SAFE[1] + 330 + 110
    assert y0 > text_bottom, f'garden top {y0} runs into the tagline (ends {text_bottom}); lower UNIT'
    search_w = round(H * 3 / 2)
    assert x0 >= (W - search_w) // 2 and x1 <= (W + search_w) // 2, 'garden wider than the 3:2 crop'
    # Soft green glow under the garden so it reads as lit, not pasted on.
    alpha = g.split()[3].filter(ImageFilter.GaussianBlur(120))
    glow = Image.new('RGBA', (W, H), (74, 222, 128, 0))
    glow.putalpha(alpha.point(lambda a: a * 0.35))
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, g)
    text(img)

    final = img.convert('RGB')   # Apple rejects alpha channels
    final.save(os.path.join(out, 'header-universal.png'))

    # Previews: centre crops for each placement, and the safe area outlined.
    hh = round(W * 9 / 21)
    final.crop((0, (H - hh) // 2, W, (H + hh) // 2)).resize((1920, round(1920 * 9 / 21))).save(
        os.path.join(out, 'preview-header-21x9.png'))
    sw = round(H * 3 / 2)
    final.crop(((W - sw) // 2, 0, (W + sw) // 2, H)).resize((1500, 1000)).save(
        os.path.join(out, 'preview-search-3x2.png'))
    check = final.copy()
    ImageDraw.Draw(check).rectangle(SAFE, outline=(255, 0, 255), width=8)
    check.resize((W // 4, H // 4)).save(os.path.join(out, 'preview-safe-area.png'))
    print('wrote', os.path.join(out, 'header-universal.png'), final.size)


if __name__ == '__main__':
    main()
