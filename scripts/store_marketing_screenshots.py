"""Build captioned App Store screenshots around REAL app screenshots.

Usage:
    python scripts/store_marketing_screenshots.py <folder with 01..08 screenshots> <out folder>

Each image is a big two-line headline above the actual screenshot in a phone
frame, rendered natively at every slot size.

Why this shape: build 23 was rejected because the old images were redrawn
mockups with no real app screens (2.3.3) and used the word "free" (2.3.7).
Captions are fine; what Apple wants is the real UI as the main element. So the
phone takes up most of every image, the screenshot inside it is untouched, and
the copy avoids "free", "trial", "discount" and any price.

The first three are what App Store search shows, side by side at thumbnail
size, so the headline is large, short and bold with one highlighted word, and
nothing else competes with it (no eyebrow or subtitle). The phone runs off the
bottom edge so the screen can be as big as possible under the headline. Every
slide shares one night sky so the set reads as a series.
"""
import os
import random
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERIF = os.path.join(ROOT, 'node_modules/@expo-google-fonts/fraunces/800ExtraBold/Fraunces_800ExtraBold.ttf')
SANS_B = 'C:/Windows/Fonts/segoeuib.ttf'

SIZES = {
    '6.9in': (1320, 2868),
    '6.5in': (1284, 2778),
    '6.3in': (1206, 2622),
    '6.1in': (1170, 2532),
}

ORANGE, PERI, GOLD, SAGE, GREEN = '#e8a87c', '#a5b4fc', '#fbbf24', '#8fbf9f', '#4ade80'

# (headline, accent) in screenshot order 01..08. *Word* is drawn in the accent.
# Every line must stay accurate to the shipping app, and never mention price.
SLIDES = [
    ('Watch your\nprayers *grow*', ORANGE),
    ('A living sky,\n*Fajr* to Isha', PERI),
    ('Small goals,\n*every* day', GOLD),
    ('Stay consistent,\nget *rewarded*', GOLD),
    ("The full *Qur'an*,\nArabic & English", ORANGE),
    ('*40 Hadith*,\ngraded & cited', SAGE),
    ('Find the *Qibla*\nwherever you are', GREEN),
    ('*Dhikr* after\nevery salah', ORANGE),
]
NIGHT_TOP, NIGHT_BOTTOM = (10, 15, 30), (24, 34, 70)


