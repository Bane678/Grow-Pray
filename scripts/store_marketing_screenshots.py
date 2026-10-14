"""Build captioned App Store screenshots around REAL app screenshots.

Usage:
    python scripts/store_marketing_screenshots.py <folder with 01..08 screenshots> <out folder>

Each image is a caption (eyebrow, serif headline, one-line subtitle) above the
actual screenshot in a phone frame, rendered natively at both slot sizes.

Why this shape: build 23 was rejected because the old images were redrawn
mockups with no real app screens (2.3.3) and used the word "free" (2.3.7).
Captions are fine; what Apple wants is the real UI as the main element. So the
phone takes up most of every image, the screenshot inside it is untouched, and
the copy avoids "free", "trial", "discount" and any price.
"""
import os
import random
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERIF = os.path.join(ROOT, 'node_modules/@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf')
SANS = 'C:/Windows/Fonts/segoeui.ttf'
SANS_SB = 'C:/Windows/Fonts/seguisb.ttf'
SANS_B = 'C:/Windows/Fonts/segoeuib.ttf'

SIZES = {
    '6.9in': (1320, 2868),
    '6.5in': (1284, 2778),
    '6.3in': (1206, 2622),
    '6.1in': (1170, 2532),
}

ORANGE, PERI, GOLD, SAGE, GREEN = '#e8a87c', '#a5b4fc', '#fbbf24', '#8fbf9f', '#4ade80'

# (eyebrow, headline, subtitle, accent) in screenshot order 01..08.
# Every line must stay accurate to the shipping app, and never mention price.
SLIDES = [
    ('PRAYER TRACKING', 'Your prayers,\ngrowing.', 'Log each salah and watch your garden flourish.', ORANGE),
    ('FAJR TO ISHA', 'A sky that\nmoves with you.', 'Your garden follows the real hours of your day.', PERI),
    ('DAILY CHALLENGES', 'Small goals,\nevery day.', 'Fajr, all five, on time. Each one earns coins.', GOLD),
    ('WEEKLY CHALLENGES', 'Consistency,\nrewarded.', 'Bigger goals that build across the week.', GOLD),
    ("QUR'AN", 'All 114 surahs,\nArabic & English.', 'Bookmark any ayah and pick up where you left off.', ORANGE),
    ('HADITH', "Nawawi's collection,\ngraded & cited.", 'Every hadith with its narrator and source.', SAGE),
    ('QIBLA', 'Face the Qibla,\nwherever you are.', 'A built-in compass that points to the Kaaba.', GREEN),
    ('DHIKR', 'Remembrance\nafter every salah.', 'A tasbih counter with duas and adhkar.', ORANGE),
]


def hex_rgb(h, a=255):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def luminance(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def median_colour(img, box):
    px = list(img.crop(box).getdata())
    return tuple(sorted(ch)[len(ch) // 2] for ch in zip(*px))


def screen_palette(shot):
    """Frame colours taken from the screenshot itself, so a daytime screen
    gets a daytime frame. Top comes from just under the status bar, bottom
    from the screen's left edge mid-height (the app background, not a card).
    The top is darkened if needed so the white headline stays readable."""
    w, h = shot.size
    top = median_colour(shot, (int(w * 0.05), int(h * 0.06), int(w * 0.95), int(h * 0.075)))
    bottom = median_colour(shot, (0, int(h * 0.40), max(2, int(w * 0.02)), int(h * 0.60)))
    while luminance(top) > 70:
        top = tuple(round(c * 0.9) for c in top)
    return top, bottom


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


def draw_spaced(d, xy, text, font, fill, spacing):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + spacing


def wrap(text, font, width):
    lines, cur = [], ''
    for w in text.split():
        trial = f'{cur} {w}'.strip()
        if font.getlength(trial) <= width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    return lines + [cur]


def render(shot_path, slide, W, H, seed):
    eyebrow, headline, subtitle, accent = slide
    shot = full_battery(Image.open(shot_path).convert('RGB'))
    img = background(W, H, seed, *screen_palette(shot))
    d = ImageDraw.Draw(img)
    pad = round(W * 0.075)
    text_w = W - 2 * pad

    # Eyebrow: a short rule then letter-spaced caps, as in the old set.
    y = round(H * 0.058)
    eb = ImageFont.truetype(SANS_SB, round(W * 0.024))
    rule = round(W * 0.05)
    mid = y + eb.size * 0.62
    d.line([(pad, mid), (pad + rule, mid)], fill=hex_rgb(accent), width=max(2, W // 600))
    draw_spaced(d, (pad + rule + W * 0.022, y), eyebrow, eb, hex_rgb(accent), eb.size * 0.2)
    y += round(eb.size * 2.0)

    # Headline: shrink until the widest line fits.
    size = round(W * 0.088)
    while True:
        hf = ImageFont.truetype(SERIF, size)
        if max(hf.getlength(l) for l in headline.split('\n')) <= text_w or size < 40:
            break
        size -= 2
    for line in headline.split('\n'):
        d.text((pad, y), line, font=hf, fill=(247, 241, 232, 255))
        y += round(size * 1.08)

    # Subtitle.
    y += round(H * 0.008)
    sf = ImageFont.truetype(SANS, round(W * 0.036))
    for line in wrap(subtitle, sf, text_w):
        d.text((pad, y), line, font=sf, fill=(205, 212, 228, 255))
        y += round(sf.size * 1.35)

    # Phone: the real screenshot, as large as the remaining space allows.
    top = y + round(H * 0.032)
    bottom = H - round(H * 0.035)
    phone_h = bottom - top
    phone_w = round(phone_h * shot.width / shot.height)
    if phone_w > W * 0.84:
        phone_w = round(W * 0.84)
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
        for i, (f, slide) in enumerate(zip(shots, SLIDES), 1):
            render(os.path.join(src, f), slide, W, H, seed=i).save(os.path.join(folder, f'{i:02d}.png'))
        print(f'{folder}  ({W}x{H}, {len(shots)} images)')


if __name__ == '__main__':
    main()
