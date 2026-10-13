"""Resize raw iPhone screenshots to the two App Store Connect slot sizes.

Usage:
    python scripts/store_screenshots.py <folder of raw screenshots>

Writes AppStore-6.5in/ (1284x2778) and AppStore-6.9in/ (1320x2868) next to the
input folder. Files are processed in name order, so name them 01.png, 02.png...

Deliberately does NOTHING else: no captions, no frames, no background. Build 23
was rejected under 2.3.3 because the screenshots were designed mockups rather
than the app in use, and under 2.3.7 for the word "free" in them. A raw
screenshot of a real screen cannot fail either rule, so this only resizes.

iPhone screenshots are all ~19.5:9, but the exact ratio differs by a fraction
of a percent between models, so each image is scaled to cover the target and
centre-cropped. The crop is a few pixels at most and nothing is stretched.
"""
import os
import sys
from PIL import Image

TARGETS = {
    'AppStore-6.5in': (1284, 2778),
    'AppStore-6.9in': (1320, 2868),
}
EXTS = ('.png', '.jpg', '.jpeg', '.heic')


def fit_cover(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    scale = max(tw / img.width, th / img.height)
    w, h = round(img.width * scale), round(img.height * scale)
    img = img.resize((w, h), Image.LANCZOS)
    left, top = (w - tw) // 2, (h - th) // 2
    return img.crop((left, top, left + tw, top + th))


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = os.path.abspath(sys.argv[1])
    files = sorted(f for f in os.listdir(src) if f.lower().endswith(EXTS))
    if not files:
        sys.exit(f'No screenshots found in {src}')
    if not 3 <= len(files) <= 10:
        print(f'WARNING: App Store Connect accepts 3-10 screenshots, you have {len(files)}.')

    parent = os.path.dirname(src)
    for name, size in TARGETS.items():
        os.makedirs(os.path.join(parent, name), exist_ok=True)

    for i, f in enumerate(files, 1):
        img = Image.open(os.path.join(src, f))
        ratio = img.width / img.height
        if not 0.44 <= ratio <= 0.48:
            print(f'SKIPPED {f}: {img.width}x{img.height} is not a full-screen iPhone '
                  f'portrait screenshot (cropped, landscape, or iPad?)')
            continue
        # App Store Connect rejects images with an alpha channel.
        img = img.convert('RGB')
        for name, size in TARGETS.items():
            out = os.path.join(parent, name, f'{i:02d}.png')
            fit_cover(img, size).save(out, 'PNG')
        print(f'{i:02d}  {f}  ({img.width}x{img.height})')

    print('\nDone. Upload these in App Store Connect:')
    for name, size in TARGETS.items():
        print(f'  {os.path.join(parent, name)}  ->  {size[0]}x{size[1]}')


if __name__ == '__main__':
    main()