def hex_rgb(h, a=255):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def luminance(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def median_colour(img, box):
    px = list(img.crop(box).getdata())
    return tuple(sorted(ch)[len(ch) // 2] for ch in zip(*px))




def background(W, H, seed, top=(11, 17, 32), bottom=(21, 30, 58)):
    bg = Image.new('RGB', (W, H))
    px = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / (H - 1)
        px.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    bg = bg.convert('RGBA')
    # Stars belong on a night sky only.
    if max(luminance(top), luminance(bottom)) > 75:
        return bg
    stars = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(stars)
    rnd = random.Random(seed)
    for _ in range(int(W * H / 26000)):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        r = rnd.choice([1.2, 1.6, 2.2, 3])
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rnd.randint(40, 170)))
    return Image.alpha_composite(bg, stars)


def full_battery(shot):
    """Replace a low-battery icon in the status bar with a full one.

    The icon is found rather than assumed: it is the cluster of pixels that
    stand out from the status-bar background to the right of the wifi glyph.
    It is covered with that background and redrawn as iOS draws a full
    battery with percentage shown: white body, dark '100', faint nub."""
    w, h = shot.size
    x0, x1, y0, y1 = int(w * 0.835), int(w * 0.95), int(h * 0.018), int(h * 0.05)
    region = shot.crop((x0, y0, x1, y1))
    bg = median_colour(shot, (x0, y0, x1, y0 + 3))
    xs, ys = [], []
    for y in range(region.height):
        for x in range(region.width):
            c = region.getpixel((x, y))
            if max(abs(c[i] - bg[i]) for i in range(3)) > 45:
                xs.append(x)
                ys.append(y)
    if len(xs) < 40:
        return shot  # nothing recognisable; leave the screenshot untouched
    bx0, bx1, by0, by1 = x0 + min(xs), x0 + max(xs), y0 + min(ys), y0 + max(ys)
    shot = shot.copy()
    d = ImageDraw.Draw(shot)
    pad = max(2, (by1 - by0) // 6)
    # Fill row by row from the pixels just left of the icon, so a sky that
    # shades from top to bottom carries straight through instead of showing a
    # flat box.
    sx = max(0, bx0 - pad - 3)
    for yy in range(by0 - pad, by1 + pad + 1):
        d.line([(bx0 - pad, yy), (bx1 + pad, yy)], fill=shot.getpixel((sx, yy)))
    bh = by1 - by0
    nub_w = max(2, round(bh * 0.12))
    body = [bx0, by0, bx1 - nub_w - max(1, round(bh * 0.06)), by1]
    r = round(bh * 0.3)
    d.rounded_rectangle(body, r, fill=(255, 255, 255))
    nub_h = round(bh * 0.36)
    cy = (by0 + by1) / 2
    d.rounded_rectangle([bx1 - nub_w, cy - nub_h / 2, bx1, cy + nub_h / 2], nub_w // 2,
                        fill=(255, 255, 255, 110))
    f = ImageFont.truetype(SANS_B, round(bh * 0.74))
    tw = f.getlength('100')
    tx = (body[0] + body[2]) / 2 - tw / 2
    ty = cy - f.getbbox('100')[3] / 2 - f.getbbox('100')[1] / 2
    d.text((tx, ty), '100', font=f, fill=(20, 20, 24))
    return shot






def segments(line):
    """Split 'a *b* c' into [('a ', False), ('b', True), (' c', False)]."""
    parts = line.split('*')
    return [(p, i % 2 == 1) for i, p in enumerate(parts) if p]


def line_widths(headline, font):
    return [sum(font.getlength(t) for t, _ in segments(l)) for l in headline.split('\n')]


def headline_size(W):
    """One size for the whole set: the largest at which every headline fits.
    Per-slide sizing made the longer headlines visibly smaller than the rest."""
    size = round(W * 0.118)
    while size > 40:
        f = ImageFont.truetype(SERIF, size)
        if all(max(line_widths(h, f)) <= W * 0.88 for h, _ in SLIDES):
            break
        size -= 2
    return size


def render(shot_path, slide, W, H, seed, size):
    headline, accent = slide
    shot = full_battery(Image.open(shot_path).convert('RGB'))
    img = background(W, H, seed, NIGHT_TOP, NIGHT_BOTTOM)
    d = ImageDraw.Draw(img)
    lines = [segments(l) for l in headline.split('\n')]

    # Headline: centred, one word in the accent colour.
    hf = ImageFont.truetype(SERIF, size)
    widths = line_widths(headline, hf)
    y = round(H * 0.06)
    for segs, lw in zip(lines, widths):
        x = (W - lw) / 2
        for t, hi in segs:
            d.text((x, y), t, font=hf, fill=hex_rgb(accent) if hi else (250, 245, 236, 255))
            x += hf.getlength(t)
        y += round(size * 1.12)

    # Phone: the real screenshot, wide, running off the bottom edge so the
    # screen is as large as possible. Only the bottom of the phone is cut.
    top = y + round(H * 0.035)
    phone_w = round(W * 0.86)
    phone_h = round(phone_w * shot.height / shot.width)
    bezel = round(phone_w * 0.022)
    left = (W - phone_w) // 2
    outer_r = round(phone_w * 0.13)

    # Soft accent glow and a drop shadow behind the phone.
    glow = Image.new('RGBA', (W, H))
    ImageDraw.Draw(glow).rounded_rectangle(
        [left - 30, top + 40, left + phone_w + 30, top + phone_h + 50], outer_r, fill=hex_rgb(accent, 55))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(W * 0.06)))
    shadow = Image.new('RGBA', (W, H))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [left, top + 24, left + phone_w, top + phone_h + 24], outer_r, fill=(0, 0, 0, 170))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(W * 0.025)))

    # Bezel, then the untouched screenshot inside it.
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([left, top, left + phone_w, top + phone_h], outer_r,
                        fill=(5, 7, 13, 255), outline=(255, 255, 255, 34), width=max(2, W // 500))
    sw, sh = phone_w - 2 * bezel, phone_h - 2 * bezel
    screen = shot.resize((sw, sh), Image.LANCZOS)
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], outer_r - bezel, fill=255)
    img.paste(screen, (left + bezel, top + bezel), mask)

    return img.convert('RGB')


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, out = sys.argv[1], sys.argv[2]
    shots = sorted(f for f in os.listdir(src) if f.lower().endswith(('.png', '.jpg', '.jpeg')))
    if len(shots) != len(SLIDES):
        sys.exit(f'Expected {len(SLIDES)} screenshots (01..{len(SLIDES):02d}), found {len(shots)}.')
    for name, (W, H) in SIZES.items():
        folder = os.path.join(out, f'Upload-{name}')
        os.makedirs(folder, exist_ok=True)
        size = headline_size(W)
        for i, (f, slide) in enumerate(zip(shots, SLIDES), 1):
            render(os.path.join(src, f), slide, W, H, seed=i, size=size).save(
                os.path.join(folder, f'{i:02d}.png'))
        print(f'{folder}  ({W}x{H}, {len(shots)} images)')


if __name__ == '__main__':
    main()
