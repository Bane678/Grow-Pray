"""Build the App Store product page header (Apple's "universal" creative asset).

Usage:
    python scripts/store_header_banner.py <out folder>

Writes header-dusk.png (5244x2950, Apple's universal 16:9 template, RGB with
no alpha) plus preview crops showing how it lands in the 21:9 header and 3:2
search slots, and a copy with the safe area outlined for checking.

The design is deliberately simple and flat, drawn from scratch: a dusk sky
from navy to sunset, stars and a crescent moon, two soft hills, a small dark
sapling on the horizon, and the wordmark with its tagline. Earlier versions
used the isometric garden and then painted onboarding art; both read as busy
or AI-made next to other apps' headers, so they were dropped.

Rules the layout must keep (checked by assertions):
- the wordmark and tagline sit inside Apple's safe area;
- the whole sapling sits inside the 21:9 header crop, which is the tighter
  placement vertically.
"""
import math
import os
import random
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERIF = os.path.join(ROOT, 'node_modules/@expo-google-fonts/fraunces/800ExtraBold/Fraunces_800ExtraBold.ttf')
SANS = 'C:/Windows/Fonts/segoeui.ttf'

# Apple's universal creative template.
W, H = 5244, 2950
SAFE = (1921, 660, 1921 + 1402, 660 + 962)   # x0, y0, x1, y1
HEADER_CROP = ((H - round(W * 9 / 21)) // 2, (H + round(W * 9 / 21)) // 2)   # y range of the 21:9 crop

SKY = [(0, (16, 20, 50)), (0.45, (74, 62, 128)), (0.72, (226, 140, 120)), (1, (246, 186, 132))]
HILL_BACK, HILL_FRONT = (64, 56, 110), (30, 30, 66)
FRONT_BASE = H * 0.85          # high enough that the whole sapling is inside the 21:9 crop
BACK_BASE = FRONT_BASE - H * 0.10
SAPLING_H = 500
TITLE_Y = SAFE[1] - 40
TITLE, TAGLINE = 'Grow Pray', 'Every prayer plants something.'
# Sized so the title (the wider line) fits the 1402px-wide safe area with a
# small margin. The first drafts used 300/104 and overflowed it by ~230px.
TITLE_SIZE, TAGLINE_SIZE, TAGLINE_GAP = 248, 88, 308


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def sky():
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        for (t0, c0), (t1, c1) in zip(SKY, SKY[1:]):
            if t0 <= t <= t1:
                d.line([(0, y), (W, y)], fill=mix(c0, c1, (t - t0) / (t1 - t0)))
                break
    img = img.convert('RGBA')
    rnd = random.Random(4)
    d = ImageDraw.Draw(img)
    for _ in range(200):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H * 0.35)
        r = rnd.choice((3, 4, 5, 6))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rnd.randint(40, 150)))
    return img


def crescent(img, cx, cy, r, colour=(255, 236, 196)):
    glow = Image.new('RGBA', img.size)
    ImageDraw.Draw(glow).ellipse([cx - r * 2.4, cy - r * 2.4, cx + r * 2.4, cy + r * 2.4], fill=colour + (60,))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(r * 1.2)))
    mask = Image.new('L', img.size, 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    md.ellipse([cx - r * 0.45, cy - r * 1.1, cx + r * 1.45, cy + r * 0.8], fill=0)
    img.paste(Image.new('RGBA', img.size, colour + (255,)), (0, 0), mask)
    return img


def hill(img, base, amp, waves, colour, seed):
    """A soft rolling hill: a sum of a few slow sine waves. Returns its outline."""
    rnd = random.Random(seed)
    phases = [(rnd.uniform(0.6, 1.6), rnd.uniform(0, 6.28), rnd.uniform(0.4, 1)) for _ in range(waves)]
    pts = []
    for x in range(0, W + 41, 40):
        y = base - sum(amp * a * math.sin(x / W * math.pi * 2 * f + p) for f, p, a in phases) / waves
        pts.append((x, y))
    ImageDraw.Draw(img).polygon(pts + [(W, H), (0, H)], fill=colour)
    return pts


def ground_y(pts, x):
    return min(pts, key=lambda p: abs(p[0] - x))[1]


def sapling(img, x, gy, h, colour):
    """Two-leaf sapling silhouette in the hill's colour. Returns its bbox."""
    d = ImageDraw.Draw(img)
    d.line([(x, gy), (x, gy - h)], fill=colour, width=round(h * 0.08))
    for s in (-1, 1):
        cx, cy = x + s * h * 0.32, gy - h * 0.92
        d.ellipse([cx - h * 0.3, cy - h * 0.16, cx + h * 0.3, cy + h * 0.16], fill=colour)
    return (x - h * 0.62, gy - h * 1.08, x + h * 0.62, gy)


def wordmark(img):
    """Title and tagline, centred. Returns the bbox they cover."""
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(SERIF, TITLE_SIZE)
    s = ImageFont.truetype(SANS, TAGLINE_SIZE)
    d.text((W / 2 - f.getlength(TITLE) / 2, TITLE_Y), TITLE, font=f, fill=(255, 250, 240))
    d.text((W / 2 - s.getlength(TAGLINE) / 2, TITLE_Y + TAGLINE_GAP), TAGLINE, font=s, fill=(222, 228, 245))
    tb = d.textbbox((W / 2 - f.getlength(TITLE) / 2, TITLE_Y), TITLE, font=f)
    sb = d.textbbox((W / 2 - s.getlength(TAGLINE) / 2, TITLE_Y + TAGLINE_GAP), TAGLINE, font=s)
    return (min(tb[0], sb[0]), tb[1], max(tb[2], sb[2]), sb[3])


def build():
    img = crescent(sky(), W * 0.78, H * 0.18, 100)
    hill(img, BACK_BASE, 180, 2, HILL_BACK, 3)
    front = hill(img, FRONT_BASE, 110, 2, HILL_FRONT, 7)
    x = W / 2
    sb = sapling(img, x, ground_y(front, x) + 10, SAPLING_H, HILL_FRONT)
    wb = wordmark(img)

    assert SAFE[0] <= wb[0] and wb[2] <= SAFE[2] and SAFE[1] <= wb[1] and wb[3] <= SAFE[3], \
        f'wordmark {wb} leaves the safe area {SAFE}'
    assert HEADER_CROP[0] <= sb[1] and sb[3] <= HEADER_CROP[1], \
        f'sapling {sb} leaves the 21:9 header crop {HEADER_CROP}'
    return img.convert('RGB')   # Apple rejects alpha channels


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    final = build()
    final.save(os.path.join(out, 'header-dusk.png'))

    final.crop((0, HEADER_CROP[0], W, HEADER_CROP[1])).resize((1920, round(1920 * 9 / 21)), Image.LANCZOS).save(
        os.path.join(out, 'preview-header-21x9.png'))
    sw = round(H * 3 / 2)
    final.crop(((W - sw) // 2, 0, (W + sw) // 2, H)).resize((1500, 1000), Image.LANCZOS).save(
        os.path.join(out, 'preview-search-3x2.png'))
    check = final.copy()
    ImageDraw.Draw(check).rectangle(SAFE, outline=(255, 0, 255), width=8)
    check.resize((W // 4, H // 4), Image.LANCZOS).save(os.path.join(out, 'preview-safe-area.png'))
    print('wrote', os.path.join(out, 'header-dusk.png'), final.size)


if __name__ == '__main__':
    main()
