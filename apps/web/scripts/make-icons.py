"""Generate the PWA icons: a simple house glyph on a deep green square.
Run: python3 scripts/make-icons.py (from apps/web)."""
from PIL import Image, ImageDraw

BG = (18, 84, 66)
FG = (244, 247, 240)
ACCENT = (232, 176, 72)

def draw_icon(size: int, maskable: bool) -> Image.Image:
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), BG + (255,))
    d = ImageDraw.Draw(img)
    # Maskable icons must keep the glyph inside the central 80% safe zone.
    inset = 0.22 if maskable else 0.16
    x0, x1 = s * inset, s * (1 - inset)
    y0, y1 = s * (inset + 0.02), s * (1 - inset - 0.02)
    w, h = x1 - x0, y1 - y0
    roof_h = h * 0.42
    # roof
    d.polygon([(x0 - w * 0.04, y0 + roof_h), (x0 + w / 2, y0), (x1 + w * 0.04, y0 + roof_h)], fill=FG)
    # body
    bx0, bx1 = x0 + w * 0.10, x1 - w * 0.10
    d.rectangle([bx0, y0 + roof_h - 1, bx1, y1], fill=FG)
    # door
    dw = (bx1 - bx0) * 0.26
    cx = (bx0 + bx1) / 2
    d.rectangle([cx - dw / 2, y0 + h * 0.64, cx + dw / 2, y1], fill=ACCENT)
    if not maskable:
        # round the corners of the plain icon
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=255)
        out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        img = out
    return img.resize((size, size), Image.LANCZOS)

for name, size, maskable in [
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("icon-maskable-512.png", 512, True),
    ("apple-touch-icon.png", 180, True),
]:
    draw_icon(size, maskable).save(f"public/{name}")
    print("wrote", name)
